# Liên kết Telegram từ tài khoản website — 18/11/2026

Mã tác vụ: TELEGRAM-SELF-LINK-027

Mục tiêu: nhân viên tự liên kết Telegram mà không tìm/gửi Telegram user ID cho admin.

Tệp đã sửa: route webhook, route `/api/auth/telegram-link`, page `/lien-ket-telegram`, component tài khoản/admin, contract/service/repository/composition Telegram-link; migration 027; runtime grants; webhook setup; test Telegram và preflight database.

Tóm tắt triển khai:

- Đăng nhập website → tạo đường dẫn → mở bot và Start → quay lại website xác nhận tên/ID Telegram. Chỉ liên kết danh tính, không cấp vai trò. Quyền đối soát tiếp tục kiểm tra ADMIN/STAFF hiện hành ở mỗi lần bấm.
- Random token 256 bit, chỉ lưu hash, 10 phút, một yêu cầu mỗi user; tạo mới/gỡ liên kết vô hiệu hóa yêu cầu cũ. Chỉ chấp nhận Start trong chat riêng từ đúng người gửi, sau xác thực webhook secret.
- Start chỉ ghi đề nghị, chưa sửa Telegram ID. Chủ tài khoản phải xác nhận trong phiên đăng nhập trên website để tránh liên kết nhầm khi đường dẫn bị chia sẻ.
- Khóa user trước khi ghi; unique index giữ một Telegram ID cho một website account. Audit và xóa challenge cùng transaction. Sửa liên kết thủ công từ admin cũng hủy challenge cũ.
- Website tự lấy username qua getMe; bot token không đưa ra browser. Webhook trả lời Start bằng sendMessage trong HTTP response, không tự gửi thông báo khi build/test.

Kiểm tra đã chạy và kết quả: `npm run check` đạt; `npm run test:auth` 43/43 đạt; `npm run test:telegram` đạt, một kiểm thử PostgreSQL tùy chọn bị bỏ qua khi chưa có DB fixture. Bộ test production được bổ sung trường hợp xác nhận từ website, hết hạn, dùng lại, trùng ID và khóa tài khoản; chưa chạy local vì chưa có PostgreSQL disposable được xác minh. Browser host báo unavailable, chưa nghiệm thu giao diện bằng trình duyệt.

Ảnh hưởng kiến trúc: module auth giữ use case/ports, SQL trong repository, composition phía server. Thêm bảng `telegram_link_requests` và grants riêng; không thêm dependency.

Ảnh hưởng OOAD: không chỉnh sơ đồ được bảo vệ; thay đổi hiện thực cần được đối chiếu khi chủ dự án yêu cầu cập nhật sơ đồ.

Rủi ro đã biết: webhook phải được đăng ký lại để nhận cả `message` và `callback_query`; không dùng local polling cùng bot trên VPS. Tên hiển thị Telegram không phải danh tính pháp lý. Chỉ xác nhận tên/ID của chính mình.

Vấn đề còn lại: chạy preflight PostgreSQL cô lập trên VPS; áp dụng migration 027, cấp runtime grants, đặt lại webhook, rồi nghiệm thu liên kết bằng hai tài khoản test và thu hồi vai trò. Không triển khai bằng cách giải nén đè bản đang chạy.

Trạng thái rà soát: Cần xử lý tiếp — preflight VPS và nghiệm thu bot/giao diện thật.

Nguồn giao thức: https://core.telegram.org/bots/features#deep-linking và https://core.telegram.org/bots/api#making-requests-when-getting-updates .
