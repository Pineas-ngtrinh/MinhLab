# MinhLab 3D — prototype 2 chức năng

Ba màn hình desktop 1440 × 900:

1. **Bộ sưu tập** — xem và lọc danh mục sản phẩm.
2. **Chi tiết sản phẩm** — xem ảnh, thông số, giá và thao tác mua.
3. **In theo file** — tải mẫu 3D, chọn vật liệu, độ mịn và nhập thông tin nhận báo giá.

## Cách đưa vào Figma với bảng Layers rõ ràng

1. Mở một **Figma Design file** mới trong ứng dụng Figma trên máy tính.
2. Vào **Plugins → Development → Import new plugin from manifest…** và chọn `manifest.json` trong thư mục này.
3. Chạy plugin **MinhLab 3D Prototype** từ **Plugins → Development**.

Plugin tạo ba Frame với các nhóm `Header desktop`, `Page heading`, `Category filter tabs`, `Featured product`, `Product gallery`, `Print request form`. Chữ, khối nền, viền, ảnh và các điểm bấm đều là lớp riêng. Ảnh được nhúng từ thư mục `public/images` của dự án; plugin không dùng mạng.

## Các liên kết prototype đã nối

- Màn hình 01: **Xem chi tiết** → màn hình 02.
- Màn hình 01 hoặc 02: **Gửi file cần in** → màn hình 03.
- Màn hình 02: đường dẫn **Bộ sưu tập** → màn hình 01.
- Màn hình 03: menu **Bộ sưu tập** → màn hình 01.

Trong Figma, mở tab **Prototype** và chọn màn hình 01 làm điểm bắt đầu nếu Figma chưa tự chọn. Bản này minh họa luồng và giao diện; nó không xử lý tải tệp hoặc đặt hàng thật bên trong Figma.

## Cách nhập nhanh

Có thể kéo ba file `.svg` vào canvas Figma để xem hoặc chỉnh các vector. Cách plugin ở trên cho cấu trúc Frame, nhóm và chữ gốc rõ hơn trong bảng Layers. SVG cũng là bản dự phòng khi chưa chạy plugin.

## Nguồn giao diện

Thiết kế tham chiếu trực tiếp `ProductGallery.tsx`, `PrintRequestForm.tsx`, `Header.tsx` và ảnh trong `public/images`. Kích thước và nội dung đã được rút gọn có chủ đích cho bài prototype ba màn hình.
