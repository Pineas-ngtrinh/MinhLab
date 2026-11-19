# Bàn giao thiết kế luồng agent — 10/11/2026

Mã tác vụ: PROD-AGENT-DESIGN-20261110

Mục tiêu: Hoàn thiện thiết kế agent điều phối đơn catalogue theo dữ liệu không tô vàng và các quyết định người dùng đã chốt: người duyệt phương án, hệ thống tự đồng bộ trạng thái sau duyệt, giữ máy đến bàn giao đóng gói và bổ sung phụ kiện theo revision.

Tệp đã sửa:

- [Luồng agent](../design/production-agent-workflow.md): vai trò, quy trình, state/transition, giữ máy theo nhóm, transaction/idempotency, quyền và 16 ca rà soát.
- [Snapshot dữ liệu](../research/production-agent-data-2026-11-10.md): 6 SKU, 37 BOM không vàng, số lượng theo xác nhận hội thoại, đơn vị nhóm tay/mirror và các điểm cần đối chiếu.
- [Khung gom mẻ](../design/production-batching-design.md): dẫn tới luồng mới, thay quyền tự áp dụng bằng người duyệt, ghi quy tắc giữ máy và bảo mật file.
- [Quyết định](../DECISIONS.md): bổ sung các quyết định 10/11, giữ nguyên các quyết định lịch sử có ngày.
- [Mục lục](../README.md): thêm đường dẫn tới thiết kế, snapshot và bàn giao.
- Báo cáo bàn giao này.

Tóm tắt triển khai: Hoàn thành tài liệu thiết kế và dữ liệu đối chiếu. Duyệt kế hoạch cập nhật tiến độ SCHEDULED và giữ máy; bắt đầu job cập nhật IN_PRODUCTION; chuyển nhóm sang đóng gói gỡ các giữ máy đủ điều kiện. Các nhãn sản xuất là projection thiết kế, không thêm enum commerce vào code hiện hành. Phân biệt máy đang chạy, máy đã được giữ và máy đã in xong nhưng chưa được giải phóng; nhiều mẻ thuộc cùng nhóm vẫn thực thi nối tiếp trong giữ máy của nhóm. Agent không tự duyệt, khởi động máy hoặc đọc file in.

Kiểm tra đã chạy và kết quả:

- Đọc workbook bằng bundled Python/openpyxl ở chế độ phân tích; đối chiếu màu dòng và khóa SKU: đúng 6 SKU/37 BOM không vàng; 30 Resin, 6 FDM, 1 Decal. Xác nhận cột số lượng nguồn còn trống, trạng thái BOM nguồn đều “Chưa”; số lượng 1 trong snapshot đến từ ảnh hội thoại người dùng bổ sung.
- Đối chiếu SHA-256 workbook trước/sau trích xuất: không đổi. Workbook nguồn không được lưu lại hoặc chỉnh sửa; không mở file 3D.
- Đọc enum/policy orders, schema printers/production_jobs và kiến trúc để phân biệt trạng thái thương mại hiện có với tiến độ/máy ở mức thiết kế.
- `git diff --check` trên scope tài liệu: exit 0. Các file scope đang untracked từ trước/hoặc mới tạo, nên kiểm thêm từng file bằng `git diff --no-index --check /dev/null <path>`; kiểm cuối toàn bộ 6 tệp không có lỗi whitespace.
- Kiểm đường dẫn tài liệu/nguồn và các link mới trong mục lục/quyết định: hợp lệ trên workspace tại thời điểm bàn giao. Link có hậu tố dòng như `:1` được xử lý đúng khi kiểm.
- Rà soát nội dung các tình huống approval cạnh tranh/retry, mẻ nhiều đơn, đơn nhiều máy, thiếu phụ kiện, máy hỏng khi đóng gói và vòng chờ do giữ máy đến đóng gói. Đây là rà soát thiết kế, không phải chạy engine hoặc nghiệm thu xưởng.
- Không chạy typecheck/build/server/browser hoặc test runtime vì chỉ thay tài liệu, không thay code/schema/UI.

Ảnh hưởng kiến trúc: Đặc tả thêm production plan/approval, giữ máy có phạm vi, allocation nhiều-nhiều và projection tiến độ cho lần triển khai sau; chưa tạo migration, API, tool LLM hoặc worker. Giữ ranh giới domain/use case/repository/integration/server và dùng policy orders hiện hành.

Ảnh hưởng OOAD: Chỉ cập nhật đặc tả nghiệp vụ. Chưa sửa/render UML/draw.io, manifest hoặc traceability; đã đánh dấu E09 là nguồn cũ chưa đồng bộ các quyết định vận hành 10/11. Khi cập nhật hồ sơ OOAD, phải đưa vào quyền người duyệt, giữ máy tới đóng gói và tiến độ theo allocation.

Rủi ro đã biết:

- Máy/profile/layout, duration/setup, tồn/QC/WIP, lịch và mapping SKU tới UUID catalogue thật còn cần được cấu hình/xác minh trước khi áp dụng plan thực tế.
- Mã LH ghi dùng chung IDE nhưng khác mã nguồn; Stinger có mô tả công nghệ tổng quan khác BOM; cùng mã nguồn ở các tên linh kiện khác nhau; tên thương hiệu vật liệu FDM chưa chỉ rõ polymer/grade. Các điểm này không được tự chuẩn hóa thành quyết định kỹ thuật đã duyệt.
- Số lượng 1 được hiểu theo đơn vị/nhóm BOM. Nhóm tay có quy tắc nhân bản/mirror; số object/yield cho các nhóm ghép còn cần metadata recipe trước khi tính capacity.
- Giữ máy đến đóng gói có thể tạo thời gian chờ và phụ thuộc nhiều máy. Thiết kế yêu cầu kiểm đường đi tới đóng gói và cho phép các job nội bộ của cùng nhóm, không tự bỏ quy tắc người dùng.

Vấn đề còn lại: Triển khai runtime theo đặc tả là giai đoạn tiếp theo; cần migration/contract và test domain/integration tương ứng. Đồng bộ bộ sơ đồ OOAD khi thực hiện tác vụ OOAD. Chưa chọn nhà cung cấp/API/model LLM; chưa có số liệu để khẳng định mức cải thiện vận hành.

Trạng thái rà soát: Sẵn sàng để ChatGPT rà soát.
