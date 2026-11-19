# Bản đồ project MinhLab 3D

## Thư mục gốc

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `app/` | Route, page, layout và HTTP API của Next.js |
| `src/` | Mã nguồn giao diện, nghiệp vụ và adapter |
| `database/` | Migration SQL và dữ liệu seed |
| `scripts/` | Công cụ chạy thủ công/CI, phân nhóm theo mục đích |
| `public/` | Tài nguyên công khai mà website tải trực tiếp |
| `assets/` | Ảnh và nhận diện nguồn phục vụ biên tập |
| `docs/` | Tài liệu kỹ thuật, thiết kế, nghiên cứu và vận hành |
| `.agents/` | Quy chuẩn và skill dự án |
| `.github/` | Workflow CI |
| `.local/` | Database local, backup và artifact cá nhân; Git bỏ qua |
| `.next/`, `.next-dev/` | Output build/dev tự sinh; Git bỏ qua |

Các file cấu hình Next.js, TypeScript, Tailwind, npm và `proxy.ts` ở root theo quy ước công cụ. Chạy công cụ qua các lệnh `npm run …` trong README; tên lệnh không đổi khi script đổi thư mục.

## Tìm nơi sửa theo tác vụ

| Muốn sửa | Bắt đầu tại | Phần liên quan |
| --- | --- | --- |
| Trang chủ | `app/page.tsx`, `src/components/home/` | `src/config/site.config.ts` |
| Catalogue và chi tiết sản phẩm | `src/components/products/`, `src/server/catalog.ts` | `src/services/catalog/`, `src/repositories/catalog/` |
| Quản trị sản phẩm | `app/admin/san-pham/`, `src/components/admin/catalog/` | `app/api/admin/products/` |
| Giỏ và checkout | `src/context/CartContext.tsx`, `src/components/checkout/` | `src/services/orders/`, `src/domain/orders/` |
| Tài khoản và đăng nhập | `src/components/auth/`, `src/components/account/` | `src/services/auth/`, `src/server/auth.ts` |
| Đơn hàng và bàn xưởng | `src/components/admin/`, `src/hooks/` | `app/api/workshop/`, `src/server/orders.ts` |
| In theo file và preview STL | `src/components/print-request/` | `src/workers/`, `src/lib/quote/` |
| Phiếu custom, file riêng tư và báo giá | `app/yeu-cau-in/`, `src/components/print-requests/` | `app/api/print-requests/`, `app/api/print-files/`, `src/services/print-requests/`, `src/server/print-requests.ts` |
| BOM, tồn, gom mẻ và vận hành sản xuất | `app/admin/san-xuat/`, `src/components/admin/production/` | `src/domain/production/`, `src/services/production/`, `src/repositories/production/`, `src/server/production.ts` |
| Agent lập kế hoạch | UI tại `src/components/admin/production/` | `src/integrations/production/`, `src/server/production-agent.ts`, `scripts/workers/production-agent.cjs` |
| Phòng lab và 3D | `src/components/lab-journey/`, `src/components/lab-scrollytelling/` | `public/models/`, `scripts/model-authoring/` |
| Header, footer, modal dùng chung | `src/components/common/`, `src/components/layout/` | `src/styles/` |
| Schema và seed | `database/migrations/`, `database/seeds/` | `scripts/database/` |
| CI và kiểm tra | `.github/workflows/`, `scripts/checks/`, `scripts/tests/` | `package.json` |
| Tài liệu | [Mục lục docs](docs/README.md) | [Kiến trúc](docs/architecture.md) |

## Cách đọc mã nguồn

Luồng backend: `app/api/` → `src/server/` ghép dependency → `src/services/<module>/` xử lý use case → `src/domain/<module>/` giữ policy, `src/repositories/<module>/` đọc/ghi DB và `src/integrations/` gọi dịch vụ ngoài.

`src/contracts/` giữ DTO dùng chung browser/server. `src/components/` chia theo tính năng; `src/hooks/` giữ hook chia sẻ, `src/context/` giữ state dùng chung. `src/lib/` chứa helper hiện hành và quote engine; kiểm tra import guard trước khi dùng module server từ frontend.

Test nghiệp vụ ở gần module trong thư mục `test/`; test helper ở `src/lib/test/`; test công cụ và tích hợp ở `scripts/tests/`. Không chuyển test ra xa module chỉ để gom mọi test vào một nơi.

Khi thêm chức năng vào auth/catalog/orders, dùng nhóm tương ứng ở các tầng hiện hành. Không tạo thêm tầng hoặc barrel export chỉ để rút ngắn đường dẫn. Không sửa migration đã áp dụng; tạo migration mới. GLB, camera spline và cơ chế tải 3D được bảo vệ theo AGENTS.md.

## Điểm vào các module backend

| Module | Composition | Nghiệp vụ / hợp đồng | Lưu trữ | Test gần nhất |
| --- | --- | --- | --- | --- |
| Auth | `src/server/auth.ts` | `src/services/auth/auth.service.ts`, `src/contracts/auth.ts` | `src/repositories/auth/auth.repository.ts` | `npm run test:auth` |
| Catalog | `src/server/catalog.ts` | `src/services/catalog/catalog-management.service.ts`, `src/contracts/catalog.ts` | `src/repositories/catalog/` | `npm run test:catalog` |
| Orders | `src/server/orders.ts` | `src/services/orders/order-checkout.service.ts`, `src/services/orders/order-workflows.service.ts`, `src/domain/orders/order-policy.ts` | `src/repositories/orders/` | `npm run test:orders`, `npm run test:checkout` |
| Print requests | `src/server/print-requests.ts` | `src/services/print-requests/`, `src/contracts/print-requests.ts` | `src/repositories/print-requests/`, `src/server/private-files.ts` | `npm run test:print-request`, `npm run test:production` |
| Production / custom production | `src/server/production.ts`, `src/server/custom-production.ts` | `src/services/production/`, `src/domain/production/planning.ts`, `src/contracts/production.ts` | `src/repositories/production/` | `npm run test:production-domain`, `npm run test:production` |

Khi lần một lỗi: bắt đầu ở route hoặc UI gây lỗi, đi vào composition/use case, rồi mới tới repository. Chỉ đọc contract/policy liên quan. Giữ cấu trúc tầng hiện tại; bảng này cung cấp góc nhìn theo module mà không cần chuyển file.

## Kiểm chứng cấu trúc bằng code

- `npm run check:architecture`: kiểm tra ranh giới và chu kỳ import theo guard.
- `npm run architecture:report`: xem nhóm code, phụ thuộc import, file dài và file nhiều caller.
- `npm run --silent architecture:report -- --json`: lấy graph file nội bộ, gồm cả cạnh type-only.

Báo cáo không gồm HTTP/DB call graph và không kết luận file không có caller là mã thừa. Xem [đánh giá công cụ](docs/reviews/architecture-tooling-2026-11-04.md) để chọn Knip, dependency-cruiser hoặc công cụ trình bày khi cần.
