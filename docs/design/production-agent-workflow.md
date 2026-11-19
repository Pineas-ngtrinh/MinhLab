# Luồng AI agent điều phối sản xuất catalogue

Ngày chốt ban đầu: 10/11/2026; bổ sung onboarding dữ liệu và ranh giới actor ngày 11/11/2026. Trạng thái: **đặc tả vẫn là nguồn quy tắc; một phần runtime/API/migration đã được triển khai ngày 11/11/2026**. Các sơ đồ không phải bằng chứng test.

Tài liệu này cụ thể hóa [khung gom mẻ](production-batching-design.md). Quyết định ngày 10/11 thay thế phần cho phép agent tự áp dụng kế hoạch trong thiết kế ngày 02/11: mọi kế hoạch và thay đổi kế hoạch đều do người có quyền quyết định. Hệ thống tự thực hiện các cập nhật liên quan sau khi người duyệt chấp nhận.

## 1. Phạm vi và dữ liệu

- Áp dụng cho dòng đơn mua sản phẩm catalogue đủ điều kiện sản xuất, kể cả sản phẩm nhận đặt trước. CUSTOM_PRINT không đi vào planner này.
- Tập dữ liệu ban đầu chỉ lấy các dòng không tô vàng trong workbook: 6 biến thể, 37 dòng BOM. Đây là snapshot tham chiếu ban đầu, không phải danh sách hard-code giới hạn agent. Sau này agent dùng sản phẩm, linh kiện và BOM revision hợp lệ đã được công bố trên database. Các dòng vàng không được dùng để tự thêm sản phẩm hoặc yêu cầu sản xuất.
- Theo xác nhận được người dùng cung cấp ngày 10/11, mỗi dòng BOM là **1 đơn vị linh kiện/nhóm linh kiện trên một bộ sản phẩm**. Riêng tay dùng mẫu một bên, nhân bản và lật gương để tạo bên còn lại. Một nhóm tay trong BOM khác với số object vật lý trên bàn in.
- Xác nhận số lượng không tự duyệt vật liệu, profile, khả năng máy hoặc bố trí mẻ. Snapshot và các điểm cần đối chiếu nằm ở dữ liệu đầu vào.
- Agent chỉ nhận mã nội bộ, revision, số lượng, quy cách, lịch và xác nhận kỹ thuật. File 3D, project slicer, G-code, tên file thật, đường dẫn và đường dẫn tải được giữ tại xưởng. Agent không đọc hình học, sửa file hoặc gửi lệnh khởi động máy.

## 2. Người và hệ thống làm gì

| Thành phần | Trách nhiệm |
| --- | --- |
| AI agent | Theo dõi thay đổi, yêu cầu core tính nhu cầu và candidate, chuẩn bị kế hoạch nháp, giải thích lựa chọn và công việc chuẩn bị, nêu phần thiếu dữ liệu |
| Core/engine | Kiểm tra số lượng, tồn kho, ràng buộc máy/profile/vật liệu, quyền, lịch và version; tính toán có thể lặp lại; ghi nhận kế hoạch được duyệt |
| Kỹ thuật/thợ | Xác nhận BOM/quy cách, kiểm tra slicer tại máy riêng, ghi bắt đầu/kết thúc thực tế, QC và bàn giao đóng gói |
| Người có quyền duyệt | Chấp nhận, sửa hoặc từ chối phương án; quyết định phương án điều chỉnh khi có sự cố |
| Hệ thống sau phê duyệt | Tự tạo job/allocation, giữ tài nguyên, cập nhật tiến độ liên quan và ghi lịch sử trong cùng giao dịch nghiệp vụ |

**Ranh giới OOAD ngày 11/11:** subject của bộ sơ đồ bổ sung là **phân hệ danh mục và quản lý sản xuất MinhLab**. AI Agent điều phối sản xuất là actor phần mềm tương tác với subject qua API/tool được cấp quyền để đọc dữ liệu, gửi kế hoạch và theo dõi. Subject sở hữu database, validation, quyền và transaction; agent không có quyền SQL trực tiếp. Actor này có thể cùng hạ tầng triển khai với ứng dụng, nhưng có trách nhiệm và danh tính riêng. Khi xem kiến trúc toàn giải pháp bao gồm cả agent thì agent được thể hiện là một component; không đổi ranh giới tùy tiện trong cùng một view. Các nhãn “agent nội bộ” ở sơ đồ cũ thể hiện view kiến trúc toàn giải pháp, không phải actor boundary của bộ bổ sung hiện tại.

