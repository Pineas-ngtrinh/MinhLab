# Staging Ubuntu với web và PostgreSQL trong hai container

Ngày 15/11/2026. Cấu hình đã được chuẩn bị trong source; chưa có triển khai trên VPS. Xem [thiết kế nghiệp vụ](../design/custom-print-lifecycle-and-retention.md) và [báo cáo triển khai](../reviews/custom-print-retention-2026-11-15.md).

## 1. Tải bản source

Trên máy phát triển, chạy `npm run deploy:package`. Gói `.local/releases/minhlab-<thời điểm>.tar.gz` có manifest SHA-256 của từng file và checksum của archive. Không chứa credential, `.local`, database cá nhân, node_modules hoặc dataset huấn luyện. Gói gồm working tree hiện tại, vì vậy có cả thay đổi chưa commit; packaging không thay thế các cổng kiểm tra.

Bạn tự thay `user@VPS` bằng kết nối Ubuntu của mình; không cần cung cấp IP/mật khẩu cho agent:

```bash
scp .local/releases/minhlab-<thời-điểm>.tar.gz user@VPS:/srv/minhlab/
ssh user@VPS
mkdir -p /srv/minhlab/current
tar -xzf /srv/minhlab/minhlab-<thời-điểm>.tar.gz -C /srv/minhlab/current
cd /srv/minhlab/current
```

Thư mục đích phải là release mới, không giải nén đè release đang chạy. `/srv/minhlab/current` ở ví dụ là vị trí host timer sẽ dùng; khi chuyển release, giữ project name Compose và các named volume, đổi liên kết current sau khi kiểm tra. Không dùng `docker compose down -v` để cập nhật vì lệnh đó xóa volume.

## 2. Chuẩn bị host và cấu hình

