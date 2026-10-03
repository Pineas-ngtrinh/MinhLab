# MinhLab — mô hình phòng lab voxel v1

Đây là **mô hình 3D có hình học thật**, dựng lại theo tinh thần ảnh phòng lab MinhLab đã duyệt. Không phải ảnh gắn lên một mặt phẳng và không phải chuyển ảnh sang 3D bằng photogrammetry. Mô hình được đơn giản hóa, phù hợp một bản diorama đầu tiên cho website.

## Tệp chính

- `minhlab-lab-v1.glb`: toàn bộ phòng lab, vật liệu và bốn animation, không cần texture ngoài.
- `minhlab-lab-preview.png`: ảnh render kiểm tra từ chính các tam giác trong GLB.
- `minhlab-mascot-detail.png`: góc nhìn gần mascot, cũng render từ GLB.
- `build_lab.py`: mã nguồn dựng hình học và xuất lại GLB; chỉnh màu, kích thước, vị trí tại đây.
- `inspect_render.py`: đọc lại GLB, kiểm tra cấu trúc và render CPU ngoại tuyến.
- `model-info.json`, `validation-report.json`: thống kê và kết quả kiểm tra thật.
- `nextjs/`: hai component mẫu để đưa mô hình vào dự án React + Next.js.

## Có gì trong mô hình

- Phòng mở hai phía, sàn gạch và tường voxel.
- Hai máy in FDM minh họa, đầu in tách riêng, cuộn nhựa và ống dẫn.
- Bàn thao tác, tủ ngăn kéo, bảng treo dụng cụ, kệ và mẫu in.
- Giá cuộn nhựa tím, cyan, vàng; máy tính với mô hình dây; cây voxel.
- Mascot khỉ: mặt pixel, áo lab trắng, logo M, giáp tím–xám, viền vàng và thiết bị đầu in trên tay.
- Vật liệu emissive cho đèn và điểm sáng. Muốn có bloom/glow trong website cần thiết lập thêm ở renderer; emissive không tự chiếu sáng các vật xung quanh.

Các chi tiết là minh họa nhận diện, **không phải bản thiết kế chế tạo máy in**. Mẫu in trong máy là mô hình trưng bày, chưa có hiệu ứng vật thể mọc lên từng lớp.

## Animation đã có trong GLB

| Clip | Chuyển động |
| --- | --- |
| `Printer_A_Printing` | Đầu in A di chuyển ngang và cuộn nhựa quay |
| `Printer_B_Printing` | Đầu in B di chuyển ngang và cuộn nhựa quay |
| `Mascot_Wave` | Tay cầm thiết bị vẫy nhẹ |
| `Mascot_Look` | Đầu khỉ quay nhẹ sang hai bên |

Đây là animation các bộ phận cứng có pivot, chưa phải nhân vật có skeleton/skinning hay animation đi bộ. Các clip không tự phát khi chỉ import GLB; ứng dụng cần dùng AnimationMixer/useAnimations để chạy chúng.

## Mở trong Blender

- Mở Blender, chọn File > Import > glTF 2.0.
- Chọn `minhlab-lab-v1.glb`.
- Xem Material Preview hoặc tự thêm ánh sáng. Có thể chỉnh các object, vật liệu và animation đã import.
- Lưu thành `.blend` trên máy của bạn nếu muốn. Gói này không chứa `.blend` vì môi trường tạo tệp không có Blender.

## Đưa vào React + Next.js

Gói này **không phải toàn bộ website Next.js**. Hai component là ví dụ tích hợp, chưa được chạy production build trong môi trường tạo mô hình.

1. Trong dự án Next.js App Router hiện tại, cài các phiên bản tương thích của:

   `npm install three @react-three/fiber @react-three/drei`

   Nếu TypeScript yêu cầu khai báo kiểu cho Three.js, cài thêm `npm install -D @types/three`.

