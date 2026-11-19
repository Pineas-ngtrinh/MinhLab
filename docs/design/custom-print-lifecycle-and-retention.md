# Nghiệp vụ in theo file và vòng đời lưu trữ

Mã tác vụ: CP-LIFECYCLE-2026-11-15. Ngày: 15/11/2026.

Trạng thái: **Đã có source triển khai retention theo yêu cầu tiếp tục của chủ dự án; kiểm chứng DB/API/VPS còn chờ môi trường.** Xem [báo cáo triển khai](../reviews/custom-print-retention-2026-11-15.md). Tài liệu này giữ đặc tả và các khoảng trống ghi nhận trước triển khai ở mục 9 để truy vết; không dùng mục đó như inventory code mới nhất. Nó bổ sung và ưu tiên cho quy tắc vòng đời/lưu file trong [đặc tả custom print](custom-print-review-design.md).

## 1. Phạm vi và quyết định

- Xem trước/dự đoán STL chạy trên thiết bị khách, không tự upload và không tạo đơn. Model export đi cùng website; huấn luyện offline, không cần container model.
- Khách gửi yêu cầu thì mới upload vào kho private và lưu phiếu. Gửi/chấp thuận dùng CUSTOMER đăng nhập; danh tính owner lấy từ phiên.
- Kỹ thuật duyệt file/cấu hình, phát hành báo giá; khách chấp thuận tạo đúng một đơn trả trước toàn bộ. Thanh toán VietQR do nhân viên đối soát ngân hàng.
- File upload bỏ dở được giữ 48 giờ. Yêu cầu còn hoạt động giữ file; yêu cầu đóng không thành đơn giữ thêm 48 giờ. Đơn được giữ file suốt xử lý và 7 ngày sau hoàn tất.
- Khi có hoàn hàng, khiếu nại hoặc in lại cần file, tạm ngừng xóa. File đã bị xóa không được hứa có thể khôi phục để in lại.
- Ảnh biên lai có chính sách riêng; không đưa vào bộ dọn file in 48 giờ/7 ngày.
- Deploy trên Ubuntu: một container website, một container PostgreSQL; volume private riêng ngoài webroot, proxy HTTPS và lịch worker trên host. Đây là thiết kế đích, chưa có cấu hình deployment được tạo bởi tài liệu này.

## 2. Luồng nghiệp vụ chính

| Bước | Hành động và kết quả | Điều kiện bắt buộc |
| --- | --- | --- |
| 1. Xem tham khảo | Khách chọn STL, vật liệu/màu, tỷ lệ và số lượng; xem hình, gram, thời gian và giá dự đoán | Không upload khi chỉ preview. Giá provisional có nhãn tham khảo; hồ sơ ngoài profile/model chuyển tư vấn, không hiển thị giá chốt |
| 2. Gửi yêu cầu | Khách đăng nhập, xác nhận quyền dùng file, điền nhu cầu/liên hệ, bấm “Gửi yêu cầu in”; nhận mã phiếu | Upload lưu private + metadata thành công trước khi báo đã nhận; retry không sinh phiếu trùng. Có thể gửi tư vấn chưa có file, nhưng chưa đủ điều kiện báo giá sản xuất |
| 3. Kiểm an toàn | Worker quét file rồi phân tích STL; OBJ/STEP chỉ nhận khi cấu hình cho phép và kỹ thuật kiểm thủ công | Hạn byte, quota, hash, scan và quyền owner; scan lỗi không coi là CLEAN. Preview không chứng minh file in được |
| 4. Duyệt kỹ thuật | FILE_REVIEWER nhận phiếu, kiểm kích thước/đơn vị, vật liệu, dung sai, support, hướng in và slicer | Đúng file/hash/revision; đủ khả năng máy/vật liệu/thời gian, có xác nhận người chịu trách nhiệm |
| 5. Kết luận | Yêu cầu bổ sung, từ chối có lý do, hoặc gửi báo giá chính thức | File/cấu hình thay đổi tạo revision; quote cũ bị vô hiệu. Ghi chú nội bộ tách khỏi nội dung khách thấy |
| 6. Chấp thuận | Khách xem file/cấu hình, quantity, các khoản tiền, phí giao, hạn báo giá và ngày dự kiến; bấm “Đồng ý báo giá và tạo đơn” | Owner, revision, terms hash, thời hạn kiểm trong transaction. Một quote chỉ chuyển thành một order, kể cả retry/key mới |
| 7. Thanh toán | Đơn PENDING_PAYMENT; khách chuyển VietQR và khai báo; nhân viên kiểm ngân hàng rồi xác nhận | Khai báo/biên lai/Telegram không xác nhận tiền. Thanh toán đủ mới bàn giao sản xuất theo policy hiện hành |
| 8. Chế tác và QC | Thợ nhận file/spec đã chấp thuận, ghi lần in và lượng đạt/hỏng, hậu xử lý, QC | Không in revision cũ, không sửa âm thầm snapshot. Lỗi in có hướng xử lý/in lại, không tự thu thêm tiền |
| 9. Giao và hoàn tất | Đủ lượng đạt → sẵn giao → đóng gói/bàn giao → đang giao → xác nhận hoàn tất | Giao thủ công theo quyết định hiện hành; không hủy khi đang giao. Mốc hoàn tất được ghi một lần có audit |
| 10. Kết thúc lưu file | Tính hạn, hiển thị cho khách, cleanup xóa bytes khi đủ điều kiện; giữ lịch sử | Hết 7 ngày sau hoàn tất, không còn blocker. Nếu khách in lại sau khi xóa thì gửi file và nhận báo giá mới |