Agent không có quyền tự duyệt. Theo policy đơn hiện tại, ADMIN/STAFF có quyền đưa đơn đủ điều kiện vào sản xuất; PRINT_OPERATOR ghi hoàn thiện trong phạm vi được phân quyền. Việc phân quyền cho thao tác duyệt kế hoạch phải bám theo các quyền này khi triển khai, không dùng quyền LLM để bỏ qua policy.

## 3. Luồng từ đơn đến đóng gói

1. **Nhận sự kiện:** đơn catalogue đủ điều kiện, tồn/QC thay đổi, máy được giải phóng, job lỗi hoặc người vận hành yêu cầu tính lại. Sự kiện được xử lý sau khi dữ liệu nguồn đã commit.
2. **Chụp dữ liệu:** core lấy các dòng đơn còn cần đáp ứng, BOM/spec revision, tồn đạt QC, lượng đã giữ, job đang đảm nhận, máy và lịch. Không gửi PII, giá hay dữ liệu thanh toán chi tiết cho LLM.
3. **Tính phần thiếu:** phân bổ thành phẩm đúng biến thể đạt QC trước; chỉ nổ BOM cho số bộ còn thiếu. Trừ linh kiện rời tốt chưa giữ và lượng do job đã duyệt/đang chạy đảm nhận, tránh tính trùng. Snapshot thiếu số liệu tồn không được hiểu là tồn bằng 0; chỉ dùng kịch bản giả định có nhãn trong bản nháp.
4. **Cộng nhu cầu:** chỉ cộng các đơn vị linh kiện cùng component revision và manufacturing specification. Giữ phân bổ ngược về từng dòng đơn. Tên sản phẩm/series và cùng mã nguồn chưa đủ để thay thế một linh kiện có quy cách khác.
5. **Đề xuất mẻ:** chia theo công nghệ, vật liệu thực tế, màu lúc in và đục/clear; tìm tổ hợp máy/cấu hình/profile phù hợp cho toàn mẻ. Nhiều hình học khác nhau được ghép khi đạt mọi ràng buộc. Không tự gộp màu sơn hoàn thiện vào màu nhựa lúc in.
6. **Kiểm tra kỹ thuật tại xưởng:** kỹ thuật kiểm tra layout, support, mirror, khoảng hở, dung sai và slicer ở môi trường riêng. Core nhận mã xác nhận, revision, máy/profile, số lượng, thời lượng ước tính cả mẻ, người xác nhận và thời điểm. Agent không cần nhận file để hoàn thành bước này.
7. **Chuẩn bị kế hoạch:** agent trình danh sách đơn/chi tiết/mẻ/máy, thứ tự, vật tư cần chuẩn bị, khâu hậu xử lý và các cảnh báo. Ưu tiên giữ hạn giao, rồi so sánh giảm đổi vật liệu và thời gian chờ. Không chờ gom đầy máy đến mức làm trễ đơn; đơn thiếu hạn dùng FIFO và hiện cảnh báo thiếu hạn.
8. **Người quyết định:** chấp nhận, sửa hoặc từ chối đúng revision của kế hoạch. Một phương án sửa trở thành revision nháp mới, cần core kiểm lại và người duyệt revision cuối. Từ chối giữ lịch sử/lý do và không giữ tài nguyên.
9. **Áp dụng sau duyệt:** core kiểm lại snapshot, quyền và xung đột; nếu hợp lệ thì tự tạo allocation/job, giữ máy/vật tư cần thiết và cập nhật trạng thái sản xuất. Nếu dữ liệu đã đổi, trả STALE/CONFLICT và tạo đề xuất mới; không cập nhật dở dang.
10. **Thực hiện:** thợ xác nhận bắt đầu/kết thúc từng job. Hệ thống tự cập nhật các đơn và máy liên quan từ sự kiện này; không suy máy đã chạy chỉ vì kế hoạch được duyệt.
11. **Hậu xử lý và QC:** ghi đạt/hỏng theo allocation, theo dõi lắp ráp, sơn và phụ kiện. Thiếu/hỏng sinh nhu cầu còn thiếu và phương án in lại cần người duyệt. Một phần hỏng không buộc in lại toàn mẻ.
12. **Bàn giao đóng gói:** khi nhóm sản phẩm liên quan đủ điều kiện và người có quyền xác nhận bàn giao, hệ thống tự chuyển tiến độ sang đóng gói và giải phóng các giữ máy đã đủ điều kiện. Agent nhận sự kiện máy rảnh để đề xuất mẻ tiếp theo.

