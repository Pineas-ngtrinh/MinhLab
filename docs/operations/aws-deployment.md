# Sơ đồ triển khai AWS — MinhLab 3D

> Cập nhật 04/11/2026: chủ dự án đã chuyển sang **VPS, không sử dụng AWS**. Tài liệu bên dưới giữ làm phương án lịch sử, không dùng làm checklist triển khai hiện hành. Xem [quyết định mới](../DECISIONS.md) và [kế hoạch rà soát/yêu cầu VPS](../planning/pre-deployment-review-plan.md). Nhà cung cấp/gói/domain được chủ dự án để sau; chưa có hạ tầng VPS được triển khai bởi cập nhật này.

Ngày lập: 22/10/2026, cập nhật luồng thanh toán 27/10/2026. Trạng thái: **ĐỀ XUẤT**, chưa tạo tài nguyên hoặc nghiệm thu trên AWS. Thiết kế dựa trên [kiến trúc hiện tại](../architecture.md), [kế hoạch hệ thống](../planning/system-design-execution-plan.md) và [kế hoạch thanh toán QR cá nhân](../design/payment-integration-plan.md). EC2/RDS và lịch chạy job là phương án để xem xét, chưa phải quyết định hosting đã được chủ dự án chốt.

Nguồn sơ đồ hiện có: [Mermaid](../ooad/diagrams/aws-deployment.mmd). Các bản PNG, SVG và draw.io riêng từng được liên kết không có trong repository. Các tài liệu D36/D37 cũ giữ nguyên để tránh thay đổi bộ OOAD ngoài yêu cầu.

## Phương án cơ sở

| Thành phần | Nơi chạy / vai trò | Hiện trạng so với repo |
| --- | --- | --- |
| DNS và HTTPS | DNS hiện có hoặc Route 53 trỏ public IPv4 cố định; Caddy trên EC2 cấp/gia hạn TLS | Chưa cấu hình cloud/domain |
| Web và API | Một EC2 trong public subnet, Docker chạy Next.js 16; Caddy chuyển tiếp HTTP nội bộ | Có ứng dụng; chưa có Dockerfile/deployment |
| Worker và scheduler | Tiến trình riêng cùng EC2; đề xuất timer/cron của host, chống chạy chồng | Có `npm run mail:deliver` và `npm run telegram:deliver`; lịch tự động, expiry/promote còn cần triển khai |
| PostgreSQL | RDS PostgreSQL private, cùng VPC; Single-AZ cho pilot | Có pg/migration 001–005; chưa cấp RDS hoặc kiểm kết nối TLS |
| File STL | S3 riêng tư, `uploads/` cho file tạm, `orders/` cho file giữ theo đơn | M3: chưa có storage adapter/upload bền vững |
| Phân tích STL | Lambda ngoài VPC gọi cùng quote-core, callback HTTPS có HMAC | Có quote-core và browser worker; chưa có Lambda/callback |
| Phục hồi phân tích | SQS làm on-failure destination cho invocation Lambda lỗi hết lượt retry | M3: bổ sung cấu hình và quy trình redrive có kiểm quyền |
| Dịch vụ ngoài | Resend gửi email; Telegram Bot API báo xưởng; khách chuyển vào QR cá nhân | Worker đã có; cần cấu hình credentials và scheduler trên host |
| Vận hành | IAM roles, Systems Manager, CloudWatch logs/alarms, AWS Budgets | Cần cấu hình cloud và kiểm chứng |

Region đề xuất: **Singapore, `ap-southeast-1`**. Next.js tiếp tục là modular monolith; không tách các domain module thành microservice.

Ứng viên Amplify trong kế hoạch cũ cần đánh giá lại: tài liệu AWS Hosting compute hiện công bố Next.js 12–15, còn repo dùng 16.4.2. Vì vậy EC2/Docker là phương án cơ sở để tự quản runtime; đây là nhận định thiết kế từ đối chiếu tài liệu và package.json, không phải kết luận đã thử deploy Amplify. [Nguồn AWS](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html).

