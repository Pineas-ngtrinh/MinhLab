# Kế hoạch hiệu chỉnh mô hình dự đoán báo giá FDM

Ngày: 20/10/2026. Trạng thái: kế hoạch, chưa huấn luyện, chưa thay giá hay dữ liệu production. Bổ sung cho [thiết kế lại dịch vụ in](../planning/custom-print-redesign-plan.md), kế thừa các nguyên tắc đánh giá trong `src/lib/quote/ml/reports/improvement_plan.md`.

## 1. Mục tiêu và ranh giới

- Hỗ trợ đúng vật liệu MinhLab có: PLA, PLA Silk và PETG; chỉ mở giá cho profile đã được đánh giá phù hợp. Danh sách màu không thay thế dữ liệu huấn luyện.
- Phân biệt FDM một màu, một cuộn phối màu, đổi màu tự động và in các phần riêng rồi lắp. Các phương án này không cùng cơ chế phát sinh chi phí.
- Dự đoán lượng vật liệu, thời gian máy và phần hao hụt; tính giá bằng bảng giá được chủ xưởng phê duyệt. Không học giá bán trực tiếp từ vài báo giá cũ chưa chuẩn hóa.
- Resin luôn đi qua báo giá thủ công theo yêu cầu đã chốt. Không áp dụng hệ số FDM hoặc xây mô hình resin trong phạm vi này.
- Không dùng các số người dùng gửi cạnh tên màu làm đơn giá hoặc số đo bản in; yêu cầu của người dùng là chỉ lấy màu.

## 2. Hiện trạng đã kiểm tra trong source

| Hạng mục | Hiện tại | Cần cải thiện |
| --- | --- | --- |
| Model đang nạp | `stl-pla-a1mini-physical-v1`, provisional, chỉ PLA | Đánh giá riêng PETG/PLA Silk, profile máy và phương án nhiều màu |
| Dữ liệu | 30 dòng manifest; 1.125 lượt slicer: PLA/PETG_HF/TPU mỗi nhóm 375; 1.105 `ok`, 2 extended timeout, 18 vượt khổ | Kiểm tra chất lượng, nguồn độc lập và định nghĩa nhãn; chưa có dữ liệu nhiều màu ở các cột hiện tại |
| Nhãn | Ước tính Bambu Studio; chưa có bằng chứng cân/đo bản in thật trong model | Bổ sung đo thực tế theo từng vật liệu/profile |
| Đầu vào quote | Vật liệu, scale, infill | Thêm định danh profile, chế độ màu, lựa chọn màu và số lượng/bố trí theo lượt |
| Khối lượng | Diện tích/thể tích/infill và hệ số hiệu chỉnh | Tách mẫu, support, brim, purge/prime tower; tránh tính trùng |
| Thời gian | Thể tích vật liệu, chiều cao, diện tích | Xem thêm số lớp, đường in, tốc độ/profile, đổi màu và tổng chu kỳ |
| Giá | Khối lượng × đơn giá theo nhóm nhựa + điện/công cố định | Chốt cách tính theo giờ máy, vật liệu/finish, lượt in, số lượng và hoàn thiện |
| Giao diện | PLA Basic đang lấy `developerPreview` và bỏ qua cờ provisional khi hiển thị tham khảo | Dùng một chính sách cho phép hiển thị; không bỏ cờ để tự mở giá |

Theo `model_params.json`, sai số CV khối lượng MAPE khoảng **16,29%**, thời gian khoảng **30,41%**; P90 sai số tương đối khoảng **29,92% / 53,77%**. Đây là kết quả đã lưu so với nhãn slicer, không phải độ chính xác trên bản in thật hoặc trên PETG/nhiều màu. Chưa chạy lại đánh giá trong lần lập kế hoạch này.

## 3. Kiến trúc dự đoán và tính giá

**File + cấu hình có thật → kiểm tra phạm vi → ước lượng tài nguyên → khoảng bất định → bảng giá phiên bản → giá tham khảo hoặc chuyển kỹ thuật.**

### A. Ước lượng tài nguyên

- Một màu: lượng nhựa mẫu, support/brim, thời gian máy/tổng chu kỳ.
- Đổi màu tự động: thêm lượng purge/tower, số lần đổi màu và thời gian phụ. Phải biết phân vùng và thứ tự màu theo lớp từ dữ liệu thích hợp hoặc kết quả slice; số màu đơn thuần không đủ.
- Tách phần rồi lắp: dự đoán từng phần/lượt, thêm phần chuẩn bị và lắp do nhân sự xác nhận. Không gán hao hụt AMS cho phương án này.
- Một cuộn silk/phối màu: định danh filament/profile riêng; không coi là nhiều lần đổi màu chỉ vì tên có hai sắc.

### B. Bảng giá nghiệp vụ

