# Triển khai vòng đời và retention in theo file

Mã tác vụ: CP-LIFECYCLE-2026-11-15. Báo cáo source, không phải nghiệm thu VPS. Phần thiết kế được chốt ngày 15/11; xem [đặc tả](../design/custom-print-lifecycle-and-retention.md).

## Kết quả trong source

- Preview STL vẫn ở trình duyệt, chỉ nút gửi yêu cầu mới upload. File nguồn mới được phân loại PRINT_SOURCE, giữ tên gốc hợp lệ trong metadata, dùng UUID key riêng để lưu bytes; tên gốc không được dùng làm path.
- Policy thuần tính deadline từ mọi phiếu/revision/đơn liên quan: upload bỏ dở 48 giờ, phiếu đóng không thành đơn thêm 48 giờ, đơn hoàn tất thêm 7 ngày. File ở phiếu/đơn còn hoạt động được giữ; lấy hạn muộn nhất khi dùng nhiều nơi.
- Phân biệt CLOSED do chuyển đơn với đóng yêu cầu. Thêm CLOSE, REOPEN, HOLD và RELEASE_HOLD qua use case có role/owner/revision/idempotency; reopen không phục hồi quote cũ hoặc file đã claim/purge. Từ chối kỹ thuật có mốc đóng; worker đóng quote hết hạn chưa chuyển đơn và ghi outbox thông báo.
- Hold thủ công có lý do, người tạo/kết thúc, ngày rà soát; không tự gỡ khi quá hạn. Return chưa xử lý, khai báo tiền chưa đối soát và job/giữ máy chưa kết thúc chặn xóa. Kết thúc hold/return cộng 7 ngày từ mốc giải quyết, không xóa ngay theo deadline cũ.
- LEGACY, PAYMENT_PROOF và QC_EVIDENCE không vào cleanup model. Migrations cũ giữ nguyên; migration mới 024 không tự backfill loại file hoặc rút ngắn thời hạn dữ liệu cũ. Biên lai mới được gán loại riêng và không dùng deadline của model.
- Cleanup giữ dry-run mặc định, mỗi lượt xét tối đa 1.000 model theo vòng, claim tối đa 100. Apply có tombstone/token/lease, tối đa 5 lần thử, backoff 5 phút, audit và nhật ký purge fsync trước unlink; chỉ đánh dấu `purged_at` khi xóa thành công/ENOENT. Quota chỉ giải phóng sau purge. Thống kê có byte, lỗi hết retry và hold quá hạn; retry-failed cần lệnh rõ ràng.
- Order/return/production và print-request dùng chung khóa lifecycle trước khóa nghiệp vụ. Scan completion bị chặn khi asset đã claim xóa. Download kiểm quyền, đọc buffer tối đa 100 MiB dưới khóa; owner thấy 410 sau purge, người ngoài vẫn 404. Cần đo RAM/concurrency trên host.
- UI có thông tin lưu trữ trước gửi, tên file, ngày dự kiến xóa, trạng thái hết hạn, đóng/mở lại và hold theo quyền. Lọc file trong trang hiện tại có nhãn rõ phạm vi; chưa phải bảng tìm kiếm retention toàn bộ kho. Ghi chú hold nội bộ không vào DTO customer/reviewer.
- Có Dockerfile, Compose web/PostgreSQL, volume private/journal/signature riêng, app chạy user không phải root, DB không publish port, web bind loopback. Model hồi quy ở cùng web. Cấu hình mẫu chưa chứa secret và không tự bật intake/AI/thanh toán.
- Có grants CLI không xoay mật khẩu, timer Ubuntu, proxy mẫu, backup DB/private file cùng mốc mã hóa age, công cụ reconcile purge journal khi restore offline và lệnh đóng gói source có manifest/checksum. Chưa cài đặt bất kỳ timer/proxy nào lên máy thật.

## Tệp của tác vụ

