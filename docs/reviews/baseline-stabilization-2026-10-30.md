# MinhLab 3D — kết quả Stage 0 và Stage 1

Ngày kiểm tra: 30/10/2026. Phạm vi: bảo vệ baseline, củng cố Telegram/preflight, rà soát bảo mật/dependency và hiệu chỉnh thiết kế gom mẻ. **Đã hoàn tất phạm vi mã nguồn được giao; chưa sẵn sàng public thương mại. Dừng trước Stage 2.**

## 1. Trạng thái repository ban đầu

- Branch `codex/quote-analyzer`; HEAD `31237ab0d9f7f7f8ac265da4297ef03277e4cd91`.
- Có 136 mục tracked/submodule có trạng thái thay đổi và 414 tệp untracked; đây là công việc có trước lượt này. Không reset, clean, checkout đè, stage hoặc commit chúng.
- Node `22.16.0`, npm `10.9.2`. Giữ npm/pg/node:test và kiến trúc modular monolith đang có.
- Trước khi sửa đã lưu status, SHA-256/bytes của các tệp hiện hữu, `git diff --binary HEAD` và bản sao từng tệp cần sửa tại `.local/baseline-stabilization-2026-10-30/`. Không sao chép `.env` hay in credential vào bằng chứng.
- Baseline thực chạy: `npm run check` đạt (guard 183 file/0 vi phạm); `npm run test:unit` đạt 94 pass/1 DB-gated skip, thêm 21 scene checks. Build được xác minh sau bản vá, không có số đo build riêng trước bản vá trong lượt này.
- F01 thu hồi lease lần cuối và F02 dùng parser VietQR **đã có trong working tree ban đầu**, khác ảnh chụp audit 29/10. Lượt này giữ các sửa đó và bổ sung phần còn thiếu, không nhận toàn bộ là thay đổi mới.

Trong lúc làm, tài liệu có thay đổi ngoài phạm vi lượt này tại `docs/planning/redesign-deployment-plan.md` và mục định hướng AWS/VPS trong `docs/DECISIONS.md`. Chúng được giữ nguyên. Chỉ thêm quyết định Stage 1 vào DECISIONS; không gộp thay đổi hosting vào bản vá nghiệp vụ.

## 2. Tệp do lượt này sửa hoặc tạo

| Tệp | Thay đổi của Stage 0/1 |
|---|---|
| `scripts/workers/telegram-deliver.cjs` | Ghi nhận số lease cuối đã thu hồi sau COMMIT; không đếm ACK mất quyền sở hữu là gửi thành công |
| `scripts/tests/test-telegram-deliver.test.cjs` | Mở rộng regression bằng provider giả và bảng TEMP cùng connection |
| `scripts/checks/check-production.cjs` | Phân biệt cấu hình payment và tiền điều kiện vận hành checkout |
| `scripts/tests/test-production-config.test.cjs` | Thêm 5 test, tổng 8 test preflight |
| `package-lock.json` | Chỉ entry `postcss-selector-parser`: 6.1.4 → 6.1.5 |
| `docs/design/production-batching-design.md` | Bổ sung giao toàn nhóm, lựa chọn máy/profile gắn với cấu hình, trace theo allocation |
| `docs/PROGRESS.md`, `docs/DECISIONS.md` | Ghi kết quả và giới hạn Stage 1; giữ nội dung có trước/đang được sửa ở chat khác |
| `docs/reviews/baseline-stabilization-2026-10-30.md` | Báo cáo này |

Ngoài repo, hiệu chỉnh mục 8.1 của [báo cáo audit 29/10](/Users/nguyenphucphu/.codex/visualizations/2026/10/29/01a187ea-e12f-72d0-93e5-61a5afebccbc/minhlab-audit-2026-10-29/bao-cao.md:309). Có ghi ngày hiệu chỉnh; các phát hiện lịch sử khác được giữ nguyên. Không xóa artifact nghiên cứu hoặc sửa UML không cần thiết.

Log và snapshot trong `.local/` là bằng chứng local được ignore, không phải thay đổi tính năng cần đưa vào commit.

## 3. Vấn đề đã xử lý