QC là tiến độ/kết quả sản xuất, không tạo enum QC mới vào trạng thái đơn thương mại. Chuỗi order giữ `PENDING_PAYMENT → CONFIRMED → IN_PRODUCTION → READY_TO_SHIP → SHIPPED → COMPLETED`.

### Các nhánh cần rõ

- **Cần sửa/bổ sung:** giữ phiếu hoạt động và toàn bộ revision cần đối chiếu. Khách gửi lại thì kiểm lại các phần bị ảnh hưởng, không ghi đè file cũ.
- **Khách không đồng ý:** “Yêu cầu điều chỉnh” giữ phiếu hoạt động; “Không đặt nữa/Đóng yêu cầu” kết thúc phiếu. Hai hành động khác nhau, không dùng một nút từ chối cho cả hai.
- **Báo giá hết hạn:** quote không còn được chấp thuận. Nếu không còn việc review/điều chỉnh hoặc quote hiệu lực khác, đóng phiếu với lý do hết hạn; nếu kỹ thuật mở lại trước khi purge thì phải duyệt và phát hành quote mới.
- **Chờ khách bổ sung quá lâu:** màn hình nhắc nhân viên rà soát và đóng có lý do; chưa đặt SLA/tự đóng theo một số ngày mới. Không xóa file chỉ vì tuổi upload trong khi phiếu vẫn mở.
- **Đã tạo đơn nhưng chưa thanh toán:** giữ file đến khi đơn được thanh toán hoặc hủy/đóng hợp lệ. Hạn thanh toán do policy riêng; quote hết hạn sau conversion không làm mất đơn/file.
- **Hủy chưa thu tiền:** sau khi đơn được hủy hợp lệ, không còn việc sản xuất/đối soát, giữ thêm 48 giờ.
- **Hủy có thu tiền/hoàn hàng:** giữ file trong khi xử lý. Khi đã hoàn tiền/giải quyết xong, không còn in lại hoặc blocker khác, giữ thêm 7 ngày từ mốc kết thúc xử lý.
- **Thay đổi sau thanh toán:** không sửa trực tiếp file/spec/giá đã chấp thuận. Giữ nguyên đơn cũ; nhân viên thống nhất thay đổi và ghi chấp thuận/điều chỉnh thương mại trước khi bàn giao bản mới. UI amendment tổng quát nằm ngoài lần thiết kế retention này.

## 3. File nào được lưu

