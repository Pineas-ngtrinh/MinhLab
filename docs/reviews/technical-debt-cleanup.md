> Cập nhật 03/11/2026: công cụ dựng/kiểm tra model đã chuyển vào `scripts/model-authoring/`, vẫn xuất tại root. Đã xóa `dist/` của Vite cũ, cache Python và metadata Finder. Rà import graph TypeScript từ app, proxy, test, worker và CLI chỉ phát hiện cặp ConsultantMascot chưa reachable; giữ lại theo vùng bảo vệ AGENTS.md. Không thay đổi kiến trúc runtime. Chi tiết tệp dọn tại `cleanup-manifest.json`. Các mô tả giữ script ở root bên dưới là lịch sử trước lần dọn này.

> Cập nhật 29/10/2026: auth/email đã tách module, repository nhóm theo chức năng, workspace route mỏng và demo/capture đã gỡ. Trạng thái hiện hành cùng phần còn thiếu tại [system-review-2026-10-29.md](system-review-2026-10-29.md). Phần bên dưới giữ lịch sử rà soát trước đó.

# Rà soát cấu trúc và clean code — 27/10/2026

## Kết quả hiện tại

MinhLab chạy theo modular monolith Next.js App Router + PostgreSQL. Luồng `orders` và `catalog` đã có contracts/domain/services/repositories/integrations/composition rõ ràng. `app/` giữ route và trang; `src/components/` chia theo tính năng; migration nằm trong `database/migrations/`; script vận hành nằm trong `scripts/`.

Đã chạy `npm run check`: TypeScript strict, ESLint và guard kiến trúc đều đạt; guard đọc 164 file và báo 0 vi phạm. `npm run test:unit` và `npm run build` cũng đạt. Kết quả này xác nhận các luật đã mã hóa, không có nghĩa mọi luồng cũ đã được tách hết.

DBML từng đặt ở root đã được chuyển vào [`docs/ooad/diagrams/designed/MinhLab_database.dbml`](../ooad/diagrams/designed/MinhLab_database.dbml). Logo nguồn đã chuyển vào `assets/brand/`; đây là tài nguyên gốc, không được frontend tham chiếu trực tiếp. Schema chạy thật lấy từ [`database/migrations/`](../../database/migrations). Các thư mục rỗng còn lại sau khi dọn component cũ đã được bỏ. `build_lab.py` và `inspect_render.py` được giữ ở root vì đường dẫn xuất model của chúng dựa trên vị trí này; chúng được ghi rõ trong README.

## Nợ kiến trúc còn lại

1. `src/services/auth.service.ts` và `account-token.service.ts` vẫn chứa SQL/transaction trực tiếp; `src/lib/auth-session.ts` còn gọi service. Tách chúng thành `services/auth/`, repository, ports và `server/auth.ts` khi làm milestone auth.
2. `src/services/email.service.ts` vừa dựng nội dung thư vừa ghi `email_outbox`. Chuyển việc dựng thông điệp sang use case và giữ ghi/gửi outbox trong `integrations/notifications/`.
3. `src/lib/` có các helper dùng chung cùng một số module server-only như DB/session. Giữ boundary server/client bằng import guard; khi chạm auth, chuyển session/DB wiring sang `src/server/` thay vì đổi tên thư mục hàng loạt.
4. `.agents/rules/project-standards.md` và skill cũ còn mô tả catalogue trong `SITE_CONFIG`, pnpm/Prisma và payOS, không khớp quyết định hiện tại trong `AGENTS.md`, `docs/DECISIONS.md` và README. Thư mục `.agents/` hiện chỉ được cấp quyền đọc trong workspace này; nội dung cũ chưa thể đồng bộ ở lượt rà soát này.

## Thứ tự hoàn thiện đề xuất

1. Tách auth/session/token qua repository và composition, giữ nguyên contract API; thêm kiểm thử luồng đăng ký, xác minh, đăng nhập, logout và reset mật khẩu.
2. Chuẩn hóa email thành adapter/outbox, bỏ import từ service legacy; kiểm tra retry và chống gửi trùng.
3. Mở rộng architecture guard để chặn SQL trong các service mới và module thuần, đồng thời giữ ngoại lệ legacy có danh sách và chủ sở hữu rõ.
4. Khi đã hoàn tất migration module, cập nhật lại OOAD/DBML và xác nhận các sơ đồ current chỉ mô tả chức năng thực sự được triển khai.
