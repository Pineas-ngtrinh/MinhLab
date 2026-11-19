# Rà soát code MinhLab 3D — 21/10/2026

## Kết luận

Code ban đầu đã có phân tầng `app / components / services / lib`, TypeScript strict và các cơ chế xác thực/transaction cơ bản. Tuy nhiên, chưa thể gọi là sạch hoàn toàn hoặc đủ điều kiện đưa lên production: UI quản trị còn thao tác giả và biên lai mẫu, các file lớn trộn điều phối với giao diện, checkout thiếu chống tạo đơn trùng, và xử lý lỗi API chưa thống nhất.

Đợt này đã sửa các vấn đề có bằng chứng ở luồng tài khoản, đơn hàng, thanh toán, checkout và form STL; đồng thời tách module để tiếp tục bảo trì rõ ràng hơn. Build được và test đạt không đồng nghĩa môi trường hiện tại đã sẵn sàng phát hành: preflight vẫn thiếu cấu hình email, URL HTTPS và catalogue được duyệt/xuất bản.

## Phạm vi và cách kiểm tra

- Kiểm kê và quét source hoạt động trong `app/`, `src/`, script vận hành và migration; kiểm tra import/biến/tham số dư bằng TypeScript, lint và build.
- Đọc sâu các luồng auth/session/bootstrap, quyền truy cập, validation, transaction, checkout, thanh toán/outbox, quản trị và phân tích STL.
- Kiểm thử API trên PostgreSQL local tạm thời, tự tạo rồi xóa database riêng. Không thêm đơn/tài khoản fixture vào database cửa hàng, không gửi email thật.
- Kiểm tra bản production bằng HTTP và trình duyệt Opera. UI quản trị và COD dùng proxy fixture tại localhost:3101; proxy không chuyển tiếp thao tác ghi đến cửa hàng. Form STL được kiểm tra trên app thật tại localhost:3100 bằng một khối lập phương tự tạo, không phải file cá nhân.
- Không thay hai GLB chính, tọa độ LAB_WAYPOINTS hoặc cơ chế dynamic import/error boundary được bảo vệ. Các thay đổi trong component 3D hiện có chỉ dọn import/tham số dư.

## Những vấn đề đã sửa

| Vấn đề có căn cứ | Kết quả |
| --- | --- |
| Gửi lại checkout sau lỗi mạng có thể tạo thêm đơn | Storefront gửi Idempotency-Key; PostgreSQL khóa theo transaction và có unique index. Cùng khóa/nội dung/người mua trả lại đơn cũ. Đổi nội dung hoặc người mua trả 409. |
| Retry cần khôi phục quyền tra cứu của khách vãng lai | Cấp lại token tra cứu ngẫu nhiên; bảng token vẫn lưu hash. Không lưu tracking token thô trong cột idempotency và không gửi lại email tạo đơn. |
| Lỗi DB trong bước xác thực nằm ngoài try/catch tại một số route | Tất cả API liên quan có ranh giới xử lý lỗi; lỗi nội bộ trả JSON 500, lỗi nghiệp vụ dùng AppError với mã trạng thái rõ ràng. Không gửi message lỗi DB/cấu hình cho khách. |
| Quyền bootstrap có thể được gán cho email đã tồn tại mà không đổi mật khẩu | Chỉ gán quyền khi tạo tài khoản mới. Danh tính đã tồn tại phải có sẵn vai trò phù hợp; không tự nâng quyền qua cấu hình bootstrap. |
| Login và đọc phiên chọn thứ tự vai trò khác nhau | Dùng chung ROLE_PRIORITY; kiểm thử tài khoản nhiều vai trò. |
| Danh sách quản trị tải toàn bộ dữ liệu và lọc trong browser | Phân trang/lọc phía server, mặc định 25, tối đa 100 mục; thứ tự ổn định theo thời gian và ID. Có index hỗ trợ danh sách. |
| Duyệt mesh, tạm dừng máy và báo hoàn thành chỉ sửa state | Bỏ các thao tác giả chưa có backend. Hai trạm hiển thị đúng phạm vi chưa kết nối. |
| Biên lai quản trị chứa số tài khoản/mã giao dịch mẫu | Hiển thị dữ liệu khai báo và liên kết chứng từ thực tế; có trạng thái chưa đính kèm ảnh. Bỏ lời hứa gửi thông báo từ chối khi backend chưa gửi. |
| Modal tự khóa cuộn nhưng chưa giữ focus đầy đủ | Dùng ModalDialog dựa trên dialog native cho checkout, sản phẩm, tóm tắt in và hộp thoại quản trị; hỗ trợ Escape và khôi phục focus. |
| Checkout có input không liên kết label và nút đóng thiếu tên | Bổ sung label/id, tên nút, autocomplete, giới hạn độ dài; input mobile 16px để tránh Safari tự zoom. |
| Xóa giỏ làm mất danh sách đã mua trong nội dung xác nhận | Giữ snapshot sản phẩm trong phiên checkout; đóng trạng thái hoàn tất đưa luồng về form. |
| Worker STL được khởi tạo trực tiếp trong component lớn | Tách useStlAnalysis; xử lý cả lỗi khởi tạo Worker, đọc file, lỗi phân tích và cleanup khi đổi file/unmount. |
| Script seed lặp lại đọc env và transpile bằng new Function | Dùng chung bộ nạp env/database và TypeScript adapter của dự án. |
| Script tạo runtime role phụ thuộc thư mục backup có sẵn | Tạo thư mục backup an toàn trước khi ghi. Không chạy lại thao tác đổi credential trong đợt này. |
| Import/dependency dư, thiếu kiểm tra chống tái xuất hiện | Dọn binding dư, bỏ hai dependency trực tiếp không dùng clsx/tailwind-merge; bật noUnusedLocals và noUnusedParameters. |
| Các section tĩnh được đưa vào client boundary | Chuyển các phần tĩnh của trang chủ/câu chuyện/thanh thông tin về Server Component. Không công bố số đo giảm bundle khi chưa có baseline so sánh. |