| Nhóm | Nội dung | Quy tắc |
| --- | --- | --- |
| File nguồn khách | STL; OBJ/STEP khi đã mở tiếp nhận thủ công | Giữ bytes/hash của từng revision đã gửi; source ban đầu và bản gắn báo giá/đơn luôn truy vết được |
| File mô hình đã duyệt | Bản kỹ thuật sửa để sản xuất, nếu có | Tạo asset mới, ghi nguồn/người sửa/lý do; khách chấp thuận thay đổi. Nếu không sửa, tham chiếu lại asset nguồn, không nhân đôi bytes |
| File dự án slicer/G-code | Chỉ khi xưởng thực sự tạo và cần lưu để tái lập lần in | Gắn file/spec revision, job/attempt, máy/profile và người tạo. Là loại file nội bộ, không mở upload G-code công khai cho khách |
| Ảnh preview/mesh tạm | Dữ liệu dựng viewer, buffer, kết quả trung gian | Tạo trên trình duyệt hoặc tái tạo khi cần; không mặc định lưu vào kho private |
| Ảnh lỗi/QC nếu cần | Bằng chứng lỗi hoặc tranh chấp | Chính sách bằng chứng riêng; không để bộ dọn model tự xóa. Chỉ bổ sung uploader khi triển khai chức năng này |
| Ảnh biên lai | Chứng từ khai báo thanh toán | Loại riêng, chỉ người có quyền đối soát; giữ theo policy thanh toán được xác định riêng |
| Catalogue/GLB website | Tài nguyên studio và ảnh bán hàng | Ngoài phạm vi cleanup file khách |

Không dùng đuôi file để quyết định retention: ảnh biên lai và ảnh preview có thể cùng là PNG. Phải có mục đích asset được server gán và kiểm quyền. Không dùng hash làm URL công khai hoặc gộp file khác khách chỉ vì cùng hash.

Các revision đã gửi được giữ đến khi toàn bộ phiếu/đơn liên quan đủ điều kiện xóa. Bản superseded không mặc nhiên thành “file bỏ dở”; điều này tránh mất căn cứ khách–kỹ thuật đã trao đổi.

## 4. Bảng thời hạn và thứ tự ưu tiên

Thời hạn là 48 giờ và 7 × 24 giờ từ timestamp server; lưu UTC, hiển thị giờ Việt Nam. Cleanup đề xuất chạy mỗi giờ, nên bytes được dọn ở lượt thành công sau hạn, không cam kết xóa đúng từng giây.

| Trường hợp | Mốc được xóa sớm nhất | Chặn xóa khi |
| --- | --- | --- |
| Preview/dự đoán chưa gửi | Không có file trên VPS | Không áp dụng |
| Upload thành công nhưng không gắn phiếu | `created_at + 48 giờ` | Có lease xử lý còn hiệu lực hoặc vừa được gắn vào nghiệp vụ hợp lệ |
| Phiếu đang tiếp nhận/kiểm tra/bổ sung/chờ báo giá | Chưa xác định ngày xóa | Phiếu còn hoạt động |
| Phiếu đóng không chuyển đơn | `closed_at + 48 giờ` | Mở lại hợp lệ, có nhu cầu/in lại/hold hoặc còn phiếu khác dùng asset |
| Đơn đang chờ tiền/đang chế tác/đang giao | Chưa xác định ngày xóa | Đơn còn hoạt động; `print_requests.status='CLOSED'` do chuyển đơn không cho phép xóa |
| Đơn hoàn tất bình thường | `completed_at + 7 ngày` | Hoàn hàng/khiếu nại/in lại chưa xong, job còn hoạt động, hold |
| Đơn hủy chưa thu tiền | `cancelled_at + 48 giờ` | Thanh toán còn khai báo/chờ đối soát, allocation/job/hold chưa giải phóng |
| Đơn có thu tiền đã hủy hoặc có hoàn hàng/khiếu nại | `resolved_at + 7 ngày`, không sớm hơn hạn hoàn tất đang có | Tiền chưa xử lý xong, còn tác vụ in lại/hoàn hàng/hold |
| Dữ liệu cũ không xác định được loại hoặc mốc | Không tự xóa | Chờ phân loại/xác minh có audit |

