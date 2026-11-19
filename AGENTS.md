# AGENTS.md — Hướng Dẫn Phát Triển Dự Án MinhLab 3D

Chào mừng các AI Coding Agents đến với codebase **MinhLab 3D**. Đây là tài liệu quy định kiến trúc tổng thể, công nghệ, quy ước và nguyên tắc làm việc bắt buộc trong dự án này.

---

## 1. Mục Tiêu Dự Án (Project Mission)

**MinhLab 3D** là nền tảng thương mại điện tử kết hợp trải nghiệm 3D tương tác dành cho studio in 3D FDM và chế tác Art Toy voxel thủ công độc bản tại Việt Nam:
- **Cửa hàng sản phẩm in 3D**: Bày bán Art Toy (chú Khỉ Kỹ Sư MinhLab, Robot Voxel), mô hình diorama phòng lab mini, phụ kiện desk setup.
- **Tour 3D phòng lab FDM**: Mô phỏng không gian xưởng in 3D thực tế (máy in FDM, cuộn sợi filament, đầu đùn 0.12mm, trạm soi file lưới và bàn kiểm định hoàn thiện).
- **Dịch vụ in theo yêu cầu**: Hỗ trợ khách hàng tải tệp 3D riêng (.STL, .OBJ, .STEP), tư vấn thông số và đặt in nhanh qua Zalo/Email.

---

## 2. Ngăn Xếp Công Nghệ (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Phiên bản | Ghi chú kiến trúc |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `16.4.2` | SSR & Static Generation tối ưu SEO |
| **Ngôn ngữ** | TypeScript | `5.9.3` | Bắt buộc `strict: true`, không dùng `any` |
| **UI Library** | React & React DOM | `19.3.1` | Server & Client Components rõ ràng |
| **3D Engine** | Three.js & React Three Fiber | `three@0.160.1`, `@react-three/fiber@9.8.2` | Hiển thị mô hình GLB thời gian thực |
| **3D Helpers** | @react-three/drei | `10.7.9` | `useGLTF`, `useAnimations`, `ContactShadows` |
| **Animation** | GSAP & ScrollTrigger | `3.15.0` | Điều khiển máy ảnh spline và animation mượt |
| **Styling** | Tailwind CSS | `3.4.19` | Utility-first, không dùng styled-components |
| **Icon Set** | Lucide React | `1.59.0` | Icon nét mảnh tinh gọn chuẩn tối giản |

---

## 3. Cấu Trúc Thư Mục Dự Án (Directory Structure)