Host cần Docker Engine, Compose v2, Nginx/Caddy với HTTPS, `flock`, `openssl`, `age` cho backup, dung lượng cho DB/file/backup và người nhận cảnh báo. Cài Docker theo [hướng dẫn Ubuntu chính thức](https://docs.docker.com/engine/install/ubuntu/). Dùng Nginx mẫu ở `deploy/nginx.conf.example`, thay domain/chứng chỉ, đặt allowlist hoặc access gateway cho staging. Template chưa có chứng chỉ hoặc giới hạn truy cập của host cụ thể.

```bash
cp deploy/.env.compose.example deploy/.env.compose
cp deploy/.env.runtime.example deploy/.env.runtime
chmod 600 deploy/.env.compose deploy/.env.runtime
openssl rand -hex 32
openssl rand -hex 32
```

Điền hai chuỗi hex khác nhau vào `MINHLAB_DB_OWNER_PASSWORD` và `MINHLAB_DB_APP_PASSWORD` của `deploy/.env.compose`; đặt `NEXT_PUBLIC_SITE_URL` bằng domain HTTPS staging. Dùng trình soạn thảo trên VPS, không dán credential vào chat hoặc lệnh có ghi mật khẩu trực tiếp vào shell history. File runtime giữ credential mail/Cloudinary/Telegram/VietQR và bootstrap admin theo runbook. Ban đầu private upload, thanh toán và AI đều tắt theo template.

Compose chỉ mở web tại `127.0.0.1:3000`; DB không publish port. Web có mạng outbound cho provider, DB ở mạng nội bộ. Bốn volume: database, private-files, purge-journal và signature ClamAV. Đây vẫn là hai container thường trực; lệnh maintenance có thể tạo container web chạy một lượt rồi tự xóa.

Cập nhật 16/11: image DB là `postgres:18-bookworm` để nhận bản sao từ PostgreSQL 18 trên Mac; volume mount tại `/var/lib/postgresql` theo [image chính thức](https://hub.docker.com/_/postgres). Đây là cấu hình cài mới. Nếu đã có volume PostgreSQL 16 thì giữ nguyên volume đó, sao lưu và phục hồi vào volume 18 mới; đổi tag/mount không tự nâng cấp database cũ. Archive source tạo trước cập nhật này vẫn chứa cấu hình 16, cần chuyển `compose.yaml` mới trước khi khởi động DB.

## 3. Build, migration và quyền runtime

```bash
docker compose --env-file deploy/.env.compose -f compose.yaml config --quiet
docker compose --env-file deploy/.env.compose -f compose.yaml build web
docker compose --env-file deploy/.env.compose -f compose.yaml up -d db
docker compose --env-file deploy/.env.compose -f compose.yaml -f deploy/compose.migrate.yaml run --rm -T web npm run db:migrate
docker compose --env-file deploy/.env.compose -f compose.yaml -f deploy/compose.migrate.yaml run --rm -T web npm run db:grant-runtime
docker compose --env-file deploy/.env.compose -f compose.yaml up -d web
docker compose --env-file deploy/.env.compose -f compose.yaml exec -T web npm run production:check
curl --fail http://127.0.0.1:3000/api/health
```

`deploy/postgres-init.sh` tạo `minhlab_app` chỉ khi volume DB mới hoàn toàn; app không dùng tài khoản owner. `db:grant-runtime` cấp đúng quyền sau migration và không xoay mật khẩu. Chỉ dùng file override `compose.migrate.yaml` với `run --rm`, không dùng với `up`; web thường trực không có URL owner.

Database cài mới chưa có catalogue được duyệt, nên `production:check` có thể fail các điều kiện kinh doanh/provider chưa cấu hình. Chỉ dùng `db:seed` một lần với DB staging mới đã chọn rõ, qua cùng maintenance override; không seed hoặc duyệt hàng loạt vào DB bán hàng. Khi nâng cấp database đã có dữ liệu, backup trước và giữ nguyên volume/credential. Migration mới `024` giữ mọi asset cũ ở `LEGACY`, không tự đưa chúng vào lịch xóa.

Chạy test integration trên cụm PostgreSQL **khác** chỉ dành cho test, không chạy `test:production` trên hai container staging chứa dữ liệu cần giữ. Test yêu cầu hai URL loopback và cờ disposable; CI đã có PostgreSQL service riêng.

## 4. Bật nhận file và lịch worker

```bash
bash deploy/worker.sh signatures
docker compose --env-file deploy/.env.compose -f compose.yaml exec -T web clamscan --version
```

Kiểm thực tế chữ ký và quét fixture được phép trước khi bật `MINHLAB_PRIVATE_FILES_ENABLED=true` trong runtime; `--version` riêng không chứng minh scan thành công. Root/scanner do Compose gán; giới hạn mẫu là 50 MiB và quota 200 MiB mỗi tài khoản, có thể điều chỉnh theo tài nguyên/nhu cầu xưởng. OBJ/STEP chỉ bật rõ sau khi nghiệm thu kiểm thủ công; G-code/3MF không mở upload công khai.

```bash
docker compose --env-file deploy/.env.compose -f compose.yaml up -d --force-recreate web
sudo cp deploy/systemd/minhlab-worker@.service deploy/systemd/minhlab-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now minhlab-files.timer minhlab-signatures.timer
bash deploy/worker.sh preview
```

`files:expire-requests` đóng quote hết hạn chưa chuyển đơn, `files:process` quét/phân tích. File preview không upload. Cleanup dry-run không thay DB/file; apply tính lại toàn bộ tham chiếu, giữ đơn đang làm, hoàn hàng/hold và loại trừ biên lai/legacy. Mỗi lượt xét tối đa 1.000 asset theo vòng và claim tối đa 100; theo dõi backlog nếu tải vượt nhịp một giờ.

Sau khi test đúng các mốc 48 giờ/7 ngày và thử đồng thời/retry trên staging:

```bash
touch deploy/.cleanup-enabled
sudo systemctl enable --now minhlab-cleanup.timer
```

Nhật ký purge nằm trên volume riêng, ghi/fsync trước unlink. Không đưa volume nhật ký vào rollback với backup DB cũ; sao chép nhật ký ra ngoài host và kiểm được tính đầy đủ. Lỗi unlink giữ tombstone, quota chưa được giải phóng, backoff 5 phút và tối đa 5 lượt. Sau khi xử lý nguyên nhân, người vận hành có thể chạy `npm run files:cleanup -- --apply --retry-failed` trong web để thử lại các tombstone thất bại; không tự khôi phục file đã claim để nhận đơn mới.

Timer dùng chung `/var/lock/minhlab-maintenance.lock` và không chạy chồng. Chỉ bật `minhlab-notifications.timer` sau khi đã chọn inbox/chat test và cho phép gửi thật. Timer `files` và `signatures` không gửi thông báo provider; expiry chỉ ghi outbox. Kiểm tra `systemctl list-timers 'minhlab-*'` và `journalctl -u 'minhlab-worker@*'`; cấu hình giám sát thất bại/backlog và người nhận trên host.

## 5. Backup và restore

`deploy/backup.sh` dừng web dưới cùng maintenance lock, dump DB và archive private-files cùng mốc, mã hóa bằng public recipient của age ngoài release rồi khởi động lại web nếu trước đó web đang chạy. Chỉ chạy backup khi toàn bộ writer đi qua web/timer dùng chung lock, không còn người chạy worker SQL/CLI bên ngoài. Ví dụ, dùng đường dẫn riêng trên host:

```bash
MINHLAB_BACKUP_DIR=/srv/minhlab-backups MINHLAB_BACKUP_RECIPIENTS_FILE=/srv/minhlab-secrets/backup-recipients.txt bash deploy/backup.sh
```

Tạo identity giải mã tại nơi phục hồi tin cậy, giữ riêng ngoài VPS; chỉ đặt public recipient trên VPS. Đọc [hướng dẫn age](https://github.com/FiloSottile/age) và giữ bản backup mã hóa ngoài VPS. Script chưa tự copy sang nhà cung cấp ngoài host hoặc tự xóa backup; nơi nhận, hạn lưu backup và hạn lưu biên lai cần được chủ dự án chốt trước nhận file thật. Không mặc định backup hết hạn theo live retention 48 giờ/7 ngày.

Restore vào DB/volume **mới**, giữ traffic/web/timer tắt: giải mã archive, `pg_restore` vào DB mới, phục hồi private-files tương ứng, chạy migration và grants, gắn volume purge-journal hiện hành. Chạy lệnh đối chiếu trong container web maintenance, vẫn không mở traffic:

```bash
docker compose --env-file deploy/.env.compose -f compose.yaml run --rm --no-deps -T web npm run files:reconcile-purges -- --offline
docker compose --env-file deploy/.env.compose -f compose.yaml run --rm --no-deps -T web npm run files:cleanup
```

Chỉ mở traffic sau khi đối chiếu purge journal, dọn lại các file đến hạn, kiểm DB/file snapshot và đối soát giao dịch phát sinh sau backup. `--offline` là điều kiện người vận hành phải bảo đảm, không tự dừng host thay họ. Journal hỏng/thiếu phải xử lý trước khi mở file; không xóa volume nhật ký để vượt lỗi.

## 6. Nghiệm thu trước mở sử dụng

Chạy luồng từ preview → gửi file → scan → kỹ thuật → báo giá → chấp thuận → VietQR → chế tác/QC → giao/hoàn tất. Kiểm source của đơn đang làm không bị dọn, file completed chưa đủ 7 ngày còn nguyên; closed request đủ 48 giờ được purge. Kiểm hold, hoàn hàng, nhiều tham chiếu, dữ liệu legacy, crash/retry/ENOENT, RBAC và download khi purge. Dùng tài khoản, file, tiền và nơi nhận test đã chọn; đối soát ngân hàng vẫn thủ công.

Đọc [đặc tả nghiệm thu](../design/custom-print-lifecycle-and-retention.md#10-tiêu-chí-nghiệm-thu-khi-hiện-thực). Upload, scanner thật, HTTPS, provider thật, backup/restore, rollback và hiệu năng tải đích chưa được chứng minh chỉ bằng build hoặc Compose config.

Nguồn cấu hình Compose: [services](https://docs.docker.com/reference/compose-file/services/), [volume bền vững](https://docs.docker.com/guides/databases/). Hướng dẫn Next.js đã đối chiếu bản cài trong `node_modules/next/dist/docs/01-app/`.