Một asset có nhiều tham chiếu: chỉ cần **một** phiếu/đơn/hold đang hoạt động thì chưa xóa. Khi mọi tham chiếu đều đã kết thúc, lấy **hạn muộn nhất**. Không lấy `is_current=false`, tuổi file, lưu trữ mềm đơn hoặc quote EXPIRED làm bằng chứng đủ để xóa.

Đặt hold thủ công chỉ dành cho ADMIN hoặc STAFF được cấp quyền xử lý sự việc, phải có mã vụ việc/lý do, người tạo và ngày cần rà soát. Gỡ hold có audit, chỉ sau khi xử lý xong. Ngày rà soát quá hạn tạo cảnh báo, không tự gỡ hold. FILE_REVIEWER/PRINT_OPERATOR không tự đổi thời hạn lưu.

Khi sự việc phát sinh sau khi bytes đã purge: giữ lịch sử, ghi rõ “file đã hết thời hạn lưu”, xin khách gửi lại nếu cần. Không hứa giữ file vô thời hạn để phục vụ mọi yêu cầu hoàn hàng tương lai; retention file không quyết định quyền gửi yêu cầu hoàn hàng.

## 5. Dữ liệu và ranh giới triển khai

Tái sử dụng `file_assets`, `attachments`, `print_requests/items`, `file_inspections`, `print_specifications`, `quotes/items`, `customer_approvals`, `orders/items`, `production_attempts`, `order_return_requests` và `audit_logs`. Không tạo một bảng “đơn tham khảo” cho thao tác preview.

| Dữ liệu | Hiện có | Bổ sung khi triển khai |
| --- | --- | --- |
| Bytes, hash, owner, trạng thái scan | `file_assets`, private filesystem | Loại/mục đích asset rõ; luồng upload source và nội bộ phân biệt |
| Hạn và bằng chứng purge | `retain_until`, `purged_at`, `upload_status='DELETED'` | `retain_until` là hạn sớm nhất sau khi tính nghiệp vụ; NULL khi đang được giữ. Purge claim/token/lease riêng cho worker dọn, không dùng lease scan làm chủ quyền xóa |
| Phiếu/revision/đơn | Quan hệ hiện có, `closed_at`, `completed_at`, `cancelled_at` | Lý do đóng để phân biệt bỏ yêu cầu và chuyển đơn; use case đóng/mở lại và expiry; cập nhật deadline trong cùng transaction chuyển trạng thái |
| Hold và kết thúc sự việc | Return REQUESTED/RETURN_RECEIVED/REFUNDED đã có một phần | Ghi nhận hold/lý do/người xử lý và `resolved_at` cho phần chưa có; unresolved return là blocker tự động. Không suy ra khiếu nại/in lại đã xong chỉ từ COMPLETED |
| Asset đã dùng thực tế | Spec và attempt tham chiếu attachment | Liên kết source/approved/slicer artifact cần đủ scope; giữ FK và snapshot sau purge |
| DTO khách/quản trị | View file/phiếu hiện có | `fileAvailability`, `scheduledDeletionAt` nullable, lý do giữ theo quyền; không lộ object key/path hoặc nội dung vụ việc nội bộ |

Thông tin còn giữ sau purge: asset ID, tên/loại, bytes, hash, nguồn/revision, người gửi, kết quả kiểm, thời điểm xóa; cùng báo giá/spec/quantity, chấp thuận, trạng thái và lịch sử giao dịch. Không xóa row `attachments`/`file_assets` để vượt FK. Đây là lịch sử nghiệp vụ, không có nghĩa giữ mọi dữ liệu cá nhân vĩnh viễn; retention PII/chứng từ là chính sách riêng.

Mọi thay đổi schema dùng migration mới theo thứ tự lúc triển khai; không sửa migrations đã áp dụng hoặc rút ngắn hạn dữ liệu cũ hàng loạt. Use case xác định policy trong domain/service; repository truy vấn tham chiếu/khóa; adapter unlink bytes; composition cấp cấu hình/dependency. Không đặt SQL, scheduler hoặc thao tác filesystem trong domain.

## 6. Cleanup an toàn khi có thao tác đồng thời

