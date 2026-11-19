# Tích hợp mô hình báo giá v3 vào website MinhLAB

Hoàn tất ngày 21/10/2026. Source: `/Users/nguyenphucphu/Downloads/minhlab-3d`.

## Kết quả

Website nạp bản `model_improved_v3/model_v3.json` từ thư mục model_minhLAB. Hệ số được sao chép nguyên vẹn, SHA256 `8b7a29fad6140069d8bf429a95fa73c1e86c38ac2d821e8c424da849e41a3331`. Không huấn luyện lại, không thay model bằng candidate v4.

Luồng chạy: STL → Web Worker trích đặc trưng hình học/hướng in/24 tiết diện/proxy support → hồi quy gram và phút → tính giá. Website chạy bằng TypeScript; không cần Python, slicer hoặc dataset trên máy triển khai.

Công thức trước ship: `ROUND_HALF_UP(gram × 1.000đ + phút/60 × 3.500đ)`. Điện tính theo giờ model; công 0đ. Lợi nhuận đã gồm trong đơn giá nhựa. Nhãn tổng gram có support/brim nên không cộng thêm khoản đó lần hai. Làm tròn một lần sau khi cộng, đồng bộ với Python. Giá trị thời gian nội bộ website là giây; model xuất phút.

Bảng giá đồng bộ với model: phí ship 25.000đ khi giá sản phẩm ≤300.000đ, miễn ship khi >300.000đ. Source cũ dùng mốc 500.000đ đã được thay bằng mốc 300.000đ của gói model. Giao diện giá tham khảo một sản phẩm chưa cộng ship và hậu xử lý.

Ánh xạ đúng profile PLA Basic → PLA; PETG HF → PETG_HF; TPU 95A HF → TPU_95A_HF. Vật liệu cần tư vấn tiếp tục đi qua nhân viên. Không suy rộng sang PLA Silk, resin hay chế độ nhiều màu.

## Phạm vi và chuyển duyệt

Vùng hữu dụng XY 170 ×170 mm, chừa brim 5 mm mỗi phía, nên mẫu ≤160 ×160 mm; chiều cao ≤180 mm. Giữ nguyên file và hướng khách gửi; không tự thu nhỏ/đổi hướng. Scale hợp lệ của mô hình là 0,5–1,5. Yêu cầu tỷ lệ khác vẫn nhập được nhưng chuyển nhân viên kiểm tra.

Mesh hở, không manifold, sai hướng mặt, tam giác suy biến, đơn vị đáng ngờ, topology chưa kiểm tra đủ, thiếu đặc trưng hoặc vượt phạm vi không được hiện giá tham khảo. Khi có lỗi dự đoán, form vẫn sử dụng được và hướng khách sang nhân viên.

`toReferenceQuoteView()` là chính sách hiển thị giá tham khảo dùng chung; chỉ bỏ chặn cờ provisional cho phần tham khảo, các cờ khác vẫn chặn. `toCustomerQuoteView()` tiếp tục chặn giá dùng cho đơn hàng khi chưa được duyệt. Giá tham khảo không phải tổng tiền thanh toán.

Khoảng giá dùng sai số P90 trên dự đoán OOF của dữ liệu phát triển cho cả gram và thời gian. Đây là khoảng tham khảo, chưa đo độ bao phủ độc lập; không gọi là khoảng tin cậy. Nhãn là kết quả slicer, không phải lượng điện/nhựa đã đo trên máy thật. Không mở final test hay hứa độ chính xác trên STL mới trong lần tích hợp này.

## Kiểm chứng

- `npm run test:quote`: 21 kiểm thử đạt, gồm phân tích STL, tiền điện theo thời gian, làm tròn, ship, chuyển duyệt và đối chiếu Python.
- 108 cấu hình tham chiếu Python trên 4 hình học tổng hợp: hộp, đổi hướng hộp, STL ASCII có dịch chuyển và khối T có mặt treo; 3 vật liệu ×3 infill ×3 scale. Các đặc trưng và dự đoán khớp trong dung sai; số tiền nguyên khớp tuyệt đối.
- Đối chiếu thêm 810 cấu hình từ đặc trưng đã lưu của 30 STL. Sai lệch tương đối lớn nhất khoảng `2,81e-14`; giá sản phẩm và tổng sau ship khớp Python.
- Đọc trực tiếp 4 STL thật G1_01, G2_02, G3_05, G5_04; đặc trưng TypeScript khớp bộ Python. G5_04 được phát hiện có tam giác suy biến và chuyển kiểm tra.
- `npm run check` (TypeScript + lint) và `npm run build`: đạt, build sinh đủ 33 trang.
- Trình duyệt local: file hộp 20 ×30 ×40 mm, PLA, infill 15%, scale 100% cho giá **12.931đ** trước ship (hiển thị nhựa 11.338đ, điện 1.593đ). Đổi PETG HF/TPU và infill 80% cập nhật giá; scale 5000% chuyển duyệt, form không lỗi.
- Đã quan sát vùng giá tại 375/768/1024/1440 px, không tràn ngang; không có console error trong tab kiểm thử. Ảnh kèm cùng thư mục báo cáo.

Các phép đối chiếu này chứng minh tích hợp đúng công thức và suy luận Python, không phải đánh giá thêm độ chính xác của mô hình so với slicer hay máy thật.

## File chính và tái lập

- `src/lib/quote/config/model_v3.json`, `model_v3_metadata.json`, `rate_card.json`, `defaults.ts`.
- `src/lib/quote/stl/model-geometry.ts`, `stl/analyze.ts`, `estimate/regression.ts`, `estimate/estimate.ts`.
- `src/lib/quote/pricing/pricing.ts`, `quote.ts`, `reference.ts`.
- `src/components/print-request/usePrintRequest.ts`, `PrintConfigurationPanel.tsx`.
- `scripts/quote/sync-quote-v3.py` đồng bộ một gói v3 đã duyệt; `scripts/quote/generate-v3-fixtures.py` tái tạo dữ liệu kiểm thử tổng hợp bằng Python có NumPy.

Bản sao các file trước thay đổi tại `.local/quote-v3-backup-20261021-115157/` trong source website; `manifest.json` ghi các đường dẫn và hash. Giữ nguyên các chỉnh sửa không liên quan đã có trong source. `model_params.json` là snapshot v1 cũ và không còn được import.

Website đã được cập nhật source và kiểm tra local. Chưa triển khai lên máy chủ công khai.
