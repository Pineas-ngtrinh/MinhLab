# Xem nhiều STL và bề mặt FDM — 18/11/2026

Mã tác vụ: FDM-PREVIEW-028

Mục tiêu: hiển thị nhiều linh kiện trong cùng khung 3D, thêm vân lớp nhựa FDM thay cho bề mặt láng mặc định.

Tệp đã sửa: `STLViewerCanvas.tsx`, `PrintFilePanel.tsx`; thêm `useStlPreview.ts`, `stl-preview-layout.ts`, `fdm-preview-material.ts`, `scripts/tests/test-stl-preview.test.cjs`; cập nhật script test và đóng gói.

Tóm tắt triển khai:

- Mặc định vẽ mỗi file STL một mẫu, xếp cạnh nhau không giao nhau, giữ tỷ lệ mm và Z-up từ file. Chọn trực tiếp mesh hoặc tên trong danh sách; có chế độ chỉ xem file đang chọn.
- Camera fit theo toàn bộ nhóm và tỷ lệ khung nhìn. Nhắc rõ nếu nhóm vượt khổ bàn 180 mm. Đây là bố trí để so sánh, không phải lắp ráp xe, bố trí sản xuất hay nhân bản theo số lượng đặt in.
- Bề mặt nhựa mờ, vân ngang bước 0,20 mm theo profile tham khảo và vân sợi chéo mặt trên. Shader giảm sọc khi nhìn xa bằng đạo hàm màn hình. Có thể đổi bề mặt láng hoặc khung lưới.
- Vân chỉ minh họa bề mặt; không tính đường đùn, support, seam hay slicing. Không thay đổi nguồn STL, mô hình hồi quy, nhựa/thời gian dự đoán hoặc giá.
- Đọc từng STL lần lượt, cache geometry khi đổi màu/tỷ lệ/lựa chọn, giải phóng geometry đã bỏ và khi unmount. Giữ giới hạn 10 file/tổng 100 MB; một Canvas cho cả nhóm.

Kiểm tra đã chạy và kết quả: bộ `test:print-request` 30/30 đạt, gồm kiểm tra bố trí không chồng, giữ tỷ lệ mm/Z-up, không sửa buffer nguồn và gắn shader vào đúng chunk của Three 0.160.1. `npm run check` và build được ghi ở bàn giao sau khi hoàn tất. Test shader không thay thế kiểm tra GPU thực tế.

Ảnh hưởng kiến trúc: chỉ frontend và tài nguyên GPU do preview sở hữu; không thêm thư viện.

Ảnh hưởng OOAD: Không áp dụng, không sửa bộ sơ đồ được bảo vệ.

Rủi ro đã biết: nhiều STL lớn có thể dùng đáng kể RAM/GPU trên điện thoại. Vân nhỏ chỉ thấy khi phóng gần và phụ thuộc GPU. Không có ảnh chụp nghiệm thu: browser host không khả dụng, Chrome headless khởi động bị dừng (exit 134), cả lần chạy trong sandbox và lần nâng quyền.

Vấn đề còn lại: nghiệm thu WebGL thực tế trên điện thoại/desktop; cập nhật VPS theo gói mới. Gói gộp cả tự liên kết Telegram/migration 027 đang chờ deploy.

Trạng thái rà soát: Cần xử lý tiếp — nghiệm thu đồ họa thực tế và triển khai VPS.
