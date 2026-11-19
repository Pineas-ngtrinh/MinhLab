# Những quyết định sản phẩm còn cần chốt

Trạng thái hiện hành của các quyết định và code có trong [ma trận triển khai 11/11/2026](implementation-verification-2026-11-11.md). Bảng dưới được cập nhật: DD-01 đã có implementation; phần thiếu là dữ liệu/vận hành thực tế và các policy còn mở, không còn thiếu bảng acceptance/job như bản 03/11.

Các quy tắc đã rõ như guest checkout, tiền nguyên VND, đối soát ngân hàng thủ công và quyền theo DB **không** được mở lại thành câu hỏi phê duyệt. Không có đề xuất kết nối ngân hàng tự động trong tác vụ này.

| ID | Quyết định thực sự còn thiếu | Lựa chọn và hệ quả | Hành vi hiện tại / phần giữ nguyên |
|---|---|---|---|
| DD-02 | Hủy/reprint/refund sau khi đã nhận tiền; ranh giới điều chỉnh order/job đã chốt | Cần quy trình có người quyết định, ledger/audit và kiểm soát thanh toán thủ công; không cho hạ trạng thái qua PATCH. | Schema plan/job/allocation/hold và concurrency đã có migrations `009–015`; runtime hiện chặn hạ cấp đơn đã thanh toán. Chưa có luồng hoàn tiền/hủy đã thu tiền. |
| DD-03 | Retention cho tệp, bằng chứng, token/outbox và dữ liệu cá nhân | Chốt thời hạn riêng theo loại, ngoại lệ tranh chấp/backup/audit và quyền yêu cầu xóa. | File cleanup có dry-run và chỉ purges tài sản hết hạn không còn tham chiếu; số ngày và host backup cần xưởng/chủ dự án cấu hình. Token/outbox chưa có lịch dọn đầy đủ. |
| DD-04 | Ngưỡng và nguồn định danh đáng tin cho rate limiting | A: Reverse proxy/gateway với trusted IP và cấu hình triển khai; B: Bộ đếm dùng chung tại ứng dụng sau khi có topology tin cậy. Cần cân bằng chống spam, khách dùng chung mạng và chi phí hash/DB. | Throttle đăng nhập theo tài khoản còn hiệu lực; chưa tin X-Forwarded-For tùy ý và không thêm limiter theo RAM process. |
| DD-05 | Provider/model và hạn mức LLM | Chọn provider/model, hạn mức chi phí và key riêng cho môi trường. | Adapter OpenAI Responses bị tắt mặc định; không gọi mạng khi thiếu cấu hình/ủy quyền metadata. |

Agent hiện chỉ tạo draft qua tool hạn chế; mọi plan cần người duyệt. Không có quyền auto-apply, QC, thanh toán hay start máy.

## Quyết định đã chốt — phần triển khai còn lại

- **DD-01, đóng câu hỏi ngày 04/11/2026, đã triển khai và kiểm DB cô lập:** một acceptance tạo một đơn đủ số lượng đã duyệt; retry trả đơn cũ, đặt thêm cần quote mới. Quote/terms/file revision immutable, unique conversion và transaction được test. [Quyết định](../DECISIONS.md). Chưa xử lý policy refund/cancel đơn đã thu tiền.
- DD-04 phụ thuộc topology VPS; thông tin gói/host hiện được chủ dự án để sau. Dữ liệu BOM/tồn/máy/evidence cần xác nhận tại xưởng, không cần chủ dự án chọn PK/FK.
