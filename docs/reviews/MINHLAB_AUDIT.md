# Kiểm toán MinhLab 3D — 03/11/2026

Đây là kết quả kiểm toán lịch sử tại 03/11, trước khi thêm migrations/runtime `009–015`. Trạng thái code và bằng chứng hiện hành nằm trong [ma trận 11/11/2026](implementation-verification-2026-11-11.md); không dùng các nhãn `NOT_IMPLEMENTED` dưới đây như trạng thái hiện tại.

Mã tác vụ: MINHLAB-MASTER-AUDIT-2026-11-03. Đã sửa ba lỗi P2 có tái hiện và kiểm thử hồi quy. Chưa có bằng chứng đủ để kết luận có lỗi runtime P0/P1 trong các luồng đã kiểm tra; điều này không xác nhận toàn bộ hệ thống hoặc hạ tầng production an toàn.

## Mốc và phạm vi

- Repository `/Users/nguyenphucphu/Downloads/minhlab-3d`, nhánh `codex/quote-analyzer`. Working tree đã có nhiều thay đổi. Mốc quy thuộc là `.local/master-audit-2026-11-03/baseline.json`, `git-status-before.txt`, `before/`; không dùng riêng HEAD để quy toàn bộ diff cho tác vụ.
- [Master prompt](../prompts/MINHLAB_MASTER_AUDIT.md) được lưu trước khi sửa. Chỉ dẫn bổ sung được ghi riêng ở cuối tệp.
- Node 22.16.0, npm 10.9.2, Next.js 16.4.2, React 19.3.1, TypeScript 5.9.3, PostgreSQL qua `pg` và SQL migrations. Không thêm dependency, schema, migration hay hạ tầng.
- Đọc AGENTS, project standards, README, scripts thực tế, migrations 001–008, code/tests và quyết định liên quan; dùng các skill UML/draw.io/PlantUML có sẵn.
- Không commit/push/deploy, không nối ngân hàng, không gửi tiền/thư thật, không sửa production hoặc dữ liệu thật. Integration dùng database local dùng một lần.

## Bốn lớp bằng chứng

| Lớp | Kết luận |
|---|---|
| REQUIREMENTS | Guest được mua sản phẩm; chủ đơn lấy từ session; giá server và tiền nguyên VND; VietQR đối soát thủ công. Nguồn: `AGENTS.md`, `docs/DECISIONS.md`, `docs/design/payment-integration-plan.md`. Thiết kế BOM/spec/slicer/người duyệt: `docs/design/production-batching-design.md:85`, `:132`, `:216`. |
| AS-IS | Checkout/token/RBAC/transaction/outbox có code và integration tests. Worker STL trích mesh, hook browser gọi computeQuote. Workshop cập nhật trạng thái đơn thủ công. Schema có tệp/báo giá, shipments, jobs, attempts và QC; có bảng không chứng minh có workflow đầy đủ. |
| TO-BE | Upload riêng tư, báo giá/chấp thuận đầy đủ, BOM revision, gom mẻ, JobAllocation đa đơn, reservations và AI planner là thiết kế. Tên vật lý/lifecycle cần DD-01/DD-02. |
| GAP | Chưa có atomic apply plan runtime để sửa stale/double apply hoặc chạy race tests cho planner. Chỉ củng cố thiết kế và acceptance cases. Mismatch UML/code không mặc định là lỗi code. |

## Sổ phát hiện ưu tiên

