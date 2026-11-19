# MinhLab 3D

Website cửa hàng mô hình và dịch vụ in 3D FDM/resin, có catalogue, giỏ hàng, checkout QR VietQR cá nhân, tra cứu đơn và bàn quản trị theo vai trò.

Form in theo file giữ dự đoán FDM và có 17 màu cho mô hình xem trước, đồng bộ với màu trong bản tóm tắt; lựa chọn màu không làm thay đổi mô hình hoặc giá. Xưởng vẫn nhận in resin qua tư vấn trực tiếp: trắng/đen/xám/clear, quy cách chai 1.000 ml. [Thông tin vật liệu và bản kiểm kê](docs/design/workshop-materials.md) phân biệt bảng màu yêu cầu với tồn kho chưa có luồng cập nhật trực tiếp.

Trên điện thoại, sản phẩm ở trang chủ và bộ sưu tập hiển thị hai mẫu mỗi hàng. Khách chọn số lượng bằng nút −/+ trong chi tiết sản phẩm, giỏ và form đặt hàng. Checkout chỉ nhận thanh toán QR cá nhân VietQR; nhân viên đối soát trong ứng dụng ngân hàng và xác nhận trong admin. Telegram báo đơn mới và trạng thái đối soát; không có cổng thanh toán hoặc tự động xác nhận tiền.

Muốn đọc hoặc dọn code: bắt đầu từ [bản đồ project](PROJECT_STRUCTURE.md), xem cấu trúc thực tế bằng `npm run architecture:report`; [đánh giá công cụ](docs/reviews/architecture-tooling-2026-11-04.md) giải thích lựa chọn phù hợp.

## Công nghệ và phạm vi

Next.js 16.4.2 (App Router), React 19.3.1, TypeScript strict, Tailwind CSS 3, PostgreSQL, React Three Fiber 9/Drei 10, Three.js 0.160.1. Framework yêu cầu Node.js từ 20.9; môi trường production/CI dùng Node 22 theo `.nvmrc` (đã kiểm tra bằng 22.16.0). Các phiên bản được lưu trong `package-lock.json`; dùng `npm ci` khi cài lại.

Đã triển khai API cho tài khoản, phiên đăng nhập, xác minh email, đặt lại mật khẩu, đơn hàng, đối soát và chuyển trạng thái. In theo file hiện phân tích STL/ước tính tham khảo ở trình duyệt rồi bàn giao qua Zalo/email; chưa phải hệ thống nhận file và quản lý báo giá đầy đủ trong PostgreSQL. Email được lưu bền vững vào outbox; cần cấu hình dịch vụ và chạy worker để thư đến hộp thư thật.

Cập nhật quyết định 27/10/2026: bỏ cổng thanh toán, dùng QR cá nhân VietQR và đối soát thủ công. Xem [quy trình thanh toán và Telegram](docs/design/payment-integration-plan.md), [tiến độ](docs/PROGRESS.md) và [quyết định](docs/DECISIONS.md).

## Chạy local

```bash
npm ci
npm run db:start
npm run dev
```

Mở `http://localhost:3000`. Kiểm tra database bằng `npm run db:status` hoặc `GET /api/health`. PostgreSQL local dùng `127.0.0.1:5433`, database `minhlab`; role sở hữu/migration là `minhlab_dev`, role chạy app sau thiết lập là `minhlab_app`. Cấu hình này dành cho máy cá nhân. `db:start` chạy migration có lưu checksum và seed catalogue thực tế.

Sau lần tạo database đầu tiên, chạy `npm run db:runtime-role` để tạo role app hạn quyền và lưu URL trong `.env.local` (không in credential); sau đó khởi động lại Next.js. `MIGRATION_DATABASE_URL` giữ quyền sở hữu cho migration/seed, `DATABASE_URL` dùng role app. Trên máy hiện tại bước này đã hoàn tất. Role này không được xóa đơn hoặc sửa audit log.

Nếu không tìm thấy PostgreSQL, cài PostgreSQL 16 trở lên; script nhận diện các bản Homebrew 16–18. Chạy `db:stop` khi chủ động muốn dừng database. PostgreSQL và Next.js là hai tiến trình riêng.

## Catalogue từ database

Trang chủ, bộ sưu tập, giỏ hàng và checkout đọc dữ liệu PostgreSQL. `SITE_CONFIG` chỉ giữ nội dung thương hiệu/marketing. Tên, mô tả, giá, màu và ảnh sản phẩm không còn nằm trong bundle cấu hình frontend. Server Components đọc qua `src/server/catalog.ts`; browser khôi phục giỏ bằng `GET /api/catalog` (`no-store`). Thêm/sửa dữ liệu DB có hiệu lực ở lần tải trang tiếp theo, không cần build lại.

