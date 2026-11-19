# Rà soát hệ thống MinhLab 3D — kiểm chứng 29/10, cập nhật 30/10/2026

Bản này đối chiếu mã chạy trong `app/`, `src/`, schema 001–008, worker, script vận hành và giao diện thật. Trạng thái được gọi là **đã chạy** chỉ khi có route/use case và kiểm chứng tương ứng; bảng schema, bản kế hoạch hay placeholder giao diện không tự chứng minh chức năng đã hoàn tất. Bộ kiểm tra dùng PostgreSQL tạm, fixture trình duyệt cô lập và không gửi email/Telegram thật.

## Phạm vi đã xử lý

| Lớp | Kết quả cụ thể | Điểm kiểm chứng |
| --- | --- | --- |
| Cấu trúc | `app/` là route mỏng; auth/orders/catalog có domain, use case, repository và composition. Repository catalogue/đơn hàng nằm trong thư mục theo chức năng; facade service/list cũ không còn caller được gỡ. | `npm run check`: 181 file trong graph, 0 vi phạm; type/lint đạt. |
| Auth/email | Đăng ký, đăng nhập, bootstrap admin, xác minh/reset/token/session tách khỏi SQL, crypto và outbox. DTO tài khoản chỉ lộ trường công khai; thời hạn session cookie và DB dùng cùng hằng 12 giờ. | 18 unit test auth + production API test token một lần, rollback, role hiện tại, thu hồi phiên. |
| Frontend | Route tài khoản/quản trị ghép controller + component theo nhiệm vụ. Trạng thái cọc/thanh toán một phần/hoàn tiền có nhãn dùng chung; lỗi đăng xuất và lỗi tải đơn độc lập. Variant button có trạng thái chọn cho screen reader; mục tiêu chạm được tăng lên 44px. | Browser ở 375/768/1024/1440px: không tràn khung trang, tabs/refresh/retry hoạt động. |
| In theo file | Kích thước STL lấy từ worker khi WebGL preview lỗi. Sao chép chỉ báo thành công sau khi browser xác nhận; trường hợp bị từ chối có hướng dẫn thử lại/chọn nội dung thủ công. | 5 unit test và browser QA tắt WebGL/Clipboard, vẫn tạo được tóm tắt. |
| Checkout | READY_PRODUCT mang tham chiếu print specification bị chặn ngay ở validation thay vì lỗi constraint DB/HTTP 500. Catalogue vẫn định giá ở server, giữ idempotency và quyền sở hữu. | Unit regression + production API chạy trên database tạm. |
| Thông báo | Telegram worker chuyển lease `PROCESSING` hết hạn ở lần thử thứ 5 thành `FAILED`, tránh kẹt vĩnh viễn và không gửi lần thứ 6 khi kết quả nhà cung cấp chưa rõ. | Unit test và kiểm thử lease trên database tạm. |
| Phát hành | Preflight chỉ đạt VietQR khi cờ bật và đủ thông tin ngân hàng hợp lệ, đồng bộ điều kiện checkout. | `npm run production:check` đọc cấu hình và schema local. |
| Dọn mã thử | API demo, tài khoản/mật khẩu demo, script capture Figma khỏi runtime; output `.build/` và NDJSON trung gian chuyển tới archive `.local/maintenance-2026-10-29/archived/`. | Demo routes/asset trả HTTP 404; checksum và đường khôi phục ở `docs/cleanup-manifest.json`. |

## Trạng thái hiện tại theo luồng

| Luồng | Hiện có | Ranh giới chưa hoàn tất |
| --- | --- | --- |
| Catalogue/cửa hàng | Catalogue PostgreSQL, duyệt/xuất bản, ảnh công khai theo rule, giỏ dùng UUID, checkout định giá server. | Chưa có UI tải ảnh mới/quản lý danh mục; sản phẩm production cần quyết định duyệt/xuất bản thật. |
| Tài khoản | CUSTOMER tự đăng ký, xác minh email nếu bật, reset mật khẩu, cookie HttpOnly, role DB hiện tại, giới hạn thử theo email/tác vụ. | Chưa có quản trị nhân sự/role và màn hình quản lý thiết bị/phiên. Giới hạn lạm dụng theo IP, chính sách dọn session/token/attempt hết hạn còn thiếu. |
| Đơn hàng | Owner/tracking token, idempotency, trạng thái/policy, lịch sử phân trang, admin đối soát, hàng đợi chế tác thủ công. | Chưa có production job/inspection riêng và dữ liệu tiến độ máy in thật. |
| Thanh toán | VietQR cá nhân, snapshot ngân hàng nhận, nhân viên xác nhận trên admin, thông báo qua outbox. | Chưa có xác nhận tiền tự động; lựa chọn đối soát thủ công là quyết định 27/10, không coi payOS là lỗi thiếu tính năng. Proof URL cũ chưa xác minh nội dung file lưu trữ. |
| In theo file | STL binary/ASCII trong worker, giá FDM tham khảo, 17 màu preview, bàn giao tóm tắt qua Zalo/email để thợ tư vấn. | **Chưa có** upload server/storage riêng, yêu cầu/phiên bản file bền vững, callback phân tích, duyệt báo giá và khách chấp thuận revision. Backend `CUSTOM_PRINT` chỉ đọc specification đã duyệt, chưa khóa đầy đủ snapshot file/cấu hình/revision/customer approval. OBJ/STEP chưa hỗ trợ. Do đó chưa phải luồng đặt in tự động đầu-cuối. |
| Vận hành | Migration có checksum, runtime role hạn quyền, CI với PostgreSQL tạm, worker email/Telegram có outbox. | Chưa thấy source Docker/Terraform/Lambda cho triển khai mục tiêu; thiếu lịch chạy worker, job hết hạn và chính sách retention. Provider email/Telegram thật chưa được nghiệm thu. |

