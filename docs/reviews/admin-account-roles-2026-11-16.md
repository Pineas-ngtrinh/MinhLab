# Phân quyền tài khoản trực tiếp trong quản trị

Mã tác vụ: ADMIN-ROLES-2026-11-16. Phạm vi: source và kiểm tra local; chưa đổi quyền tài khoản thật hoặc deploy VPS.

## Cách sử dụng

ADMIN mở **Tài khoản & phân quyền** tại `/admin/nhan-su`, tìm theo tên/email, chọn **Đổi quyền**, chọn vai trò, nhập lý do và xác nhận. Sáu vai trò hiện có: CUSTOMER, STAFF, WORKSHOP_OPERATOR, FILE_REVIEWER, PRINT_OPERATOR và ADMIN. Tài khoản phải đăng ký trước.

Màn hình mới đặt một vai trò nhân sự chính và giữ CUSTOMER làm nền; quyền nhân sự cũ bị thay thế. Chọn CUSTOMER để thu hồi mọi quyền nhân sự. Dữ liệu nhiều vai trò cũ vẫn được đọc theo ROLE_PRIORITY; màn hình hiển thị vai trò có hiệu lực và gửi toàn bộ assignment cũ để phát hiện thay đổi đồng thời.

Người đang thao tác không tự sửa quyền của mình. Có thể cấp ADMIN cho một tài khoản khác đang hoạt động/đã xác minh theo cấu hình rồi để ADMIN đó xử lý tài khoản cũ. Tài khoản khóa/chưa xác minh vẫn có thể bị thu hồi về CUSTOMER, nhưng không nhận quyền nhân sự mới.

## Cơ chế kiểm quyền

- GET/PATCH `/api/admin/team/accounts` yêu cầu ADMIN qua session DB; không tin actor/role tự khai trong body. GET phân trang tối đa 100, mặc định 25, tìm kiếm literal tối đa 100 ký tự và không trả hash/token/mật khẩu.
- Use case kiểm ADMIN lần nữa trong transaction, đọc trạng thái tài khoản/vai trò hiện hành. Khóa advisory chung cho toàn bộ API quản trị vai trò, kể cả API workshop-operators cũ, trước khi khóa user rows.
- `expectedRoles` phát hiện bản sửa cũ và trả 409. Request lặp khi role đã đúng trả unchanged, không ghi audit hai lần. Quyền ADMIN cuối đang hoạt động được bảo vệ; không cho self-edit.
- Xóa assignment cũ, thêm CUSTOMER/vai trò mới và ghi actor, lý do, roles trước/sau trong cùng transaction. Lỗi ghi audit rollback cả thay đổi quyền. Vai trò tạm ngừng không được cấp.
- Không đổi cookie hoặc cơ chế login. Auth repository đã đọc DB mỗi request, nên phiên hiện có nhận quyền mới ở request tiếp theo; giao diện ở tab cũ có thể cần tải lại. Không có cơ chế hủy mọi request đang chạy trước thời điểm thay đổi.
- Giữ API `workshop-operators` để tương thích, thêm kiểm actor DB và chặn tự sửa; UI cũ được thay bằng manager toàn bộ tài khoản.

## Tệp thay đổi

- `src/contracts/team.ts`: DTO account/role assignment có snapshot roles.
- `src/services/auth/team-management.service.ts`: quản lý vai trò, actor recheck và policy.
- `src/repositories/auth/team-management.repository.ts`: truy vấn phân trang, lock/read roles, thay assignment và audit.
- `src/server/team-management.ts`: transaction/khóa chung.
- `app/api/admin/team/accounts/route.ts`: GET/PATCH có authorization và validation.
- `src/components/admin/team/TeamAccountsManager.tsx`: danh sách, tìm kiếm, phân trang, modal xác nhận và trạng thái lỗi/loading; thay `TeamOperatorsManager.tsx`.
- `app/admin/nhan-su/page.tsx`, `src/components/admin/AdminWorkspace.tsx`: điểm vào và nhãn điều hướng.
- Unit/service/repository/SSR tests trong `src/services/auth/test/team-management.service.test.ts`, `src/repositories/auth/test/team-management.repository.test.ts`, `scripts/tests/test-team-roles-ui.test.cjs`.
- `scripts/lib/test-team-roles.cjs`, `scripts/tests/test-production.cjs`: các ca API/DB integration mới.
- `package.json`: nối các kiểm thử mới vào `test:auth`; `docs/DECISIONS.md`, mục lục và báo cáo này.

