---
name: premium-ui-design
description: >-
  Use this skill whenever designing a new page or section, modifying layouts,
  establishing or refining the design system, or improving user experience (UX)
  for the MinhLab 3D project. Enforces a minimal, premium, industrial tech aesthetic
  with strict typography, disciplined accents, and zero generic AI clichés.
---

# Premium UI Design Guide (MinhLab 3D)

Kỹ năng này hướng dẫn quy trình thiết kế giao diện cho **MinhLab 3D** — thương hiệu studio in 3D FDM & chế tác mô hình voxel thủ công cao cấp. Mục tiêu là tạo ra sản phẩm mang tính thẩm mỹ tối giản, sang trọng, giàu tính công nghiệp và chuẩn xác như cẩm nang kỹ thuật Nhật Bản.

---

## 1. Triết lý Thiết Kế & Định Hướng Thị Giác

### 1.1. Tinh Thần Cốt Lõi: Industrial Luxury & Japanese Minimalism
- **Sản phẩm là nhân vật chính**: Giao diện đóng vai trò là sân khấu trưng bày (Showroom / Gallery) yên tĩnh, tôn vinh hình khối 3D thật, độ mịn lớp in 0.12mm và bề mặt vật liệu PLA+.
- **Vẻ đẹp kỹ thuật (Technical Elegance)**: Cung cấp thông số minh bạch (kích thước cm, trọng lượng gram, thời gian in, dung sai ±0.05mm) dạng Spec Sheet / Catalogue thay vì quảng cáo hoa mỹ.
- **Chân thực, tự nhiên, không "AI đại trà"**:
  - KHÔNG sử dụng nền gradient neon phát sáng, viền tím/cyan cyberpunk lóa mắt.
  - KHÔNG dùng hiệu ứng hạt bụi lơ lửng, vòng hào quang hologram sci-fi.
  - KHÔNG dùng font chữ hoạt hình hoặc hiệu ứng 3D phồng rực rỡ.

### 1.2. Bảng Màu Kỷ Luật (Disciplined Palette)
- **Nền Studio (Deep Charcoal Base)**:
  - Nền chính: `#08090C` (đen than chì sâu lắng, tĩnh lặng).
  - Khối thẻ / Panel: `#0B0B0E`, `#111216`, `#14151C`.
  - Khung viền Hairline: `border-white/[0.08]`, `border-white/[0.05]` (mỏng nhẹ, sắc cạnh).
- **Màu Điểm Nhấn (Accent Color - Tối đa 1 màu chủ đạo)**:
  - **Champagne Gold (`#C8A261`, hover: `#B89251`)**: Màu vàng kim mờ đồng điệu cùng viền giáp của linh vật chú Khỉ Kỹ Sư 3D.
  - Dùng có chủ đích: Tag tiêu đề, viền focus, nút CTA chính, đường kẻ active danh mục, thông số nổi bật.
  - Chữ trên nút màu điểm nhấn phải dùng đen than chì `#0B0B0E` đậm để đạt độ tương phản và dễ đọc tối đa.

### 1.3. Hệ Thống Chữ (Typography Hierarchy)
- **Font chính (Body & Heading)**: `Plus Jakarta Sans` — nét chữ hiện đại, hình học cân đối, không chân.
- **Font thông số (Spec Sheet & Monospace)**: `SF Mono`, `Fira Code`, `Consolas` — biểu thị mã sản phẩm (`№ 01 / TOY`), dung sai, độ dày lớp in (`0.12 mm`), số điện thoại, giá tiền (`450.000 ₫`).
- **Font vi mô (Micro-Labels)**: Kích thước 10px–11px, `uppercase`, `tracking-wider` hoặc `tracking-widest`.

---

## 2. Quy Tắc Bố Cục & Tránh Lỗi Phổ Biến

1. **Khoảng trắng có chủ đích (Deliberate Whitespace)**:
   - Khoảng cách giữa các section: `py-20 sm:py-24`.
   - Khoảng cách giữa tiêu đề và nội dung: `mb-12 sm:mb-16`.
   - Để sản phẩm có không gian thở, không nhồi nhét quá nhiều thẻ cạnh nhau.
2. **Không biến mọi thứ thành Card**:
   - Tránh việc đóng khung viền cho tất cả các đoạn text.
   - Kết hợp giữa văn bản mở dạng Lookbook tạp chí và bảng thông số Spec Sheet phẳng.
3. **Bo góc vừa phải (Moderate Radii)**:
   - Nút bấm và tag: `rounded-lg` (8px) hoặc `rounded-xl` (12px).
   - Thẻ sản phẩm: `rounded-2xl` (16px).
   - Tuyệt đối không dùng bo tròn quá mức dạng con nhộng (`rounded-full`) cho các khối nội dung lớn.
4. **Hạn chế số lượng Icon**:
   - Chỉ dùng icon khi thực sự bổ trợ ngữ nghĩa (giỏ hàng, mũi tên điều hướng, xe tải freeship, thước đo).
   - Dùng icon kích thước nhỏ gọn (`w-4 h-4` hoặc `w-3.5 h-3.5`), nét mảnh tinh tế từ `lucide-react`.

---

## 3. Chuyển Động & Trạng Thái Tương Tác

- **Animation nhẹ & tôn trọng `prefers-reduced-motion`**:
  - Dùng GSAP hoặc CSS transition thời gian ngắn (`duration-200` đến `duration-300`).
  - Kiểm tra `window.matchMedia('(prefers-reduced-motion: reduce)')` trước khi chạy các chuyển động phức tạp.
- **Đầy đủ các trạng thái tương tác**:
  - **Default**: Rõ ràng, thanh lịch.
  - **Hover**: Biến đổi nhẹ về độ sáng nền hoặc màu text, mũi tên nhích nhẹ (`group-hover:translate-x-0.5`).
  - **Focus / Focus-visible**: Viền sáng tinh tế `focus-visible:ring-1 focus-visible:ring-[#C8A261]`.
  - **Active**: Phản hồi tức thì khi bấm.
  - **Disabled**: Độ mờ `opacity-30` hoặc `opacity-40`, con trỏ `cursor-not-allowed`.
  - **Loading**: Skeleton hoặc spinner pulse đồng màu điểm nhấn.

---

## 4. Quy Trình Làm Việc Trước Khi Viết Mã (Pre-Code Audit)

Trước khi bắt tay vào code bất kỳ giao diện mới nào:
1. **Khảo sát giao diện hiện có**:
   - Đọc kỹ `src/components/common/Header.tsx`, `Hero.tsx`, `ProductGallery.tsx`, `CartDrawer.tsx`.
   - Kiểm tra mã màu, class Tailwind đang dùng.
2. **Xác định các thành phần có thể tái sử dụng**:
   - Các định dạng tiền tệ `formatVND`.
   - Các class khung thẻ `bg-[#111216] border border-white/[0.08]`.
   - Nút bấm chính `bg-[#C8A261] hover:bg-[#B89251] text-[#0B0B0E] font-bold`.
3. **Kiểm tra trên 4 breakpoint chuẩn**:
   - **Mobile nhỏ**: `375px` (iPhone SE).
   - **Mobile lớn / Tablet**: `768px` (iPad).
   - **Laptop**: `1024px`.
   - **Desktop lớn**: `1440px`.