| Nhóm | Đường dẫn |
| --- | --- |
| Schema/policy | `database/migrations/024_custom_file_retention.sql`; `src/domain/print-requests/file-retention.ts` |
| Persistence/storage | `src/repositories/print-requests/file-retention.repository.ts`, `private-file.repository.ts`, `print-request.repository.ts`; `src/repositories/orders/payment-proof.repository.ts`; `src/integrations/private-files/local-store.ts`, `purge-journal.ts` |
| Use case/composition | `src/services/print-requests/print-request.service.ts`, `print-request.ports.ts`; `src/server/private-files.ts`, `print-requests.ts`, `orders.ts`, `order-returns.ts`; `src/repositories/production/production.repository.ts`, `custom-production.repository.ts` |
| Contract/UI | `src/contracts/print-requests.ts`; `src/components/print-requests/RequestRetention.tsx`, `PrintRequestsWorkspace.tsx`, `RequestSubmissionForm.tsx`; `src/components/print-request/PrintRequestForm.tsx` |
| Test | `src/domain/print-requests/test/file-retention.test.ts`; `scripts/lib/test-file-retention.cjs`, `test-custom-print.cjs`; `scripts/tests/test-file-retention-ui.test.cjs`, `test-production-config.test.cjs`, `test-production.cjs` |
| Vận hành | `Dockerfile`, `.dockerignore`, `compose.yaml`, `deploy/`; `scripts/deploy/`; `scripts/workers/expire-print-requests.cjs`, `private-files-cleanup.cjs`; `scripts/database/db-grant-runtime.cjs`, `db-runtime-role.cjs`; `scripts/lib/grant-runtime.cjs`, `database.cjs`; `scripts/checks/check-production.cjs`; `package.json`, `.env.example`, `.gitignore` |
| Tài liệu | Đặc tả lifecycle và custom print, `docs/architecture.md`, runbook/staging/Docker, `docs/ooad/database-dictionary.md`, mục lục và báo cáo này |

Worktree có nhiều thay đổi có sẵn của chủ dự án; các đường dẫn trùng được sửa thêm theo phạm vi, không reset/gom commit. Baseline code liên quan được giữ riêng ở `/private/tmp/minhlab-cp-baseline-20261115/`; không chứa credential. Lệnh `MINHLAB_ENV_FROM_PROCESS=true` cho script CLI/test dùng biến truyền vào thay vì tìm dotenv local.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả quan sát |
| --- | --- |
| `npm run check` | Đạt TypeScript, ESLint và guard: 279 file, 0 vi phạm |
| `npm run test:print-request` | 17 đạt: validation hiện có, policy retention và React SSR theo role/trạng thái |
| `npm run test:orders` | 20 đạt |
| `npm run test:production-domain` | 24 đạt |
| `npm run test:hardening` | 19 + 4 đạt, gồm kiểm cấu hình journal tách khỏi kho private |
| Tổng kiểm thử chọn theo module | 84 đạt; không đồng nghĩa API/DB integration đã chạy đạt |
| `npm run build` | Đạt trên bản sao source ở `/private/tmp/minhlab-cp-release`, không có dotenv/DB cá nhân; site URL fixture HTTPS. Đây là Next build, chưa phải Docker image build |
| Compose | Cấu hình thường và migration override qua `config --no-env-resolution --quiet`, dùng giá trị fixture; không đọc credential đích và không cần daemon |
| Shell/Node CLI | `bash -n`, `sh -n`, `node --check` đạt cho script được thêm |
| `git diff --check` | Không có lỗi whitespace ở tracked diff; file mới được kiểm riêng |
| `npm run test:production` | **Bị chặn trước tạo DB:** `connect EPERM 127.0.0.1:55439`. Initdb thử ở `/private/tmp` cũng bị chặn `shmget`; không dùng database cá nhân để thay thế |
| `npm run production:check` | Exit 1 trên bản sao không có cấu hình đích: thiếu DB/provider/HTTPS/VietQR và catalogue chưa xác minh; chưa có preflight đạt trên VPS |
| Browser QA | Bị chặn: server loopback trả listen EPERM; mở fixture file trong browser bị URL policy từ chối. Đã dừng phần CUA, không đổi browser/surface để vượt chặn. SSR fixture chỉ là bằng chứng render component, không thay thế QA viewport/tương tác |
| Docker/ClamAV/backup-restore | Chưa thực thi: Docker daemon không khả dụng; chưa có scanner thật hoặc host/volume đích |

