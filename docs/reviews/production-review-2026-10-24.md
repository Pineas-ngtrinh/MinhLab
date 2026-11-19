# Rà soát production — 24/10/2026 (luồng thanh toán cập nhật 27/10)

Phần thương mại hiện có đã được sửa và kiểm thử trên bản production local với PostgreSQL riêng. Chưa phát hành Internet hoặc nghiệm thu toàn bộ roadmap. Không gán điểm Lighthouse hay điểm đồ án khi chưa đo theo thang cụ thể.

Cập nhật sau báo cáo: checkout mới chỉ nhận QR cá nhân VietQR; COD giữ cho đơn lịch sử. Telegram outbox/worker đã được thêm; production còn thiếu bot/chat credentials và scheduler.

## Những vấn đề đã xử lý

| Vấn đề | Kết quả trong source hiện tại |
| --- | --- |
| Chưa có đường quản lý nội dung catalogue | ADMIN thêm/sửa mô tả, ảnh, thông số và biến thể tại `/admin/san-pham`; UI cửa hàng tải PostgreSQL, không sửa JSX để thêm sản phẩm |
| Mã/SKU nhập tay, dễ va chạm | Sequence DB cấp `ML-P-<số>` / `ML-S-<số>`; giữ mã/slug/SKU cũ; không cam kết dãy không có khoảng trống |
| Chỉnh sản phẩm có thể ghi đè hoặc bán nội dung chưa duyệt | Revision trả 409 khi stale; khóa hàng; save rút về DRAFT/NEEDS_REVIEW; publish riêng với xác nhận/ghi chú; audit cùng transaction |
| Bỏ biến thể làm mất định danh | Ngừng bán thay vì xóa; SKU đã nghỉ không chiếm giới hạn biến thể đang sửa; giỏ mới lưu UUID, đổi tên vẫn giữ SKU, không thay bằng SKU khác cùng tên; đơn cũ giữ snapshot |
| Lịch sử khách tải toàn bộ, thiếu đường xem chi tiết | API phân trang có giới hạn và ownership; summary toàn bộ đơn; khách mở chi tiết bằng phiên; tracking hiển thị đủ bước đang giao/đã giao |
| Phí giỏ và checkout dễ lệch | Một domain policy cho giỏ/checkout/server; 30.000đ, miễn từ 500.000đ; kiểm tổng tiền không vượt cột DB |
| Tài khoản VietQR hardcode chưa có bằng chứng chủ sở hữu | Bỏ khỏi marketing, opt-in qua môi trường, lưu receiving account snapshot cho từng khoản; thiếu cấu hình chặn VietQR và cho COD |
| Thợ in thiếu thao tác thực | Hàng đợi đọc DB; chỉ xác nhận IN_PRODUCTION → READY_TO_SHIP, không lộ liên hệ/địa chỉ/tiền; không giả telemetry |
| Request cũ và trạng thái UI | Hủy/bỏ response cũ khi đổi scope/trang; bootstrap auth không ghi đè đăng nhập mới; error/retry rõ ràng; native dialog giữ focus, Escape; ảnh lỗi có fallback |
| Hygiene/vận hành | Tách contracts/domain/service/repository/composition, guard bao phủ orders/catalog; chuẩn hóa format module mới; capture Figma opt-in dev; CI Node 22; preflight kiểm checksum migration |

## Ma trận chức năng và quyền

| Actor | Đã kiểm | Giới hạn |
| --- | --- | --- |
| Guest | Đọc catalogue; checkout giá server; token riêng; idempotency và giới hạn input | Không được xem lịch sử của tài khoản qua email người nhận |
| CUSTOMER | Đăng nhập/đăng xuất; lịch sử 2 trang và tổng 27 đơn; mở đơn owner không token; logo về trang chủ; QR checkout và validation | Không gọi quản trị/catalogue hoặc hàng đợi |
| ADMIN | Tạo/sửa/duyệt/ẩn/ngừng bán sản phẩm, cấp mã, revision, lọc; đối soát/trạng thái theo policy | Không bỏ qua điều kiện tiền hoặc cạnh trạng thái |
| STAFF | API đơn/đối soát và đọc hàng đợi | Bị chặn CRUD/xuất bản catalogue |
| PRINT_OPERATOR | Hàng đợi và bàn giao hoàn thiện; cạnh tranh cập nhật chỉ một lịch sử | Không đọc PII/tiền qua API thương mại, giao/hoàn tất đơn hoặc quản lý catalogue |
| FILE_REVIEWER | Bị chặn catalogue/hàng đợi không thuộc quyền | Trạm duyệt file vẫn thông báo chưa kết nối; chưa triển khai M3–M4 |

Browser QA dùng tài khoản/sản phẩm/đơn giả trong database riêng (server/database thử đã dọn sau nghiệm thu), không seed thử vào `minhlab`, không gửi thư/nhắn Zalo/chuyển tiền. Nhập/sửa/publish chỉ trên fixture. API test kiểm cả ma trận quyền và những lỗi đồng thời/rollback, không chỉ giao diện nút ẩn.

## Bằng chứng kiểm tra

