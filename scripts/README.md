# Công cụ dự án

Chạy từ root qua `npm run <lệnh>`; xem danh sách đầy đủ trong `package.json`. Tên lệnh npm giữ nguyên sau khi phân nhóm.

| Thư mục | Nội dung | Lệnh thường dùng |
| --- | --- | --- |
| `database/` | PostgreSQL local, migration, seed, role runtime | `db:start`, `db:status`, `db:stop`, `db:migrate`, `db:seed`, `db:runtime-role` |
| `checks/` | Guard kiến trúc và preflight production | `check:architecture`, `architecture:report`, `production:check` |
| `tests/` | Kiểm thử công cụ, scene và tích hợp PostgreSQL | `test:architecture`, `test:models`, `test:hardening`, `test:telegram`, `test:production`, `test:production-domain` |
| `workers/` | Gửi email/Telegram, chạy agent theo metadata và xử lý file riêng tư | `mail:deliver`, `telegram:deliver`, `production:agent`, `files:process`, `files:cleanup` |
| `quote/` | Benchmark STL, đồng bộ model và sinh fixture | `benchmark:stl` |
| `model-authoring/` | Dựng GLB và render CPU offline | Xem [hướng dẫn model](../docs/models/model-authoring.md) |
| `ooad/` | Xuất bộ sơ đồ editable | Xem [OOAD](../docs/ooad/README.md) |
| `lib/` | Adapter/helper cho các công cụ | Được import bởi script khác |

Worker gửi thông báo thật khi có cấu hình. `production:agent` chỉ gọi provider khi đủ cờ opt-in, model/key và quyền metadata; nếu thiếu, sự kiện giữ trạng thái chờ cấu hình. `files:process` cần private root và executable scanner đã cấu hình; `files:cleanup` mặc định chỉ xem trước, chỉ xóa tài sản customer hết hạn không còn tham chiếu khi truyền `-- --apply`. Test production tạo database cô lập. Các script quote đồng bộ artifact đã duyệt; quy trình training nằm ngoài công cụ vận hành website. Các script Python nhận tham số như trước; dùng `--help` khi công cụ hỗ trợ.

`npm run architecture:report` chỉ đọc mã nguồn và in báo cáo cấu trúc; không khởi động server hoặc kết nối DB. Thêm `-- --json` để xuất graph nội bộ; dùng `npm run --silent architecture:report -- --json` nếu cần stdout JSON thuần. Báo cáo dùng chung analyzer với guard; không thay thế test hành vi hoặc phân tích dead code.

`python3 scripts/ooad/build-design-pilot.py --output /đường/dẫn/mới.drawio` sinh bộ thiết kế tập trung theo [brief OOAD](../docs/ooad/DESIGN_BRIEF.md), kèm manifest. Công cụ từ chối ghi đè file có sẵn để bảo vệ chỉnh sửa bằng tay. Đầu ra là mô hình thiết kế logic, không phải ảnh chụp schema hiện hành.

`python3 scripts/ooad/build-actor-usecases.py --output /đường/dẫn/mới.drawio --combined-output /đường/dẫn/bản-ghép.drawio` sinh riêng 13 trang Use Case và tùy chọn bản ghép 22 trang. Cả hai đích phải chưa tồn tại; công cụ không ghi đè chỉnh sửa thủ công.