**F01 — Telegram:** xác minh PROCESSING có attempts=5 và lease hết hạn chuyển FAILED, giữ identity/dedup/body/created_at, ghi `DELIVERY_LEASE_EXPIRED`, xóa lease và không gửi lần thứ sáu. Lease đang hiệu lực không bị thu hồi. Bổ sung log số bản ghi thu hồi sau transaction thành công để người vận hành biết cần đối soát.

Phát hiện thêm bằng regression: khi worker cũ nhận phản hồi thành công sau khi worker khác đã chiếm lease, UPDATE bảo vệ bằng lease token vốn không ghi đè được bản ghi, nhưng bộ đếm vẫn báo `delivered=1`. Nay chỉ đếm delivered nếu UPDATE ACK tác động đúng một hàng; mất lease ghi `LEASE_OWNERSHIP_LOST`, trả failed và giữ nguyên lease của worker mới.

**F02 — preflight:** phân biệt `DISABLED`, `MISSING_DESTINATION`, `INVALID_DESTINATION`, `READY`; chỉ báo tên biến thiếu, không in giá trị ngân hàng. Thêm hàng `checkout operational readiness`, yêu cầu payment hợp lệ, HTTPS, migration khớp checksum, DB runtime role phù hợp và catalogue bán được. Thiếu bất kỳ kiểm tra nào thì chưa đạt. Lỗi khởi tạo DB không làm mất kết quả kiểm tra cấu hình.

**Dependency:** vá đúng một dependency transitive trong cùng nhánh tương thích; audit trước có 1 moderate, sau có 0 vulnerability được công bố trong kết quả npm audit tại thời điểm chạy.

## 4. Giải thích và giới hạn của các sửa đổi

- Outbox vẫn gửi sau commit; giới hạn 5 attempts, lease 60 giây và lịch backoff hiện hành giữ nguyên. Reaper và claim nằm cùng transaction; lỗi claim làm rollback recovery. Không thêm queue, schema hoặc migration.
- Telegram giữ ngữ nghĩa at-least-once trong phạm vi retry hữu hạn: provider có thể đã nhận nhưng app chưa ACK được. Lần gửi lại có thể tạo thông báo trùng; FAILED ở lease cuối biểu thị kết quả chưa chắc chắn, không chứng minh provider chưa nhận. Nhân sự phải đối soát trước redrive; chưa tạo chức năng redrive tự động.
- Kiểm tra payment vẫn gọi `manualVietQrDestination` của checkout. Không đổi BIN/account validation, amount, xác nhận tiền, snapshot ngân hàng hoặc snapshot đơn hàng.
- Operational readiness ở đây là **tiền điều kiện**, không phải bằng chứng chuyển tiền hay đặt đơn thật thành công. Các gate mail/Telegram/verification/runtime/framework vẫn hiện riêng và vẫn làm toàn lệnh preflight exit 1 nếu không đạt.
- Theo [advisory chính thức](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), bản vá nhánh 6 là 6.1.5; rủi ro CPU liên quan parsing selector không tin cậy trong request path. Trong repo này dependency nằm ở toolchain Tailwind/CSS; chưa thấy đường nhận selector khách rồi parse bằng thư viện này trong API. Đây là đánh giá khả năng tiếp cận từ mã nguồn, không phải tuyên bố mọi deployment đều miễn nhiễm.
- `package.json`, Next.js, React, Tailwind và các dependency khác không đổi so với baseline của lượt này. Không chạy `npm audit fix --force` hoặc thêm direct dependency/override.

## 5. Kiểm tra đã thực chạy