Các nhóm độc lập đủ dữ liệu vẫn được chuẩn bị dù nhóm khác đang chờ. Không trình phương án thiếu hard constraint như một kế hoạch đã sẵn sàng áp dụng.

## 4. Trạng thái và cập nhật tự động

### 4.1 Kế hoạch

| Trạng thái thiết kế | Ý nghĩa / thao tác tiếp theo |
| --- | --- |
| DRAFT | Agent đang chuẩn bị; chưa giữ kho/máy |
| WAITING_DATA | Thiếu BOM/spec/máy/layout/thời lượng hoặc dữ liệu thiết yếu; hiện rõ mục cần bổ sung |
| PENDING_APPROVAL | Candidate đã được kiểm đủ để người có quyền xem xét |
| REJECTED | Người duyệt từ chối, lưu lý do; không thay đơn/kho/máy |
| APPROVED | Người duyệt chấp nhận đúng revision và core đã ghi đủ hiệu ứng trong giao dịch |
| STALE | Dữ liệu đầu vào thay đổi; phải tính lại và duyệt revision mới |
| SUPERSEDED | Được thay bằng phương án điều chỉnh đã duyệt; giữ trace kế hoạch cũ |

PENDING_APPROVAL không tự giữ lịch. Hai người cùng duyệt các phương án cạnh tranh thì chỉ một giao dịch được giữ cùng một lượng tồn hoặc slot máy.

### 4.2 Máy và quyền sử dụng máy

Giữ riêng tình trạng thực tế của máy và trạng thái được phân công. Các tên dưới đây là thiết kế; chưa phải enum đã được thêm vào database.

| Trạng thái điều phối | Khi nào xuất hiện | Hành vi planner |
| --- | --- | --- |
| AVAILABLE | Máy sẵn sàng, không có giữ máy hiện hành và không bảo trì/hỏng | Có thể đề xuất giao cho nhóm mới |
| RESERVED | Kế hoạch đã duyệt giữ máy cho nhóm sản xuất/khung giờ | Chỉ chạy các job đã duyệt trong phạm vi giữ; cấm giữ lịch chồng lấn |
| IN_USE | Thợ xác nhận một job đã bắt đầu | Có thể chuẩn bị nháp mẻ tiếp theo; không giao trùng thời gian |
| HOLD_UNTIL_PACKING | Máy đã in xong nhưng nhóm sản phẩm giữ máy chưa được bàn giao đóng gói | Theo quyết định xưởng, chưa cấp máy cho nhóm mới |
| MAINTENANCE / OUT_OF_SERVICE | Máy bảo trì/hỏng hoặc chưa xác nhận sẵn sàng | Không đề xuất job mới vào khoảng bị chặn |

**Quy tắc người dùng chốt:** in xong không tự giải phóng máy. Chỉ khi nhóm sản phẩm liên quan chuyển sang đóng gói mới gỡ giữ máy. Máy chỉ hiển thị AVAILABLE nếu đồng thời không có giữ máy đang hiệu lực, job chạy, lỗi/bảo trì hoặc hạn chế vận hành khác. Một sự kiện đóng gói không được ghi đè trạng thái máy hỏng.

Mỗi giữ máy phải có `holdId`, `printerId`, phạm vi nhóm sản xuất được duyệt, các job và các allocation bàn giao cần hoàn tất. Một mẻ nhiều đơn chỉ giải phóng giữ máy khi tất cả allocation thuộc phạm vi giữ đã đạt điều kiện bàn giao hoặc đã được người có quyền xử lý giải phóng có lý do. Không chờ các dòng đơn không liên quan đến giữ máy đó; không gỡ giữ chỉ vì đơn đầu tiên của mẻ đã đi đóng gói. Nếu quy trình chỉ bàn giao đóng gói nguyên đơn, điều kiện này tham chiếu đủ các dòng cần thiết của lần bàn giao đó.

