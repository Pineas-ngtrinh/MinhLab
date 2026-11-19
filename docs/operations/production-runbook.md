# Vận hành và điều kiện phát hành

Ngày rà soát: 24/10/2026 (giữ lịch sử thay đổi từ 19/10). Tài liệu này phân biệt việc build được với việc đã triển khai an toàn trên Internet.

Cập nhật 27/10/2026: thanh toán dùng QR VietQR cá nhân và đối soát thủ công; Telegram worker gửi thông báo cửa hàng từ outbox. Xem [quy trình thanh toán](../design/payment-integration-plan.md). Không cấu hình cổng thanh toán hoặc webhook.

## 1. Những thay đổi đã áp dụng

- Nâng Next.js 14.2.35 → 16.4.2, React 18 → 19.3.1, R3F 9.8.2, Drei 10.7.9, wrapper postprocessing 3.2.0. Three.js vẫn 0.160.1; peer `postprocessing` khóa 6.36.6. Đã bỏ dependency Lenis không dùng.
- Next.js 16 dùng `proxy.ts`, tham số route/query bất đồng bộ và ESLint flat config. Giữ webpack để tương thích cấu hình WebGL hiện có.
- Một số effect đồng bộ browser/WebGL/API cần chạy sau mount để SSR không lệch hydration. Các ngoại lệ lint được ghi tại đúng dòng; rules of hooks/exhaustive dependencies vẫn bật. Các đối tượng scene Three.js được clone rồi thay đổi theo API R3F, không coi là React state bất biến.
- Phiên ngẫu nhiên 256 bit; chỉ lưu SHA-256 trong `auth_sessions`; đọc lại trạng thái tài khoản và vai trò mỗi yêu cầu. Không còn tin vai trò/ID trong cookie tự ký cũ.
- Mọi đăng ký công khai đều nhận CUSTOMER; xử lý xác minh và đặt lại mật khẩu bằng token một lần. Không còn tài khoản/API demo hoặc mật khẩu mặc định.
- Đơn chỉ gắn `customer_id` từ phiên đã xác thực. Email người nhận là snapshot, không quyết định chủ sở hữu. Guest dùng token bí mật riêng.
- Chặn gọi khai báo chuyển khoản bằng mã đơn đơn thuần; thanh toán VERIFIED không bị ghi đè. Khóa hàng khi đối soát; tiền đã thu không được hủy đơn mà thiếu quy trình hoàn tiền.
- Đơn COD lịch sử vẫn có bước giao vận và ghi nhận thu tiền khi nhân sự xác nhận hoàn tất. Checkout mới chỉ nhận QR VietQR.
- JSON đầu vào bị giới hạn theo byte thực đọc, có kiểm tra kiểu/độ dài/số lượng. Giá phía trình duyệt bị bỏ qua. Proxy kiểm tra Origin cho yêu cầu thay đổi dữ liệu.
- Outbox và nghiệp vụ được commit cùng transaction. Worker chỉ gửi sau commit, có retry, khóa SKIP LOCKED và idempotency key.
- Migration có checksum/advisory lock, bổ sung CHECK/index; không seed catalogue trong mỗi lần checkout.
- Giỏ hàng phân biệt từng màu, đọc lại dữ liệu lưu bằng catalogue tin cậy và không xóa giỏ cũ khi mua trực tiếp một món.

## Trạng thái local sau rà soát

Đã thiết lập `minhlab_app` cho `DATABASE_URL` và giữ `minhlab_dev` cho migration. Role app không phải superuser, không có DELETE trên orders hoặc UPDATE audit_logs. `.env.local` và bản sao credential được giữ riêng, quyền file 600. Cụm PostgreSQL local còn xác thực trust trên loopback; khi triển khai cần thay bằng cấu hình host production.

Preflight local ngày 27/10 còn các điều kiện: credential mail và Telegram, URL HTTPS, catalogue được duyệt/xuất bản. API demo và capture đã được gỡ ngày 29/10; xem `system-review-2026-10-29.md`. Website QA dùng DB riêng đã kiểm catalogue admin, giỏ/checkout, lịch sử/tra cứu khách và hàng đợi chế tác ở 375/768/1024/1440px. Không suy thành nghiệm thu mail/Telegram thật.

## 2. Cấu hình production cần hoàn tất