1. Mặc định dry-run, trả số asset/bytes đủ điều kiện và các lý do bị giữ; không sửa dữ liệu. Chỉ `--apply` mới claim/xóa.
2. Trong transaction, khóa theo thứ tự thống nhất với submit/revision/accept/đóng–mở phiếu, payment, production và hold. Tính lại mọi tham chiếu, hạn và lease scan; chỉ claim asset đủ điều kiện, đổi sang `DELETED` và ghi audit/claim token trước commit. Tất cả đường gắn file/accept/hold phải dùng cùng giao thức khóa và từ chối asset đã claim; không chỉ vá riêng cleanup.
3. Sau commit, adapter unlink đúng UUID key trong private root. Với claim còn tồn tại, submit/accept/mở lại không được gắn file đó; phải gửi lại file. Như vậy không có cửa sổ nhận đơn thành công rồi worker xóa file sau đó.
4. Chỉ ghi `purged_at` khi unlink thành công hoặc hệ điều hành trả ENOENT. Khi lỗi disk/quyền, giữ tombstone và retry có giới hạn/backoff, không báo đã purge. Worker chết giữa unlink và ghi DB thì lần sau hoàn tất idempotent.
5. Worker scan và purge loại trừ nhau; token/lease kiểm ở mọi cập nhật. Duyệt/đóng/mở lại/hold đồng thời với purge có một kết quả thắng rõ, không dùng dữ liệu dry-run cũ để xóa.
6. Route tải file kiểm quyền trước, rồi kiểm trạng thái. Người có quyền nhận thông báo hết hạn/410 khi đã xóa; người không có quyền nhận 404. Đóng kết nối download đang dùng trước purge bằng cơ chế lease đọc hoặc cơ chế tương đương được kiểm thử; không suy ra “không scan” là “không ai đọc”.
7. Ghi số đủ điều kiện/đã xóa/lỗi/bytes và tuổi backlog, không log bytes nội dung, credential hay đường dẫn khách. Có cảnh báo khi cleanup hoặc hold quá hạn rà soát.

Asset bị malware/phân tích lỗi không được phát hành/tải cho thợ; cô lập, báo rõ lỗi cho khách. Việc thanh lý bytes dùng cùng cơ chế purge khi đủ policy, không dùng file chưa quét làm mẫu in hoặc đưa vào LLM.

## 7. Website, kho file và vận hành Ubuntu

- Container PostgreSQL có volume DB; container website có volume private, ví dụ `/var/lib/minhlab/private-files`. Volume private nằm ngoài `public/`, `.next/`, image và `/tmp`; user app có quyền tối thiểu. Không phục vụ volume bằng static alias của proxy.
- Model hồi quy JSON/TypeScript ở cùng bản release website; không tải dataset huấn luyện lên VPS để phục vụ dự đoán. STL preview ở browser; worker scan/analysis server xử lý file đã gửi.
- Để giữ hai container thường trực, host timer gọi worker bằng `docker compose exec -T web ...`; không cần container model/scheduler riêng. Timer có chống chạy chồng và theo dõi exit code. Scanner thật và signature được cập nhật phải sẵn sàng trước khi bật nhận file; cấu hình executable đơn thuần không chứng minh quét thành công.
- `files:process` xử lý scan/analysis; `files:cleanup` giữ dry-run; sau khi nghiệm thu mới lên lịch `files:cleanup -- --apply` mỗi giờ. Đây là lịch đích cần cấu hình, chưa có cron/systemd được tạo trong lượt này.
- Backup DB và bytes cùng mốc, mã hóa/giới hạn truy cập và có bản ngoài VPS. Hạn backup chứa file khách được cấu hình/công bố riêng; purge live không bảo đảm bytes biến mất ngay khỏi backup.
- Giữ nhật ký purge cần thiết ngoài phạm vi snapshot rollback để khi restore vẫn biết asset nào đã bị xóa. Trước mở traffic sau restore, chặn download, đối chiếu nhật ký và dọn lại asset hết hạn/đã purge; không tự phục hồi quyền đọc file đã xóa từ backup cũ.
- Chưa chốt số ngày lưu backup hoặc chứng từ trong thiết kế này. Đây là điều kiện cần bổ sung trước bật nhận file thật, không lấy 48 giờ/7 ngày của live storage thay thế.