## Các luồng chính

1. **Website:** browser → HTTPS Caddy → Next.js → PostgreSQL bằng TLS. HTML, ảnh catalogue và GLB tĩnh đi cùng bản phát hành đầu; browser giữ WebGL và STL preview hiện có. Tên miền được DNS phân giải tới EC2, DNS không chuyển tiếp nội dung HTTP.
2. **Upload, M3:** API xác thực/giới hạn upload và lưu intent → cấp presigned POST → browser tải trực tiếp lên S3 → S3 ObjectCreated kích hoạt Lambda → Lambda đọc đúng object, kiểm file và gọi quote-core → callback HMAC qua HTTPS Caddy về API → API xác minh, ghi DB → browser hỏi trạng thái qua API. Kết quả client chỉ là tham khảo; giá đặt đơn được server tính và lưu snapshot.
3. **Thanh toán:** thợ duyệt giá → khách chấp thuận → server tạo QR theo tài khoản cá nhân đã cấu hình và snapshot tài khoản vào payment → khách chuyển khoản → nhân viên kiểm tra giao dịch trong ứng dụng ngân hàng → admin xác nhận trong transaction. QR và khai báo của khách không tự chứng minh tiền đã về.
4. **Công việc nền:** mail worker claim `email_outbox` và Telegram worker claim `telegram_outbox` sau commit; jobs còn thiếu cần lease/retry cho hạn và promote file. Job promote dùng quyền CopyObject tương ứng (`GetObject` nguồn + `PutObject` đích); chỉ mở bước in khi file đơn hàng sẵn sàng.
5. **Phân tích lỗi:** lỗi callback có thể retry phải làm invocation Lambda thất bại; lỗi file nghiệp vụ được callback thành trạng thái lỗi. Invocation hết lượt retry chuyển tới SQS, có alarm và quy trình redrive; callback trùng/cũ không ghi đè revision mới. Không hứa xử lý đúng một lần qua mạng. [S3 → Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html), [retry và failure destination](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html).

## Ranh giới mạng và dữ liệu

- **EC2:** public subnet có route tới Internet Gateway và public IPv4 cố định. Security group nhận 443; 80 chỉ phục vụ chuyển HTTPS/ACME nếu cấu hình cần. Cổng Next.js chỉ nội bộ, không mở 3000 hoặc SSH công khai; quản trị bằng Systems Manager. Outbound HTTPS phục vụ S3, Telegram, mail, log, quản trị và cập nhật. Đây là phương án một máy cho pilot, chưa có tính sẵn sàng cao.
- **RDS:** `PubliclyAccessible=false`; DB subnet group gồm private subnets ở hai AZ dù DB Single-AZ. Chỉ cho TCP 5432 từ security group EC2; kết nối xác minh CA và hostname RDS, không tắt kiểm chứng TLS. Role migration tách role runtime hiện có; backup tự động và diễn tập restore trước khi nhận đơn thật. Hai subnet không đồng nghĩa có DB standby. [Subnet group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html), [TLS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html).
- **Lambda:** ngoài VPC, không có credential/kết nối PostgreSQL; chỉ quyền đọc `uploads/`, callback và log. S3/Lambda cùng region; trigger chỉ prefix `uploads/`, suffix `.stl`, tránh copy sang `orders/` gây phân tích lặp. Mô hình này không cần NAT Gateway cho Lambda.
- **S3:** Block Public Access, mã hóa SSE-S3, chỉ HTTPS. POST policy buộc key, dung lượng và TTL 10 phút; CORS đúng origin/method, không cấp quyền public. Giới hạn cloud 50 MiB là đề xuất cần benchmark và thống nhất với UI đang 100 MiB. DB quản lý hạn logic 7 ngày; lifecycle 8 ngày chỉ là lưới an toàn cho vùng tạm. File đơn đã trả tiền phải được promote bền vững trước khi vùng tạm bị xóa; `orders/` có retention riêng cần chủ dự án chốt.
- **Danh tính:** EC2 instance role và Lambda execution role tách riêng, IAM giới hạn theo prefix/hành vi; không phát AWS credentials cho browser. Bí mật DB, Telegram và HMAC chỉ phía server, lưu qua kho bí mật có IAM giới hạn và đưa vào runtime khi triển khai; không đưa giá trị vào image, Git, log hoặc `NEXT_PUBLIC_*`. [EC2 IAM roles](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html).
- **Callback:** chỉ callback HMAC của Lambda được dự kiến public. `proxy.ts` và Caddy cần ngoại lệ Origin đúng route này; không bỏ kiểm Origin toàn bộ API. Callback chưa phải endpoint hoạt động.