```text
minhlab-3d/
├── .agents/                  # Quy chuẩn và kỹ năng phát triển
├── app/                      # App Router: trang, tài khoản, quản trị và API
├── src/
│   ├── components/           # home, common, auth, products, print-request, lab
│   ├── config/site.config.ts # Nội dung thương hiệu/marketing; catalogue đọc PostgreSQL
│   ├── context/              # AuthContext, CartContext
│   ├── contracts/            # DTO request/response dùng chung với browser
│   ├── domain/orders/        # Model và policy đơn hàng thuần, không I/O
│   ├── lib/                  # DB, phiên, validation, phân tích STL/ước tính giá
│   ├── services/             # Use cases; services/orders không chứa SQL/SDK
│   ├── repositories/         # SQL đọc/ghi và ánh xạ DB rows
│   ├── integrations/         # Adapter dịch vụ ngoài/outbox
│   ├── server/               # Composition chỉ phía server
│   └── styles/               # Styles chung
├── database/migrations/      # Schema và lịch sử migration
├── scripts/                  # Vận hành database, mail worker và kiểm thử
├── public/                   # Tài nguyên website, GLB được bảo vệ
├── assets/source-photos/     # Ảnh gốc sản phẩm
├── docs/ooad/                # Hồ sơ OOAD và bằng chứng kiểm tra
├── proxy.ts                  # Kiểm tra Origin và giới hạn body trước API
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

Bản đồ tìm code theo tác vụ tại `PROJECT_STRUCTURE.md`; mục lục tài liệu tại `docs/README.md`; nhóm công cụ tại `scripts/README.md`. Cấu trúc và lệnh vận hành chi tiết tại `README.md`; file đã lưu trữ tại `docs/cleanup-manifest.json`. Node.js tối thiểu 20.9.0.

Các module orders, catalog và auth đã được tách theo domain, use case, repository, integration và composition phía server. Type nghiệp vụ đơn hàng nằm ở `src/domain/orders`, DTO tại `src/contracts`, DB row chỉ ở repository. Type catalogue tại `src/contracts/catalog.ts`, type tài khoản dùng chung tại `src/contracts/auth.ts`; giỏ UI tại CartContext, không đưa DB row vào config hoặc context. Quy tắc cũ đặt dữ liệu sản phẩm trong SITE_CONFIG được thay bằng PostgreSQL theo yêu cầu chủ dự án. Nội dung marketing tiếp tục dùng SITE_CONFIG. Xem `docs/architecture.md`; `npm run check` bắt buộc chạy guard import cùng type/lint.

### Nguồn sự thật hiện hành

- Stack lấy từ `package.json` và `package-lock.json`: Next.js `16.4.2`, React `19.3.1`, TypeScript `5.9.3`, Tailwind `3.4.19`, Three.js `0.160.1`, React Three Fiber `9.8.2`. Dùng npm và `package-lock.json`; không chuyển sang pnpm hoặc Prisma. Node tối thiểu là `20.9.0`; CI hiện dùng Node 22.
- Dữ liệu bền vững dùng PostgreSQL qua `pg` và SQL trong `database/migrations/`; vận hành migration bằng `npm run db:migrate`. Không sửa migration đã áp dụng; bổ sung migration khi thay đổi schema.
- `src/config/site.config.ts` giữ nội dung thương hiệu/marketing. Catalogue và giá SKU đọc PostgreSQL qua module catalog; DTO ở `src/contracts/catalog.ts`. Type tài khoản dùng chung ở `src/contracts/auth.ts`; auth hiện dùng domain/use case/repository/integration/composition riêng, không dùng Auth.js.
- Checkout mới chỉ hỗ trợ QR cá nhân VietQR và nhân viên xác nhận thủ công. COD chỉ còn trong dữ liệu/luồng đơn lịch sử. Không tích hợp payOS, SePay, webhook ngân hàng hay tự đối soát nếu chưa có quyết định mới. Quyết định hiện hành ở `docs/DECISIONS.md` và `docs/design/payment-integration-plan.md`.
- Preview và giá ước tính STL hiện có không phải hóa đơn hay quy trình nhận file/báo giá bền vững hoàn chỉnh. Hàng đợi chế tác hỗ trợ thao tác thủ công; schema hiện có `printers` và `production_jobs`, còn engine lập lịch/gom mẻ, phân bổ nhiều-nhiều và runtime AI agent vẫn ở mức thiết kế. Xem `docs/architecture.md` và chỉ mở tài liệu thiết kế sản xuất khi tác vụ đụng tới phần đó.
- `docs/operations/aws-deployment.md` và `docs/operations/production-runbook.md` mô tả kế hoạch/điều kiện vận hành; không xem chúng là bằng chứng website đã triển khai hoặc sẵn sàng production.

### Chính sách kích hoạt skill

Đọc `AGENTS.md` và `.agents/rules/project-standards.md` làm ngữ cảnh chung. Sau đó chỉ nạp skill và tài liệu gắn trực tiếp với tác vụ; không kích hoạt toàn bộ skill UI/UX hay đọc toàn bộ hồ sơ tham chiếu mặc định.

| Tác vụ | Skill / công cụ | Tài liệu cần mở |
| --- | --- | --- |
| Backend, domain, API, auth, catalogue, checkout hoặc payment | `minhlab-3d-build` khi thuộc phạm vi nghiệp vụ này; Serena MCP để tìm symbol/reference có mục tiêu khi cần điều hướng code | `docs/architecture.md`, mục liên quan trong `docs/DECISIONS.md`, cùng tài liệu module cụ thể nếu cần |
| Frontend implementation | `frontend-engineering`; chỉ dùng hướng dẫn React bổ sung nếu skill đó thực sự được cài và liên quan | Component/route, contract hoặc use case đang sửa; Next.js 16 docs liên quan trước khi dùng API có khác biệt phiên bản |
| Thiết kế/đổi giao diện trực quan | `premium-ui-design` | Chỉ brief/brand token và component liên quan |
| Kiểm tra trực quan sau đổi giao diện hoặc tương tác | `visual-qa` khi có thể chạy ứng dụng và trình duyệt | Luồng, trạng thái và viewport bị ảnh hưởng |
| OOAD hoặc sơ đồ | `plantuml` khi tạo/sửa sơ đồ PlantUML | Nguồn liên quan trong `docs/ooad/` và code/schema mà sơ đồ biểu diễn |
| Dataset, hồi quy hoặc huấn luyện mô hình báo giá | `minhlab-model-train` | `src/lib/quote/`, test/fixture liên quan; chỉ đọc `references/quote-core.md` cho thuật toán lõi |
| Triển khai hoặc chuẩn bị release | `minhlab-3d-build` chỉ khi sửa runtime/infra; review tài liệu/readiness không cần skill chuyên biệt | `docs/operations/aws-deployment.md`, `docs/operations/production-runbook.md`, `docs/reviews/production-review-2026-10-24.md` khi cần trạng thái readiness |

Với OOAD thiết kế, đọc `docs/ooad/DESIGN_BRIEF.md` trước. Yêu cầu và tài liệu học phần quyết định mô hình cần xây; code/migration chỉ giới hạn sơ đồ được xác định rõ là hiện trạng. Không loại bỏ chức năng thiết kế vì chưa có code. Mẫu trình bày mới nhất là `/Users/nguyenphucphu/Downloads/giuaki_chan_chim.drawio`: chữ lớn, chỉ tiêu đề và sơ đồ, không ghi chú trên canvas. ERD dùng chân chim; sơ đồ lớp dùng bội số UML và các đầu nối đúng nghĩa.

Với Serena, chỉ khởi tạo và đọc hướng dẫn Serena khi cần dùng MCP; tìm đúng symbol/caller thay vì nạp hàng loạt file. Tác vụ chỉ sửa tài liệu hoặc thay đổi nhỏ đã xác định vị trí có thể bỏ qua Serena.

---

## 4. Định Hướng Thiết Kế (Design Direction)

1. **Phong cách Titanium Studio (Industrial Luxury)**:
   - Nền tối trầm tĩnh: Đen than chì studio (`#08090C`, `#0B0B0E`, `#111216`, `#0B0F14`).
   - Đường kẻ viền hairline: `border-white/[0.08]` hoặc `#27313C` mỏng nhẹ, sắc cạnh.
   - Màu điểm nhấn chủ đạo (Primary Accent): **Đỏ cam MinhLab (`#EB4037`, hover: `#FF5147`)** — theo đúng `tailwind.config.js` (`brand.DEFAULT`) và nhận diện thương hiệu studio xưởng in.
   - Màu điểm nhấn phụ (Secondary Accent): **Vàng kim Champagne Gold (`#C8A261`, hover: `#B89251`)** — giữ làm điểm nhấn phụ cho các chi tiết cao cấp (eyebrow, viền focus, text link, số thứ tự, badge/CTA) trong các component và stylesheet hiện hành.
   - Nút bấm màu vàng kim dùng chữ đen than chì đậm `#0B0B0E` để bảo đảm độ tương phản tối đa.