| ID / mức / phân loại | Quan sát, ảnh hưởng và kỳ vọng | Bằng chứng / symbol | Hành động, test, trạng thái / độ tin cậy |
|---|---|---|---|
| AUD-01 / P2 / CONFIRMED_BUG | No-op trả allowed trước RBAC. Operator retry trạng thái dành cho staff nhận thành công sai quyền, dù không đổi dữ liệu. Retry phải có thẩm quyền. | `src/domain/orders/order-policy.ts:29`, `evaluateOrderTransition`, nhánh sửa `:35`; adapter 403 ở `src/services/orders/order-workflows.service.ts:101`. | **FIXED** tại domain. Unit hồi quy thất bại trước sửa rồi đạt; hai PATCH operator CONFIRMED đồng thời đều 403, không thêm history. `src/domain/orders/test/order-policy.test.ts`; `scripts/lib/test-master-audit.cjs:46`. Retry hợp lệ vẫn idempotent. Cao. |
| AUD-02 / P2 / CONFIRMED_BUG | Đơn giá 0.5 × 2 lọt kiểm vì tổng nguyên, lưu snapshot trái quy tắc VND. Cần kiểm từng đơn giá server trước persist. | `src/services/orders/order-checkout.service.ts:59`, `createCheckout`; `src/domain/orders/checkout-pricing.ts:5`, `validUnitPrice`; numeric ở `database/migrations/001_init.sql:357`. | **FIXED**: safe integer, không âm, giới hạn numeric(12,2) theo VND nguyên. Regression trước sửa 201; sau sửa 400 và không tạo đơn. `scripts/lib/test-master-audit.cjs:5`; `src/lib/test/production-hardening.test.ts:54`. Cao. |
| AUD-03 / P2 / CONFIRMED_BUG | Proof khác query/cùng pathname dùng chung object_key; UPSERT sửa secure_url đã gắn đơn khác. | `src/services/orders/order-workflows.service.ts:12`, `paymentProof`; `src/repositories/orders/order-write.repository.ts:127`, `attachPaymentProof`. | **FIXED**: hash full canonical URL, bỏ fragment, namespace mới; conflict chỉ đọc reference, không UPDATE URL. Hai đơn khác query độc lập; khai báo đồng thời cùng URL tái dùng an toàn. Port/escape sai trả 400 tại `app/api/payments/declare/route.ts:19`. Cao. |
| AUD-04 / P1 / NOT_IMPLEMENTED | Planner, atomic snapshot validation, reservations và multi-order allocation chưa có runtime; chưa thể cam kết ngăn stale/double apply khi chạy thật. | `docs/design/production-batching-design.md:132`, `:216`, `:228`; `src/contracts/workshop.ts:1`; schema job `database/migrations/001_init.sql:420`. | **BACKLOG BL-01**. E09/E10/E11/E12, EL10/17 và PLAN-01–07 yêu cầu BEGIN, khóa, kiểm quyền/key, đọc lại nguồn trong transaction ngay trước ghi, replay/stale/rollback. Race runtime **NOT VERIFIED**. Cao đối với source đã rà. |
| AUD-05 / P2 / DOCUMENTATION_MISMATCH | Use Case bắt guest đăng nhập; tưởng tượng bank API; gán worker chạy inference; trạng thái/quan hệ sai; nhiều bản Elaboration cạnh tranh. | Bản gốc 29 trang UC00–08/EL02–19; đối chứng `src/services/orders/order-workflows.service.ts:31`, `:66`, `stl-quote.worker.ts:14`, `src/components/print-request/usePrintRequest.ts:179`, migrations 001–003. | **ĐÃ SỬA NGUỒN VÀ BẢN SAO**; giữ 29 page IDs. [Change log](../ooad/ELABORATION_CHANGELOG.md), [mapping](../ooad/exports/elaboration-page-map.json), [truy vết](../ooad/ELABORATION_TRACEABILITY.md). Visual QA chỉ có hiệu lực với trang/phiên bản được ghi, không tự xác nhận 142 trang. Cao. |
| AUD-06 / P2 / DOCUMENTATION_MISMATCH | COMMENT về status/quantity/QC không phải CHECK. QC hiện trỏ job, không FK tới attempt/allocation. Nhầm schema với mô hình mở rộng làm sai ràng buộc. | `database/migrations/001_init.sql:420`, `:436`, `:458`, `:753`, `:787`; CHECK commerce tại `database/migrations/003_production_invariants.sql`. | **ĐÃ SỬA EL12/TÀI LIỆU**; 25 quan hệ ERD khớp nguồn FK/nullability. CHECK cho workflow xưởng thuộc BL-12/DD-02. Không thêm constraint vào dữ liệu thật. Cao với migrations; production schema **NOT VERIFIED**. |

Ba bản vá giữ API shape và dependency. Khác biệt tương thích có chủ đích: no-op sai quyền trả 403; giá phần lẻ/URL proof sai trả 400. Reference cũ được giữ, không chuyển đổi dữ liệu. Hash URL chỉ định danh reference; không chứng minh nội dung đã quét, kho private hoặc tài nguyên remote bất biến.