## 8. Nội dung giao diện cần có

| Vị trí | Thông điệp/hành động |
| --- | --- |
| Preview | “File được phân tích trên thiết bị của bạn. Chỉ khi gửi yêu cầu in, file mới được tải lên xưởng.” |
| Trước gửi | Giải thích lưu private, chờ kỹ thuật duyệt và thời hạn; checkbox quyền sử dụng, nút “Gửi yêu cầu in” |
| Phiếu chờ | Mã yêu cầu, trạng thái file/scan/review, người phụ trách theo quyền, việc khách cần làm và lịch sử revision |
| Phiếu đóng không đặt in | “File dự kiến được xóa sau 48 giờ kể từ khi yêu cầu kết thúc”, kèm ngày giờ cụ thể |
| Báo giá | File/revision, cấu hình khách yêu cầu và bản chốt, quantity, từng khoản tiền, vận chuyển, tổng, hạn và ngày dự kiến; hai hành động chấp thuận/điều chỉnh và hành động đóng riêng |
| Đơn đang xử lý | “File được giữ trong thời gian xử lý đơn và 7 ngày sau khi đơn hoàn tất.” |
| Đơn hoàn tất | Ngày giờ dự kiến xóa; tải lại file của mình khi còn quyền; hướng dẫn gửi lại để đặt in mới sau hạn |
| Sau purge | “File đã hết thời hạn lưu. Lịch sử đơn vẫn được giữ. Vui lòng gửi lại file nếu muốn đặt in tiếp.” |
| Quản trị | Bộ lọc file sắp hết hạn, blocker/hold, dry-run, lịch sử xóa; không có nút xóa ép vượt đơn đang làm |

Không hiển thị `scheduledDeletionAt` khi còn blocker, không hứa một ngày xóa giả trong khi đang giữ. Khi hạn thay đổi do hoàn hàng/in lại, hiển thị trạng thái giữ phù hợp, không lộ ghi chú nội bộ.

## 9. Hiện trạng đã đối chiếu và phần cần triển khai

| Hạng mục | Bằng chứng source | Khoảng trống |
| --- | --- | --- |
| Preview cục bộ | [useStlAnalysis.ts](../../src/components/print-request/useStlAnalysis.ts) | Giữ tính chất không upload ở bước dự đoán |
| Submit/review/quote/accept | [print-request.service.ts](../../src/services/print-requests/print-request.service.ts), [repository](../../src/repositories/print-requests/print-request.repository.ts) | Hoàn thiện close/reopen/expiry và thông báo; quote decline hiện chuyển NEEDS_REVISION, không phải đóng phiếu |
| Hạn file hiện có | [private-file.repository.ts](../../src/repositories/print-requests/private-file.repository.ts) | Đang đặt hạn từ upload và loại trừ mọi attachment khi cleanup; chưa thực hiện bảng thời hạn ở mục 4 |
| Xóa bytes | [private-files.ts](../../src/server/private-files.ts), [cleanup CLI](../../scripts/workers/private-files-cleanup.cjs) | Đã có dry-run/apply và ENOENT; cần phân loại asset, tính tham chiếu, hold, giao thức claim/khóa/retry và read lease |
| File private/scan | [local-store.ts](../../src/integrations/private-files/local-store.ts) | Allowlist hiện chỉ model/ảnh; chưa có uploader project slicer/G-code, chưa nghiệm thu scanner/volume thật |
| Hoàn hàng | [migration 021](../../database/migrations/021_order_returns.sql) | Có trạng thái return/refund; chưa có workflow khiếu nại/in lại tổng quát hoặc retention hold tương ứng |
| Deploy | [runbook](../operations/production-runbook.md) | Chưa có Compose, volume/backup/timer và nghiệm thu VPS trong phạm vi tài liệu này |

## 10. Tiêu chí nghiệm thu khi hiện thực