2. **Không mang cảm giác "AI đại trà" hay "Game Cyberpunk"**:
   - Không dùng đèn neon xanh tím phát sáng (glow/aura).
   - Không dùng particle bụi bay, vòng hào quang sci-fi.
   - Nội dung copywriting viết bằng tiếng Việt thuần túy, chân thành, tự nhiên từ góc nhìn người thợ chế tác và kỹ sư xưởng in.

---

## 5. Quy Ước Đặt Tên (Naming Conventions)

- **Component React**: PascalCase (ví dụ: `ProductGallery.tsx`, `CartDrawer.tsx`).
- **Thư mục Component**: kebab-case (ví dụ: `lab-journey/`, `common/`).
- **Type & Interface**: PascalCase (ví dụ: `ProductItem`, `CartContextType`).
- **Biến cấu hình toàn cục**: UPPER_SNAKE_CASE (ví dụ: `SITE_CONFIG`, `LAB_WAYPOINTS`).
- **Hooks**: camelCase bắt đầu bằng `use` (ví dụ: `useCart`).

---

## 6. Lệnh Thao Tác Dự Án (Commands)

```bash
# Khởi chạy server phát triển local (Port 3000)
npm run dev -- -p 3000

# Kiểm tra kiểu dữ liệu TypeScript (Không xuất file)
npx tsc --noEmit

# Kiểm tra cú pháp và quy tắc ESLint
npm run lint

# Đóng gói sản phẩm production
npm run build
```

---

## 7. Những Phần Được Bảo Vệ (Do Not Touch Without Explicit Request)