Nhóm sản xuất cần nhiều mẻ vẫn được chạy nối tiếp các job đã duyệt trên máy thuộc chính nhóm đó; giữ máy không cấm các job nội bộ tiếp theo. Trước khi duyệt, kiểm đường đi đến đóng gói và các phụ thuộc giữa máy/nhóm để không tạo tình huống máy đang giữ cho sản phẩm nhưng lại chặn chính mẻ còn thiếu của sản phẩm đó. Xung đột hoặc vòng chờ phải trình người duyệt điều chỉnh, không tự bỏ quy tắc giải phóng.

Máy đã gỡ giữ hiện hành nhưng có booking tương lai chỉ được nhận việc vào khoảng trống không chồng lịch. Chưa biết giờ bàn giao thì agent chỉ đưa phương án dự kiến với phần lịch chưa xác nhận; không tự hứa một slot chính xác. Bản nháp có thể được chuẩn bị khi máy bận; job thực tế của nhóm mới chỉ được bắt đầu sau khi các giữ máy trước đã được giải phóng và đủ quyền.

Tạm dừng hoặc lỗi job không tự gỡ giữ. Hủy đơn/mẻ cần xử lý phần đã làm, allocation còn lại và quyền giải phóng; không giải phóng tài nguyên của các đơn khác trong mẻ chung. Máy được gỡ giữ sau hủy chỉ AVAILABLE nếu không còn ràng buộc khác.

### 4.3 Đơn hàng và dòng đơn

Tên hiển thị sản xuất được tính từ job/allocation; không tự thêm các tên đó vào `orders.order_status`. Đối chiếu [policy hiện hành](../../src/domain/orders/order-policy.ts) và [enum đơn hàng](../../src/domain/orders/order.ts).

| Sự kiện | Tiến độ sản xuất tự cập nhật | Trạng thái thương mại hiện hành | Máy |
| --- | --- | --- | --- |
| Duyệt phương án hợp lệ | SCHEDULED: đã xếp lịch cho các dòng/allocation được duyệt | Đơn CONFIRMED giữ nguyên đến khi có sản xuất thực tế; đơn đã IN_PRODUCTION không bị lùi | Tạo giữ máy/booking, RESERVED |
| Thợ xác nhận bắt đầu job đầu tiên | IN_PROGRESS cho phần đang làm; đơn hiển thị đang sản xuất | CONFIRMED → IN_PRODUCTION qua policy và quyền hợp lệ | IN_USE |
| In xong, còn hậu xử lý/QC | POST_PROCESSING / WAITING_QC; các dòng khác giữ tiến độ riêng | IN_PRODUCTION | HOLD_UNTIL_PACKING theo giữ máy liên quan |
| Đủ linh kiện đạt và phụ kiện, xác nhận bàn giao đóng gói | PACKING cho phạm vi bàn giao; không chuyển cả đơn nếu còn dòng chưa đủ | Giữ IN_PRODUCTION trong lúc đóng gói | Gỡ giữ đủ điều kiện; tính lại availability |
| Hoàn tất đóng gói và đủ toàn bộ điều kiện sẵn giao | READY_FOR_DISPATCH | IN_PRODUCTION → READY_TO_SHIP qua policy | Không đổi lại máy đã gỡ giữ |
| Nhân viên xác nhận giao đơn vị vận chuyển | Theo sự kiện bàn giao vận chuyển | READY_TO_SHIP → SHIPPED qua policy | Không tác động máy |

Như vậy, một lần duyệt tự cập nhật trạng thái xếp lịch của đơn và giữ máy; người vận hành không phải sửa từng đối tượng riêng. Các bước thực tế sau đó cũng tự đồng bộ từ sự kiện do người có quyền ghi nhận. Duyệt phương án không tạo tín hiệu khởi động phần cứng, xác nhận QC, đã đóng gói hoặc đã giao hàng.

