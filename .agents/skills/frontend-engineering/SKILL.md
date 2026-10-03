---
name: frontend-engineering
description: >-
  Use this skill when implementing React/Next.js components, managing state,
  structuring logic and data access, optimizing rendering and 3D WebGL bundle performance,
  or preventing hydration and runtime errors in the MinhLab 3D codebase.
---

# Frontend Engineering Standards & Best Practices (MinhLab 3D)

Tài liệu này cung cấp các nguyên tắc công nghệ và quy chuẩn kỹ thuật phần mềm dành cho Next.js 14 (App Router), React 18, TypeScript và Three.js/R3F trong dự án **MinhLab 3D**.

---

## 1. Kiến Trúc Next.js 14 & Phân Định Server / Client Component

### 1.1. Nguyên Tắc Server First
- Mặc định các trang, layout hoặc section tĩnh là **Server Component**.
- Chỉ gắn directive `'use client'` khi component thực sự cần:
  - Sử dụng React hooks (`useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`).
  - Lắng nghe sự kiện trình duyệt (`onClick`, `onChange`, `onScroll`, `window.addEventListener`).
  - Render Three.js / Canvas WebGL (`@react-three/fiber`, `@react-three/drei`).
  - Tiêu thụ Context API (`useCart`).

### 1.2. Kỹ Thuật Dynamic Import Cho WebGL
- Thư viện Three.js và Canvas 3D phụ thuộc vào `window` và WebGL context của trình duyệt.
- Luôn sử dụng `dynamic` import với `{ ssr: false }` khi nhúng Canvas 3D:
  ```tsx
  const MascotCanvas = dynamic(() => import('./MinhLabMascotCanvas'), {
    ssr: false,
    loading: () => <MinhLabMascotLoader />,
  });
  ```
- Luôn bọc Canvas trong một `ErrorBoundary` chuyên biệt để nếu WebGL gặp sự cố hoặc GPU quá tải, giao diện vẫn hiển thị fallback ảnh tĩnh thay vì sập toàn trang.

---

## 2. Quản Lý Trạng Thái (State Management) & Tránh Lỗi useEffect

### 2.1. Không Lưu Trữ Derived State (Trạng Thái Phái Sinh)
- Tuyệt đối không dùng `useState` + `useEffect` để tính toán giá trị có thể suy ra trực tiếp từ props hoặc state khác.
- **Sai**:
  ```tsx
  // ❌ Tệ: Tốn render thừa, dễ desync
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
  }, [items]);
  ```
- **Đúng**:
  ```tsx
  // ✅ Tốt: Tính toán tức thì hoặc dùng useMemo nếu mảng cực lớn
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [items]);
  ```

### 2.2. Hạn Chế `useEffect` Không Cần Thiết
- Chỉ sử dụng `useEffect` khi thực sự đồng bộ hóa với hệ thống bên ngoài (External System):
  - Lắng nghe sự kiện cửa sổ: `scroll`, `resize`, `keydown`.
  - Khởi tạo `IntersectionObserver` hoặc `matchMedia`.
  - Khởi tạo animation GSAP timeline.
- Luôn trả về hàm dọn dẹp (`cleanup function`) để gỡ bỏ event listener, hủy GSAP context (`ctx.revert()`) hoặc ngắt observer.

---

## 3. Chống Lỗi Bất Đồng Bộ Hydration (Hydration Mismatch)

Lỗi Hydration xảy ra khi HTML server sinh ra khác với DOM render lần đầu tại client:
1. **Truy cập `localStorage`**:
   - Chỉ đọc `localStorage` bên trong `useEffect` sau khi component đã mount trên client.
   - Tránh đọc `localStorage` trực tiếp trong giá trị khởi tạo `useState(localStorage.getItem(...))` vì server không có `localStorage`.
2. **Thời gian & Ngày tháng**:
   - Không gọi `new Date().toLocaleTimeString()` trực tiếp trong JSX mà không kiểm soát.
3. **Kiểm tra môi trường**:
   - Dùng pattern `isMounted`:
     ```tsx
     const [mounted, setMounted] = useState(false);
     useEffect(() => setMounted(true), []);
     if (!mounted) return null; // Hoặc skeleton
     ```

---

## 4. Xử Lý Đầy Đủ 4 Trạng Thái (Loading, Empty, Error, Success)

Mọi luồng dữ liệu và trải nghiệm người dùng phải bao quát đủ 4 trạng thái:
1. **Loading State**:
   - Model 3D đang tải: hiển thị loader tinh gọn (`MinhLabMascotLoader`).
   - Hình ảnh: dùng placeholder hoặc skeleton mờ.
2. **Empty State**:
   - Giỏ hàng trống (`CartDrawer`): Hiển thị icon giỏ hàng xám, thông điệp nhẹ nhàng và nút "Tiếp tục xem sản phẩm".
   - Danh mục không có sản phẩm: Hiển thị hướng dẫn chọn danh mục khác.
3. **Error State**:
   - Trình duyệt không hỗ trợ WebGL: Hiển thị ảnh chụp tĩnh vật studio thay thế.
   - Form gửi thiếu thông tin: Báo lỗi viền đỏ rõ ràng tại ô nhập liệu.
4. **Success State**:
   - Đặt hàng thành công (`CheckoutModal`): Hiện mã đơn hàng, tóm tắt người nhận, tổng tiền và hướng dẫn thanh toán VietQR / COD.

---

## 5. Tối Ưu Hóa Hiệu Năng & Tài Nguyên

- **Tối ưu hình ảnh (`next/image`)**:
  - Luôn sử dụng `<Image />` từ `next/image` thay cho thẻ `<img />` thông thường.
  - Cung cấp thuộc tính `sizes` chính xác cho responsive:
    `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"`
  - Ảnh logo và ảnh banner trên nếp gấp đầu trang (above-the-fold) phải có `priority`.
- **Tối ưu WebGL / 3D**:
  - Dừng vòng lặp render khi khuất màn hình (`frameloop={isInView ? 'always' : 'demand'}`).
  - Khống chế pixel ratio hợp lý: `dpr={[1, 1.5]}` để máy cấu hình yếu hoặc màn hình retina không bị nóng máy.
  - Hủy texture, geometry khi unmount model để tránh rò rỉ bộ nhớ (Memory Leak).

---

## 6. Tiêu Chuẩn TypeScript & Interface

- Đặt tên interface theo PascalCase (`ProductItem`, `CartItem`, `CartContextType`).
- Tách rõ Props interface:
  ```tsx
  interface ProductGalleryProps {
    initialCategory?: string;
    onSelectProduct?: (product: ProductItem) => void;
  }
  ```
- Giữ component API gọn gàng: Tránh truyền quá 5-7 props; gom nhóm dữ liệu vào object cấu trúc rõ ràng.