| Lệnh / bằng chứng | Kết quả thật |
|---|---|
| `npm run check` trước và sau | Exit 0; gồm `tsc --noEmit`, ESLint app/src/proxy và architecture guard: 183 file/0 vi phạm |
| `npm run test:unit` trước | Exit 0; 94 pass/1 skip, thêm 21 scene checks |
| Preflight regression trước triển khai helper | Exit 1; 3 pass/5 fail do helper mới chưa có; `red-preflight.log` |
| Telegram fixture trước sửa ACK | Exit 1; test ACK đến muộn tái hiện delivered sai; `red-telegram.log` |
| `node --test scripts/tests/test-production-config.test.cjs` sau sửa | Exit 0; 8/8 pass; `green-preflight.log` |
| `node .local/baseline-stabilization-2026-10-30/run-telegram-fixtures.cjs green` | Exit 0; 14/14 pass, gồm 8 tình huống DB TEMP và wrapper; 0 skip |
| `npm run test:unit` sau | Exit 0; 100 pass/1 skip, thêm 21 scene checks; DB-gated suite đã chạy riêng ở hàng trên |
| `npm run build` | Exit 0; Next.js production build sinh đủ 37/37 trang |
| `npm audit --json --ignore-scripts --no-fund` | Trước: exit 1, 1 moderate; sau: exit 0, total 0 |
| HTTP trên `next start`, `127.0.0.1:3108` | 9/9 đạt: 5 trang công khai và 3 GET API trả 200; GET admin chưa đăng nhập trả 401; health báo DB up |
| `node scripts/checks/check-production.cjs` | Exit 1 đúng với các gate local chưa đạt, chi tiết mục 6 |
| `git diff --check` | Exit 0; đã đọc diff riêng so với snapshot trước sửa, bao gồm script vốn untracked |
| SHA-256 so baseline | Mọi tệp hiện hữu trong `app/`, `src/`, `database/` không đổi; `package.json` không đổi |

Telegram fixtures chỉ chạy trên PostgreSQL local, dùng một connection và bảng `pg_temp.telegram_outbox`; mọi provider call được inject bằng hàm giả. Hash/count của 10 bảng public nghiệp vụ giống nhau trước và sau cả lần red và green. Không gửi Telegram, email hay payment thật. Chỉ kiểm HTTP GET không có cookie; không POST đăng ký/checkout trên dữ liệu đang dùng. Server kiểm tra đã được dừng sau smoke test.

HTTP smoke kiểm SSR/API, không thay thế kiểm tra tương tác/hydration trên trình duyệt. Không có thay đổi giao diện ở lượt này. Bộ test auth 18, orders 7, checkout 9, catalogue 6 và quote 21 đều qua; cộng với checksum nguồn không đổi, đây là bằng chứng hồi quy trong phạm vi đã kiểm, không phải nghiệm thu E2E bằng tiền thật.

Không chạy `test:production`: script đó tạo/drop database kiểm thử và ghi lại artifact OOAD, không phù hợp giới hạn của nhiệm vụ này. Không chạy migrate, seed, worker CLI hoặc deploy.

Bằng chứng local: [thư mục kết quả](/Users/nguyenphucphu/Downloads/minhlab-3d/.local/baseline-stabilization-2026-10-30), gồm `initial-manifest.json`, `initial-status.txt`, `initial-tracked.patch`, `before/`, các log baseline/final/red/green, `green-telegram-database-safety.json`, `http-smoke.json`, `scope-check.json` và `stage01-review.patch`. Không coi skip của suite mặc định là pass; không cộng test chạy lại thành số test duy nhất.

## 6. Vấn đề còn lại

Preflight local: mail credentials, Telegram store alerts, public HTTPS URL và sellable catalogue đều FAIL. Catalogue hiện có **0 biến thể** thỏa PUBLISHED + APPROVED + ACTIVE. Hàng operational checkout cũng FAIL vì HTTPS/catalogue chưa đạt. Payment config, verification enabled, Node/framework, migration checksum và runtime DB role đạt. Không tự bật credential, duyệt catalogue hoặc tạo dữ liệu để làm xanh gate.

**Rate limit theo nguồn vẫn chưa triển khai.** `proxy.ts` kiểm Origin và Content-Length, không giới hạn số request. Login hiện giới hạn theo email chuẩn hóa (10/15 phút), yêu cầu email theo purpose+email (3/15 phút) qua DB; chúng không ngăn nguồn gửi nhiều email khác nhau hoặc tạo guest orders/register hàng loạt. Idempotency cũng không thay thế quota. Hậu quả có thể là tăng CPU hash, đơn rác và outbox/email; chưa có số đo tải hay bằng chứng đã bị khai thác.

Phương án trước public: quota riêng cho POST orders/register/login/email ở reverse proxy/edge đã chọn, nhận diện nguồn từ connection/proxy tin cậy, bỏ header chuyển tiếp do client tự gửi, trả 429 và Retry-After, có burst/backoff và kiểm thử NAT/IPv6/nhiều instance. Ngưỡng phải đo theo tải/chi phí thực tế. Chưa cấu hình nhà cung cấp/hạ tầng trong lượt này.

