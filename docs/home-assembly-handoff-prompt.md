# MinhLab Homepage — Prompt bàn giao cho Antigravity

Bạn đang tiếp tục dự án MinhLab 3D tại:

`/Users/nguyenphucphu/Downloads/minhlab-3d`

Đọc toàn bộ `AGENTS.md` và các skill bắt buộc trước khi chỉnh sửa:

- `.agents/skills/premium-ui-design/SKILL.md`
- `.agents/skills/frontend-engineering/SKILL.md`
- `.agents/skills/visual-qa/SKILL.md`

## Mục tiêu cuối cùng

Hoàn thiện trang chủ thành một hành trình kể chuyện fullscreen gồm các chương. Một gesture cuộn dọc hợp lệ phải tiến hoặc lùi đúng một chương, giống lật sang trang/slide mới. Mỗi cảnh là một không gian MinhLab hoàn chỉnh, có liên kết về robot, mascot, vật liệu, ánh sáng và câu chuyện. Nội dung HTML phải nằm trong rail gọn ở bên trái, không che chủ thể của cảnh.

Các route còn lại như `/bo-suu-tap`, `/phong-lab`, `/in-theo-file`, `/ve-minhlab` phải giữ cuộn native và hành vi bình thường.

## Những gì đã được thực hiện

### 1. Sáu scene plate chất lượng cao đã được render và đưa vào project

Các ảnh 16:9 nằm tại:

- `public/images/home-scenes/scene-01-origin.png`
- `public/images/home-scenes/scene-02-paths.png`
- `public/images/home-scenes/scene-03-collection.png`
- `public/images/home-scenes/scene-04-lab.png`
- `public/images/home-scenes/scene-05-custom.png`
- `public/images/home-scenes/scene-06-corner.png`

Các cảnh dùng cùng ngôn ngữ hình ảnh: workshop than chì, gỗ walnut, đá đen, viền champagne gold, robot voxel trắng và ánh sáng studio ấm. Mascot khỉ kỹ sư đã được render trực tiếp vào từng background với hành động khác nhau, hai tay trống, không cầm nozzle.

Không tạo thêm mascot chạy/nổi tự do trên giao diện. Không bật lại `HomeCompanion` hoặc `ConsultantMascot`.

### 2. Sân khấu CSS khối cũ đã được thay bằng scene plate

File:

- `src/components/home/StoryAssemblyStage.tsx`
- `src/components/home/story-assembly.module.css`

Hiện trạng:

- Chỉ có một stage fullscreen cố định cho cả trang chủ.
- Sáu ảnh được render thành các layer trong cùng stage.
- Cảnh active crossfade, zoom rất nhẹ và có sweep champagne khi đổi chương.
- Có scrim riêng cho copy rail và vignette, không còn robot hình chữ nhật dựng bằng CSS.
- Mobile/tablet dùng crop và object-position riêng.
- `prefers-reduced-motion` tắt chuyển động.

Không quay lại hệ thống slab/artifact CSS cũ. Không tạo sáu Canvas hoặc sáu stage độc lập.

### 3. Nội dung fullscreen đã được thu gọn

File:

- `src/components/home/StudioExperience.tsx`
- `src/components/home/studio.module.css`

Hiện trạng:

- Bảy chapter đều dùng `height: 100svh` và copy rail bên trái.
- Mapping cảnh: `SCENE_BY_CHAPTER = [0, 1, 2, 3, 4, 4, 5]`.
- Ba card lối vào đã đổi thành ba link nhỏ.
- Bộ sưu tập chỉ còn một featured-product spec block.
- Console phòng lab lớn đã được thay bằng danh sách FDM/Resin gọn.
- Quy trình in theo file đã đổi thành timeline bốn dòng.
- Chapter FAQ chỉ còn preview ba câu.
- FAQ đầy đủ và footer đã chuyển xuống `#studio-support` ở normal document flow sau hành trình fullscreen.
- Không còn `HomeCompanion` trong component.

### 4. Cuộn từng chương đã được triển khai

File:

- `src/components/home/useStudioScroll.ts`
- `src/components/home/chapter-scroll.ts`
- `scripts/test-studio-scroll.cjs`

Hiện trạng:

- Đã gỡ Lenis/ScrollTrigger khỏi controller homepage để tránh hai engine tranh nhau.
- Wheel/trackpad dùng ngưỡng 36px và khoảng nghỉ 200ms; momentum tail được hấp thụ.
- Mỗi gesture chuyển đúng một `[data-home-chapter]` bằng GSAP khoảng 0.75 giây.
- Touch swipe dọc dùng ngưỡng 42px.
- Hỗ trợ Arrow, Page Up/Down, Space, Home và End.
- Tạm dừng khi cart, checkout, dialog hoặc mobile navigation đang mở.
- Cho native scrolling ở biên đầu/cuối để không tạo scroll trap và để người dùng xuống phần FAQ/footer normal-flow.
- Reduced motion chuyển tức thời nhưng vẫn theo chương.

## Kết quả kiểm tra tự động gần nhất

Đã đạt:

