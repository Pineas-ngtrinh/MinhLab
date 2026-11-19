# Đối chiếu yêu cầu, OOAD và runtime — 11/11/2026

## Phạm vi

Đối chiếu request đã duyệt với route/UI → use case/domain → repository/migration → integration. Mục tiêu là hoàn thành các luồng có thể triển khai mà không bịa dữ liệu xưởng, không gửi file ra ngoài, không gọi dịch vụ thật và không thay đổi chính sách thanh toán. Đã giữ nguyên các thay đổi sẵn có trong working tree, các GLB, camera spline và ranh giới tải 3D.

**Trạng thái chung: Cần xử lý tiếp.** Các luồng cốt lõi đã có runtime và có bằng chứng tích hợp cô lập; xưởng chưa nạp dữ liệu thật, AI/scanner/delivery chưa được cấu hình thật, và toàn bộ checklist trước production chưa được nghiệm thu.

Mức ưu tiên: **P1** là điều kiện trước vận hành xưởng/nhận tiền thật; **P2** là giới hạn còn lại không làm giả trạng thái đã chạy.

## Ma trận truy vết

| Luồng / yêu cầu | Khoảng trống đã xác nhận khi đối chiếu | Hiện thực và đường đi chính | Trạng thái / bằng chứng | Còn lại / mức |
| --- | --- | --- | --- | --- |
| Tài khoản, xác thực và phục hồi | Cần phân quyền theo vai trò hiện hành, ownership và quy trình reset/verify thay vì dựa vào role phía client. | `app/api/auth/*` → `src/server/auth.ts` → `src/services/auth/` → `src/repositories/auth/`; session tra role hiện tại trong DB. | Đã có; unit/integration và đăng nhập admin/customer trên DB cô lập. | Cấu hình email thật và kiểm tra giao nhận outbox trước phát hành. P1 |
| Catalogue, SKU và quản trị | Catalogue phải có nguồn DB, giá server-authoritative, quản trị có audit/duyệt và revision; sản phẩm mới không cần nhánh SKU trong code. | `/admin/san-pham` → `/api/admin/products` → `src/services/catalog/` → catalog repository; production BOM chọn UUID variant từ catalogue DB. | Đã có; tích hợp tạo/sửa/ẩn/duyệt, conflict, SKU và checkout snapshot. | Cần chủ xưởng xác nhận/nhập catalogue thực tế và thuộc tính liên quan tới sản xuất. P1 |
| Giỏ, checkout, VietQR và theo dõi | Không tin giá client, không tạo COD mới/payOS/webhook trái quyết định; xác nhận thanh toán thủ công; không lộ đơn khác chủ. | `src/context/CartContext.tsx` → `/api/orders`/payment routes → order service/domain/repository → VietQR snapshot + outbox; progress chỉ được trả sau owner/tracking authorization. | Đã có; checkout/payment concurrency, ownership, retry, manual verification và public progress được test. Browser thấy progress cho catalog/custom fixture. | Tài khoản nhận VietQR thật, email/Telegram thật và smoke quy trình đối soát chưa được xác minh. P1 |
| Nhận file riêng tư | Preview cũ không phải storage an toàn; cần giới hạn, hash, quyền sở hữu, scan/analysis và retention bền vững. | `/api/print-files` → `src/server/private-files.ts` → filesystem private root ngoài `public/`; `/api/print-files/[id]` kiểm quyền; `scripts/workers/private-files.cjs` scan rồi phân tích STL; OBJ/STEP chờ kỹ thuật. | Đã có code và integration test đọc/ghi/quota/owner/retention trên thư mục tạm. Không tải file người dùng thật. | `clamscan` không cài trong môi trường này; scanner test là fixture. Cần private root, antivirus, retention và backup thực trên host. P1 |
| Phiếu in, duyệt kỹ thuật và báo giá | Preview/ước tính tham khảo không thể thay báo giá ràng buộc; cần revision, file quyền hạn, assignment, quote có hạn/terms và acceptance một lần. | `/yeu-cau-in`/`/api/print-requests` → `services/print-requests` → repository; FILE_REVIEWER claim/assignment; quote khóa revision; `createAcceptedCustomOrder` dùng cùng transaction order/payment/outbox. | Đã có code; race assignment, thay revision, quote expiry/replay, whole-quantity acceptance và custom production test. Browser đã gửi 2 phiếu tư vấn chưa file trên DB cô lập; chúng ở `Cần bổ sung`, chưa có quote/order. | Chưa có quote hay khoản thanh toán thật; fulfillment/hủy/hoàn tiền đơn đã thu tiền vẫn cần policy. P1 |
| Dữ liệu sản xuất động | Metadata không được hard-code theo 6 SKU; BOM phải link variant → component revision và số lượng; order/job giữ snapshot; trường thiếu phải chờ. | `/admin/san-xuat` → `/api/workshop/production` → production service/domain/repository; migrations `009–015`; checkout/requirements pin published BOM. | Đã có code; test tạo SKU/BOM mới, immutable revisions, incomplete draft WAITING_DATA và đơn cũ giữ snapshot. Dữ liệu workbook 6 SKU/37 dòng không được tự import. | Chưa có mapping/attributes/BOM thực tế được xưởng xác nhận. P1 |
| Tồn, profile, machine và kỹ thuật | Không được suy tồn 0, capacity, thời gian hay evidence; mẻ phải tương thích profile/máy và lượng kiểm đủ. | `production_inventory`, `production_checks`, `manufacturing_revisions`; UI nhập kiểm kê và kỹ thuật xác nhận; `src/domain/production/planning.ts` kiểm hard constraints. | Đã có code; test tồn unknown, tồn xác nhận 0, vật tư/accessory thiếu, layout/qty, xung đột máy. | Phải nhập kiểm kê thật (kể cả 0), máy/trạng thái/profile/layout/thời gian; evidence hiện là mã xác nhận con người nhập, không phải telemetry hay file bằng chứng. P1 |
| Đề xuất, duyệt, shared batches và resource holds | Agent không tự duyệt; stale/retry không ghi dở; allocation phải gắn từng đơn; start thực tế khác approval; QC/hỏng/đóng gói mới giải phóng hold đúng scope. | `production_plans/jobs/supplies/holds`; `APPROVE`, `START`, `QC`, `PACK` qua service và transaction lock; `/admin/san-xuat`; owner-only progress projection. | Đã có code; test rollback, concurrent approval, stale plan, reprint deficit, shared hold, máy maintenance, packing gates và API/UI state. | Chưa có job/telemetry thật. Lịch chưa có due date được xác nhận sẽ hiện FIFO/`NO_DUE_DATE`; chưa triển khai tối ưu lịch toàn cục. P1 |
| AI agent là actor phần mềm | Không thể gọi planner cố định/mock là AI; cần adapter thật nhưng chỉ metadata/tool scope hẹp, không file/PII/SQL/approval/start. | `src/integrations/production/openai-agent.ts` → `src/server/production-agent.ts` → `agent.repository.ts`/production core; worker xử lý event/retry; agent chỉ `read_production_metadata` và `create_draft_production_plan`. | Adapter thật theo OpenAI Responses API đã viết; test synthetic kiểm schema, projection, cấm tool và retry dùng lại draft. UI đang hiển thị “Chờ cấu hình”. **Không gọi provider thật.** | Chưa chốt provider/model/API key và cờ bật/ủy quyền metadata; chưa thử latency/chi phí/rate-limit của provider. P1 |
| Màn hình, phân trang và responsive | Loading/error/empty, điều hướng theo role, list lớn và viewport hẹp phải còn thao tác được. | `/admin/san-xuat`, `/yeu-cau-in`, `/in-theo-file`, `/tai-khoan`, `/theo-doi-don`; DTO/pagination phía server; `OrderProductionProgress`. | Browser QA trên DB cô lập ở 375/768/1024/1440px cho production, request, preview, account và tracking: không có tràn ngang; browser console không có warning/error trong các trang đã kiểm. | Keyboard/screen reader, WebGL fallback trên thiết bị thật và toàn bộ empty/failure state chưa được nghiệm thu bằng QA đầy đủ. P2 |
| OOAD và schema | Sơ đồ bổ sung phải giữ actor/core boundary; không tuyên bố thiết kế là runtime hoặc ERD hiện hành. | Giữ các file draw.io đơn giản; cập nhật `TRACEABILITY.md` và phần trạng thái trong README/đặc tả để link code/migrations. | Workflow thiết kế phù hợp ở mức actor, human approval, start/QC/packing và shared hold. Không sửa diagram XML trong lượt này. | ERD/class/state tổng vẫn chưa phản ánh migrations `009–015`; cần cập nhật/kiểm tra traceability OOAD riêng. P2 |

