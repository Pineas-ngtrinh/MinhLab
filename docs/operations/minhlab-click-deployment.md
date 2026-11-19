# Triển khai thử tại minhlab.click

Thông tin chủ dự án cung cấp ngày 16/11/2026: VPS BumbooHost `103.74.101.82`, Ubuntu **24.04.3 LTS**, user sudo `minhlabadmin`, SSH bằng key ở cổng `2222`, DNS quản lý tại Tenten. Đây là hướng dẫn và cấu hình chuẩn bị trong source, chưa phải bằng chứng triển khai thành công trên VPS.

Địa chỉ chính: `https://minhlab.click`. `www.minhlab.click` chuyển về địa chỉ chính. Nginx chạy trên host, chuyển tiếp tới web tại `127.0.0.1:3000`; PostgreSQL nằm trong mạng Docker nội bộ. Giữ cổng SSH `2222` trong UFW.

Chủ dự án đã chọn **chuyển dữ liệu hiện tại từ Mac**. `.local/postgres/PG_VERSION` là 18, công cụ Homebrew là 18.6. `compose.yaml` hiện dùng `postgres:18-bookworm` và mount `/var/lib/postgresql`. Archive `minhlab-2026-11-16T07-10-56-179Z.tar.gz` đã gửi trước quyết định này còn dùng 16: chuyển riêng `compose.yaml` mới từ Mac lên VPS trước khi khởi động DB; không cần build lại web chỉ vì thay image DB.

## 1. DNS tại Tenten

Vào quản lý DNS của `minhlab.click`, sửa/thêm riêng từng bản ghi:

| Host | Loại | Giá trị |
| --- | --- | --- |
| `@` | A | `103.74.101.82` |
| `www` | CNAME | `minhlab.click` |