Đơn nhiều sản phẩm/máy giữ tiến độ chi tiết theo dòng/allocation. Bắt đầu một job đủ để phản ánh đơn đang sản xuất; hoàn thành một job chưa đủ để phản ánh toàn đơn sẵn giao. Không để riêng planner hoàn tất hoặc lùi trạng thái commerce của đơn có dòng custom nằm ngoài phạm vi; use case đơn hàng kiểm điều kiện của toàn đơn.

## 5. Phê duyệt nhất quán và chống lặp

1. Người duyệt gửi plan ID, revision, snapshot version và idempotency key; actor là người có quyền, agent là bên đề xuất.
2. Trong một transaction, core khóa các đơn, nhu cầu, nguồn kho, booking/giữ máy bị ảnh hưởng theo thứ tự ổn định; kiểm tiền/đơn còn đủ điều kiện, lượng còn thiếu, BOM/spec/profile và chứng nhận layout còn đúng revision, máy và ràng buộc lịch chưa thay đổi.
3. Ghi approval, reservation, job/allocation, tiến độ sản xuất, audit/status history và outbox cùng commit. Thiếu một bước thì rollback toàn bộ.
4. Retry cùng thao tác trả kết quả đã ghi, không giữ kho/máy hoặc phát hành việc hai lần. Notification gửi sau commit, không nằm trong giao dịch gọi mạng.
5. Bàn giao đóng gói cũng là một transaction có idempotency: kiểm QC/phụ kiện và phạm vi bàn giao, cập nhật tiến độ, đóng các hold đủ điều kiện, tính lại máy và ghi sự kiện cho agent. Sự kiện lặp không gỡ giữ của một nhóm mới vừa được giao máy.

Mọi thay đổi về BOM, layout, vật liệu, số lượng hoặc phân công máy sau duyệt cần phương án điều chỉnh được người duyệt chấp nhận. Job đang chạy được giữ nguyên đến khi có thao tác vận hành có quyền; agent không âm thầm đổi một kế hoạch đã duyệt.

## 6. Tối ưu và điều kiện chưa đủ dữ liệu

Thứ tự đánh giá: đủ ràng buộc chế tạo và quyền sử dụng tài nguyên; giữ hạn giao; sau đó giảm setup/đổi nhựa-màu, thời gian chờ và tải hậu xử lý. Trình phương án tách nếu gom gây trễ. Nếu mọi phương án đều trễ thì hiện độ trễ và nguyên nhân để người quyết định.

Agent chuẩn bị trước danh sách vật tư, vệ sinh/đổi vật liệu, máy rửa/đóng rắn, dụng cụ, người thao tác và phụ kiện. Mốc máy được giữ đến đóng gói được tính vào lịch và năng lực; theo dõi riêng thời gian máy thật sự chạy với thời gian bị giữ sau in để biết nguyên nhân chờ.

| Dữ liệu thiếu | Agent được làm | Điều kiện trước khi áp dụng kế hoạch thật |
| --- | --- | --- |
| Máy/profile/capacity chưa duyệt | Đề xuất nhóm nhu cầu sơ bộ, nêu phần chờ kỹ thuật | Có tổ hợp máy-cấu hình-profile và layout hợp lệ cho toàn mẻ |
| Thời lượng mẻ/setup/hậu xử lý | Hiện lịch chưa ước tính và checklist chuẩn bị | Có ước tính cả mẻ và các bước ảnh hưởng slot/hạn; không bịa thời gian |
| Tồn thành phẩm/linh kiện/WIP | Trình sơ đồ hoặc kịch bản giả định được gắn nhãn | Có snapshot thực tế hoặc xác nhận kiểm kê bằng 0, không coi ô trống là 0 |
| Mapping SKU workbook với UUID catalogue | Chuẩn bị bảng đối chiếu | Người quản trị xác nhận mapping; không tự publish/tạo SKU thật |
| Hạn đơn | FIFO, hiện NO_DUE_DATE | Không cam kết đúng hạn nếu chưa có hạn được ghi nhận |
| Alias file/spec hoặc đơn vị nhóm chưa rõ | Giữ nhu cầu tách và nêu điểm cần đối chiếu | Có xác nhận alias/revision và quy cách/yield; không suy từ tên |

Theo dõi trước/sau bằng thời gian chuẩn bị kế hoạch, số lần đổi vật liệu, thời gian chạy/giữ/chờ máy, tỷ lệ trễ, số chi tiết in dư và số lần người sửa/từ chối. Chưa có số đo vận hành thì chỉ báo ước tính có nguồn, không tuyên bố phần trăm cải thiện.