## Kiểm tra đã chạy

- `npm run check` — đạt; TypeScript, ESLint và architecture guard, **227 file / 0 vi phạm**.
- `npm run test:unit` — đạt toàn bộ scripts trong unit suite, gồm production-domain planner/agent fixtures.
- `npm run test:production` — **79 đạt / 0 lỗi** trên DB disposable; có migration fresh/idempotency, upgrade từ `008`, RBAC, transaction, quote/file/production concurrency và retry. Báo cáo chi tiết: [test-results.json](../ooad/test-results.json).
- `npm run build` — đạt; Next.js 16.4.2 tạo 43 trang/API.
- Browser QA local `next start` cổng 3191 + PostgreSQL/file root cô lập — đăng nhập vai trò, sản xuất, gửi phiếu tư vấn không file, tài khoản/tiến độ và tracking; 4 viewport, không tràn ngang. Không dùng server 3000, không gọi email/Telegram/LLM thật.
- `clamscan` không có trong môi trường; antivirus thật chưa kiểm. Không chạy deployment, không chỉnh DB production hoặc gửi dữ liệu tới dịch vụ ngoài.

## Điều kiện còn thiếu trước production

1. Xưởng xác nhận map UUID variant/SKU, linh kiện/BOM/revision/yield, vật liệu, machine/profile/layout, tồn thực tế, timing và bằng chứng kỹ thuật. Không dùng workbook cũ để tự populate.
2. Chủ dự án chọn provider/model, cấp API key riêng trong môi trường và chốt quyền gửi đúng projection metadata; sau đó mới bật `MINHLAB_PRODUCTION_AGENT_ENABLED` và `MINHLAB_PRODUCTION_AGENT_METADATA_AUTHORIZED`.
3. Chọn private storage root và antivirus thật; cấu hình quota/retention/backup; thử phục hồi file và sự cố worker.
4. Kiểm nhận VietQR thật, email/Telegram thật và luồng vận hành payment review trong môi trường staging.
5. Hoàn thiện policy đơn đã thu tiền nhưng cần hủy/hoàn; hiện hệ thống chặn thao tác hạ cấp, không tự hoàn tiền.
6. Cập nhật full ERD/class/state và chạy lại checklist nghiệm thu toàn sản phẩm, accessibility, WebGL fallback, backup/restore, monitoring, rollback và staging smoke.

