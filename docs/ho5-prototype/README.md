# MinhLab HO #5 — Prototype thao tác gửi yêu cầu in 3D

Bộ prototype Figma để chụp ảnh nộp bài. Gồm các trạng thái của một tính năng: chọn tệp, xem tệp đã nạp, chọn cấu hình, báo lỗi số điện thoại, thông tin hợp lệ và lớp xác nhận dạng overlay.

## Cài vào Figma

1. Giải nén `HO5-minhlab-figma-plugin.zip`.
2. Mở file Figma đang làm HO #4 và tạo một Page mới tên `HO5 — Gửi yêu cầu in 3D`, để giữ nguyên bài trước.
3. Trong Figma Desktop, mở **Plugins → Development → Import plugin from manifest…** rồi chọn `manifest.json` trong thư mục `ho5-prototype` vừa giải nén.
4. Chọn **Plugins → Development → MinhLab HO5 - Print Request**. Plugin tạo sáu Frame có layer native trên Page đang mở.
5. Bấm vào Frame `01 / Tải tệp`, nhấn **Present** và đi theo các nút tương tác trên màn hình.

## Luồng để trình bày

- **Chọn tệp mẫu:** Frame 01 → vùng tải tệp → Frame 02.
- **Chọn cấu hình:** Frame 02 → vùng chọn PETG → Frame 03.
- **Kiểm tra dữ liệu:** nút tiếp tục ở Frame 01, 02 hoặc 03 → Frame 04 có lỗi số điện thoại.
- **Sửa và xác nhận:** bấm trường số điện thoại trong Frame 04 → Frame 05 → nút tạo bản tóm tắt → overlay xác nhận.
- Đóng overlay hoặc chọn quay lại để trở về màn hình hợp lệ.

## Ảnh nộp

Chụp các ảnh từ Figma: (1) toàn bộ canvas ở Design/Prototype với tên Frame, Layers và dây nối nhìn rõ; (2) màn hình trình chiếu trạng thái báo lỗi; (3) màn hình overlay tóm tắt. Gộp ảnh vào một file duy nhất theo yêu cầu bài. Không cần tạo báo cáo PDF riêng.

Các trạng thái liên hệ và file mẫu là dữ liệu minh họa để demo. Prototype không tải tệp lên máy chủ, không gửi yêu cầu và không liên hệ Zalo/email thật.