## 7. Phụ kiện có thể bổ sung sau

Mỗi phụ kiện có mã, revision, đơn vị, số lượng trên SKU, quy cách, tình trạng duyệt và routing. Liên kết vào BOM của sản phẩm hoặc một SKU bán riêng nếu cần. Phân biệt:

- PRINTED: sinh nhu cầu in; cùng quy tắc kiểm máy/profile/layout như linh kiện khác.
- STOCKED/PURCHASED: phân bổ kho hoặc tạo việc chuẩn bị/mua, không chiếm máy in 3D.
- FINISHING/KITTING: decal, sơn hoặc công đoạn hoàn thiện; có nhiệm vụ và vật tư riêng. Decal đã xuất hiện trong dữ liệu BD-LH được giữ ở routing này; chưa tự xác định xưởng làm hay thuê ngoài.

Phụ kiện bắt buộc chưa đủ thì nhóm sản phẩm chưa đủ điều kiện chuyển đóng gói. Phụ kiện tùy chọn chỉ tạo nhu cầu nếu có trong cấu hình khách đã đặt. Thêm phụ kiện tạo BOM revision mới; không làm thay đổi đơn đã chốt hoặc plan đang chạy. Muốn bổ sung cho đơn cũ phải có thay đổi được người có quyền duyệt.

## 8. Ranh giới triển khai

Nguồn sự thật runtime là [kiến trúc](../architecture.md), policy orders và migrations `001–015`. Migration `009`–`015` hiện bổ sung revision BOM/profile/linh kiện, requirement pin revision, inventory/check/plan, shared `production_jobs`/hold/allocation, event/run, custom job scope, quote/acceptance, immutability và retention marker. Revisions mới không backfill order cũ. Không tạo module PrintJob thứ hai trùng nghĩa. Dữ liệu máy, BOM, tồn, profile, timing và evidence xưởng thật vẫn phải được xác nhận riêng.

Core/domain chịu trách nhiệm hard constraint, use case ghép transaction, repository quản lý SQL và khóa, integration cung cấp LLM/outbox, server ghép dependency. Agent gọi tool có contract như đọc snapshot, tính candidate, so sánh và tạo draft. Việc duyệt/áp dụng đi qua use case của người có quyền; agent không được gọi API ghi để thay cho phê duyệt.

Chưa chốt nhà cung cấp/model/API LLM. Bản thiết kế không phụ thuộc API miễn phí cụ thể; core tính đúng ngay cả khi LLM không khả dụng, và người vận hành vẫn có thể xem draft/nhu cầu có cấu trúc. Không gửi file hay PII đến provider.

## 9. Ca rà soát bắt buộc trước khi triển khai

| Ca | Kết quả cần đạt |
| --- | --- |
| Lọc workbook | Chỉ 6 SKU và 37 BOM dòng không vàng; không sinh nhu cầu từ 3 SKU/15 BOM ví dụ |
| Nhu cầu nhóm tay | Một nhóm tay trên một bộ; bố trí đủ bên gốc và bên mirror, không coi là một tay đơn hoặc nhân đôi cả nhóm hai lần |
| Đơn đã có thành phẩm/linh kiện/job | Chỉ lập phần thiếu; chuyển WIP thành hàng QC không trừ hai lần |
| Cùng hình học khác màu/spec | Nhu cầu tách; vật liệu lúc in và màu sơn cuối được xử lý riêng |
| LH ghi dùng chung IDE nhưng mã khác | Chờ xác nhận alias; không tự cộng thành một component đã được duyệt |
| Stinger ghi FDM nhưng BOM có Resin | Hiện cảnh báo đối chiếu; không đẩy mọi linh kiện sang máy FDM |
| Duyệt / từ chối / sửa | Duyệt mới ghi giữ máy/việc; từ chối không thay tài nguyên; sửa cần duyệt revision cuối |
| Hai approval cùng máy/kho | Chỉ một commit hợp lệ; thao tác khác conflict/stale, không cập nhật một nửa |
| Retry approval/bàn giao | Không tạo job, allocation hoặc giải phóng giữ máy hai lần |
| In xong chưa chuyển đóng gói | Máy còn HOLD_UNTIL_PACKING, chưa giao cho nhóm mới |
| Nhiều mẻ cùng nhóm trên một máy | Chạy được các job nội bộ đã duyệt; không tự tạo vòng chờ đến đóng gói |
| Một mẻ nhiều đơn | Bàn giao một phần không gỡ hold còn allocation chưa đủ điều kiện |
| Máy hỏng khi bàn giao đóng gói | Gỡ hold nếu hợp lệ nhưng không chuyển máy hỏng thành AVAILABLE |
| Đơn cần nhiều máy hoặc có custom item | Theo dõi từng dòng; không báo toàn đơn sẵn giao từ một job riêng lẻ |
| Phụ kiện mới / thiếu decal | Không chiếm máy nếu không phải in 3D; chặn đóng gói khi thiếu món bắt buộc; revision cũ được giữ |
| File riêng tư | Tool/payload/log của agent không chứa file, link tải, path, hình học hoặc project slicer |