## Bàn giao

Mã tác vụ: MINHLAB-IMPLEMENTATION-20261111

Mục tiêu: Đối chiếu yêu cầu/OOAD với runtime, vá các thiếu hụt có thể triển khai an toàn và hoàn thành luồng end-to-end có thể kiểm chứng.

Tệp đã sửa: `database/migrations/009_manufacturing_workflow.sql`–`015_file_purge_marker.sql`; route/UI `app/admin/page.tsx`, `app/admin/san-xuat/page.tsx`, `app/yeu-cau-in/page.tsx`, `app/in-theo-file/page.tsx`, `app/tai-khoan/page.tsx`, `app/theo-doi-don/page.tsx`, `app/api/print-requests/`, `app/api/print-files/`, `app/api/workshop/production/`, `app/api/orders/`, `app/api/customer/orders/`; `src/components/admin/production/`, `src/components/print-requests/`, `src/components/print-request/`, `src/components/common/OrderProductionProgress.tsx`, `src/contracts/`, `src/domain/production/`, `src/domain/orders/`, `src/services/production/`, `src/services/print-requests/`, `src/services/orders/`, `src/repositories/production/`, `src/repositories/print-requests/`, `src/repositories/orders/`, `src/server/`, `src/integrations/production/`; workers/tests/config và docs nêu trong ma trận. Không sửa migrations `001–008` hoặc GLB/camera.

Tóm tắt triển khai: Runtime cho production metadata, plan approval, shared jobs/QC/packing, private file intake, formal quote/one-time acceptance, AI adapter có opt-in và UI đã được triển khai. AI thật, antivirus thật và dữ liệu xưởng thật chưa có.

Kiểm tra đã chạy và kết quả: Các lệnh/evidence nêu ở phần “Kiểm tra đã chạy”; không có deployment hoặc outbound delivery.

Ảnh hưởng kiến trúc: Thêm domain/service/repository/server/integration cho production và print-requests; PostgreSQL migrations `009–015`; không thêm dependency.

Ảnh hưởng OOAD: Giữ nguyên sơ đồ và actor boundary; traceability được cập nhật; ERD/class/state tổng còn chênh với schema mới.

Rủi ro đã biết: Provider, scanner, file root, dữ liệu/mapping xưởng, due date và evidence thật chưa được cấu hình; không đủ cơ sở kết luận website production-ready.

Vấn đề còn lại: Sáu điều kiện trước production ở trên và các giới hạn P1/P2 trong ma trận.

Trạng thái rà soát: Cần xử lý tiếp.