Cài mới: `npm run db:migrate` rồi `npm run db:seed`. Nâng cấp DB đã có catalogue trước migration 005: sao lưu, chạy migration rồi `npm run db:seed -- --backfill-display` một lần để bổ sung ảnh/thông số hiện có. Script không thay tên, mô tả, giá, ID hoặc trạng thái duyệt của sản phẩm cũ. Seed thường chỉ thêm mẫu chưa tồn tại; `database/seeds/catalog.json` là dữ liệu khởi tạo, không phải nguồn đọc khi website chạy.

Production chỉ hiển thị và cho mua sản phẩm `PUBLISHED` + `APPROVED`; local dev có thể xem `DRAFT` để phát triển, luôn ẩn `HIDDEN`/`ARCHIVED`/`REJECTED`. Ảnh hỗ trợ `/images/` và Cloudinary đã cấu hình trong Next.js. Giỏ lưu tham chiếu sản phẩm/UUID biến thể/số lượng, đọc lại giá từng SKU; dữ liệu giỏ cũ theo màu vẫn được hỗ trợ. Đổi tên màu giữ đúng biến thể; biến thể ngừng bán không được chuyển sang SKU khác cùng tên.

ADMIN mở `/admin/san-pham` để thêm/sửa tên, mô tả, ảnh, thông số và các biến thể. Database tự cấp mã `ML-P-<số>` và SKU `ML-S-<số>`; mã/slug/SKU cũ được giữ. Mã có thể nhảy số khi transaction rollback, không dùng làm số thứ tự kế toán. Lưu luôn thành bản nháp; thao tác **Duyệt & xuất bản** yêu cầu xác nhận quyền sử dụng mẫu và ghi chú riêng. Chỉnh sửa sản phẩm đang bán thu hồi duyệt để kiểm tra lại; đơn cũ giữ snapshot. Revision chống hai người ghi đè thay đổi của nhau. Danh mục được chọn từ DB; chưa có form quản lý danh mục/tải ảnh mới.

Áp dụng migration `006_catalogue_management.sql` và `007_payment_destination_snapshot.sql` trước khi chạy source mới. Local đã sao lưu, nâng cấp và thử restore vào DB riêng tại `.local/production-2026-10-24/`; không tự duyệt 7 sản phẩm đang có.

## Thanh toán và bàn xưởng

Phí giao catalogue dùng chung domain policy cho giỏ, checkout và server: 30.000đ, miễn từ 500.000đ. Tổng tiền cuối lấy từ dữ liệu server. Checkout chỉ dùng VietQR cá nhân; VietQR mặc định bị tắt cho đến khi cấu hình `MINHLAB_MANUAL_VIETQR_ENABLED=true` và đủ `MINHLAB_VIETQR_BANK_BIN`, `MINHLAB_VIETQR_BANK_NAME`, `MINHLAB_VIETQR_ACCOUNT_NUMBER`, `MINHLAB_VIETQR_ACCOUNT_NAME`. Mỗi khoản chờ lưu snapshot ngân hàng nhận; đổi cấu hình không đổi QR đơn đã tạo. COD chỉ còn trong dữ liệu và luồng hoàn tất của các đơn cũ.

Lịch sử `/tai-khoan` phân trang phía server, tổng trạng thái tính trên toàn bộ đơn của chủ tài khoản; liên kết chi tiết dùng phiên đã đăng nhập. Hàng đợi chế tác cho ADMIN/STAFF/PRINT_OPERATOR đọc đơn đang in/hoàn thiện; thợ chỉ xác nhận `IN_PRODUCTION → READY_TO_SHIP`. API hàng đợi không trả liên hệ/địa chỉ hoặc tiền của khách. Đây là cập nhật thủ công sau kiểm tra tại xưởng; duyệt file, telemetry và điều khiển máy chưa kết nối.

## Tài khoản thật

Đăng ký tại `/dang-ky`; tài khoản mới luôn là CUSTOMER, không thể tự chọn ADMIN. Không có mật khẩu admin mặc định.

Sao chép các biến cần dùng từ `.env.example` sang `.env.local` và điền trên máy của bạn. `MINHLAB_ADMIN_EMAIL`, `MINHLAB_ADMIN_PASSWORD` (ít nhất 12 ký tự), `MINHLAB_ADMIN_NAME` dùng để khởi tạo quản trị viên do chủ triển khai cấu hình. Không commit mật khẩu/khóa API. Việc bootstrap không đổi mật khẩu của tài khoản đã tồn tại.

