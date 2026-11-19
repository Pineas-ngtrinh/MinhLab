# Xác minh nền tảng trước hoàn thiện toàn sản phẩm — 03/11/2026

Mã tác vụ: FINALIZE-BASELINE-2026-11-03

Mục tiêu: Chạy lại các cổng chất lượng hiện hành, xác minh ca checkout đã lỗi, làm baseline trước khi triển khai phần còn thiếu.

Tệp đã sửa: Báo cáo này; docs/PROGRESS.md; checklist hoàn thiện; chú thích cập nhật báo cáo sắp xếp; docs/README.md. Test tích hợp tự cập nhật docs/ooad/test-results.json. Log unit/build ở .local/finalization-unit.log và .local/finalization-build.log (Git bỏ qua).

Tóm tắt triển khai: Không sửa code nghiệp vụ. Code đầu lượt đã có validUnitPrice kiểm tra số nguyên VND và giới hạn. Xác minh thực tế ca SKU 0,5 VND × 2 bị từ chối đúng; lỗi lịch sử không còn tái hiện ở bản hiện tại. Giữ toàn bộ thay đổi có sẵn.

Kiểm tra đã chạy và kết quả:

- npm run check: đạt; architecture guard 186 file, 0 vi phạm.
- npm run test:unit: đạt; 105 test pass, 1 test phụ thuộc DB skip; 109 scene assertions đạt riêng trong test:models. Không gọi test skip là pass.
- npm run test:production: lần đầu EPERM trong sandbox; chạy lại với quyền kết nối PostgreSQL local đạt trên database cô lập. Báo cáo máy đọc tại docs/ooad/test-results.json. Bao gồm migration/idempotency, quyền, checkout, thông báo, thử đồng thời và transaction rollback.
- npm run build: đạt.
- git diff --check: đạt.

Đã lần theo code declarePayment → outbox Telegram và đường xác nhận thủ công. Test tích hợp xác minh đối soát đồng thời chỉ ghi nhận một lần; khi outbox lỗi, trạng thái và audit thanh toán rollback. Đây không phải nghiệm thu gửi Telegram thật hay kiểm chứng tiền vào ngân hàng.

Ảnh hưởng kiến trúc: Không áp dụng, không đổi runtime hoặc schema.

Ảnh hưởng OOAD: Cập nhật artifact kết quả test; không đổi mô hình/sơ đồ.

Rủi ro đã biết: Chưa nghiệm thu mail/Telegram thật, browser ở lượt này, staging hoặc host production. Kết quả local không chứng minh toàn sản phẩm đã hoàn tất.

Vấn đề còn lại: Hoàn thiện nhận file riêng tư, phân tích bền vững, phiếu/revision/duyệt giá, BOM/tồn, điều phối/gom mẻ và AI theo checklist. Kiểm thử hồi quy baseline đạt không đóng toàn bộ bước nghiệm thu nghiệp vụ.

Trạng thái rà soát: Sẵn sàng để ChatGPT rà soát baseline; chưa đủ điều kiện deploy toàn sản phẩm.