- `npm run check`: TypeScript strict, ESLint và architecture guard đạt; 162 file trong graph, 0 vi phạm.
- `npm run test:unit`: 58 test Node đạt, 21 kiểm tra scene đạt.
- `npm run test:production`: 55 tình huống đạt, 0 lỗi; migrations cài mới/idempotency, runtime role hạn quyền, các actor, catalogue, ownership, tiền, cạnh tranh và rollback. [Kết quả máy đọc](../ooad/test-results.json).
- `npm run build`: exit 0. HTTP smoke 27/27 đạt; QA local theo evidence dưới `.local/production-2026-10-24/`.
- Browser 375/768/1024/1440px: form sản phẩm, giỏ, checkout, lịch sử khách và queue không tràn ngang. Kiểm ảnh lỗi fallback, thiếu contact, COD, đổi trang, link owner, logo, Escape và focus sau đặt đơn. Chưa đo Lighthouse hoặc nghiệm thu GPU/thiết bị thật toàn bộ website.
- Backup trước nâng cấp 006–007; 7 products, 7 variants, 26 images, 19 orders và 3 payments cũ giữ nguyên. Restore vào DB mới và so hash các bảng này đạt; DB restore thử đã xóa. Backup có dữ liệu nội bộ, giữ riêng, không commit.

### Bổ sung benchmark lõi STL — 27/10/2026

- `npm run benchmark:stl` phân tích STL binary tổng hợp 50.000032 MiB, 1.048.575 tam giác trên Node v22.16.0 / Darwin arm64: 2.001,6 ms; RSS quan sát trước/sau là 172,344/180,234 MiB. Lệnh trả lỗi nếu vượt 3.000 ms.
- Fixture lặp mặt tứ diện để đo đường đọc và tính đặc trưng ở kích thước lớn; đây là phép đo synthetic trên một máy, không đại diện mọi STL hoặc thiết bị khách. Vì hơn 500.000 tam giác, topology bị bỏ qua và kết quả mang `TOPOLOGY_SKIPPED`; policy hiện tại buộc xưởng duyệt, không hiển thị giá chốt.
- Kết quả này đạt ngưỡng tốc độ M1 trên môi trường đo. Cần đo riêng Worker trên thiết bị di động/cấu hình thấp và xác định giới hạn file dùng thống nhất trước khi mở upload bền vững M3.

### Preflight local — 27/10/2026

`npm run production:check` đọc được PostgreSQL: migration, runtime role, Node/Next và cấu hình VietQR đều đạt. Preflight trả exit 1 vì mail/Telegram credentials chưa có, URL HTTPS production chưa cấu hình, tài khoản demo còn bật và catalogue có 0 biến thể được duyệt/xuất bản. Đây là các cổng phát hành còn thiếu; không tự duyệt sản phẩm để làm xanh preflight.

## Dependency và giới hạn bảo mật

`npm audit` ngày rà soát: 0 critical, 0 high, 3 cảnh báo moderate ở `tailwindcss → postcss-nested/postcss-selector-parser`, cùng một lỗi CPU exhaustion của parser. Theo [advisory chính thức](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), rủi ro này áp dụng khi parse CSS selector không tin cậy đồng bộ trong request; build từ source tin cậy không nằm trong phạm vi đó. Đây là đánh giá khả năng đi tới lỗi từ code đang có, không phải chứng nhận miễn nhiễm cho mọi môi trường.

Không chạy `npm audit fix --force` đổi Tailwind 3 sang 4 hoặc ép parser sang major mới ngoài constraint của upstream. Cần nâng dependency khi có bản tương thích, hoặc lập thay đổi Tailwind 4 riêng với kiểm CSS/visual. [Audit JSON](../ooad/dependency-audit.json). Node 22/24 hiện là nhánh LTS theo [Node.js](https://nodejs.org/en/about/previous-releases); CI dùng 22, chưa nâng runtime patch của máy người dùng.

URL QR theo [tài liệu VietQR](https://www.vietqr.io/qr-dong), nhưng tính hợp lệ cú pháp không xác minh chủ tài khoản và không xác nhận đã nhận tiền. API test chỉ dùng destination giả; chưa gọi ngân hàng thật. Cập nhật quyết định 27/10: dùng QR cá nhân và xác nhận thủ công; payOS kế hoạch cũ bị hủy.

## Việc phải hoàn tất trước phát hành

1. Cấu hình host/domain HTTPS, mail đã xác minh và lịch outbox worker; tắt seed/demo, nghiệm thu email đến hộp thư thật. Preflight local hiện fail mail, HTTPS, cờ demo và sellable catalogue.
2. Chủ xưởng duyệt nội dung/quyền sử dụng/giá của catalogue thật. Không tự APPROVE 7 sản phẩm hiện có. Chủ dự án đã cung cấp tài khoản BIDV và yêu cầu sử dụng ngày 24/10: đã bật manual VietQR tại local qua `.env.local`; khi phát hành phải cấu hình cùng năm biến trên host đích. Khoản cũ không bị đổi tài khoản nhận; việc đối soát vẫn thủ công.
3. Nghiệm thu backup/restore, ingress rate limit, TLS/credential DB và scheduler trên host đích; local đạt không thay cho môi trường Internet.
4. M3–M5: storage private/analysis server, request/revision, thợ duyệt giá, khách chấp thuận, production jobs và Telegram outbox. Thanh toán QR cá nhân cần nhân viên đối soát thủ công. Đường STL hiện là preview/ước tính + tư vấn thủ công. Giá model chưa là hóa đơn tự động.
5. Auth/email legacy tiếp tục tách repository theo từng luồng; tồn kho/nguyên liệu, vận chuyển có tracking, refund/hóa đơn chưa triển khai. Chưa chạy workflow GitHub, chưa xuất lại draw.io; nguồn ERD/DBML cần đồng bộ migration 008 trước lần xuất kế tiếp.

Thứ tự và cổng nghiệm thu chi tiết: [kế hoạch system design](../planning/system-design-execution-plan.md). Không cần đổi stack hoặc tách microservice để hoàn thiện các bước này.