1. Chọn file/xem dự đoán không gửi request upload hoặc tạo asset/đơn. Đăng nhập giữ draft trong tab; reload không được hứa giữ File trong localStorage.
2. Upload bỏ dở: chưa đủ 48 giờ giữ bytes; sau hạn và lượt cleanup thành công thì purge. Upload lỗi không báo đã nhận phiếu.
3. Phiếu đang kiểm/bổ sung, quote hiệu lực hoặc đơn đang xử lý: không xóa dù file có tuổi lớn hơn 48 giờ/7 ngày.
4. Phiếu đóng không thành đơn: đúng 48 giờ sau mốc đóng; mở lại/quote mới hợp lệ trước claim vô hiệu deadline cũ.
5. Request CLOSED do conversion: file vẫn tồn tại trong lúc đơn chờ tiền, chế tác và giao; quote hết hạn sau conversion không xóa file.
6. Đơn COMPLETED: giữ đủ 7 ngày; hoàn hàng/hold/in lại chặn purge. Gỡ blocker tính mốc giải quyết mới, không xóa ngay theo deadline cũ.
7. Đơn hủy có tiền/khai báo chờ đối soát: chưa giải quyết thì giữ; lưu trữ mềm admin không kích hoạt purge.
8. Asset dùng chung nhiều revision/phiếu/đơn: giữ theo blocker và hạn muộn nhất; asset không rõ loại/dữ liệu cũ không bị suy diễn thành bỏ dở.
9. Source/approved/slicer model được dọn theo scope; payment proof, bằng chứng QC, catalogue/GLB không bị cleanup model chọn nhầm.
10. Chạy đồng thời cleanup với accept/submit/reopen/payment/hold/scan/download: một thứ tự hợp lệ, không nhận đơn hoặc stream thành công từ asset bị xóa giữa chừng.
11. Crash sau claim, sau unlink, lỗi quyền/disk, ENOENT, worker trùng và lease hết hạn: retry idempotent, marker/audit đúng, không giải phóng quota trước khi bytes đã purge.
12. Quyền CUSTOMER/FILE_REVIEWER/PRINT_OPERATOR/STAFF/ADMIN, asset purged và IDOR được kiểm qua API; nội dung/path không bị lộ qua DTO/log/link.
13. Backup/restore diễn tập với volume và purge journal; không hồi sinh file đã xóa. Scanner thật, lịch worker và backlog được kiểm trên staging cô lập.
14. Tiền/checksum snapshot/idempotency quote-conversion giữ đúng; Python–TypeScript model không thay đổi vì retention.

## 11. Thứ tự triển khai

1. Bổ sung policy thuần, phân loại asset và migration mới cho dữ liệu còn thiếu; dữ liệu cũ mặc định cần rà soát, chưa purge tự động.
2. Nối deadline/hold vào submit, revision, close/reopen, quote expiry/accept, order completion/cancel và resolution. Hoàn thiện quyền và contract trước UI.
3. Sửa cleanup, claim/retry, read/processing lease và giao thức khóa ở mọi caller; kiểm các ca đồng thời trên DB/storage cô lập.
4. Bổ sung UI ngày lưu/xóa, trạng thái file và hành động đóng/điều chỉnh; chưa cần mở uploader slicer/G-code để hoàn tất luồng source model.
5. Chuẩn bị Compose hai container, scanner, volume, backup/restore, timer; dry-run trên staging rồi mới bật apply. Nghiệm thu các vai trò trước nhận file thật.

Lượt thiết kế ban đầu chỉ thêm tài liệu; lượt tiếp tục đã thêm source, migration 024 và cấu hình deployment/worker. Các tiêu chí trên vẫn là điều kiện nghiệm thu, không phải danh sách test đã đạt; kết quả cụ thể và giới hạn được ghi trong báo cáo triển khai. Download hiện dùng buffer có giới hạn dưới khóa lifecycle thay cho lease stream; cache deadline được tính lại khi đọc/cleanup từ quan hệ hiện hành. Uploader artifact slicer/G-code và sửa model tại xưởng chưa mở; scope hiện thực phục vụ source model khách gửi. Thời hạn backup/chứng từ và đích backup ngoài host vẫn cần quyết định vận hành.
