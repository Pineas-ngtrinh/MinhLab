# Đồng bộ phân quyền và báo cáo MinhLab ngày 19/11/2026

Mã tác vụ: MINHLAB-ROLE-REPORT-20261119

Mục tiêu: bỏ vai trò Nhân viên đơn hàng, chuyển xử lý đơn/thanh toán về ADMIN; sửa lỗi form đăng ký và quyền quyết định kế hoạch; hoàn thiện báo cáo và sơ đồ theo mẫu hoàn chỉnh của người dùng, chữ lớn và đen trắng.

## Tệp và hành vi thay đổi

- `src/lib/auth-roles.ts`, các route `app/api/admin`, `app/api/workshop`, `app/api/print-requests` và service/ports/repository liên quan: bỏ STAFF, giữ năm vai trò. SQL đối soát website/Telegram và kiểm tra readiness chỉ nhận ADMIN.
- `src/repositories/auth/auth.repository.ts`: chỉ nhận mã vai trò trong allowlist hiện hành khi đọc tài khoản/phiên.
- `database/migrations/028_retire_order_staff.sql`: giữ phân công cũ để truy vết, bổ sung CUSTOMER cho người từng có STAFF, vô hiệu hóa STAFF; không tự cấp ADMIN, không xóa tài khoản/đơn.
- `src/components/admin` và `src/components/print-requests`: bỏ lựa chọn và thao tác STAFF, ADMIN phụ trách đơn, tiền, giao nhận và giữ tệp. WORKSHOP_OPERATOR/PRINT_OPERATOR/FILE_REVIEWER giữ phạm vi kỹ thuật riêng.
- `app/dang-ky/page.tsx`: đặt khóa gửi sau kiểm tra đầu vào để người dùng sửa lỗi rồi gửi lại được.
- `src/components/auth/EmailCodeVerification.tsx`: lỗi nhập mã/email bằng tiếng Việt; gửi lại mã không cần mã cũ; không dùng popup validation tiếng Anh.
- `ProductionPanels.tsx` và `ProductionManager.tsx`: PRINT_OPERATOR quyết định kế hoạch theo service nhưng không được sửa nháp. ADMIN không được bỏ qua blocker hoặc xác minh kỹ thuật.
- Cập nhật fixture tích hợp sang WORKSHOP_OPERATOR và dùng ADMIN cho bước đối soát/giao hàng. Thêm kiểm thử nâng cấp với STAFF cũ, reject request cấp STAFF, đọc lại quyền, form gửi lặp và sửa dữ liệu sau validation lỗi.
- `docs/ooad/dong-bo-website-2026-11-19/`: 105 trang native, 37 đặc tả và ma trận truy vết. Giữ file gốc. Các trang gợi ý cấu trúc AI vẫn là đề xuất.
- `docs/reports/2026-11-19/`: báo cáo ba chương, thành viên/điểm để trống; không sao chép nghiệp vụ nhân sự hoặc kết quả chấm của mẫu.

## Kiểm tra đã chạy

- `npm run check`: đạt; guard 300 tệp, 0 vi phạm.
- `npm run test:unit`: 269 trường hợp, 268 đạt, 0 lỗi, 1 bỏ qua. Kiểm thử form thực thi handler thật qua nhiều lần render với fetch/account fixture cục bộ; không gửi email thật.
- `npm run build`: đạt.
- `npm run test:production`: chưa đạt điều kiện chạy trên máy này. PostgreSQL riêng trong `/private/tmp` bị chặn shared memory; endpoint loopback bị EPERM. Không chạy thử trên DB hiện tại hoặc production.
- Preflight 030 trên PostgreSQL cô lập tại VPS do người dùng chạy: các bước trước `test-master-audit` đạt, sau đó lỗi `403 !== 200`. Nguyên nhân: ca kiểm tra thu hồi quyền đã hạ fixture ADMIN thành CUSTOMER nhưng không khôi phục. Đã thêm `finally` khôi phục fixture và kiểm tra phiên đọc lại ADMIN; không nới quyền API. Cần chạy lại preflight của bản đóng gói mới trước apply.
- XML draw.io: 105 trang, 0 lỗi; 498 cảnh báo là các đoạn/lifeline/separator có tọa độ tự do, không tự coi là lỗi quan hệ UML. Cần đọc log chi tiết, không tuyên bố UML đúng tuyệt đối từ parser.
- Kiểm tra browser cục bộ bị chặn giao thức file. Bước mở bản xem thử diagrams.net bị auto-review từ chối vì có thể gửi nội dung sơ đồ nội bộ ra ngoài. Không lách chặn; sử dụng ảnh render và kiểm tra cấu trúc cục bộ.

## Ảnh hưởng và triển khai

Ảnh hưởng kiến trúc: giữ domain/use case/repository/integration hiện hành, không thêm thư viện hoặc đổi luồng tiền. Phiên đọc lại quyền DB, Telegram kiểm lại ADMIN và liên kết cá nhân.

Ảnh hưởng OOAD: bỏ actor Nhân viên đơn hàng, đồng bộ mục tiêu và ràng buộc theo năm vai trò; sửa U16, U21, U25, U27 và quan hệ biến thể–dòng đơn. Không nhận chức năng AI tương lai là đã chạy.

Rủi ro đã biết: cần chạy kiểm thử PostgreSQL cô lập và áp dụng migration 028 cùng bản web mới. Tài khoản chỉ có STAFF trước đây trở về quyền khách hàng; ADMIN phải cấp vai trò phù hợp nếu cần. Không nâng tự động thành quản trị.

Vấn đề còn lại: chưa triển khai lên VPS; chưa smoke đủ các vai trò trên bản mới. Timer worker minhlab chưa xuất hiện trong output VPS đã nhận; cần cấu hình lịch và nghiệm thu riêng. Không tự gửi thông báo đang chờ trong tác vụ này.

Trạng thái rà soát: Cần xử lý tiếp phần nghiệm thu PostgreSQL/VPS; mã nguồn và tài liệu sẵn sàng để rà soát trong phạm vi bằng chứng nêu trên.
