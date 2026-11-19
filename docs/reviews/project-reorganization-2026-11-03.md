> Cập nhật sau lượt sắp xếp: ca checkout 0,5 VND đã đạt khi chạy lại trên code hiện tại. Xem [baseline](finalization-baseline-2026-11-03.md). Phần dưới giữ kết quả lịch sử của lần sắp xếp.

# Sắp xếp cấu trúc project — 03/11/2026

Mã tác vụ: STRUCTURE-2026-11-03

Mục tiêu: Phân nhóm thư mục để tìm, đọc và chỉnh sửa dễ hơn.

Tệp đã sửa: 46 tệp chuyển vị trí (xem các mục ngày 2026-11-03 trong `../cleanup-manifest.json`), các liên kết tham chiếu, `../../package.json`, `../../AGENTS.md`, `../../README.md`; thêm `../../PROJECT_STRUCTURE.md`, `../README.md`, `../../scripts/README.md`.

Tóm tắt triển khai:

- Script chia thành database, checks, tests, workers, quote, ooad; giữ lib và model-authoring.
- Tài liệu chia thành operations, planning, design, quote, reviews, research, hci, models. Giữ architecture, DECISIONS và PROGRESS tại docs root để làm điểm vào hiện hành. Hồ sơ OOAD và nguồn sơ đồ giữ vị trí.
- Cập nhật đường dẫn require, project root của script, lệnh npm và liên kết Markdown. Giữ tên lệnh npm hiện có.
- Thêm bản đồ tìm code theo chức năng và mục lục. Giữ cấu trúc phân tầng src hiện hành; test module vẫn cạnh module.
- Sửa 5 liên kết cũ bị hỏng: chuyển 2 liên kết lịch sử tới đích thực; bỏ 3 liên kết artifact AWS không có trong repository, giữ nguồn Mermaid.

Kiểm tra đã chạy và kết quả:

- `npm run check`: đạt, guard 186 file, 0 vi phạm.
- `npm run test:unit`: đạt toàn bộ các lệnh module.
- Cú pháp Python (AST), shell (`bash -n`), CommonJS (`node --check`): đạt.
- Rà liên kết Markdown local và relative require CommonJS: 0 đường dẫn thiếu.
- `git diff --check`: đạt.
- `npm run test:production`: lần trong sandbox bị EPERM kết nối local. Chạy lại ngoài sandbox: migration và nhiều luồng API đạt, suite dừng ở `scripts/lib/test-master-audit.cjs:13`: SKU giá 0,5 VND, quantity 2 trả HTTP 201 thay vì 400. Không sửa nghiệp vụ trong tác vụ sắp xếp này.
- Không chạy build/browser vì không đổi route, UI hoặc ranh giới server/client.

Ảnh hưởng kiến trúc: Không thay đổi luồng runtime hay schema; chỉ thay vị trí công cụ/tài liệu và các tham chiếu tương ứng.

Ảnh hưởng OOAD: Giữ nguồn sơ đồ và nội dung mô hình; công cụ xuất chuyển sang scripts/ooad.

Rủi ro đã biết: Lệnh gọi script trực tiếp bên ngoài repository phải đổi sang vị trí mới; các lệnh npm giữ nguyên. Tham chiếu archive trong manifest giữ đường dẫn lịch sử. Skill trong .agents có thể còn nhắc đường dẫn tài liệu cũ; tra docs/README.md hoặc manifest để tìm vị trí mới.

Vấn đề còn lại: Test tích hợp checkout nêu trên chưa đạt. Không xác nhận production readiness.

Trạng thái rà soát: Cần xử lý tiếp đối với lỗi tích hợp checkout; phần sắp xếp thư mục sẵn sàng rà soát.