TTL dùng mặc định. Nếu đã có A/AAAA/CNAME cho cùng host, kiểm tra và thay bản ghi web cũ để tránh trỏ lẫn máy khác. Chưa cấu hình IPv6 của VPS thì không tạo AAAA; AAAA cũ trỏ sai cần bỏ. Giữ bản ghi MX/TXT đang dùng cho email/xác minh. Không dùng chức năng tự động “Cấu hình theo IP” vì Tenten cho biết thao tác này xóa các bản ghi cũ. Tham khảo [hướng dẫn Tenten](https://help.tenten.vn/huong-dan-cau-hinh-dns-tai-tenten/).

Trên **Mac**, kiểm tra sau khi lưu:

```bash
dig +short minhlab.click A
dig +short www.minhlab.click A
dig +short minhlab.click AAAA
dig +short www.minhlab.click AAAA
```

Hai truy vấn A phải dẫn tới `103.74.101.82` (truy vấn www có thể in thêm tên CNAME). Hai truy vấn AAAA để trống nếu chưa dùng IPv6. Chưa đúng thì chờ/kiểm tra DNS trước khi xin chứng chỉ.

## 2. Chuẩn bị VPS và chuyển source

Trên **Mac**, đăng nhập:

```bash
TERM=xterm-256color ssh -p 2222 -i ~/.ssh/minhlab_vps_ed25519 minhlabadmin@103.74.101.82
```

Trên **VPS**:

```bash
sudo apt update
sudo apt install -y nginx dnsutils nano
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo systemctl enable --now nginx
sudo ufw status verbose
sudo docker --version
sudo docker compose version
```

Nếu Docker/Compose chưa có, cài Engine và Compose plugin theo [hướng dẫn Docker cho Ubuntu](https://docs.docker.com/engine/install/ubuntu/), sau đó kiểm lại hai lệnh phiên bản. Không mở cổng `3000` hoặc `5432` ra Internet. Nếu BumbooHost có firewall riêng, cho phép TCP `80`, `443` và giữ `2222` tại đó.

Tạo thư mục lần triển khai đầu, trên **VPS**:

```bash
sudo install -d -o minhlabadmin -g minhlabadmin -m 750 /srv/minhlab
```

Trên **Mac**, ở thư mục dự án, chạy `npm run deploy:package`. Dùng đúng tên archive mới được lệnh in ra, thay phần `<thời-điểm>` dưới đây; không gửi file `.env` qua chat:

```bash
scp -P 2222 -i ~/.ssh/minhlab_vps_ed25519 .local/releases/minhlab-<thời-điểm>.tar.gz minhlabadmin@103.74.101.82:/srv/minhlab/minhlab-release.tar.gz
```

Trên **VPS**, chỉ tiếp tục nếu `/srv/minhlab/current` chưa chứa bản triển khai khác:

```bash
ls -la /srv/minhlab
mkdir -p /srv/minhlab/current
tar -xzf /srv/minhlab/minhlab-release.tar.gz -C /srv/minhlab/current
cd /srv/minhlab/current
cp deploy/.env.compose.example deploy/.env.compose
cp deploy/.env.runtime.example deploy/.env.runtime
chmod 600 deploy/.env.compose deploy/.env.runtime
openssl rand -hex 32
openssl rand -hex 32
nano deploy/.env.compose
```

Điền hai chuỗi hex khác nhau vào mật khẩu owner/app trong `.env.compose`, và đặt `NEXT_PUBLIC_SITE_URL=https://minhlab.click`. Không đổi mật khẩu bằng file env khi volume DB đã tồn tại: init chỉ chạy khi DB mới. Với lần cập nhật sau, backup và giữ volume; không giải nén đè release đang chạy, không chạy `docker compose down -v`.

```bash
nano deploy/.env.runtime
```

Điền bootstrap admin của chủ dự án, Resend, Cloudinary và Telegram trực tiếp tại VPS. Với DB mới, tài khoản/catalogue local không tự chuyển sang VPS; cần chọn nhập dữ liệu hoặc tạo mới. Bootstrap không nâng quyền một customer có sẵn. Telegram approver dùng UUID tài khoản trong **database VPS**, không mặc định dùng UUID local. Bật VietQR thủ công sau khi điền và kiểm thông tin tài khoản nhận tiền. Private upload và worker AI giữ tắt cho đến bước nghiệm thu riêng trong [runbook Docker](vps-docker.md).

## 3. Build và khởi động web

**Với lựa chọn chuyển DB từ Mac:** build web trước được, nhưng thay bước migration ngay sau `up -d db` bằng phục hồi backup vào DB trống; sau đó mới migration/grants. Không seed dữ liệu. Dừng thao tác ghi/worker local trong thời gian chốt bản sao và sao lưu cả private-files/purge-journal nếu đang có file bền vững. Chỉ backup SQL không chuyển các file riêng tư trên ổ đĩa; ảnh Cloudinary tiếp tục dùng liên kết đã lưu.

Bản dump custom cần tạo bằng `pg_dump` 18, lưu trong thư mục quyền 700 ngoài source công khai, file quyền 600. Trước khi restore, kiểm tra DB đích không có bảng ứng dụng. Restore bằng `pg_restore --no-owner --no-privileges --single-transaction --exit-on-error` với owner `minhlab_owner` vào DB `minhlab`; không dùng `--clean` để ghi đè DB đã có dữ liệu. Giữ backup trên Mac cho đến khi đối chiếu tài khoản/vai trò, số dòng và file trên VPS.

Giữ nguyên UUID tài khoản khi restore thì liên kết Telegram theo tài khoản website vẫn còn trong DB; phải kiểm tra role và trạng thái tại VPS. Outbox có thể chứa thông báo chưa gửi từ local: rà soát hàng pending/failed trước khi bật worker thông báo để tránh gửi lại thông báo cũ. Credential provider không nằm trong dump DB và cần cấu hình riêng trong `deploy/.env.runtime`.

Trên **VPS**, tại `/srv/minhlab/current`:

```bash
dc() { sudo docker compose --env-file deploy/.env.compose -f compose.yaml "$@"; }
dc config --quiet
dc build web
dc up -d db
```

**Chuyển dữ liệu từ Mac:** dừng ở đây để phục hồi bản dump vào DB trống và chuyển private-files/journal nếu có. Các lệnh tiếp theo chỉ chạy sau khi restore thành công. **Cài DB mới hoàn toàn:** có thể chạy tiếp ngay.

Nếu gộp lệnh qua `bash <<'EOF'`, Docker Compose `exec`/`run` mặc định giữ stdin và có thể đọc mất phần script còn lại. Với lệnh không nhận dữ liệu, thêm `</dev/null` hoặc tắt interactive theo [Docker exec](https://docs.docker.com/reference/cli/docker/compose/exec/). Riêng `pg_restore` truyền dump qua stdin thì chuyển hướng rõ `< /srv/minhlab/minhlab-local.dump`. Chạy script từ file cũng tách đầu vào script khỏi stdin của tiến trình con.

```bash
sudo docker compose --env-file deploy/.env.compose -f compose.yaml -f deploy/compose.migrate.yaml run --rm -T web npm run db:migrate
sudo docker compose --env-file deploy/.env.compose -f compose.yaml -f deploy/compose.migrate.yaml run --rm -T web npm run db:grant-runtime
dc up -d web
dc ps
curl --fail http://127.0.0.1:3000/api/health
```

Dừng tại lệnh lỗi để xử lý. VPS hiện khoảng 4 GiB RAM, chưa có swap: build có thể thiếu RAM; xem lỗi thực tế trước khi điều chỉnh tài nguyên. Override migration chỉ dùng với `run --rm`, không dùng với `up`. Không chạy integration test trên database có dữ liệu cần giữ; không seed/duyệt catalogue hàng loạt để vượt kiểm tra.

## 4. Nginx HTTP rồi chứng chỉ HTTPS

Chỉ cài **một** cấu hình MinhLab tại `sites-available/minhlab`; hai file HTTP và HTTPS thay thế nhau, không bật đồng thời.

Trên **VPS**:

```bash
sudo cp deploy/nginx-minhlab.click-http.conf /etc/nginx/sites-available/minhlab
sudo ln -sfn /etc/nginx/sites-available/minhlab /etc/nginx/sites-enabled/minhlab
sudo nginx -t
sudo systemctl reload nginx
curl --fail -H 'Host: minhlab.click' http://127.0.0.1/api/health
```

Chỉ reload nếu `nginx -t` thành công. Kiểm tra từ **Mac**:

```bash
curl --fail http://minhlab.click/api/health
curl --fail http://www.minhlab.click/api/health
```

HTTP chỉ phục vụ bootstrap/cấp chứng chỉ; đăng nhập và nghiệm thu sau khi HTTPS xong. Khi cả hai hostname trỏ đúng và HTTP truy cập được từ ngoài, trên **VPS**:

```bash
sudo apt install -y snapd
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx --cert-name minhlab.click -d minhlab.click -d www.minhlab.click
```

Nhập email quản trị và đọc/chấp thuận điều khoản trực tiếp trong terminal. Cách cài này theo [Ubuntu TLS](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/) và [Certbot cho Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap). Nếu Certbot lỗi thì xử lý lỗi, chưa chép cấu hình HTTPS có đường dẫn chứng chỉ.

Sau khi cấp chứng chỉ thành công:

```bash
sudo cp deploy/nginx-minhlab.click.conf /etc/nginx/sites-available/minhlab
sudo nginx -t
sudo systemctl reload nginx
sudo /snap/bin/certbot renew --dry-run
curl --fail https://minhlab.click/api/health
curl -I http://minhlab.click
curl -I https://www.minhlab.click
dc exec -T web npm run production:check
```

Phương án gói Ubuntu 24.04 khi chưa cài Certbot bằng snap: `sudo apt install -y certbot python3-certbot-nginx`, sau đó dùng `sudo certbot --nginx --redirect --cert-name minhlab.click -d minhlab.click -d www.minhlab.click`. Chọn một cách cài; với gói apt dùng `sudo certbot renew --dry-run` và `sudo systemctl enable --now certbot.timer`. Hai gói được liệt kê trong [kho Ubuntu Noble](https://packages.ubuntu.com/noble/certbot), plugin/cờ domain theo [hướng dẫn Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html#nginx).

HTTP và www cần chuyển về `https://minhlab.click`; health cần HTTP 200. `production:check` có thể báo thiếu cấu hình provider/catalogue trên DB mới: xử lý đúng mục được báo, không xem việc bỏ qua kiểm tra là nghiệm thu.

## 5. Nghiệm thu trên VPS

Kiểm đăng nhập, phân quyền, tạo category, sản phẩm, ảnh chính/ảnh góc Cloudinary, xuất bản, giỏ hàng, checkout VietQR, xác nhận thủ công, Telegram và hoàn hàng với dữ liệu test. Kiểm mail xác minh/quên mật khẩu dùng domain mới. Health 200 không chứng minh tất cả nghiệp vụ đã hoạt động.

Worker thông báo, scanner/file upload, backup/restore và lịch tác vụ làm tiếp theo [runbook Docker](vps-docker.md). Chỉ bật gửi thông báo thật khi đã chọn người nhận test; giữ cleanup apply tắt trong đợt test ban đầu. Không dùng DB này làm target của `test:production`.