Không thêm limiter bằng Map/global của Next hoặc tin trực tiếp X-Forwarded-For: không chia sẻ trạng thái giữa instance, dễ bypass hoặc khóa nhầm người dùng. Tài liệu Next đi kèm tại `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` cũng yêu cầu không dựa vào shared module/global. Giải pháp DB/app bền vững cần quyết định nguồn tin cậy, retention và test đồng thời; thay đổi đó chưa cần để hoàn thành yêu cầu **review**, và vượt phạm vi không migration/không đổi auth của lượt này.

## 7. Rủi ro và tương thích

- Public site còn rủi ro lạm dụng cho tới khi rate limit theo nguồn được nghiệm thu; production gates hiện FAIL nên không kết luận sẵn sàng nhận đơn thương mại.
- Kiểm thử Telegram mô phỏng interleaving và lỗi kết nối ACK, không phải stress test nhiều process hoặc chứng minh exactly-once. Worker vẫn cần được chạy định kỳ trên host; chưa cấu hình cron.
- Reaper để kết quả cuối ở FAILED có audit identity và error code, không thêm lịch sử từng attempt hoặc công cụ đối soát mới.
- Bản vá parser cùng nhánh có rủi ro tương thích nhỏ, được kiểm bằng type/lint/unit/build; kết quả audit 0 chỉ áp dụng danh sách advisory tại thời điểm chạy.
- Working tree còn nhiều công việc chưa commit, một số tệp nghiệp vụ đang untracked. Khi tạo commit sau này cần stage từng hunk/tệp theo sở hữu; không dùng commit toàn bộ. Snapshot/diff local giúp tách phần sửa này khỏi phần có trước.
- Không thay đơn giá catalogue, mô hình FDM, luồng STL của khách, auth architecture, payment rule, DB schema hoặc dữ liệu public.

## 8. Quyết định thiết kế gom nhóm đã cập nhật

1. **Demand aggregation:** cùng approved component revision + manufacturing specification revision mới là nhu cầu có thể thay thế nhau; vẫn phân bổ về từng đơn.
2. **Physical batching:** cho phép đầu/tay/nắp/thân/chân hoặc mẫu khác nhau cùng mẻ nếu tương thích công nghệ, material identity, màu lúc in và appearance. Component revision không phải khóa bằng nhau cho cả bàn in.
3. Có một lựa chọn máy + configuration revision + profile revision chung cho **toàn bộ nhóm**. Các cặp có giao chưa đủ; ví dụ `{P1,P2}`, `{P2,P3}`, `{P1,P3}` có giao toàn nhóm rỗng. Hai tập máy/profile riêng còn phải khớp thành lựa chọn thực thi hợp lệ.
4. Tiếp tục kiểm capability, layout/support/clearance, chất lượng, deadline, vật tư, máy/nhân sự và công suất hậu xử lý; bucket chỉ lọc sơ bộ.
5. Allocation giữ requirement/order item, component/spec revision, quantity, yêu cầu chế tạo và QC riêng. Black/White chung file nhưng khác màu có thể khác DemandKey/bucket; Black và Three Claws khác thân/chân vẫn có thể cùng mẻ resin đen nếu toàn bộ điều kiện được xác nhận.

Đây chỉ là thiết kế. Chưa có BOM engine, inventory reservation, batching engine, scheduler hoặc AI Agent chạy trong hệ thống.

## 9. Đề nghị cho Stage 2

Sau khi chủ dự án duyệt riêng, Stage 2 nên giới hạn ở chuẩn hóa Component/BOM/Manufacturing Specification và trình schema/contract diff trước migration. Tái sử dụng các mẫu Black/White/Three Claws đã cung cấp; chỉ nhập thêm số lượng BOM, file/revision và thông số máy/profile còn thiếu, không yêu cầu gửi lại thông tin đã có.

Đầu ra nên có revision bất biến, quy tắc approved, mapping variant, quantity/unit, trace và kế hoạch backfill/rollback/test. Chưa thêm scheduler/AI/FastAPI/Strands/OR-Tools. Việc public website cần gate vận hành và rate limit riêng, không tự được phê duyệt cùng Stage 2.

**Dừng tại đây và chờ phê duyệt Stage 2; chưa thực hiện schema hoặc tính năng của giai đoạn đó.**
