# Sửa quyền PostgreSQL của preflight — 18/11/2026

Mã tác vụ: PREFLIGHT-GRANTS-029

Mục tiêu: sửa lỗi `permission denied for table telegram_link_requests` khi chạy check bản 028 trên database disposable.

Tệp đã sửa: `scripts/tests/test-production.cjs`; bổ sung báo cáo này vào script đóng gói. Không thay mã ứng dụng, schema hay chính sách quyền thực tế của bản 028.

Tóm tắt triển khai: fixture test:production tự cấp quyền theo danh sách cũ thiếu bảng migration 027, trong khi `scripts/lib/grant-runtime.cjs` dùng khi deploy đã có SELECT/INSERT/UPDATE/DELETE cho bảng này. Preflight nay gọi đúng helper đó; thêm assertion kiểm tra bốn quyền để lỗi cấp quyền xuất hiện ngay đầu test thay vì cuối luồng tự liên kết. Quyền cấm xóa đơn và sửa audit vẫn kiểm tra như trước.

Kiểm tra đã chạy và kết quả:

- Log người dùng cung cấp: bản 028 dừng ở test tự liên kết, chưa có TEST_OK nên không đủ điều kiện apply.
- `node --check scripts/tests/test-production.cjs`, `npm run check`, `git diff --check`: đạt.
- `npm run test:telegram`: 30 đạt, 0 thất bại, 1 test PostgreSQL bỏ qua vì chưa có fixture.
- Đối chiếu SHA-256 từng file trong manifest bản 028: trước khi thêm báo cáo/đóng gói, chỉ `scripts/tests/test-production.cjs` thay đổi. Không cần dựng lại cùng mã ứng dụng đã build đạt trong bản 028.
- Thử PostgreSQL disposable tại `/private/tmp` với shared_memory_type=mmap và dynamic_shared_memory_type=mmap; cả bước bootstrap initdb bị OS chặn shmget (Operation not permitted), nên chưa chạy được test:production local. Không dùng database thật để thay thế.

Ảnh hưởng kiến trúc: dùng chung chính sách runtime grants cho preflight và deployment, loại bỏ danh sách quyền bị lệch trong test harness.

Ảnh hưởng OOAD: Không áp dụng, không sửa sơ đồ.

Rủi ro đã biết: toàn bộ test:production cần chạy lại trên PostgreSQL cô lập của VPS để phát hiện các lỗi kế tiếp. Không đánh dấu đạt hoặc bỏ qua receipt kiểm thử.

Vấn đề còn lại: upload gói 029, chạy updater check; chỉ apply sau TEST_OK. Bản 029 vẫn gộp tự liên kết Telegram và preview nhiều STL/FDM của các bản trước.

Trạng thái rà soát: Cần xử lý tiếp — chờ preflight VPS.
