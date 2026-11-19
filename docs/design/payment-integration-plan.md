# Thanh toán QR cá nhân và thông báo Telegram

Cập nhật: 27/10/2026. Quyết định hiện hành: khách chuyển khoản vào tài khoản BIDV cá nhân MinhLab đã cấu hình; nhân viên kiểm tra giao dịch và xác nhận thủ công trong trang quản trị. Không tích hợp cổng thanh toán, link thu tiền, webhook ngân hàng hoặc tự động xác nhận giao dịch.

## Luồng thanh toán

1. Server lấy thông tin người nhận từ cấu hình riêng phía server, tạo QR theo số tiền và mã đơn, đồng thời lưu snapshot tài khoản nhận vào khoản thanh toán. Việc đổi cấu hình sau đó không làm thay đổi QR của đơn cũ.
2. Khách quét QR cá nhân và chuyển đúng số tiền. Nội dung chuyển khoản chứa mã đơn để nhân viên tra cứu. Website chỉ hiển thị trạng thái lấy từ database; QR hoặc thao tác quay lại trang không chứng minh tiền đã về.
3. Nếu khách khai báo đã chuyển, hệ thống chỉ gắn trạng thái chờ kiểm tra. Nhân viên đối chiếu giao dịch thực tế trong ứng dụng ngân hàng, đúng người nhận, số tiền và mã đơn rồi mới xác nhận ở trang quản trị.
4. Trong một transaction, server khóa payment/order, kiểm tra số tiền, ghi audit/lịch sử, xác nhận đơn và thêm thông báo vào outbox. Email giao dịch cho khách và Telegram cho cửa hàng được gửi sau commit.
5. Checkout không nhận COD mới. Các đơn COD đã tồn tại vẫn giữ nguyên lịch sử và có thể được nhân viên hoàn tất theo luồng cũ.

## Telegram cho cửa hàng

Telegram chỉ nhận thông báo vận hành về đơn mới, khách khai báo chuyển khoản và nhân viên đã đối soát. Nội dung gồm mã đơn, số tiền, phương thức/trạng thái và hướng dẫn mở trang quản trị. Không gửi tên, email, số điện thoại, địa chỉ giao hàng, ảnh biên nhận hoặc số tài khoản khách.

Các thông báo được ghi vào `telegram_outbox` cùng transaction với thay đổi nghiệp vụ. `npm run telegram:deliver` claim theo lease, gửi qua [Telegram Bot API sendMessage](https://core.telegram.org/bots/api#sendmessage), rồi cập nhật trạng thái. Worker thử tối đa 5 lần với backoff; lỗi Telegram không rollback đơn hoặc thanh toán. Giao nhận qua mạng là at-least-once: nếu Telegram nhận tin nhưng worker dừng trước khi cập nhật DB, có thể có một tin trùng.

Cấu hình ở môi trường server: `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`. Tạo bot, đưa bot vào nhóm nhận thông báo, lấy chat ID rồi điền secret tại host; không commit token và không đặt tiền tố `NEXT_PUBLIC_`. Lập lịch chạy worker sau deploy. Nếu thiếu cấu hình, tin vẫn nằm trong outbox và `npm run production:check` sẽ báo chưa sẵn sàng.

## Kiểm soát và nghiệm thu

- API luôn tính lại giá từ catalogue/đơn đã duyệt; không tin số tiền trình duyệt gửi lên.
- Đơn VietQR không được xác nhận tự động dựa trên QR, nội dung khách khai báo, ảnh biên nhận hay Telegram.
- Khóa hàng và kiểm tra trạng thái ngăn xác nhận đồng thời hoặc xác nhận đơn đã hủy; khóa dedup ngăn thêm nhiều thông báo cho cùng một sự kiện.
- Test bằng fake Telegram API và database cô lập; không gửi tin thật trong CI. Kiểm tra order/payment/outbox rollback cùng nhau, retry, 429 và thông báo không chứa dữ liệu cá nhân.
- Production cần có HTTPS, email sender, Telegram bot/chat, migration 008, worker scheduler và catalogue được duyệt. Test giả không thay thế việc nhân viên xác nhận giao dịch thật.

## Những mục không còn trong phạm vi

Không dùng payOS, SePay hoặc cổng thanh toán nào; không tạo payment link, webhook, truy vấn trạng thái tự động hay tác vụ tự đối soát. Khi muốn thay đổi cách nhận tiền, cần cập nhật quyết định và kiểm thử riêng trước khi triển khai.