1. **File mô hình nhị phân 3D**: `public/models/minhlab-mascot-v1.glb` và `public/models/minhlab-lab-v1.glb`; không sửa, thay thế hoặc xóa nếu chưa được yêu cầu. Các bản cùng tên ở thư mục gốc đang có thay đổi xóa sẵn trong worktree; giữ nguyên trạng thái đó.
2. **Tọa độ Camera Spline**: `LAB_WAYPOINTS` trong `LabCanvas.tsx` đã được hiệu chỉnh chính xác để không bao giờ bị cắt xén đầu hoặc chân linh vật.
3. **Cơ chế tải 3D an toàn**: `dynamic(() => ..., { ssr: false })` kết hợp `CanvasErrorBoundary` trong `ConsultantMascot.tsx` và `LabScrollytelling.tsx`.
4. **Không cài đặt thêm thư viện trùng lặp**: Giữ dependencies tinh gọn, sử dụng đúng các thư viện đã có trong `package.json`.

---

## 8. Cổng chất lượng theo loại tác vụ

Chọn các kiểm tra phù hợp với phần bị thay đổi. Không yêu cầu build, chạy server hoặc kiểm tra trình duyệt cho mọi tác vụ. Chỉ báo lệnh đã thật sự chạy và kết quả quan sát được.

| Loại tác vụ | Cổng chất lượng |
| --- | --- |
| Chỉ tài liệu/hướng dẫn | Đối chiếu quyết định và code hiện hành; kiểm tra link/path được thêm hoặc sửa; `git diff --check`; xác nhận scope. Không cần typecheck/build ứng dụng nếu không đổi code. |
| Frontend | `npm run check` và test liên quan hành vi; kiểm tra trình duyệt/viewport/trạng thái bằng `visual-qa` khi thay đổi hiển thị hoặc tương tác. Chạy `npm run build` khi thay đổi route, ranh giới server/client, cấu hình hoặc có rủi ro build-time. |
| Backend/API | `npm run check` và test gần nhất với use case; chạy `npm run test:production` khi thay đổi cần xác minh tích hợp PostgreSQL, transaction, quyền hoặc migration. Kiểm tra HTTP phù hợp nếu thay contract/route. |
| Database migration | `npm run check` và `npm run test:production` trên database cô lập; xác minh cài mới, nâng cấp từ schema được hỗ trợ và tính idempotent theo migration runner. Không thử migration trên production để kiểm chứng. |
| Domain/production planning | Chạy guard và test domain/production bị ảnh hưởng; xác minh policy/luồng với `docs/architecture.md` và quyết định hiện hành. Nếu chỉ đổi thiết kế, ghi rõ phần nào chưa được triển khai. |
| OOAD/sơ đồ | Kiểm tra sơ đồ render được, khớp code/schema hiện hành và manifest/traceability nếu bị ảnh hưởng; dùng `plantuml` khi tạo/sửa PlantUML. Sơ đồ thiết kế không phải bằng chứng triển khai. |
| Deployment/release | Chạy `npm run check` và `npm run build`; chạy `npm run production:check` khi cấu hình/môi trường release sẵn sàng. Đọc runbook và xác minh health/smoke trên môi trường được phép. Chỉ triển khai hoặc chạm tài nguyên thật khi người dùng đã cho phép rõ ràng. |

`npm run check` gồm TypeScript, ESLint và guard kiến trúc. Chọn test qua scripts có sẵn trong `package.json`; không chạy cả bộ test hoặc build nếu không cần cho thay đổi. Không suy ra production readiness chỉ từ build hoặc smoke test local.

Các test theo module hiện có gồm `npm run test:orders`, `test:auth`, `test:catalog`, `test:checkout`, `test:quote`, `test:print-request`; `npm run test:production` kiểm tra luồng tích hợp PostgreSQL trên database riêng. Dùng `npm run test:unit` khi thay đổi liên quan nhiều module hoặc cần toàn bộ unit suite.

## 9. Báo cáo bàn giao Codex → ChatGPT

Kết thúc tác vụ bằng báo cáo đủ bằng chứng để ChatGPT rà soát; điền `Không áp dụng` khi một mục không bị ảnh hưởng và không khẳng định kiểm tra chưa chạy.

```text
Mã tác vụ:
Mục tiêu:
Tệp đã sửa:
Tóm tắt triển khai:
Kiểm tra đã chạy và kết quả:
Ảnh hưởng kiến trúc:
Ảnh hưởng OOAD:
Rủi ro đã biết:
Vấn đề còn lại:
Trạng thái rà soát: Sẵn sàng để ChatGPT rà soát / Cần xử lý tiếp / Bị chặn
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