2. Đặt GLB tại `public/models/minhlab-lab-v1.glb`.
3. Đặt ảnh preview tại `public/images/minhlab-lab-preview.png`.
4. Đặt hai tệp trong `nextjs/` cạnh nhau tại `components/minhlab/`.
5. Import `MinhLabViewer` vào trang và render `<MinhLabViewer />`.
6. Chạy build và kiểm tra trên thiết bị thật. Nếu TypeScript/React/Three.js đang ở phiên bản khác, đối chiếu peerDependencies trước khi đổi package.

Component wrapper khai báo `next/dynamic` với `ssr: false` bên trong Client Component. Nội dung giới thiệu và SEO của trang có thể giữ trong Server Components.

Mẫu viewer dùng OrbitControls để **kiểm tra mô hình**, nên thao tác cuộn trên viewer dùng để zoom. Khi đưa vào landing page scroll-driven, bỏ OrbitControls hoặc tắt zoom và dùng camera theo tiến độ GSAP; không để camera tự xoay và timeline cuộn tranh quyền điều khiển.

## Gợi ý camera cho hành trình cuộn

Tọa độ nằm trong trường `extras.cameraPresets` của GLB và được liệt kê ở đây để dễ dùng. Trục Y hướng lên, nhân vật nhìn về +Z, đơn vị kích thước mang tính minh họa.

| Cảnh | Vị trí camera | Điểm nhìn |
| --- | --- | --- |
| Toàn phòng | `[11, 8.5, 13]` | `[0, 1.55, -0.25]` |
| Máy in | `[0.3, 4.1, 3.8]` | `[-2.1, 2.15, -2.1]` |
| Mascot | `[5.2, 3.8, 6.8]` | `[1.15, 1.8, 0.8]` |
| Bàn mẫu in | `[1.1, 4.3, 5.3]` | `[-2.75, 1.38, 1.6]` |

Đây là góc máy khởi điểm để tinh chỉnh theo tỷ lệ màn hình, không phải đường camera đã được kiểm thử trên website. Khi animation bằng GSAP, điều khiển một biến tiến độ và cập nhật camera qua ref/useFrame, không set React state cho mỗi frame. Khi prefers-reduced-motion bật, giữ một góc tĩnh và cuộn nội dung bình thường.

## Dựng lại và kiểm tra

Yêu cầu Python 3, numpy và Pillow:

```bash
python3 build_lab.py
python3 inspect_render.py
```

Lệnh đầu tạo lại GLB và thống kê; lệnh sau đọc GLB đó, xác nhận cấu trúc và render các góc kiểm tra. Chạy lại sẽ thay các tệp xuất cùng tên trong thư mục này; hãy sao lưu nếu đã sửa GLB thủ công.

## Giới hạn và kiểm chứng

- Đã kiểm tra header/chunk GLB, vùng dữ liệu, chỉ số tam giác, normal, hướng mặt, tên node duy nhất, keyframe và quaternion.
- Đã kiểm tra animation thực sự thay đổi tọa độ hình học; đã render trực tiếp từ tệp GLB xuất ra.
- Chưa chạy Khronos glTF Validator chính thức, Blender hoặc trình duyệt WebGL tại môi trường tạo tệp. Không tuyên bố FPS, Lighthouse hay tương thích mọi thiết bị.
- Mô hình chưa nén Draco/Meshopt và không có texture ánh sáng bake. Hình render preview dùng ánh sáng riêng của bộ render CPU; khi đổi renderer, cần tinh chỉnh ánh sáng và tone mapping.
- Bản v1 giữ tinh thần voxel của ảnh tham chiếu, chưa tái tạo từng chi tiết hoặc độ bóng điện ảnh của ảnh concept.
- Tất cả geometry được dựng bằng mã nguồn trong gói, không tải model hoặc texture từ bên thứ ba.

## Tài liệu kỹ thuật đối chiếu

- GLB/glTF: [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- Phần client-only: [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).
- Cân bằng hiệu năng: [React Three Fiber](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