## Việc còn lại theo mức ưu tiên

1. **P0 — Hoàn thiện chuỗi in theo file trước khi gọi là tự động:** upload riêng tư với xác thực/kích thước/hash, bản ghi request/file revision, phân tích có retry, thợ duyệt và sửa giá có lý do, khách chấp thuận đúng revision, snapshot bất biến khi đặt đơn. Thiết kế token khách và cleanup file cần đi cùng luồng này. Không tạo khoản thanh toán cho quote chưa được duyệt.
2. **P0 — Điều kiện phát hành:** cấu hình và thử mail/Telegram thật trong môi trường đích; HTTPS công khai; đảm bảo catalogue được chủ xưởng duyệt và xuất bản; chạy worker có giám sát. Preflight local hiện còn thiếu mail, Telegram, HTTPS và sản phẩm bán được; không tự đổi quyết định duyệt dữ liệu thật.
3. **P1 — Vận hành và dữ liệu:** định nghĩa production job/kiểm định/tồn kho, hạn và chính sách lưu/xóa dữ liệu cá nhân, lịch retry/expiry/redrive; xây dựng Docker/Terraform/Lambda theo kiến trúc được duyệt và môi trường triển khai đã chọn.
4. **P1 — Bảo vệ tài khoản và nội dung:** bổ sung chống lạm dụng theo IP cho auth/upload, giao diện cấp/thu hồi vai trò nhân sự, quy trình kiểm chứng proof chuyển khoản từ file riêng tư thay URL tự khai.
5. **P2 — Giao diện/hiệu năng:** tiếp tục tách `LabScrollytelling.tsx`/`LabCanvas.tsx` theo chức năng khi có visual goldens, giữ nguyên spline/GLB/loading boundary; tạm dừng render Hero/STL Canvas khi khuất màn hình; làm rõ khả năng cuộn ngang của bảng admin trên mobile. Chỉ mở rộng OBJ/STEP sau khi luồng STL bền vững và quy tắc xưởng được chốt.

Các đề mục P0/P1 là backlog chức năng còn thiếu, không phải phần đã triển khai trong lượt dọn mã này. Kế hoạch milestone chi tiết ở `docs/planning/system-design-execution-plan.md`, kiến trúc hiện hành ở `docs/architecture.md`. Dữ liệu thật như ngân hàng, giá, cấu hình máy và retention cần quyết định của chủ dự án trước triển khai.

## Bằng chứng kiểm chứng

- `npm run check`: TypeScript, ESLint và import graph đạt 181 file, 0 vi phạm.
- `npm run test:unit`: 94 Node tests đạt, 0 lỗi; 1 test lease PostgreSQL chỉ chạy trong `test:production`. `test:models` thêm 21 scene checks đạt.
- `npm run test:production`: 55 kiểm tra API/schema/quyền/transaction đạt, dùng DB local tạm và xóa sau chạy; có kiểm tra Telegram lease, không gửi nhà cung cấp thật. Kết quả ở `docs/ooad/test-results.json`.
- `npm run build`: exit 0, 37 route static/dynamic được build, không còn demo route trong danh sách.
- Browser QA: 23 kịch bản, 0 page error; account/admin ở 4 viewport, public pages ở 375px, tracking label, retry/logout, WebGL/clipboard lỗi, HTTP health 200 và demo/capture 404. Fixture/screenshot local trong `.local/system-cleanup-2026-10-29/`.
- `npm audit --omit=dev`: 0 lỗ hổng được báo cho 95 production dependencies tại thời điểm kiểm tra. Đây là kết quả registry, không thay thế rà soát bảo mật vận hành.
- `npm run production:check`: thất bại đúng các cổng mail, Telegram, HTTPS và catalogue được duyệt/xuất bản; migration, runtime DB role, Node/Next và VietQR local đạt. Không xem đây là bản phát hành production đã sẵn sàng.

Working tree ban đầu đã có nhiều thay đổi chưa commit từ các lượt trước. Lượt này không gom hoặc commit chung lịch sử đó; các file demo/output được lưu trong archive local có manifest để khôi phục khi cần.