1. Tên miền HTTPS và `NEXT_PUBLIC_SITE_URL` đúng; reverse proxy đặt giới hạn body/timeouts và rate limit theo IP. Giới hạn theo email tại app không thay thế chống bot ở ingress.
2. PostgreSQL có backup/khôi phục được kiểm chứng; runtime role không phải superuser. Dùng credential/TLS được cấp bởi host. Tài khoản migration sở hữu schema tách khỏi runtime; đặt `MIGRATION_DATABASE_URL` khi chạy `db:migrate`.
3. `MINHLAB_ADMIN_*` thuộc chủ triển khai, không dùng tài khoản mặc định. Chính sách bootstrap không cập nhật mật khẩu tài khoản có sẵn; cân nhắc cấp quyền theo thủ tục quản trị riêng khi thay nhân sự.
4. Cấu hình Resend và Telegram bot/chat ID, xác minh địa chỉ/domain gửi, đưa bot vào nhóm nhận tin và chạy hai worker định kỳ bằng process manager/scheduler. `mail:deliver` và `telegram:deliver` gửi dữ liệu thật; kiểm tra hàng FAILED trước khi redrive.
5. Duyệt nội dung sản phẩm, quyền sử dụng mẫu và trạng thái catalogue. Database hiện giữ sản phẩm ở DRAFT/NEEDS_REVIEW; không tự phê duyệt để vượt kiểm tra. Ở local có thể thử checkout sản phẩm DRAFT; production chặn.
6. Kiểm tra trực quan 375/768/1024/1440 px, thao tác bàn phím, fallback WebGL, mail và Telegram thật. Lần rà soát này có bằng chứng HTTP/API/model, chưa có nghiệm thu trực quan đầy đủ vì công cụ trình duyệt đã bị chặn truy cập URL local.
7. Đối soát ngân hàng vẫn là thao tác người có quyền. Không có kết nối ngân hàng, callback thu tiền hay tự xác thực tính thật của ảnh chụp biên lai.

## 3. Triển khai

- Tạo backup trước migration. Chạy `DATABASE_URL=... MIGRATION_DATABASE_URL=... npm run db:migrate` trong môi trường riêng có quyền thích hợp. Không đưa URL chứa mật khẩu vào tài liệu công khai hoặc lịch sử terminal dùng chung.
- `npm ci`, kiểm tra type/lint/test, `npm run production:check`, `npm run build`, sau đó `npm start` dưới process manager.
- Đăng ký, gửi lại xác minh và đặt lại mật khẩu thử gửi email ngay sau khi commit; phản hồi có thể chờ tối đa 15 giây nếu Resend chậm. Chạy `npm run mail:deliver` và `npm run telegram:deliver` theo lịch của host để xử lý thư lỗi và thông báo đơn. Mỗi worker xử lý tối đa 20 mục/lần; email dùng idempotency key theo outbox ID và tối đa 5 lần thử. Telegram retry tối đa 5 lần theo backoff và có thể gửi trùng nếu tiến trình dừng sau khi Telegram nhận tin nhưng trước khi DB ghi SENT.
- Theo dõi `/api/health`: 200 khi DB truy cập được, 503 khi DB không sẵn sàng. Endpoint này không công bố tên user, mật khẩu hoặc nội dung bảng.
- Không dùng `db:start` của môi trường local để quản lý database production.

## 4. Khôi phục

Backup local trước rà soát: `.local/maintenance-2026-10-19/database-before.dump` (định dạng pg_dump custom). Khôi phục thử vào **database mới** bằng `pg_restore -d <database_moi> <backup.dump>`; đối chiếu dữ liệu trước khi đổi URL. Không restore đè database đang có giao dịch mới.

Snapshot source: `source-before.tar.gz`; diff trước sửa: `working-tree-before.patch`; node_modules/lockfile cũ cũng được giữ trong cùng thư mục. Chúng có thể chứa dữ liệu nội bộ, không commit hoặc công khai backup.

## 5. Giới hạn còn lại được đưa vào backlog OOAD

