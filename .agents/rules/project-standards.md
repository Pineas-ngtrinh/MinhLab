# MinhLab 3D — Workspace Project Standards

Tài liệu này định nghĩa các tiêu chuẩn kỹ thuật, nguyên tắc kiến trúc và quy ước chất lượng bắt buộc phải tuân thủ khi phát triển và bảo trì codebase **MinhLab 3D**.

---

## 1. Tiêu chuẩn TypeScript & Kiểu dữ liệu

- **Strict Mode bắt buộc**: Dự án đã bật `strict: true` trong `tsconfig.json`. Mọi file code mới hoặc chỉnh sửa phải thỏa mãn type-check mà không có cảnh báo.
- **Tuyệt đối không dùng `any` bừa bãi**:
  - Không sử dụng `any` trừ khi làm việc với thư viện bên thứ ba không có type definition và bắt buộc phải dùng (phải kèm comment giải thích lý do cụ thể).
  - Sử dụng `unknown` kết hợp type guard (`typeof`, `instanceof`, custom type predicates) thay vì ép kiểu mù quáng `as any`.
- **Tập trung hóa interface & type**:
  - Các cấu trúc dữ liệu domain chung (sản phẩm, giỏ hàng, danh mục, thông số 3D) phải được định nghĩa tại `src/config/site.config.ts` hoặc `src/context/CartContext.tsx`.
  - Component Props phải được định nghĩa bằng `interface` rõ ràng (ví dụ: `interface ProductGalleryProps`).

---

## 2. Trách nhiệm Component & Cấu trúc mã

- **Single Responsibility Principle (Nguyên tắc đơn trách nhiệm)**: Mỗi component chỉ chịu trách nhiệm cho một giao diện hoặc một tác vụ logic cụ thể.
- **Quy tắc tách component**:
  - Tách component khi có khả năng tái sử dụng ở nhiều nơi (Button, Modal, Drawer, Badge, Card, Spec Sheet).
  - Tách khi một file vượt quá 300–400 dòng hoặc chứa nhiều logic lồng nhau phức tạp.
  - **Không chia nhỏ quá mức**: Không tạo các micro-component 5-10 dòng chỉ dùng 1 lần trong cùng file nếu việc đó chỉ làm tăng số lượng file và gây phân mảnh ngữ cảnh.
- **Tách biệt tầng UI và Dữ liệu**:
  - Không hardcode text, dữ liệu sản phẩm, số điện thoại, email, địa chỉ rải rác trong JSX.
  - Toàn bộ nội dung copywriting, danh mục, thông số kỹ thuật, liên hệ phải lấy từ `src/config/site.config.ts`.

---

## 3. Semantic HTML & Khả năng tiếp cận (Accessibility - a11y)

- **Semantic Elements**: Sử dụng đúng thẻ HTML (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`, `<button>`, `<a>`, `<dialog>`, `<figure>`).
- **Interactive Elements**:
  - Nút bấm phải dùng `<button type="button">`, liên kết chuyển trang/mục phải dùng `<a>` hoặc `<Link>`. Không dùng `<div onClick={...}>` trừ khi đó là backdrop phủ overlay (và phải có `role` hoặc `aria` phù hợp).
  - Nút chỉ có icon bắt buộc phải có `aria-label` hoặc `title` rõ ràng (ví dụ: `aria-label="Xem giỏ hàng"`, `aria-label="Đóng menu"`).
- **Trạng thái bàn phím & Focus**:
  - Mọi phần tử tương tác phải nhận focus hợp lệ khi nhấn phím `Tab`.
  - Có trạng thái `focus-visible:outline-none focus-visible:ring-1` rõ ràng.

---

## 4. Responsive Hoàn Hảo & Không Tràn Khung Ngang (Zero Horizontal Overflow)

- **Mobile-first approach**: Thiết kế từ màn hình nhỏ nhất (375px) đến desktop rộng (1440px+).
- **Quy tắc ngăn chặn tràn ngang**:
  - Mọi container bao bọc chính phải có `w-full max-w-full overflow-x-hidden`.
  - Tuyệt đối không dùng `w-screen` kết hợp padding lớn gây xuất hiện thanh cuộn ngang khó chịu.
  - Hình ảnh phải có kích thước kiểm soát, dùng thuộc tính `fill` của `next/image` kết hợp wrapper tỷ lệ cố định (`relative aspect-[4/3]`, `aspect-video`).
  - Kiểm tra kỹ các phần tử 3D Canvas (`pointer-events-auto` bên trong, `pointer-events-none` ở các lớp overlay trống).

---

## 5. Vệ sinh Code & Kiểm soát chất lượng (Hygiene & Discipline)

- **Không code dư thừa**: Không để import không dùng, biến không dùng, dead code hoặc các khối code bị comment bỏ ngỏ.
- **Không console.log**: Tuyệt đối xóa sạch `console.log`, `console.warn`, `console.debug` trước khi hoàn tất công việc.
- **Kỷ luật phạm vi chỉnh sửa (Scope Discipline)**:
  - Chỉ sửa đổi những file liên quan trực tiếp đến yêu cầu của người dùng.
  - Không tự ý format, refactor lại toàn bộ codebase hoặc đổi thư viện khác khi không được yêu cầu.
  - Không cài đặt các thư viện trùng lặp chức năng (ví dụ: dự án đã có `lucide-react`, không cài thêm `react-icons`; đã có `gsap`, không cài thêm `framer-motion`).

---

## 6. Tiêu chí Hoàn thành (Definition of Done - DoD)

Một nhiệm vụ **chỉ được coi là hoàn thành** khi và chỉ khi thỏa mãn đầy đủ các điều kiện sau:
1. Đã chạy kiểm tra cú pháp và kiểu dữ liệu: `npx tsc --noEmit` không có lỗi.
2. Đã chạy kiểm tra lint: `npm run lint` không có lỗi.
3. Đã chạy kiểm tra đóng gói: `npm run build` kết thúc với mã thoát `0` (Compiled successfully, static pages generated).
4. Trang web local server đang hoạt động thực tế trên trình duyệt và không có lỗi runtime/hydration (đã kiểm tra qua `curl` hoặc visual browser inspection).