## Coverage và giới hạn

| Khu vực | Quan sát trực tiếp / phân loại | Phần còn lại |
|---|---|---|
| Sản phẩm/biến thể/giỏ | CONFIRMED_CORRECT trong tests: giá DB, biến thể đúng sản phẩm/được bán, khôi phục giỏ theo định danh; quản trị có revision/audit. `order-checkout.service.ts:47`; `scripts/tests/test-production.cjs`. | Chưa benchmark danh mục lớn; không tự duyệt sản phẩm thật. |
| Guest/đơn/liên hệ | CONFIRMED_CORRECT: guest customer_id null; owner từ session hoặc token hash đúng hạn; email trùng không nhận quyền. `src/services/orders/order-workflows.service.ts:31`, `src/repositories/orders/order-read.repository.ts:166`, migration 002. | Capability token cần bảo vệ; retention DD-03. |
| Thanh toán/thông báo | CONFIRMED_CORRECT: declare giữ PENDING; STAFF/ADMIN kiểm ngân hàng ngoài website. Verify khóa order/payment, kiểm tiền/trạng thái, ghi audit/outbox cùng transaction (`src/services/orders/order-workflows.service.ts:43`, `:66`). Verify đồng thời chỉ một tác động; outbox lỗi rollback/retry đạt. | Không có bank API tự đối soát. Gửi provider thật và availability **NOT VERIFIED**. |
| Auth/RBAC/IDOR | Tests xác nhận session opaque, role đọc DB, khóa/xóa user làm mất quyền; public register CUSTOMER; bootstrap không nâng tài khoản sẵn có; reset thu hồi phiên; cross-owner bị chặn. `src/services/auth/test/auth.test.ts`, integration. | Không phải penetration test đầy đủ; rate limiting theo nguồn cần DD-04. |
| Input/SQL/XSS/CSRF | Stream body 64 KiB ở `src/lib/request-validation.ts:17`; origin ở `proxy.ts:6`; SQL liên quan dùng tham số; proof URL allowlist, nhánh đã xem không fetch nội dung server. | Headers/TLS/proxy qua deployment và mọi bề mặt XSS **NOT VERIFIED**. Không in secret; không coi build xanh là secret scan hay chứng minh không có lỗ hổng. |
| STL/giá | Chọn .stl, limit 100 MiB ở `src/components/print-request/usePrintRequest.ts:112`, `:128`; parser nội dung `src/lib/quote/stl/analyze.ts:336`; worker trả MeshFeatures `src/workers/stl-quote.worker.ts:14`; browser computeQuote tại `src/components/print-request/usePrintRequest.ts:179`. | File ở thiết bị. Upload private, lưu trữ/quét và official quote đầu-cuối NOT_IMPLEMENTED. Limit client không thay server policy tương lai. |
| DB/concurrency | Đọc migrations/FK/nullability/unique/CHECK/index/transaction; integration xác nhận checksum, least privilege, checkout replay/conflict/rollback và snapshot. | Direct SQL vẫn lưu phần lẻ VND; Payment type có REFUNDED khác CHECK verification; BL-10/11/12. Không chứng minh production schema đồng bộ. |
| Sản xuất | Có schema printers/jobs/attempts/QC, runtime theo đơn. Job thuộc một order_item; mô hình JobAllocation nhiều đơn/BOM/spec/QC riêng là thiết kế. | Không suy composition PrintJob từ FK. Slicer/máy/vật tư/slot/FDM/resin/E-G-A cần engine và dữ liệu thật được kiểm; chưa có race tests planner. |
| Kiến trúc | Guard: 186 files, 0 violations; giữ domain/ports/repository/composition, không thêm abstractions/dependency cho ba bản vá. | Tài liệu lịch sử giữ như bằng chứng thời điểm, không là source of truth hiện hành. |
| Hiệu năng/vận hành | Có mesh worker, runbook; `test:models` đạt 109 checks. | Benchmark tải/heap/query production mới, restore/scheduler/alert/chi phí cloud/advisory dependency mới **NOT VERIFIED**; BL-05–08. Không có tuyên bố phần trăm tối ưu. |
| Ridge | `src/lib/quote/config/model_v3_metadata.json:5` nhãn slicer; `:11` grouped OOF development, chưa final STL độc lập hoặc in thực nghiệm. P90 tương đối gram ≈0.2731, thời gian ≈0.7419 (`:13`). 108 fixture parity Python trong `test:quote` đạt. | Parity kiểm inference, không chứng minh tổng quát hóa hoặc không leakage toàn dataset. Chưa train lại/raw-data audit. Khoảng giá là advisory spread, không CI đã hiệu chỉnh hoặc giá chính thức. |