Đây là danh sách nghiệm thu thiết kế; chưa phải các test runtime đã chạy.

## 10. Thêm sản phẩm/linh kiện để agent tự sử dụng về sau

### 10.1 Lưu dữ liệu có thẩm quyền

1. Quản trị viên thêm/sửa sản phẩm hoặc biến thể trong module catalogue; thêm linh kiện và cấu hình sản xuất trong phân hệ sản xuất. Form/API kiểm thuộc tính và lưu vào PostgreSQL qua use case/repository. Agent không phải bên ghi thêm một bản sản phẩm vào database chính.
2. Thuộc tính cấu trúc của sản phẩm/biến thể gồm ID ổn định, mã, tên, thuộc tính bán hàng và trạng thái công bố. Linh kiện có ID/revision, đơn vị/yield, quy cách vật liệu/màu/công nghệ và routing. BOM nối biến thể với component/spec revision, số lượng và điều kiện phụ kiện. Metadata máy/recipe và kết quả kiểm kỹ thuật được liên kết riêng; không yêu cầu tải file 3D.
3. Lưu nháp luôn tạo dữ liệu bền vững, nhưng chưa đủ điều kiện cho agent phát hành việc sản xuất. Phân biệt trạng thái công bố catalogue với `productionReadiness`: sản phẩm có thể được quản lý/hiển thị mà còn thiếu BOM hoặc cấu hình sản xuất. Trường hợp đó đơn vào WAITING_DATA và hiện đúng phần thiếu.
4. Kỹ thuật xác nhận cấu hình/đơn vị; người có quyền công bố revision sản xuất khi đạt validation. Sửa một revision đã công bố tạo revision nháp mới, không ghi đè bản đang được đơn/job tham chiếu. Agent không tự bổ sung vật liệu, số lượng, profile hoặc quyền công bố từ suy đoán.

### 10.2 Agent nhận biết dữ liệu mới

1. Transaction công bố ghi revision và sự kiện `ManufacturingRevisionPublished` vào outbox cùng commit. Payload sự kiện chỉ cần ID, revision, loại thay đổi và event ID; không chứa file hoặc PII. Thao tác công bố không chờ LLM trả lời.
2. Worker chuyển sự kiện cho actor agent. Agent gọi tool đọc revision được công bố từ subject, làm mới dữ liệu tra cứu nếu có. Đồng bộ là đăng ký/tra cứu bản mới, không huấn luyện lại mô hình, không buộc đưa dữ liệu vào vector database hoặc tạo một catalogue do LLM sở hữu.
3. Worker retry hữu hạn và lưu tiến độ. Agent xử lý event trùng theo event ID; event cũ đến sau không được thay revision mới bằng revision cũ. Dữ liệu cache chỉ hỗ trợ tra cứu, không có thẩm quyền phát hành plan.
4. Khi có đơn đủ điều kiện, core luôn resolve dữ liệu sản xuất có thẩm quyền và chốt revision cho requirement; agent lấy snapshot qua tool. Vì vậy, bỏ lỡ sự kiện/lỗi đồng bộ không làm sản phẩm mới biến mất khỏi planner: lần tra cứu theo đơn vẫn đọc được database. LLM không khả dụng thì giữ việc chờ và cho người vận hành xem nhu cầu có cấu trúc.
5. SKU mới cùng mô hình dữ liệu/routing được hỗ trợ sẽ chạy cùng luồng chung: trừ tồn, nổ BOM, gom nhu cầu, đề xuất mẻ, người duyệt và thực hiện. Không thêm nhánh `if SKU == ...` hoặc mã riêng cho từng mẫu.