Công thức đề xuất để chủ xưởng chốt, chưa có đơn giá mặc định mới:

`Giá trước vận chuyển = phần vật liệu tính phí + phần giờ máy tính phí + chuẩn bị/lượt + công hoàn thiện/lắp + phụ phí được duyệt − giảm giá được duyệt`.

- Nếu đơn giá theo gram đã gồm lợi nhuận hoặc một phần chi phí máy, không cộng lại những khoản đó lần hai. Cần chọn rõ mô hình giá, không trộn giá vốn và giá bán.
- Phần vật liệu phải xác định có bao gồm support/purge/brim hay không; mỗi phần chỉ xuất hiện một lần.
- Không mặc định mọi màu PETG cùng profile/cùng giá hoặc PLA Silk cùng tốc độ PLA Basic. Chỉ tách đơn giá màu/finish khi xưởng thực sự có chính sách khác nhau.
- Số lượng ảnh hưởng cách xếp bàn, số lượt và cách chia chi phí chuẩn bị/hao hụt. Không mặc định tổng là giá một mẫu × số lượng, cũng không tự giảm giá theo số lượng.
- Phí vận chuyển và các khoản chưa xác định trình bày riêng; không biến giá tham khảo thành cam kết thanh toán.

## 4. Dữ liệu cần thu

### Danh mục profile

Máy, khả năng đổi màu thực tế, nozzle, slicer/version, layer, wall/top/bottom, infill/pattern, support, hướng đặt, mã vật liệu/finish và profile tốc độ. PETG_HF trong bộ cũ không tự đại diện cho mọi cuộn PETG người dùng liệt kê.

### Mỗi lần slice/in

- ID và hash file, nhóm nguồn/quan hệ biến thể, bộ phận, phiên bản cấu hình và bố trí bàn.
- Công nghệ, material ID, các màu và vai trò/bộ phận, chế độ một cuộn/AMS/tách lắp, số bản sao/số lượt.
- Nhựa mẫu/support/brim/purge/tower theo thành phần và vật liệu nếu slicer cung cấp; ghi rõ nhãn nào là tổng.
- Số lần đổi màu, thời gian mẫu, thời gian phụ và tổng thời gian theo định nghĩa thống nhất.
- Khi có bản in thật: khối lượng đo, phần hao hụt có thể đo tách được, thời gian bắt đầu/kết thúc, dừng/lỗi và kết quả. Lưu lý do loại mẫu, không xóa bản in hỏng để làm đẹp số liệu.
- Báo giá thợ duyệt, các dòng chi phí và lý do điều chỉnh để đối chiếu, không dùng thay nhãn vật lý.

STL hiện tại không cung cấp đủ phân vùng màu. Với STL chưa phân phần, nhiều màu đi qua kiểm tra thủ công; có thể nhận mô tả/ảnh làm đầu vào tư vấn, không giả rằng model đã hiểu vị trí màu. Đọc 3MF phải có parser và quy tắc xác thực riêng nếu triển khai.

## 5. Lộ trình hiệu chỉnh

### M0 — Khóa quy tắc hiển thị giá

Thống nhất trạng thái `manual_quote`, `awaiting_review`, `reference_ready`. Resin, profile lạ, mesh lỗi, thiếu phân vùng nhiều màu hoặc model chưa đạt đều không trả giá dùng để thanh toán. UI phải theo cùng chính sách với service; không đọc `developerPreview` để vượt cổng duyệt. Lưu riêng model version, rate-card version và lý do cần thợ duyệt.

### M1 — Làm sạch dữ liệu và tái lập baseline

Kiểm tra hai lượt extended timeout, nguồn trùng, đơn vị, hướng in và thành phần `mass_g`/thời gian. Khóa snapshot dữ liệu; tái lập baseline PLA trước khi thay mô hình. PETG cần báo cáo riêng trên các lượt hợp lệ, không chỉ đổi nhãn supportedMaterials. TPU giữ ngoài phạm vi công bố nếu không phải vật liệu xưởng cung cấp.

### M2 — Cải thiện FDM một màu trước

So sánh baseline vật lý hiện có, mô hình vỏ/infill có kiểm soát và hồi quy regularization; thêm từng nhóm đặc trưng hình học khả dụng khi khách gửi file. Đánh giá phần thời gian với số lớp/đường in ước lượng và profile. PLA Silk dùng profile và dữ liệu riêng hoặc chuyển duyệt thủ công nếu chưa đủ mẫu. Giữ mô hình đơn giản nhất đáp ứng mục tiêu, không chọn thuật toán phức tạp chỉ vì muốn gọi là AI.

### M3 — Thử nghiệm nhiều màu theo khả năng máy đã xác nhận