Không thêm thư viện hoặc migration. Runtime cần SELECT/INSERT roles, INSERT/DELETE user_roles và INSERT audit_logs; quyền DELETE user_roles đã có ở migration 023 và script grants hiện hành. Không chỉnh schema/migration đã áp dụng.

## Kiểm tra và giới hạn

| Kiểm tra | Kết quả |
| --- | --- |
| `MINHLAB_ENV_FROM_PROCESS=true npm run check` | Đạt TypeScript, ESLint, architecture guard 280 file / 0 vi phạm |
| `MINHLAB_ENV_FROM_PROCESS=true npm run test:auth` | 43/43 đạt, gồm auth hiện có, policy phân quyền, mapping role inactive/active và SSR modal |
| `npm run build` | Đạt trên bản sao source không chứa dotenv cá nhân ở `/private/tmp/minhlab-roles-release`, site URL fixture HTTPS |
| `node --check scripts/lib/test-team-roles.cjs` | Đạt cú pháp fixture integration |
| `git diff --check` | Không có lỗi whitespace ở tracked diff; kiểm file mới riêng |
| Browser guest guard | Mở `/admin/nhan-su` bằng browser chưa đăng nhập: quan sát redirect tới `/dang-nhap` |
| Browser ADMIN/viewport | Chưa có phiên ADMIN thử nghiệm trong browser; chưa nghiệm thu modal/tìm kiếm/keyboard ở 375/768/1024/1440 px. Không dùng tài khoản thật hoặc đoán credential |
| `npm run test:production` | Đã thử với URL/cụm disposable tường minh, bị chặn `connect EPERM 127.0.0.1:55439` trước tạo DB. Chưa chạy được các ca DB/API mới |

Fixture integration đã thêm các ca: ma trận 401/403 và self-edit; search/pagination/không lộ auth record; chuyển đủ sáu vai trò và hiệu lực cookie cũ; stale edit/locked revoke; rollback audit; hai ADMIN thao tác thu hồi lẫn nhau đồng thời. Đây là test đã viết, chưa phải kết quả đạt trên PostgreSQL.

Log được giữ tại `.local/admin-account-roles/`. Bước cần tiếp tục là chạy integration trên PostgreSQL disposable, kiểm UI bằng tài khoản staging và xác minh quyền runtime 023 trước phát hành. Build/unit không thay thế các bước đó.

## Bàn giao Codex → ChatGPT

Mã tác vụ: ADMIN-ROLES-2026-11-16.

Mục tiêu: Chỉ ADMIN phân quyền cho các tài khoản khác trực tiếp trong trang quản trị.

Tệp đã sửa: Theo danh sách phía trên; giữ thay đổi có sẵn trong worktree.

Tóm tắt triển khai: Manager sáu vai trò, tìm kiếm/phân trang, xác nhận/lý do; API/use case/repository kiểm ADMIN, chống self-edit/stale race và ghi lịch sử atomic.

Kiểm tra đã chạy và kết quả: Check + 43 auth tests + Next build đạt; guest redirect quan sát được; DB integration bị chặn EPERM và browser ADMIN còn chưa nghiệm thu.

Ảnh hưởng kiến trúc: Tái sử dụng auth/session/roles hiện hành; giữ DTO/use case/repository/composition; không đổi schema/dependency.

Ảnh hưởng OOAD: Không áp dụng thay đổi schema/sơ đồ trong tác vụ này; cập nhật quyết định nghiệp vụ cho màn hình mới.

Rủi ro đã biết: SQL/transaction concurrent mới chưa chạy kiểm trên DB; tab cũ cần refresh để cập nhật menu dù quyền server đổi ở request tiếp theo.

Vấn đề còn lại: DB integration, QA ADMIN trên các viewport và smoke staging; không thay quyền tài khoản thật trong lượt này.

Trạng thái rà soát: **Cần xử lý tiếp — source sẵn để review, chưa đủ bằng chứng nghiệm thu DB/UI quản trị.**