Production mặc định yêu cầu xác minh email. Local mặc định chưa yêu cầu nếu `MINHLAB_REQUIRE_EMAIL_VERIFICATION` để trống. Muốn thử luồng xác minh thật tại local: cấu hình `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (địa chỉ đã được nhà cung cấp xác minh), bật `MINHLAB_REQUIRE_EMAIL_VERIFICATION=true`, khởi động lại app và đăng ký. Đăng ký, gửi lại liên kết xác minh và yêu cầu đặt lại mật khẩu sẽ gửi email ngay sau khi lưu outbox; nếu nhà cung cấp lỗi, yêu cầu vẫn thành công và thư được giữ để thử lại. Chạy định kỳ `npm run mail:deliver` để gửi lại tối đa 20 thông báo đang chờ; lệnh này gửi thư thật. Bộ test dùng nhà cung cấp giả và không gửi thư thật.

Các trang: `/xac-thuc-email`, `/gui-lai-xac-minh`, `/quen-mat-khau`, `/dat-lai-mat-khau`. Token có hiệu lực 30 phút và chỉ dùng một lần; đặt lại mật khẩu thu hồi các phiên cũ.

## Kiểm tra chất lượng

```bash
npm run check
npm run test:unit
npm run test:production
npm run build
```

`check` gồm TypeScript, ESLint và guard kiến trúc; `test:unit` tổng hợp test kiến trúc, auth/crypto/token, policy/mapper/use case đơn hàng, checkout, catalogue, cấu hình production, Telegram, quote, scene và xử lý tệp/clipboard. CI dùng PostgreSQL tạm với role runtime hạn quyền, không gửi email hoặc gọi thanh toán thật. Xem [kiến trúc và ma trận API/quyền](docs/architecture.md).

`test:production` tự tạo một database `minhlab_audit_test_<thời gian>` trên PostgreSQL local, chạy migration/fixture, kiểm tra API rồi xóa database tạm. Tài khoản PostgreSQL chạy test cần quyền CREATEDB. Có thể đặt `TEST_DATABASE_URL` tới một PostgreSQL local dành riêng kiểm thử. Test không thêm tài khoản/đơn vào database `minhlab`, không gửi email thật và không tự chạy các script QA cũ.

`npm run build` chỉ đóng gói. Chạy `npm start` để phục vụ bản production, hoặc `npm run dev` khi phát triển. Dev sử dụng `.next-dev`, build dùng `.next`, tránh hai lệnh ghi đè chunk của nhau.

## Chuẩn bị triển khai

```bash
npm run db:migrate
npm run production:check
npm run build
npm start
```

Thực hiện sau khi cấu hình môi trường production. `production:check` chỉ là kiểm tra điều kiện cấu hình/database, không thay thế kiểm thử vận hành. Catalogue phải được duyệt `APPROVED` và xuất bản `PUBLISHED` mới được mua ở production; seed không tự thay quyết định này. Không dùng role PostgreSQL superuser hoặc xác thực trust cho server công khai.

Đọc [runbook production](docs/operations/production-runbook.md), [kế hoạch đã thực hiện](docs/planning/production-ooad-plan.md) và [hồ sơ OOAD](docs/ooad/README.md). Bộ nguồn có [danh mục sơ đồ](docs/ooad/diagrams.md), [manifest](docs/ooad/diagram-manifest.csv) và [export tổng hợp 142 trang](docs/ooad/exports/MinhLab-OOAD.drawio). Bản nộp Elaboration được chọn riêng: [Reviewed 29 trang](docs/ooad/exports/MinhLab_Elaboration_Reviewed.drawio), [thay đổi và visual QA](docs/ooad/ELABORATION_CHANGELOG.md), [truy vết](docs/ooad/ELABORATION_TRACEABILITY.md).

## Cấu trúc chính

Tra cứu [bản đồ project](PROJECT_STRUCTURE.md), [mục lục tài liệu](docs/README.md) và [công cụ theo nhóm](scripts/README.md).

- `app/`: trang và API; `proxy.ts`: kiểm tra nguồn yêu cầu và kích thước trước route.
- `src/contracts/`: DTO và phân trang dùng chung với browser; `src/domain/orders/`: model và policy đơn hàng thuần.
- `src/services/orders/`: checkout, idempotency, đối soát, ports và presenter; `src/server/orders.ts` ghép adapter thật. Auth dùng cùng ranh giới tại `src/services/auth/`, `src/repositories/auth/`, `src/server/auth.ts`; crypto/email là adapter riêng.
- `src/services/catalog/`, `src/domain/catalog/`, `src/repositories/catalog/catalog-write.repository.ts`: quản lý bản nháp/duyệt, policy xuất bản và SQL; composition tại `src/server/catalog.ts`.
- `src/hooks/`: controller tải phân trang, theo dõi đơn và tình trạng phương thức thanh toán; hủy/bỏ phản hồi của request cũ.
- `src/repositories/`: SQL đọc/ghi và ánh xạ PostgreSQL; `src/integrations/notifications/`: adapter email outbox trong transaction đơn hàng.
- `src/components/admin/`: workspace, controller, bảng và hộp thoại quản trị; `src/components/account/`: profile, tổng quan và lịch sử đơn của khách.
- `src/components/checkout/` và `src/components/print-request/`: controller của từng luồng tách khỏi các phần giao diện.
- `src/lib/`: truy cập PostgreSQL, phiên, validation, phân tích STL và mô hình giá tham khảo.
- `database/migrations/`: lịch sử schema; không sửa migration đã áp dụng.
- `public/`: tài nguyên website; giữ nguyên hai GLB chính.
- `assets/brand/`: logo nguồn thương hiệu; `assets/source-photos/`: ảnh gốc sản phẩm, không được đóng gói làm route.
- `docs/ooad/`: yêu cầu, use case, sơ đồ nguồn, dữ liệu và bằng chứng kiểm thử.

## File đã dọn và khôi phục

Bài nộp HCI, prototype Figma/HO5, script QA cũ, file sinh tạm và component không được App Router dùng đã được chuyển khỏi source hoạt động. Danh mục và lý do tại [cleanup-manifest.json](docs/cleanup-manifest.json). Bản giữ lại trên máy ở `.local/maintenance-2026-10-19/archived/`; snapshot source và PostgreSQL cũng nằm trong thư mục đó, đã được Git bỏ qua. Không xóa thư mục backup trước khi đã kiểm tra lại tài liệu cần nộp.

`scripts/model-authoring/build_lab.py` và `scripts/model-authoring/inspect_render.py` vẫn là công cụ dựng model hợp lệ, không phải bài tập môn khác. Công cụ được nhóm trong `scripts/model-authoring/` và vẫn sinh file ở root; các output này đã được Git bỏ qua. Xem [tài liệu model gốc](docs/models/model-authoring.md).

## Rà soát code ngày 21/10/2026

Xem [báo cáo audit và phạm vi còn lại](docs/reviews/code-audit-2026-10-21.md). TypeScript kiểm tra cả import, biến và tham số không dùng. API quản trị phân trang mặc định 25 mục, tối đa 100 (`page`, `pageSize`, `status`).

Thứ tự hoàn thiện các phần còn thiếu nằm trong [kế hoạch system design](docs/planning/system-design-execution-plan.md); ranh giới module ở [kiến trúc hiện tại](docs/architecture.md), còn nợ clean code được ghi trong [bản rà soát cấu trúc](docs/reviews/technical-debt-cleanup.md). Kế hoạch không xác nhận các milestone mở rộng đã triển khai.

Storefront gửi `Idempotency-Key` khi tạo đơn; cùng khóa và cùng thông tin/người mua trả lại đơn đã tạo. Đổi thông tin/người mua với khóa cũ trả HTTP 409. API còn chấp nhận client cũ không có header, nên các client tích hợp khác phải tự gửi khóa để được bảo vệ chống trùng. Khóa và nội dung yêu cầu chỉ lưu dạng SHA-256; khi retry server cấp lại token tra cứu và không gửi lại email đặt hàng.

Chạy `npm run db:migrate` trước khi chạy source mới để áp dụng `004_checkout_idempotency.sql`. Local đã sao lưu tại `.local/audit-2026-10-21/database-before-cleanup.dump` và áp dụng migration này. Bootstrap admin chỉ cấp quyền cho tài khoản mới; danh tính có sẵn phải đã có vai trò tương ứng, không được tự nâng quyền từ CUSTOMER qua biến môi trường.

Rà soát mới nhất: [kiến trúc, các lỗi đã sửa, chức năng còn thiếu và kiểm chứng ngày 29/10/2026](docs/reviews/system-review-2026-10-29.md). API/tài khoản demo và script capture đã được gỡ hoàn toàn. Artifact trình bày tạm ở root được lưu trong `.local/maintenance-2026-10-29/archived/` với checksum tại manifest dọn dẹp; bộ test tự động được giữ.