- Đã có quản trị catalogue và hàng đợi chế tác thủ công. Còn quản lý tồn/nguyên liệu, duyệt file/báo giá đầy đủ, production job/phân công, telemetry, giao vận có tracking, hoàn tiền và hóa đơn.
- `carts/cart_items` là thiết kế DB; giỏ thực tế hiện lưu ở trình duyệt. Đơn/giá trị tiền đã đặt được lưu PostgreSQL.
- Catalogue hiển thị và giá checkout cùng đọc PostgreSQL từ migration 005. Seed JSON chỉ khởi tạo/backfill có chủ đích; admin CRUD/cấp mã/duyệt đã có từ migration 006 (24/10). Production ẩn sản phẩm chưa xuất bản/duyệt.
- Checkout storefront đã có Idempotency-Key, khóa transaction và ràng buộc duy nhất từ migration 004 (21/10/2026). Client tích hợp khác phải gửi cùng header để được chống trùng.
- Danh sách quản trị đã phân trang/lọc phía server, mặc định 25 và tối đa 100 mục (21/10/2026). Lịch sử khách đã phân trang ownership và summary toàn bộ đơn từ 24/10.
- Liên kết ảnh thanh toán là tham chiếu Cloudinary, không phải bằng chứng đã quét virus hoặc đã kiểm chứng giao dịch. Không suy diễn hash URL thành hash nội dung file.
- Giá in theo STL đang dùng mô hình provisional; không dùng làm hóa đơn hoặc tự tạo đơn custom khi chưa có thông số/báo giá duyệt.
- Phí vận chuyển của bảng ước tính in theo file và giỏ hàng sẵn khác nhau theo bảng giá tương ứng; cần chính sách kinh doanh thống nhất trước khi nối hai luồng thành checkout chung.
- Hệ thống giới hạn đăng nhập theo email cần kết hợp giới hạn IP/chống bot, dọn token/session hết hạn và chính sách lưu giữ log tại triển khai thật.

## 6. Nguồn đối chiếu

- [Next.js support policy](https://nextjs.org/support-policy).
- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication).
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).
- Kết quả registry tại thời điểm rà soát: `docs/ooad/dependency-audit.json`. Đây là kết quả quét dependency, không phải chứng nhận an toàn cho mọi cấu hình triển khai.

## Cập nhật rà soát 21/10/2026

Xem [báo cáo code](../reviews/code-audit-2026-10-21.md). Các thao tác duyệt mesh/điều khiển máy chỉ sửa state cục bộ đã được bỏ khỏi UI hoạt động; hai trạm hiện thông báo đúng phạm vi chưa kết nối. Biên lai quản trị dùng liên kết đính kèm thực tế, không hiển thị số tài khoản hoặc mã giao dịch giả. Lỗi không dự kiến trả JSON HTTP 500, không công bố nội dung lỗi nội bộ. Bootstrap không tự nâng quyền danh tính có sẵn.

Preflight local vẫn thiếu mail credentials, URL HTTPS công khai và catalogue được duyệt/xuất bản. Build/test thành công không thay thế ba điều kiện vận hành này.

## Cập nhật 24/10/2026

- Áp dụng migrations 006–007 trước khi chạy bản mới. Runtime cần INSERT/UPDATE catalogue, DELETE chỉ bảng ảnh và USAGE hai sequence; các lệnh cấp quyền đã nằm trong migration cho role `minhlab_app` có sẵn và script tạo role cho cài mới. Không mở DELETE orders hoặc UPDATE audit_logs.
- Chỉ ADMIN vào `/admin/san-pham`; không dùng SQL đổi hàng loạt sản phẩm thành APPROVED. Form quản trị lưu nháp; duyệt riêng có ghi chú/audit; mọi sửa đổi yêu cầu duyệt lại. Ảnh dùng URL có sẵn, chưa có uploader.
- Tài khoản VietQR cũ trong marketing đã gỡ. Mặc định tắt; chủ triển khai xác nhận ngân hàng rồi cấu hình bốn trường tài khoản cùng cờ bật. Mỗi payment lưu destination snapshot; không tự backfill payment cũ bằng tài khoản chưa xác nhận. Thiếu cấu hình chặn toàn bộ checkout mới; COD chỉ còn cho đơn lịch sử.
- Backup trước nâng cấp: `.local/production-2026-10-24/database-before.dump`. Restore đã chạy vào DB tạm, hash sản phẩm/biến thể/ảnh/đơn/thanh toán khớp; DB thử đã xóa. Chưa thay thế diễn tập trên host production.
- CI/.nvmrc dùng Node 22; kiểm tra phiên bản patch và advisory trước phát hành.
- [Review và bằng chứng](../reviews/production-review-2026-10-24.md) ghi rõ các điều kiện còn thiếu và 3 cảnh báo dependency mức vừa trong công cụ CSS.