## Cấu trúc sau chỉnh sửa

| Vị trí | Trách nhiệm |
| --- | --- |
| `app/api/` | Kiểm tra request/quyền, gọi nghiệp vụ, ánh xạ response; lỗi dùng helper chung. |
| `src/services/order.service.ts` | Đối soát, quyền chuyển trạng thái, transaction/audit; giữ facade cho route hiện có. |
| `src/services/orders/` | Tạo đơn, khôi phục checkout bằng idempotency, kiểu dữ liệu đơn/thanh toán. |
| `src/repositories/order.repository.ts` | Truy vấn đọc, phân trang, ánh xạ dữ liệu PostgreSQL và tải quan hệ. |
| `src/components/admin/` | Bảng đơn/thanh toán, phân trang, hộp thoại, tải dữ liệu và trạng thái chưa kết nối. |
| `src/components/checkout/` | Controller useCheckout và từng phần form/thanh toán/xác nhận. |
| `src/components/print-request/` | Controller yêu cầu in, chọn file/viewer, cấu hình, tóm tắt và hook worker. |
| `src/components/products/ProductDetailModal.tsx` | Chi tiết sản phẩm, chọn màu và duyệt ảnh; tách khỏi catalogue. |
| `src/lib/api-response.ts`, `errors.ts`, `pagination.ts`, `site-url.ts` | Quy ước dùng chung cho lỗi, phân trang và URL công khai. |

Một số file điều phối trước/sau:

| File | Trước | Sau |
| --- | ---: | ---: |
| `app/admin/page.tsx` | 1.672 dòng | 385 dòng |
| `src/components/common/CheckoutModal.tsx` | 898 dòng | 106 dòng |
| `src/components/print-request/PrintRequestForm.tsx` | 988 dòng | 60 dòng |
| `src/services/order.service.ts` | 811 dòng | 300 dòng |
| `src/components/products/ProductGallery.tsx` | 857 dòng | 441 dòng |

Việc tách giảm số trách nhiệm mỗi file; không đánh đồng giảm số dòng ở file gốc với giảm tổng mã nguồn. Các phần WebGL/scrollytelling lớn vẫn được giữ trong phạm vi đã hiệu chỉnh và bảo vệ.