## Thứ tự triển khai

| Bước | Công việc | Bằng chứng cần đạt |
| --- | --- | --- |
| 1 — Chốt cấu hình | Xác nhận EC2/RDS hay phương án tiết kiệm, domain, ngân sách, vùng, retention và scheduler | Ước tính chi phí theo tài khoản; chưa apply |
| 2 — Staging hiện trạng | Đóng Docker, EC2/Caddy, RDS private, migration, DNS/TLS, Resend và lịch mail worker | Check/build xanh; health + catalogue/auth/checkout; dữ liệu còn sau restart; mail nhận thật; restore DB thử thành công |
| 3 — M3/M4 | S3/IAM/presigned POST, Lambda/HMAC/failure recovery, request/revision và duyệt báo giá | Local test rồi staging upload → analysis → duyệt; chống giả/trùng/cũ; file private đúng quyền |
| 4 — M5/M6 | QR cá nhân, xác nhận thủ công, Telegram outbox và job retention/promote | Test lỗi/đồng thời/khôi phục; nghiệm thu chuyển khoản thật riêng; alarm và redrive chạy được |
| 5 — Phát hành | Release theo commit/image bất biến, backup trước migration, health và smoke test sau deploy | Rollback ứng dụng còn tương thích schema; đối soát tiền sau restore; chủ tài khoản quyết định mở nhận đơn |

CI hiện chỉ kiểm chất lượng, chưa có CD. Nhánh triển khai tương lai: CI → image gắn commit → lưu registry → phiên triển khai có quyền hạn chế trên EC2 → migrate bằng role riêng → khởi động web/worker → health/smoke test. Chưa thêm workflow hoặc tạo registry trong tác vụ này.

Không đưa CloudFront, ALB, ECS hoặc NAT Gateway vào phương án pilot này. Sau pilot mới đánh giá nhiều EC2/ALB và RDS Multi-AZ nếu có yêu cầu uptime và ngân sách tương ứng. Single EC2/Single-AZ có thời gian gián đoạn khi máy hoặc AZ lỗi.

## Ngân sách và đầu vào còn cần chốt

Chưa xác nhận phương án RDS đáp ứng mục tiêu dưới 150.000 VND/tháng trong playbook. Cần tính EC2 + EBS + RDS/storage/backup + public IPv4 + S3/request/egress + Lambda + SQS + CloudWatch + kho bí mật + domain/DNS và thuế; điều kiện credits/Free Tier phụ thuộc tài khoản, không coi là miễn phí mặc định. AWS Budgets chỉ cảnh báo, không thay giới hạn truy cập hoặc cam kết tự ngắt tài nguyên.

Nếu vượt ngân sách, có thể trình phương án pilot PostgreSQL trên EC2 và backup ngoài máy; đây là phương án khác cần phê duyệt về khả năng khôi phục, không phải thay đổi đã chốt. Cần chủ dự án xác nhận host/DB, domain, giới hạn chi tiêu, lịch job, retention file/PII và credentials vận hành trước khi tạo tài nguyên thật.

Trong tác vụ lập sơ đồ này chỉ tạo tài liệu, không thêm dependency, không chạy Terraform, không triển khai AWS hoặc thanh toán thật.