Thiết kế mẫu cùng hình học/cấu hình nhưng khác phân bố màu, số lần đổi màu, bố trí nhiều bản sao và phương án tách/lắp. Ghi hao hụt/thời gian từ slice; dùng định luật tính chi phí đơn giản làm baseline trước khi hồi quy phụ phí. Giai đoạn chưa có đủ biến đầu vào đáng tin, chỉ cung cấp ước lượng nội bộ để thợ duyệt. Không yêu cầu model suy ra purge từ tên/mã HEX.

### M4 — Hiệu chỉnh bằng in thật và kiểm định

Pilot đề xuất khoảng 15–20 lượt đa dạng vật liệu/hình dạng/phương án làm thực có; đây chỉ là bước khởi đầu, không cam kết đủ dữ liệu để mở giá tự động. Tách mẫu hiệu chỉnh với mẫu kiểm tra theo nguồn. Phân biệt sai số model so với slicer và slicer so với bản in thật; bổ sung phép đo khi chưa đủ đại diện.

### M5 — Kết nối giao diện, database và vận hành

Lưu request item, màu/phân bố, profile, số lượng, ước lượng, lý do cần duyệt và phiên bản. Khi khách đổi màu/file/số lượng, hủy hiệu lực báo giá nháp tương ứng và tính/duyệt lại. Bảng giá chính thức và tổng đơn tính trên server; khách chỉ xem khoảng tham khảo khi đủ điều kiện. Theo dõi chênh lệch giá dự kiến với giá thợ duyệt để phát hiện profile lệch.

## 6. Phương pháp đánh giá và tiêu chí mở giá

- Chia train/validation/test theo **nguồn thiết kế**; tất cả biến thể scale/infill/màu của cùng nguồn nằm cùng nhóm. Giữ tập nguồn mới chưa dùng để chọn mô hình; không gọi một tập là test độc lập sau khi đã dùng nó để sửa model.
- Chỉ dùng đầu vào có sẵn tại thời điểm dự đoán. Số lần đổi màu/support từ slicer không được dùng huấn luyện rồi yêu cầu model chạy chỉ với diện tích/thể tích ở website.
- Báo cáo MAE/WAPE/MAPE/P90 theo vật liệu, hình dạng và phương án màu; thêm sai số tiền, xu hướng báo thiếu và tỷ lệ yêu cầu model đủ điều kiện xử lý.
- Khoảng giá phải có độ bao phủ được đo trên dữ liệu giữ riêng. Không coi nhân dự đoán với `1 ± P90 sai số tương đối` là khoảng tin cậy đã được kiểm định.
- Mốc thảo luận cho một màu: MAPE khối lượng ≤15%, thời gian ≤25%, phải báo MAE/P90 và từng nhóm khó. Đây là mục tiêu đề xuất, chưa phải kết quả hoặc lời hứa đạt. Ngưỡng sai số tiền, mức báo thiếu chấp nhận được và độ bao phủ khoảng giá do chủ xưởng chốt trước đánh giá cuối.
- Nhiều màu/PETG/PLA Silk chỉ mở từng phạm vi đã đạt; không dùng điểm tốt của PLA để mở toàn bộ. Một cờ `provisional=false` không đủ chứng minh chất lượng.
- Khi triển khai mới bổ sung kiểm thử đối chiếu Python–TypeScript, chống tính trùng hao hụt, batch/số lượng, đổi bảng giá, model ngoài phạm vi và resin không gọi model FDM.

## 7. Đầu ra để báo cáo OOAD và demo

1. Bảng màu theo vật liệu và khả năng xưởng, có nguồn xác nhận.
2. Từ điển dữ liệu đo/slice, snapshot dữ liệu và baseline tái lập.
3. Bảng so sánh các mô hình trên cùng phép chia nguồn, kèm hạn chế.
4. Cấu hình model/bảng giá có phiên bản, chính sách cho phép hiển thị và chuyển thợ duyệt.
5. Use case: yêu cầu nhiều màu → kỹ thuật kiểm tra → báo giá → khách xác nhận; resin báo thủ công riêng.
6. Demo thể hiện đúng ba trường hợp: một màu đủ điều kiện tham khảo; nhiều màu cần dữ liệu/duyệt; resin báo giá thủ công.

## 8. Thông tin còn chờ

- In nhiều màu bằng AMS, tách chi tiết/lắp hoặc cả hai; khả năng máy và cấu hình thực tế.
- Dòng PET “xanh dương tím” và chuẩn hóa các tên Betg/Bet.
- Bảng màu resin và công hoàn thiện nhận làm.
- Đơn giá/quy tắc thương mại do MinhLab duyệt, số liệu slice nhiều màu và các bản in thật để hiệu chỉnh.

Không dùng các giá trị thiếu để tự huấn luyện, tạo độ chính xác giả hoặc điền phụ phí mặc định. Kế hoạch này không thay website, database hoặc mô hình hiện hành.
