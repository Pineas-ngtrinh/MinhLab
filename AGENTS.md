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
| **Framework** | Next.js (App Router) | `14.2.35` | SSR & Static Generation tối ưu SEO |
| **Ngôn ngữ** | TypeScript | `5.4.5` | Bắt buộc `strict: true`, không dùng `any` |
| **UI Library** | React & React DOM | `18.2.0` | Server & Client Components rõ ràng |
| **3D Engine** | Three.js & React Three Fiber | `three@0.160.0`, `@react-three/fiber@8.15` | Hiển thị mô hình GLB thời gian thực |
| **3D Helpers** | @react-three/drei | `9.96.0` | `useGLTF`, `useAnimations`, `ContactShadows` |
| **Animation** | GSAP & ScrollTrigger | `3.12.5` | Điều khiển máy ảnh spline và animation mượt |
| **Styling** | Tailwind CSS | `3.4.3` | Utility-first, không dùng styled-components |
| **Icon Set** | Lucide React | `0.378.0` | Icon nét mảnh tinh gọn chuẩn tối giản |

---

## 3. Cấu Trúc Thư Mục Dự Án (Directory Structure)

```text
minhlab-3d/
├── .agents/                          # Hệ thống quy tắc và kỹ năng Agent
│   ├── rules/
│   │   └── project-standards.md      # Quy chuẩn code, TypeScript & a11y
│   └── skills/
│       ├── premium-ui-design/        # Kỹ năng thiết kế UI phong cách Industrial Luxury
│       │   └── SKILL.md
│       ├── frontend-engineering/     # Kỹ năng kiến trúc React/Next.js/Three.js
│       │   └── SKILL.md
│       └── visual-qa/                # Kỹ năng kiểm thử trực quan trên trình duyệt
│           └── SKILL.md
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root Layout, font Be Vietnam Pro / IBM Plex Mono
│   ├── page.tsx                      # Trang chủ (StudioExperience)
│   └── phong-lab/                    # Tour 3D phòng lab FDM & Resin (LabScrollytelling)
├── src/
│   ├── components/
│   │   ├── common/                   # Header, Footer, CartDrawer, CheckoutModal
│   │   ├── home/                     # StudioExperience.tsx, ConsultantMascotCanvas.tsx
│   │   ├── lab-journey/              # LabCanvas.tsx (Sân khấu Three.js phòng lab)
│   │   ├── lab-scrollytelling/       # LabScrollytelling.tsx (Timeline HUD & Scrollytelling)
│   │   ├── products/                 # ProductGallery.tsx (Catalogue & Product Spec Sheet Modal)
│   │   ├── choice/                   # ChoiceSection.tsx (Phân luồng Mua có sẵn vs Gửi file)
│   │   ├── process/                  # Process.tsx (Quy trình 4 bước chuẩn Nhật)
│   │   ├── services/                 # Services.tsx (Dịch vụ gia công in FDM theo file)
│   │   └── contact/                  # ContactSection.tsx (Soạn tin nhắn Zalo/Email nhanh)
│   ├── config/
│   │   └── site.config.ts            # Nguồn dữ liệu tập trung duy nhất (Single Source of Truth)
│   ├── context/
│   │   └── CartContext.tsx           # Quản lý giỏ hàng, tính tổng tiền, lưu localStorage
│   └── styles/
│       └── index.css                 # Base styles, scrollbar, import Tailwind
├── public/                           # Tài nguyên tĩnh
│   ├── models/                       # File mô hình 3D GLB (mascot, lab)
│   └── images/                       # Logo và hình ảnh sản phẩm
├── package.json                      # Scripts và khai báo dependencies
├── tsconfig.json                     # Cấu hình TypeScript strict
└── tailwind.config.js                # Cấu hình theme màu và font chữ
```

---

## 4. Định Hướng Thiết Kế (Design Direction)

1. **Phong cách Titanium Studio (Industrial Luxury)**:
   - Nền tối trầm tĩnh: Đen than chì studio (`#08090C`, `#0B0B0E`, `#111216`, `#0B0F14`).
   - Đường kẻ viền hairline: `border-white/[0.08]` hoặc `#27313C` mỏng nhẹ, sắc cạnh.
   - Màu điểm nhấn chủ đạo (Primary Accent): **Đỏ cam MinhLab (`#EB4037`, hover: `#FF5147`)** — theo đúng `tailwind.config.js` (`brand.DEFAULT`) và nhận diện thương hiệu studio xưởng in.
   - Màu điểm nhấn phụ (Secondary Accent): **Vàng kim Champagne Gold (`#C8A261`, hover: `#B89251`)** — giữ làm điểm nhấn phụ cho các chi tiết cao cấp (eyebrow, viền focus, text link, số thứ tự, badge/CTA) trong `studio.module.css`.
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
npx next dev -p 3000

# Kiểm tra kiểu dữ liệu TypeScript (Không xuất file)
npx tsc --noEmit

# Kiểm tra cú pháp và quy tắc ESLint
npm run lint

# Đóng gói sản phẩm production
npm run build
```

---

## 7. Những Phần Được Bảo Vệ (Do Not Touch Without Explicit Request)

1. **File mô hình nhị phân 3D**: `public/models/minhlab-mascot-v1.glb` và `minhlab-lab-v1.glb`.
2. **Tọa độ Camera Spline**: `LAB_WAYPOINTS` trong `LabCanvas.tsx` đã được hiệu chỉnh chính xác để không bao giờ bị cắt xén đầu hoặc chân linh vật.
3. **Cơ chế tải 3D an toàn**: `dynamic(() => ..., { ssr: false })` kết hợp `CanvasErrorBoundary` trong `ConsultantMascot.tsx` và `LabScrollytelling.tsx`.
4. **Không cài đặt thêm thư viện trùng lặp**: Giữ dependencies tinh gọn, sử dụng đúng các thư viện đã có trong `package.json`.

---

## 8. Tiêu Chí Hoàn Thành Nhiệm Vụ (Definition of Done)

Một tác vụ được xem là hoàn thành khi:
1. Đã tuân thủ toàn bộ quy tắc trong `.agents/rules/project-standards.md`.
2. Đã áp dụng các chỉ dẫn từ các Agent Skills (`premium-ui-design`, `frontend-engineering`, `visual-qa`).
3. Đã chạy `npx tsc --noEmit` và `npm run build` thành công 100% không lỗi (exit code 0).
4. Máy chủ local phản hồi `HTTP 200 OK` và giao diện thực tế hoạt động trơn tru.
