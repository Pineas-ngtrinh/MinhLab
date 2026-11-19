# PostgreSQL local

PostgreSQL chạy độc lập với Next.js trên `127.0.0.1:5433`. Project kết nối qua
`DATABASE_URL` trong `.env.local`; thư mục dữ liệu database nằm ở `.local/postgres`
và đã được Git bỏ qua.

## Chạy mà không cần chuyển thư mục

```bash
npm --prefix /Users/nguyenphucphu/Downloads/minhlab-3d run db:start
npm --prefix /Users/nguyenphucphu/Downloads/minhlab-3d run dev
```

Tắt hoặc xem trạng thái database:

```bash
npm --prefix /Users/nguyenphucphu/Downloads/minhlab-3d run db:status
npm --prefix /Users/nguyenphucphu/Downloads/minhlab-3d run db:stop
```

`db:start` khởi tạo PostgreSQL local khi cần, tạo database `minhlab`, áp dụng
`migrations/001_init.sql` nếu schema chưa có, rồi thêm chuỗi kết nối vào
`.env.local` nếu chưa được cấu hình. Server chỉ lắng nghe trên loopback máy này.
Mỗi lần chạy, script cũng áp dụng các migration gia tăng an toàn như
`migrations/002_order_tracking_tokens.sql`.

## Kết nối từ ứng dụng

Ứng dụng dùng `pg` qua `src/lib/db.ts`. Tài khoản, vai trò, đăng ký, đơn hàng,
chi tiết đơn, thanh toán và lịch sử trạng thái được lưu trong PostgreSQL.
`db:start` đồng bộ danh mục và các sản phẩm thật đang có trong
`src/config/site.config.ts` sang cơ sở dữ liệu; lệnh `npm run db:seed` có thể
chạy lại an toàn và không thêm sản phẩm mẫu. Bản ghi sản phẩm khởi tạo ở trạng thái `DRAFT` và
`NEEDS_REVIEW` để nhân sự có thể rà soát trong database trước khi xuất bản.

## Truy vấn database

```bash
/opt/homebrew/opt/postgresql@18/bin/psql -h 127.0.0.1 -p 5433 -U minhlab_dev -d minhlab
```

Ví dụ trong `psql`:

```sql
\dt
SELECT email, full_name, status FROM users ORDER BY created_at;
SELECT order_number, order_status, grand_total FROM orders ORDER BY created_at DESC;
SELECT product_code, name, publication_status, compliance_status FROM products ORDER BY product_code;
```

Kết nối local dùng role `minhlab_dev` qua trust authentication trên loopback;
không dùng cấu hình này cho máy chủ production. Đổi URL trong `.env.local` khi
kết nối sang PostgreSQL khác.