```text
npx tsc --noEmit                         PASS
npm run lint                             PASS — 0 warning/error
node scripts/test-studio-scroll.cjs      PASS — 46 checks
node scripts/test-home-chapters.cjs      PASS — 140 checks
node scripts/test-stepped-home-scroll.cjs PASS — 23 checks
node scripts/test-scene-customization.cjs PASS — 21 checks
```

Tổng cộng 230 kiểm tra chuyên biệt đã đạt.

## Việc Antigravity phải làm tiếp theo

### Ưu tiên 1 — Visual QA thật, không phỏng đoán

Khởi động dev server mới, không dùng `.next` cũ:

```bash
npx next dev -p 3000
```

Kiểm tra lần lượt ở 1440px, 1024px, 768px và 375px:

1. Scene phủ toàn viewport và không có khung/card bao quanh background.
2. Left copy rail không che robot, mascot, máy in hoặc bản vẽ.
3. Chữ và CTA đều nằm trên vùng tối, dễ đọc.
4. Không có horizontal overflow.
5. Mobile không cắt mất heading/CTA/HUD.
6. Sáu ảnh đều tải trước khi hoặc ngay khi chuyển cảnh; không flash nền đen lâu.
7. Scene 04 có đúng một FDM và một resin.
8. Mascot chỉ nằm trong ảnh nền, không có phần tử mascot roaming/floating riêng.

Nếu hình bị crop sai, chỉ chỉnh `focus` trong `SCENE_PLATES` hoặc media query của `story-assembly.module.css`. Không sửa trực tiếp ảnh trừ khi thật sự cần.

### Ưu tiên 2 — Kiểm tra cảm giác cuộn bằng wheel/trackpad thật

Tại mỗi chapter:

1. Một gesture xuống chỉ tới chapter kế tiếp.
2. Momentum tail không nhảy thêm hai hoặc ba chapter.
3. Cuộn ngược hoạt động tương tự.
4. Touch swipe trên mobile tiến đúng một chapter.
5. Link/button/input không bị gesture controller chặn.
6. Mở cart hoặc menu mobile thì controller phải dừng.
7. Từ chapter cuối, cuộn xuống phải vào `#studio-support` bằng native scroll.
8. Từ support cuộn lên phải quay lại chapter cuối tự nhiên, không mắc kẹt.
9. Các route ngoài homepage không có wheel gate.

Nếu cảm giác quá nhạy, tinh chỉnh duy nhất các ngưỡng trong `useStudioScroll.ts`; không thêm lại Lenis hoặc CSS `scroll-snap: mandatory` song song.

### Ưu tiên 3 — Sửa những lỗi bố cục phát hiện qua screenshot

Chỉ sửa có mục tiêu:

- Desktop: rail tối đa khoảng 440px; phần hình bên phải phải là chủ thể chính.
- Tablet portrait: copy nằm trên khoảng 35–40% màn hình, art ở dưới.
- Mobile: copy phải ngắn; có thể ẩn description/spec phụ, nhưng không ẩn CTA chính.
- Các block nội dung bán trong suốt phải nhỏ và không trải qua vùng hình.
- HUD luôn nằm trên cùng nhưng không che CTA.

Không khôi phục ba card ảnh lớn, WorkshopStationConsole trên homepage hoặc bốn process card lớn.

### Ưu tiên 4 — Build production và kiểm tra HTTP

Sau khi visual QA và sửa lỗi:

```bash
npx tsc --noEmit
npm run lint
node scripts/test-studio-scroll.cjs
node scripts/test-home-chapters.cjs
node scripts/test-stepped-home-scroll.cjs
node scripts/test-scene-customization.cjs
npm run build
```

Khởi động production và xác nhận HTTP 200 cho ít nhất:

- `/`
- `/bo-suu-tap`
- `/phong-lab`
- `/in-theo-file`

## Những điều tuyệt đối không được phá

- Không thêm mascot roaming/floating.
- Không quay lại robot/slab CSS phẳng.
- Không tạo card lớn che scene.
- Không thêm neon cyan/tím, particle, hologram hoặc glow kiểu game.
- Không sửa file nhị phân `public/models/minhlab-mascot-v1.glb` và `public/models/minhlab-lab-v1.glb`.
- Không sửa camera spline được bảo vệ trong LabCanvas.
- Không cài thêm thư viện khi những dependency hiện có đã đủ.
- Không để wheel gate ảnh hưởng route khác.
- Không báo hoàn tất trước khi đã chụp và xem screenshot thật ở desktop lẫn mobile.

## Definition of Done

Trang chủ chỉ được coi là hoàn thiện khi:

1. Sáu scene render hiện rõ, không bị nội dung che chủ thể.
2. Một gesture cuộn tương ứng một chapter ở cả hai hướng.
3. Người dùng đi qua chapter cuối vào FAQ/footer normal-flow mà không bị scroll trap.
4. Desktop, tablet và mobile không overflow/cắt nội dung.
5. Không có console error hoặc hydration error.
6. TypeScript, lint, toàn bộ test và production build đều đạt.
7. Các route ngoài homepage vẫn hoạt động bình thường.

Khi bàn giao lại, ghi rõ screenshot đã kiểm tra, file đã sửa, kết quả từng lệnh và mọi giới hạn còn lại.