### 10.3 Thay đổi, ngừng bán và quyền dữ liệu

- Sản phẩm/linh kiện/BOM mới có ID hoặc revision riêng; agent dùng dữ liệu được truy vấn, không sửa danh sách 6 SKU trong source để “dạy” sản phẩm mới.
- Linh kiện mới tự xuất hiện trong dữ liệu tra cứu sau công bố, nhưng không tự gắn vào mọi sản phẩm. Quản trị chọn sản phẩm/BOM liên quan, số lượng và tính bắt buộc/tùy chọn rồi công bố revision tương ứng. Linh kiện bán riêng cần có SKU bán riêng; chỉ tồn tại một component chưa làm phát sinh nhu cầu sản xuất.
- Revision được chốt khi tạo requirement và được kế hoạch tham chiếu. Đơn/requirement/job đã chốt giữ bản cũ hợp lệ; sản phẩm mới được công bố không tự đổi số lượng hoặc quy cách của đơn đang làm. Phương án muốn đổi bản phải qua use case điều chỉnh và người duyệt.
- Dữ liệu nguồn ảnh hưởng một đề xuất thay đổi thì core kiểm snapshot; đề xuất không còn hợp lệ chuyển STALE trước khi áp dụng. Sự kiện công bố một bản mới không tự làm hỏng mọi job dùng bản cũ vẫn còn được phép.
- Ngừng bán không xóa lịch sử hay tự hủy đơn đã nhận. Thu hồi kỹ thuật một revision phải chặn phát hành job mới trên revision đó và cảnh báo người phụ trách các job liên quan; quyết định tiếp tục/dừng/in lại đi qua thao tác có quyền, không tự đổi job đang chạy.
- Bổ sung **mẫu sản phẩm/linh kiện** trong schema/routing đã hỗ trợ không cần sửa code từng mẫu. Công nghệ hoặc thuộc tính mới có ảnh hưởng cách tính/ràng buộc nhưng chưa có rule thì cần bổ sung rule/cấu hình hoặc implementation phù hợp; agent không tự hiểu một kỹ thuật hoàn toàn mới chỉ vì có cột text.

### 10.4 Ca nghiệm thu dữ liệu động

| Ca | Kết quả mong đợi |
| --- | --- |
| Thêm SKU và BOM hợp lệ, công bố, rồi có đơn | Tra được revision mới từ database; tạo requirement và đề xuất theo luồng chung, không thay danh sách SKU trong code |
| Chỉ lưu nháp hoặc thiếu BOM/profile được duyệt | Dữ liệu được lưu nhưng chưa đủ điều kiện phát hành việc; hiện WAITING_DATA cụ thể |
| Thêm một linh kiện dùng cho hai SKU | Hai BOM tham chiếu cùng component/spec đã duyệt; cộng đúng nhu cầu, giữ phân bổ từng đơn |
| Thêm linh kiện chưa gắn vào BOM hoặc SKU bán riêng | Agent tra được component đã công bố nhưng chưa tạo nhu cầu từ đơn sản phẩm khác |
| Sự kiện công bố bị trễ hoặc trùng | Công bố đã commit; lần đọc theo đơn vẫn tìm được revision; không tạo sản phẩm hoặc plan trùng |
| Sự kiện cũ đến sau bản mới | Không ghi đè dữ liệu tra cứu mới hơn; core resolve revision từ nguồn có thẩm quyền |
| Sửa sản phẩm sau khi có requirement/job | Bản chốt cũ được giữ; chỉ đổi theo phương án điều chỉnh được duyệt |
| Phụ kiện mới | Áp dụng routing PRINTED/STOCKED/PURCHASED/FINISHING như mục 7; món bắt buộc được tính vào điều kiện bàn giao đóng gói |
| Công nghệ mới chưa có rule | Báo cấu hình chưa hỗ trợ; không suy profile hoặc xác nhận tương thích từ tên |