Log thành công và chẩn đoán cuối được sao chép vào `.local/custom-print-retention/`. Test DB mới có các ca close/reopen/IDOR, converted request, completion/hold/return, shared references, metadata sau purge, scan lease cũ, worker trùng/ENOENT/retry và quote expiry; **những ca integration này đã viết nhưng chưa chạy được**.

## Điều kiện cần hoàn tất tiếp

1. Chạy fresh install, upgrade/idempotency và toàn bộ `test:production` trên PostgreSQL disposable có role runtime. Chỉ sau khi đạt mới coi migration/transaction/cleanup được kiểm chứng.
2. Browser thật ở 375/768/1024/1440 px: form, thông báo lưu file, close/reopen, hold/release, quote/đơn, keyboard/focus và file gone. Không tự gán kết quả từ SSR.
3. Build/run Docker trên Linux, ClamAV/signature thật, worker/health, HTTPS, provider test và restart volume trên staging. Chưa có đo tải RAM/disk cho bounded download/cleanup.
4. Chốt đích backup ngoài host, hạn lưu backup và policy biên lai; giữ identity giải mã ngoài VPS. Không tự prune các loại dữ liệu này.
5. Diễn tập backup/restore + purge journal và rollback trước bật cleanup apply/nhận file khách thật. Không cần cung cấp IP/mật khẩu trong chat; chủ dự án dùng [hướng dẫn Ubuntu](../operations/vps-docker.md) trên máy của mình.
6. Uploader nội bộ cho file sửa, slicer/G-code vẫn chưa mở, theo lát cắt source-model của đặc tả. Cần triển khai riêng nếu muốn quản lý những artifact này trực tiếp trên website. Snapshot ERD/draw.io chưa xuất lại cho migration 024; từ điển đã ghi chênh lệch.

## Bàn giao Codex → ChatGPT

Mã tác vụ: CP-LIFECYCLE-2026-11-15-IMPLEMENT.

Mục tiêu: Hiện thực vòng đời in theo file, giữ/xóa model và chuẩn bị bộ deploy Ubuntu hai container.

Tệp đã sửa: Theo bảng tệp phía trên; bảo toàn thay đổi có sẵn.

Tóm tắt triển khai: Policy 48 giờ/7 ngày, lifecycle/hold/expiry, purge có journal/retry/khóa, UI và migration 024; Compose, timer, grants, backup/reconcile và đóng gói source.

Kiểm tra đã chạy và kết quả: Check + 84 kiểm thử chọn theo module + Next build đạt; Compose/syntax/whitespace đạt. DB integration, browser và runtime Docker/VPS chưa nghiệm thu vì blocker môi trường nêu trên.

Ảnh hưởng kiến trúc: Giữ domain/use case/repository/adapter/composition; thêm khóa lifecycle chung và volume journal tách khỏi backup rollback. Không thêm dependency npm hoặc container model.

Ảnh hưởng OOAD: Thêm schema hold/field retention; cập nhật từ điển, chưa xuất lại ERD/draw.io.

Rủi ro đã biết: Migration/SQL và tranh chấp DB chưa chạy kiểm thực; scanner, stream buffer RAM, job và restore chưa đo trên VPS; giữ cleanup apply tắt.

Vấn đề còn lại: Các điều kiện nghiệm thu 1–6; không triển khai hoặc gửi thông báo thật trong tác vụ này.

Trạng thái rà soát: **Cần xử lý tiếp — source sẵn để review, chưa đủ bằng chứng bật cleanup hoặc mở nhận file thật.**