## Kiểm thử

| Lệnh thực tế | Kết quả cuối | Diễn giải |
|---|---|---|
| `npm run check` | exit 0 | TypeScript, ESLint, architecture: 186 files, 0 violations; chạy tuần tự sau build. |
| `npm run test:unit` | exit 0 | 105 TAP tests đạt, 1 Telegram DB test skip trong unit; thêm 109 checks của test:models đạt. Ca DB tương ứng chạy trong integration. |
| `npm run test:production` | exit 0; **61 đạt, 0 lỗi** | Route handlers và DB local dùng một lần, runtime privileges, không mail thật. Không phải planner tests hay HTTP smoke deployment. [Kết quả](../ooad/test-results.json). |
| `npm run build` | exit 0 | Next.js build với webpack. |
| `npm run test:orders` / `npm run test:hardening` | exit 0; 8/8 và 16/16 | Chạy trước lượt unit đầy đủ, kiểm retry/giá/validation. |
| `python3 scripts/ooad/check-elaboration-relations.py` | exit 0; 25 quan hệ, 0 lỗi | Subset FK/nullability/unique theo các dạng SQL đang dùng. [Evidence](../ooad/exports/elaboration-relations.json). |
| `python3 -B /Users/nguyenphucphu/.agents/skills/plantuml/scripts/generate_plantuml.py docs/ooad/diagrams --lint` | exit 0; 68 files, 0 lỗi/0 cảnh báo | Compatibility lint, không phải render PlantUML. Ba single-line class được sửa ở 02-domain-class và D09. |
| `git diff --check` | exit 0 | Tracked tree hiện tại; tệp mới được rà riêng trong danh sách tác vụ. |

- Baseline check/unit/build đạt. Ba hồi quy RBAC, giá và proof thất bại trước bản vá, đạt sau sửa.
- Integration trong sandbox ban đầu bị EPERM tới local PostgreSQL; chạy lại với quyền đã cho phép trên DB tạm đạt. Đây là lỗi môi trường.
- Một lượt check chạy song song build bị TS6053 do `.next/types` bị thay thế. Chạy tuần tự lại đạt; đây là lỗi điều phối, không phải lỗi ứng dụng tồn tại sẵn.
- Một fixture mới dùng ADMIN đã bị test trước hạ role; chuyển fixture sang STAFF hợp lệ rồi suite đạt. Không đổi policy để làm test xanh.
- Trong lúc dựng bản sao, script làm rơi named styles của mxGraph; visual QA phát hiện decision/oval thành chữ nhật. Đã sửa bảo toàn named styles và kiểm lại ảnh. Đây là lỗi phát sinh trong tác vụ, không quy cho bản gốc.
- XML/visual QA và phần **NOT VERIFIED** ghi tại [change log](../ooad/ELABORATION_CHANGELOG.md), [validation](../ooad/exports/validation.json). Render PlantUML local **NOT VERIFIED** vì chưa có renderer; không gửi source lên public Kroki.

## Bàn giao

Code: 6 tệp runtime. Tests: hai tệp TS, helper integration mới và script integration hiện có. Không migration. OOAD: nguồn D/E sửa có mục tiêu, bộ export tổng hợp 142 trang, bản Reviewed 29 trang, script dựng/kiểm quan hệ và JSON evidence. Danh sách thay đổi tác vụ ở `.local/master-audit-2026-11-03/task-changes.json`; không nhận các thay đổi khác có sẵn là của kiểm toán.

[Backlog](REMEDIATION_BACKLOG.md) ghi ưu tiên/công sức/phụ thuộc; [quyết định](DECISIONS_NEEDED.md) chỉ gồm DD-01–04. Bước an toàn tiếp theo là review bản Reviewed và chốt acceptance/schema sản xuất trước triển khai mở rộng; không cần đổi stack hay nối ngân hàng cho ba bản vá hiện tại.