## Bằng chứng kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npx tsc --noEmit` | Thành công, gồm kiểm tra unused mới. |
| `npm run lint` | Thành công. |
| `npm run build` | Exit 0; tạo đủ 33 trang/static entries trong build. |
| `npm run test:production` | 33 ca đạt, 0 lỗi; có kiểm tra role runtime hạn quyền. Chi tiết tại `docs/ooad/test-results.json`. |
| `npm run test:quote` | 13 test đạt. |
| `npm run test:models` | 21 kiểm tra đạt. |
| `npm run test:checkout` | 3 test đạt: retry, đổi nội dung, storage bị khóa/hỏng, không lưu thông tin cá nhân. |
| HTTP bản production local | 13 trang chính và `/api/health` trả 200. |
| Responsive | Quản trị và form in: 375, 768, 1024, 1440 CSS px, không tràn ngang toàn trang. Bảng quản trị cuộn ngang bên trong khung. |
| Tương tác UI | Chuyển trang/lọc quản trị; mở biên lai; giữ focus/Tab và Escape; mở sản phẩm; COD thành công với fixture; label checkout đọc được và input mobile 16px. |
| STL trên browser thật | Khối lập phương mẫu đọc đúng 10 × 10 × 10 mm; worker tính được khoảng giá tham khảo; không có lỗi console được ghi nhận trong lượt kiểm tra. |

Ảnh/fixture QA được giữ local trong `.local/audit-2026-10-21/visual/`, không đưa vào bundle ứng dụng. Các screenshot quản trị/COD dùng dữ liệu giả. Kiểm thử breakpoint là mô phỏng trên Opera, không phải nghiệm thu trên thiết bị iOS/Android vật lý.

## Migration và dữ liệu

- Thêm `004_checkout_idempotency.sql`, không sửa migration đã áp dụng trước đó.
- Database local đã được sao lưu vào `.local/audit-2026-10-21/database-before-cleanup.dump` trước khi áp dụng migration bổ sung.
- Runtime role tiếp tục dùng quyền trên bảng orders hiện có; không cần cấp thêm quyền quản trị schema hay đổi credential.
- Client API cũ không gửi Idempotency-Key vẫn được chấp nhận để giữ tương thích; muốn chống trùng phải gửi header này. Storefront đã gửi sẵn.

## Những phần còn cần làm trước hoặc sau phát hành

1. **Điều kiện phát hành chưa đạt:** RESEND_API_KEY/EMAIL_FROM, NEXT_PUBLIC_SITE_URL dùng HTTPS, và catalogue APPROVED/PUBLISHED. Không tự phê duyệt catalogue hoặc tạo thông tin triển khai giả để vượt preflight.
2. **Phạm vi sản phẩm hiện tại:** in theo file vẫn đọc STL ở browser rồi bàn giao Zalo/email; chưa có upload bền vững, quy trình duyệt báo giá, quản lý máy in hay telemetry thực tế. Giá mô hình vẫn là tham khảo. Đây là chức năng cần xây dựng riêng, không thể hoàn thành bằng đổi tên thư mục hoặc bật nút giả.
3. **Khi dữ liệu tăng:** lịch sử đơn trong tài khoản khách còn tải toàn bộ; nên bổ sung phân trang. Chưa có màn CRUD catalogue; nội dung SITE_CONFIG và giá trong PostgreSQL cần được đồng bộ theo quy trình vận hành.
4. **Vận hành host:** cấu hình ingress/rate limit theo IP, lịch chạy mail worker và kiểm chứng khôi phục backup trên host triển khai. Không gửi mail thật hay triển khai hạ tầng trong đợt rà soát này.
5. **Tài nguyên 3D:** đã giữ test scene hiện có và kiểm tra viewer STL; chưa nghiệm thu lại toàn bộ góc camera/GPU trên thiết bị vật lý. Hai model chính và camera spline được giữ nguyên.

README và production runbook đã được cập nhật theo cấu trúc/giới hạn thực tế. Workspace có nhiều chỉnh sửa tồn tại từ trước; đợt này không tạo commit hoặc coi toàn bộ diff hiện có là thay đổi của riêng đợt audit.
