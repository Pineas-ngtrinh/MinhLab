---
name: visual-qa
description: >-
  Use this skill after completing or modifying any UI components or page layouts
  in MinhLab 3D. Guides the visual and functional quality assurance (QA) inspection
  using a browser, testing multiple viewports (desktop, tablet, mobile), detecting
  overflow, inspecting states, taking screenshots, fixing defects, and verifying builds.
---

# Visual QA & Browser Verification Runbook (MinhLab 3D)

Kỹ năng này định nghĩa quy trình kiểm thử trực quan và xác nhận chất lượng giao diện thực tế trên trình duyệt cho website **MinhLab 3D**. Không có nhiệm vụ giao diện nào được coi là hoàn tất nếu chưa đi qua danh sách kiểm tra này.

---

## 1. Chuẩn Bị Môi Trường Local

Trước khi kiểm tra giao diện:
1. Đảm bảo máy chủ phát triển đang chạy:
   ```bash
   # Kiểm tra port 3000 đang phục vụ 200 OK
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
   ```
2. Nếu máy chủ chưa chạy hoặc bị lỗi chunk webpack:
   - Dừng tiến trình cũ nếu có.
   - Khởi chạy lại: `npx next dev -p 3000` (ở chế độ daemon / background task).
   - Đảm bảo terminal báo: `Ready in ...ms`.

---

## 2. Danh Sách Kiểm Tra 10 Điểm (10-Point QA Checklist)

### 2.1. Kiểm Tra 3 Kích Thước Màn Hình Bắt Buộc
- **Desktop lớn (1440px / 1280px)**:
  - Header dàn ngang đủ khoảng cách, menu desktop hiển thị đầy đủ 5 mục.
  - Sân khấu 3D Mascot và mô hình phòng Lab căn giữa, không bị lệch hoặc cắt cụt.
  - Grid sản phẩm hiển thị chuẩn 3 cột (`grid-cols-3`).
- **Tablet (768px - iPad Portrait)**:
  - Grid sản phẩm co về 2 cột (`grid-cols-2`).
  - Thanh tabs lọc danh mục cuộn ngang mượt mà, không làm vỡ layout.
- **Mobile nhỏ (375px - iPhone SE)**:
  - Header chuyển sang nút Hamburger Menu.
  - Grid sản phẩm hiển thị 1 cột (`grid-cols-1`) hoặc thẻ trượt tối ưu cảm ứng.
  - Mascot 3D và Lab Canvas co về chiều cao thích ứng (360px).

### 2.2. Kiểm Tra Tràn Khung Ngang (Zero Horizontal Overflow)
- Sử dụng console hoặc kiểm tra chuột:
  ```javascript
  document.documentElement.scrollWidth <= window.innerWidth
  ```
- Tuyệt đối không được xuất hiện thanh cuộn ngang dưới đáy trình duyệt ở bất kỳ breakpoint nào.

### 2.3. Kiểm Tra Menu Mobile
- Bấm nút Hamburger: Drawer mở trơn tru, phủ nền mờ kín màn hình.
- Bấm vào một liên kết (ví dụ `#san-pham`): Menu tự động đóng lại và trang cuộn êm đến đúng vị trí (có bù trừ khoảng cách 80px của header cố định).
- Bấm icon `X`: Menu đóng ngay lập tức.

### 2.4. Kiểm Tra Khoảng Cách, Căn Lề & Typography
- Khoảng cách giữa các tiêu đề section đồng đều (chuẩn 80px–96px: `py-20 sm:py-24`).
- Chữ tiếng Việt không bị lỗi font, không bị gãy dòng đột ngột hay mất dấu.
- Font số tiền và thông số kỹ thuật dùng đúng font mono (`SF Mono` / `font-mono`).

### 2.5. Kiểm Tra Hình Ảnh & Tỷ Lệ Khung Hình
- Không có ảnh bị vỡ (broken image icon).
- Ảnh sản phẩm dùng `object-cover object-center`, không bị méo tỷ lệ (stretched / squished).

### 2.6. Kiểm Tra Toàn Bộ Trạng Thái Tương Tác (States)
- **CartDrawer Empty State**: Mở giỏ hàng khi chưa có món nào -> Hiện icon giỏ trống, lời nhắn nhẹ nhàng và nút xem sản phẩm.
- **CartDrawer Active State**: Bấm "Mua ngay" hoặc "Thêm vào giỏ" -> Drawer mở ra, badge số lượng nhảy đúng, thanh Freeship cập nhật tỷ lệ %, nút tăng giảm (+/-) số lượng hoạt động chính xác.
- **CheckoutModal State**: Điền thông tin -> Thử submit -> Hiển thị màn hình thành công với mã đơn hàng và tổng tiền.

### 2.7. Kiểm Tra Điều Khiển 3D Canvas
- Mascot Khỉ Kỹ Sư 3D: Vẫy tay khi hover vào nút "Khám phá sản phẩm", chuyển động mắt/đầu nhẹ nhàng.
- Phòng Lab 3D: Bấm chọn từng bước (01 -> 05) trên thanh HUD -> Camera 3D lướt êm ái đến góc máy tương ứng, không bị giật khung hình và không cưỡng bức cuộn chuột của người dùng.

### 2.8. Kiểm Tra Khả Năng Tiếp Cận & Điều Hướng Bàn Phím
- Dùng phím `Tab` duyệt qua các nút bấm: Có vòng focus viền sáng nhìn rõ.
- Nhấn phím `Esc`: Đóng Drawer giỏ hàng và Modal chi tiết nếu đang mở.
- Phím mũi tên `←` / `→`: Điều khiển lùi/tiến bước trong Tour 3D phòng Lab.

---

## 3. Chụp Ảnh & Tự Khắc Phục Lỗi (Self-Healing Loop)

1. Khi phát hiện bất kỳ điểm nào chưa đạt chuẩn:
   - Ghi nhận chính xác component và dòng code gây lỗi.
   - Sử dụng công cụ `replace_file_content` sửa trực tiếp vào file.
2. Kiểm tra lại ngay lập tức:
   - Chạy `npx tsc --noEmit` để xác nhận không lỗi type.
   - Chạy `npm run build` để xác nhận đóng gói sạch sẽ.
3. Không bao giờ bàn giao một giao diện có lỗi hiển thị mà chưa tự kiểm tra và sửa chữa.
