# Chọn công cụ và làm gọn MinhLab 3D — 04/11/2026

## Kết luận cho dự án

Giữ modular monolith Next.js/PostgreSQL hiện hành. Ưu tiên tìm code theo tính năng, kiểm chứng quan hệ import, rồi tách từng trách nhiệm khi có vấn đề cụ thể. Chưa có lý do từ khảo sát này để chuyển sang microservices, monorepo hay một cấu trúc framework khác.

Đây là đánh giá độ phù hợp từ tài liệu chính thức và khảo sát repo, không phải benchmark hoặc kết quả chạy các công cụ bên ngoài. Chưa cài công cụ mới hay gửi source lên dịch vụ ngoài.

## So sánh công cụ

| Công cụ / nguồn chính thức | Dùng cho việc gì | Quyết định cho MinhLab |
| --- | --- | --- |
| [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices) | Nguyên tắc phân chia trách nhiệm, xử lý lỗi, kiểm thử và vận hành Node.js | Dùng chọn lọc làm checklist review. Repo đã có route/use case/repository; giữ quy ước Next.js và SQL hiện hành, không chép starter Express. |
| [Knip](https://knip.dev/overview/getting-started) | Tìm file, export và dependency không được dùng | Công cụ bổ sung đáng thử nhất ở lượt dọn mã thừa. Có [plugin Next.js](https://knip.dev/reference/plugins/next); cần kiểm cả script, test, Web Worker và dynamic import trước khi xóa. Knip v6 cần Node >=20.19, cao hơn mức tối thiểu 20.9 của ứng dụng; dùng Node 22 của CI khi thử. |
| [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | Phân tích, đặt luật và trực quan hóa quan hệ dependency JS/TS | Phù hợp nhất nếu cần graph import bằng công cụ chuyên dụng. Hiện trùng một phần guard nội bộ; chưa thêm ngay. Khi dùng phải giữ luật đặc thù client/server/domain hiện có và chạy đối chiếu fixture trước khi thay guard. |
| [Archify](https://github.com/tt-a1i/archify) | Agent tạo mô hình JSON, công cụ kiểm tra và render visual tương tác | Tùy chọn cho bản đồ tổng quan trình bày với người xem. Không xem hình đẹp hoặc validator của hình là bằng chứng quan hệ trong source đúng. Đối chiếu từng cạnh với code. |
| [Understand-Anything](https://github.com/Lum1104/Understand-Anything) | Pipeline AI tạo knowledge graph và dashboard khám phá codebase | Thử khi cần onboarding sâu hoặc phân tích nhiều luồng; chưa cần làm công cụ mặc định cho khoảng 200 file code. Có thêm bước lập graph/cập nhật, và kết quả AI cần kiểm chứng. |
| [EventCatalog](https://github.com/event-catalog/eventcatalog) | Catalogue systems/domains/services/messages/schemas, tài liệu và business flows | Hữu ích hơn khi cần quản trị nhiều service/message/schema. Monolith vẫn dùng được, nhưng hiện thêm một hệ thống tài liệu phải duy trì trong khi Markdown và OOAD đã có. Hoãn. |
| [Madge](https://github.com/pahen/madge) | Graph module và phát hiện phụ thuộc vòng | Nhẹ hơn về mục tiêu sử dụng, phù hợp kiểm tra nhanh. Chọn dependency-cruiser nếu cần luật kiến trúc; tránh cài cả hai cho cùng một việc. |
| [RealWorld](https://github.com/realworld-apps/realworld) | Các implementation full-stack theo bài toán Medium clone | Nguồn học cách hiện thực từng luồng; không dùng làm khuôn cấu trúc cho xưởng in, đơn hàng, outbox và 3D. |
| [Airbnb JavaScript](https://github.com/airbnb/javascript) | Quy ước viết JavaScript | Chỉ tham khảo cách viết dễ đọc. Giữ ESLint 9 + eslint-config-next đang có; không đổi formatter/style diện rộng chỉ để giống Airbnb. |
| [Awesome](https://github.com/sindresorhus/awesome), [Developer Roadmap](https://github.com/kamranahmedse/developer-roadmap) | Danh mục tài nguyên và lộ trình học | Dùng tra cứu; không phải công cụ phân tích hay tái cấu trúc code. |

Các lựa chọn trên là nhận định cho repo này. Không dùng số sao GitHub làm tiêu chí chất lượng, và không coi công cụ tạo graph là công cụ tự sửa kiến trúc.

## Những điểm làm repo khó đọc

Khảo sát đếm được 185 file trong src, 41 file trong app và 183 file trong docs (gồm cả asset/tài liệu, không chỉ mã runtime). Guard có phạm vi đếm riêng: bỏ test, declaration và các file không phải JS/TS; xem [báo cáo sinh từ source](codebase-map-2026-11-04.md).

1. **Nhiều tầng nhưng thiếu góc nhìn theo luồng khi mới mở repo.** Auth/catalog/orders đã tách tầng; chuyển toàn bộ sang feature folders sẽ gây đổi import và guard lớn. Bổ sung điểm vào module trong PROJECT_STRUCTURE giúp tìm code mà không cần thay kiến trúc.
2. **Tài liệu hiện hành, kế hoạch và bằng chứng lịch sử cùng nằm trong mục lục dài.** Thêm bảng chọn tài liệu theo câu hỏi ở đầu docs/README; giữ đường dẫn cũ để không phá OOAD và tham chiếu lịch sử.
3. **Một số file chứa nhiều chi tiết.** LabScrollytelling và LabCanvas là hai file dài nhất. Độ dài chưa chứng minh cần tách; phải xác định component, effect và quyền sở hữu tài nguyên trước. Các tọa độ camera và cơ chế tải 3D được bảo vệ.
4. **src/lib dễ trở thành chỗ chứa mọi thứ.** Hiện đã có quote engine và helper ở đây. Đặt code mới theo trách nhiệm sẵn có; chỉ chuyển helper khi có consumer và trách nhiệm rõ, không tạo một thư mục utils thay thế với cùng vấn đề.
5. **Worktree có nhiều thay đổi chưa commit từ trước.** Không thể dùng diff tổng để quy trách nhiệm cho lượt này; không reset, xóa hoặc đưa tất cả vào một commit dọn dẹp.

## Đã làm trong lượt này

- Bổ sung `npm run architecture:report`, dùng chính TypeScript resolver và luật guard hiện có; không thêm dependency.
- Báo cáo nhóm code, quan hệ import giữa nhóm, file dài và file nhiều caller. JSON xuất bằng `npm run --silent architecture:report -- --json` giữ đường dẫn file và phân biệt cạnh type-only để dùng cho công cụ khác; không phải định dạng nhập Archify có sẵn.
- Giữ nguyên kết quả guard mặc định; graph chỉ được tạo khi caller yêu cầu `includeGraph`.
- Bổ sung điểm vào tài liệu, bảng tra module và snapshot báo cáo. Không thay đổi route, UI, DB, cấu hình thanh toán, GLB hoặc camera.

Báo cáo chỉ đọc source cục bộ và in ra stdout. Xem nhanh bằng `npm run architecture:report`; tạo snapshot bằng cách chuyển stdout của lệnh có `--silent` tới file đích bạn chọn. Không cần DB/server/API key. Guard phát hiện vi phạm thì lệnh trả exit code 1. Snapshot không tự cập nhật; chạy lại để kiểm tra code mới.

## Thứ tự dọn tiếp có giới hạn

| Thứ tự | Việc cụ thể | Điều kiện hoàn tất |
| --- | --- | --- |
| 1 | Rà mã/dependency thừa bằng Knip trong Node 22, đối chiếu các entry point trước khi xóa | Có danh sách đã xác minh; check và test module liên quan đạt; không tự động xóa theo mọi cảnh báo |
| 2 | Tách một trách nhiệm độc lập trong component dài khi xác định được lợi ích | Giữ hành vi, camera/GLB và cleanup; check, visual QA theo viewport và build nếu ảnh hưởng ranh giới |
| 3 | Nếu vẫn khó lần import, thử dependency-cruiser trên app/src rồi so với guard nội bộ | Giải được alias và type-only, không mất luật client/server; chỉ thêm devDependency khi có nhu cầu thực tế |
| 4 | Khi cần thuyết trình, dựng bản đồ tổng quan bằng Archify từ các quan hệ đã xác minh | Phân biệt rõ import, HTTP, DB và thiết kế chưa triển khai; không gom toàn bộ file vào một hình |

Các dòng này là đề xuất tiếp theo, chưa được triển khai hoặc kiểm chứng bằng công cụ bên ngoài. Chưa kết luận mã nào là dead code, chưa xác nhận production readiness.

## Báo cáo bàn giao Codex → ChatGPT

Mã tác vụ: ARCH-TOOLING-2026-11-04

Mục tiêu: Đánh giá công cụ phù hợp và giảm công sức tìm hiểu cấu trúc MinhLab 3D.

Tệp đã sửa trong lượt này:

- `../../README.md`, `../../PROJECT_STRUCTURE.md`, `../README.md`, `../../scripts/README.md`.
- `../../package.json`: thêm script architecture:report; không đổi dependency hoặc lockfile.
- `../../scripts/lib/architecture.cjs`: thêm graph tùy chọn, giữ kết quả mặc định.
- `../../scripts/checks/report-architecture.cjs`: công cụ báo cáo Markdown/JSON mới.
- `../../scripts/tests/test-architecture.cjs`: thêm ca kiểm tra graph.
- Báo cáo này và `codebase-map-2026-11-04.md`.

Tóm tắt triển khai: Thêm báo cáo import đọc trực tiếp từ source, phân biệt type-only và runtime; cải thiện điều hướng tài liệu/module; ghi đánh giá 10 nhóm công cụ/tài nguyên cùng phạm vi áp dụng. Không cài hoặc chạy công cụ bên ngoài.

Kiểm tra đã chạy và kết quả:

- `npm run check`: đạt TypeScript, ESLint và guard; 186 file, 0 vi phạm.
- `npm run test:architecture`: 12/12 test đạt, gồm ca graph alias, re-export, dynamic import literal và type-only.
- `node --check` với analyzer, script báo cáo và test kiến trúc: đạt.
- Chạy script báo cáo Markdown và chế độ JSON: đạt; 186 node, mọi cạnh trỏ vào node tồn tại; snapshot giống đầu ra khi chạy lại.
- Kiểm tra 92 liên kết local trong 6 tài liệu điều hướng/báo cáo trước khi thêm mục bàn giao này: không có đường dẫn thiếu.
- `git diff --check`: đạt.
- Không chạy build, browser, test PostgreSQL hoặc toàn bộ unit suite: thay đổi chỉ ở công cụ phân tích và tài liệu, không đổi runtime ứng dụng.

Ảnh hưởng kiến trúc: Giữ nguyên kiến trúc ứng dụng; mở rộng API analyzer nội bộ bằng tùy chọn includeGraph. Luật guard hiện hành giữ nguyên.

Ảnh hưởng OOAD: Không áp dụng; không sửa sơ đồ hoặc traceability.

Rủi ro đã biết: Graph chỉ bao phủ import nội bộ trong phạm vi guard; snapshot có thể cũ khi code thay đổi. Không đo độ phức tạp nghiệp vụ, không phát hiện toàn bộ dead code hoặc luồng HTTP/DB.

Vấn đề còn lại: Rà mã thừa bằng Knip và refactor component dài chưa thực hiện; cần xác minh riêng trước khi xóa/tách. Các thay đổi worktree có sẵn được giữ nguyên.

Trạng thái rà soát: Sẵn sàng để ChatGPT rà soát phần công cụ và điều hướng đã hoàn tất.
