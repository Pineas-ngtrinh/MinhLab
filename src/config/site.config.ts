/**
 * =====================================================================
 * MINHLAB 3D - CẤU HÌNH THƯƠNG HIỆU & DANH MỤC SẢN PHẨM (UNIQLO STYLE)
 * =====================================================================
 * Triết lý thiết kế:
 *  - Phong cách tối giản Nhật Bản (Minimalist / LifeWear / Industrial Design).
 *  - Ngôn ngữ chân thành, tự nhiên, tập trung vào bản chất thủ công & kỹ thuật FDM.
 *  - Thông số kỹ thuật minh bạch: độ dày lớp 0.12mm, vật liệu PLA+ nguyên sinh,
 *    kích thước thực tế, cân nặng và thời gian in.
 * =====================================================================
 */

export interface ProductItem {
  id: string;
  code: string; // Mã danh mục chuẩn catalogue (e.g. № 01 / TOY)
  title: string;
  category: string;
  categorySlug: 'all' | 'art-toys' | 'diorama' | 'desk-setup' | 'keycaps';
  description: string;
  longDescription?: string;
  price: number; // Giá bán (VNĐ)
  originalPrice?: number; // Giá niêm yết trước ưu đãi
  image: string;
  material: string;
  dimensions: string; // Kích thước (DxRxC cm)
  weight: string; // Trọng lượng
  printTime?: string; // Thời gian chế tác
  layerHeight?: string; // Độ phân giải lớp in (mm)
  featured?: boolean;
  badge?: 'MỚI' | 'TIÊU BIỂU' | 'BÁN CHẠY' | 'ĐỘC BẢN';
  inStock: boolean;
  colors?: { name: string; hex: string }[];
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  iconName: string;
  specs: string[];
}

export interface ProcessStep {
  step: string;
  title: string;
  description: string;
  detail: string;
}

export interface ContactInfo {
  phone: string;
  zaloPhone: string;
  email: string;
  address: string;
  workingHours: string;
  socials: {
    facebook?: string;
    zalo?: string;
    github?: string;
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export const SITE_CONFIG = {
  brand: {
    name: 'MinhLab',
    badge: 'COLLECTOR WORKSHOP',
    positioning: 'Modern Collector Workshop',
    tagline: 'Phục dựng đồ sưu tầm & In 3D theo yêu cầu',
    subtitle: 'Giúp bạn hoàn thiện bộ sưu tập và tìm lại những món đồ gắn liền với ký ức bằng công nghệ in 3D FDM chính xác.',
  },

  studioHome: {
    eyebrow: 'MINHLAB / COLLECTOR WORKSHOP',
    heroTitle: ['Từ ý tưởng.', 'Đến vật thể.'],
    heroDescription: 'Một xưởng nhỏ cho những ý tưởng không nhỏ. Khám phá đồ sưu tầm, ghé phòng lab, hoặc để chúng mình in nên thiết kế của bạn.',
    explore: 'Bước vào MinhLab',
    scroll: 'Cuộn để khám phá',
    index: 'Hành trình tại xưởng',
    label: 'Điều hướng hành trình MinhLab',
    shop: 'Khám phá bộ sưu tập',
    tour: 'Dạo một vòng phòng lab',
    print: 'Bắt đầu với file của bạn',
    introNote: 'Được tạo bằng công nghệ. Hoàn thiện bằng đôi tay.',
    destinationsTitle: 'Bạn muốn bắt đầu từ đâu?',
    destinationsDescription: 'Ba cách để bước vào thế giới MinhLab. Chọn điều khiến bạn tò mò.',
    collectionTitle: ['Một góc riêng.', 'Một dấu ấn của bạn.'],
    collectionDescription: 'Những khối hình có cá tính, dành cho góc bàn và bộ sưu tập của bạn.',
    collectionNote: 'Art Toy & Diorama / Chế tác tại MinhLab',
    labTitle: ['Đằng sau mỗi lớp in,', 'là một người thợ.'],
    labDescription: 'Ghé xưởng, từ bàn kiểm tra file đến khi mô hình thành hình. Hai công nghệ, một tinh thần làm kỹ.',
    labTechnologies: [
      { name: '01 / FDM', title: 'Từ sợi nhựa đến hình khối.', description: 'Đùn từng lớp vật liệu, phù hợp với phụ kiện, mô hình và chi tiết sử dụng hằng ngày.' },
      { name: '02 / RESIN', title: 'Dành chỗ cho từng chi tiết.', description: 'Tạo hình bằng nhựa quang hóa, phục vụ những bề mặt và chi tiết nhỏ cần được thể hiện rõ.' },
    ],
    customTitle: ['File của bạn.', 'Đôi tay của MinhLab.'],
    customDescription: 'Mang bản vẽ đến xưởng. Chúng mình cùng kiểm tra khả năng in, chọn vật liệu và thống nhất báo giá trước khi bắt đầu.',
    fileFormats: '.STL / .OBJ / .STEP / .3MF',
    faqTitle: 'Trước khi bắt đầu.',
    contactTitle: ['Ý tưởng tiếp theo,', 'là của bạn.'],
    contactDescription: 'Chọn một món đã thành hình. Hoặc bắt đầu một điều chưa có.',
    chapterNames: ['Lời chào', 'Ba lối vào', 'Bộ sưu tập', 'Trong xưởng', 'In theo yêu cầu', 'Giải đáp', 'Kết nối'],
    imageAlt: 'Xưởng MinhLab với Khỉ Kỹ Sư tay không, một máy in FDM, một máy in resin và bảng tên đỏ',
    mascotAlt: 'Khỉ Kỹ Sư MinhLab với hai bàn tay trống trong xưởng',
    pause: 'Tạm dừng chuyển động linh vật',
    resume: 'Tiếp tục chuyển động linh vật',
    labImage: '/images/minhlab-lab-resin-v2.png',
    mascotImage: '/images/minhlab-mascot-free-v2.png',
  },

  homeConsultant: {
    label: 'Cùng Khỉ Kỹ Sư khám phá MinhLab',
    guideLabel: 'Khỉ Kỹ Sư · Người dẫn đường của bạn',
    actorLabel: 'KHỈ KỸ SƯ',
    pauseMascot: 'Tạm dừng chuyển động của Khỉ Kỹ Sư',
    resumeMascot: 'Cho Khỉ Kỹ Sư tiếp tục di chuyển',
    actorActions: {
      idle: 'Quan sát cùng bạn', walk: 'Dạo một vòng xưởng', greet: 'Chào bạn đến xưởng',
      point: 'Giới thiệu chi tiết', inspect: 'Kiểm tra bề mặt mẫu', work: 'Kiểm tra chi tiết',
      hop: 'Đổi góc quan sát', celebrate: 'Sẵn sàng bàn giao',
    },
    scrollHint: 'Mỗi nhịp cuộn, một câu chuyện',
    previous: 'Trang trước',
    next: 'Trang tiếp theo',
    wave: 'Chào Khỉ Kỹ Sư',
    freeScroll: 'Cuộn tự do',
    steppedScroll: 'Cuộn từng trang',
    start: 'Dẫn mình vào xưởng',
    browse: 'Xem bộ sưu tập',
    add: 'Thêm vào giỏ',
    print: 'Gửi file để được tư vấn',
    about: 'Câu chuyện MinhLab',
    contact: 'Trò chuyện qua Zalo',
    account: 'Theo dõi đơn hàng',
    restart: 'Về trang mở đầu',
    footer: 'Thông tin liên hệ',
    loading: 'Khỉ Kỹ Sư đang đến…',
    fallback: 'Khỉ Kỹ Sư MinhLab',
    shipping: 'Miễn phí vận chuyển từ 500.000 ₫',
    chapters: [
      { id: 'chao-ban', label: 'Lời chào', eyebrow: '01 / Chào mừng đến xưởng', title: 'Mỗi món đồ, một câu chuyện.', guide: 'Mình là Khỉ Kỹ Sư. Ghé xưởng nhé, mình dẫn đường!', detail: 'Một món đồ sưu tầm. Một góc bàn rất riêng. Hay ý tưởng của bạn đang chờ được in thành hình.' },
      { id: 'ba-khong-gian', label: 'Ba không gian', eyebrow: '02 / Bạn muốn bắt đầu từ đâu?', title: 'Ba lối vào. Một niềm yêu chế tác.', guide: 'Muốn chọn một món có sẵn, ghé xem xưởng hay in từ file riêng? Mình chỉ đường cho bạn đây.', detail: '' },
      { id: 'san-pham', label: 'Bộ sưu tập', eyebrow: '03 / Bộ sưu tập tại xưởng', title: 'Một góc nhỏ, thêm chút cá tính.', guide: 'Đây là ba mẫu mình muốn giới thiệu với bạn. Thích mẫu nào, bạn có thể thêm ngay vào giỏ nhé.', detail: '' },
      { id: 'in-rieng', label: 'In theo yêu cầu', eyebrow: '04 / Từ file đến sản phẩm', title: 'Bạn có ý tưởng. Xưởng có đôi tay.', guide: 'Có sẵn file 3D rồi à? Mình sẽ cùng bạn chọn vật liệu, kiểm tra khả năng in và thống nhất báo giá trước khi chạy máy.', detail: '.STL · .OBJ · .STEP · .3MF' },
      { id: 'chuyen-xuong', label: 'Chuyện xưởng', eyebrow: '05 / Chậm một chút, kỹ hơn một chút', title: 'Không chỉ in lại một món đồ.', guide: 'Một món đồ đẹp còn cần đôi tay hoàn thiện. Mình kiểm tra từng chi tiết, từ lớp in đến khớp nối, trước khi gửi đến bạn.', detail: 'MinhLab phục dựng những món đồ sưu tầm đã ngừng sản xuất, để ký ức có thể trở lại trên bàn trưng bày của bạn.' },
      { id: 'hoi-khi-ky-su', label: 'Giải đáp', eyebrow: '06 / Mình nghe bạn hỏi', title: 'Có điều gì bạn muốn biết?', guide: 'Mình để vài câu hỏi thường gặp ở đây. Bạn chạm vào từng câu để xem câu trả lời nhé.', detail: '' },
      { id: 'hen-gap-ban', label: 'Hẹn gặp tại xưởng', eyebrow: '07 / Bắt đầu cùng MinhLab', title: 'Món đồ tiếp theo, là của bạn.', guide: 'Cảm ơn bạn đã đi cùng mình! Ghé bộ sưu tập, gửi file riêng hoặc trò chuyện với xưởng khi bạn cần tư vấn thêm nhé.', detail: '' },
    ],
    destinations: [
      { number: '01', title: 'Chọn sản phẩm 3D', description: 'Art Toy, mô hình và phụ kiện cho góc riêng của bạn.', href: '/bo-suu-tap', label: 'Ghé bộ sưu tập' },
      { number: '02', title: 'Dạo một vòng phòng lab', description: 'Khám phá máy in và từng công đoạn tại xưởng.', href: '/phong-lab', label: 'Tham quan xưởng 3D' },
      { number: '03', title: 'In từ file của bạn', description: 'Gửi thiết kế, chọn vật liệu và nhận tư vấn báo giá.', href: '/in-theo-file', label: 'Đến bàn kỹ thuật' },
    ],
    destinationAdvice: [
      'Thích một món đồ cho góc bàn? Cùng mình ghé tủ Art Toy và phụ kiện nhé.',
      'Đi cùng mình vào phòng lab, xem một mô hình được chế tác qua từng công đoạn.',
      'Có sẵn file 3D? Đưa mình xem nào. Xưởng sẽ kiểm tra và tư vấn trước khi in.',
    ],
    productAdvice: 'Bạn đang xem',
    selectedAdvice: 'Mình đã thêm mẫu bạn chọn vào giỏ rồi nhé.',
    helloAdvice: 'Chào bạn! Mình sẵn sàng rồi. Cuộn một nhịp để cùng vào xưởng nhé.',
    fileLabel: 'Từ bản vẽ của bạn',
    studioNote: 'In 3D FDM · Hoàn thiện thủ công',
  },

  // Dải thông tin tin cậy (Section 2)
  trustItems: [
    {
      title: 'Kiểm tra file trước khi in',
      desc: 'Soi lỗi hở mesh, góc đặt support tối ưu bề mặt',
    },
    {
      title: 'Tư vấn vật liệu phù hợp',
      desc: 'PLA+ nguyên sinh, PETG kháng lực, ABS kỹ thuật',
    },
    {
      title: 'Báo giá rõ ràng',
      desc: 'Minh bạch theo gram nhựa & thời gian chạy máy',
    },
    {
      title: 'Đóng gói chống va đập',
      desc: 'Hộp carton cứng cáp bọc xốp khí đa tầng',
    },
  ],

  // Mặt tiền Hero Editorial
  hero: {
    eyebrow: 'ĐỒ CHƠI SƯU TẦM · IN 3D THEO YÊU CẦU',
    headlineTitle: 'Những món đồ từng biến mất, được trở lại trên bàn trưng bày.',
    description:
      'MinhLab phục dựng những mẫu đồ chơi đã ngừng sản xuất và nhận in 3D trực tiếp từ file của bạn, với quy trình kiểm tra rõ ràng trước khi chế tác.',
    ctaPrimary: 'Khám phá bộ sưu tập',
    ctaSecondary: 'Gửi file cần in',
    specs: [
      { label: 'ĐỘ PHÂN GIẢI', value: '0.12 mm', sub: 'Lớp đùn mịn, sắc cạnh' },
      { label: 'VẬT LIỆU', value: '100% PLA+', sub: 'Nhựa sinh học an toàn' },
      { label: 'DUNG SAI', value: '±0.05 mm', sub: 'Đo kiểm thước kẹp điện tử' },
      { label: 'HOÀN THIỆN', value: 'Thủ công', sub: 'Tách support & gọt bavia' },
    ],
  },

  // Danh mục sản phẩm (Tabs phong cách Uniqlo)
  categories: [
    { slug: 'all', name: 'Tất cả sản phẩm', code: 'ALL' },
    { slug: 'art-toys', name: 'Art Toys & Mô hình', code: 'TOY' },
    { slug: 'diorama', name: 'Diorama & Đèn Decor', code: 'DIO' },
    { slug: 'desk-setup', name: 'Phụ kiện Desk Setup', code: 'DSK' },
    { slug: 'keycaps', name: 'Keycaps Phím Cơ', code: 'KEY' },
  ],

  // Bộ sưu tập sản phẩm thương mại
  products: [
    {
      id: 'prod-mascot-monkey',
      code: '№ 01 / TOY',
      title: 'Mascot Khỉ Kỹ Sư MinhLab (Signature Art Toy)',
      category: 'Art Toys & Mô hình',
      categorySlug: 'art-toys',
      description:
        'Linh vật Khỉ Kỹ Sư tạo hình voxel đặc trưng, áo lab trắng và hai bàn tay tự do. Mỗi khối pixel được đùn chuẩn xác với bề mặt nhám mịn tinh tế.',
      longDescription:
        'Sản phẩm biểu tượng của xưởng MinhLab. Mô hình được chia tầng in FDM tỉ mỉ với độ phân giải lớp 0.12mm, sau đó được gọt dũa bavia và lắp ráp thủ công. Phù hợp đặt trên bàn làm việc, kệ sách hoặc góc setup công nghệ.',
      price: 450000,
      originalPrice: 520000,
      image: '/images/minhlab-mascot-free-v2.png',
      material: 'Nhựa sinh học PLA+ cao cấp',
      dimensions: '14 × 10 × 18 cm',
      weight: '220 gram',
      printTime: '16 giờ in liên tục',
      layerHeight: '0.12 mm',
      featured: true,
      badge: 'TIÊU BIỂU',
      inStock: true,
      colors: [
        { name: 'Màu chuẩn MinhLab (Tím than / Vàng đồng / Trắng áo lab)', hex: '#7C3AED' },
        { name: 'Obsidian Matte (Đen mờ / Điểm nhấn đỏ)', hex: '#18181B' },
        { name: 'Studio Pure White (Trắng gốm mờ)', hex: '#F4F4F5' },
      ],
    },
    {
      id: 'prod-lab-diorama',
      code: '№ 02 / DIO',
      title: 'Diorama Phòng Lab In 3D Mini Voxel (Kèm Đèn LED Ấm)',
      category: 'Diorama & Đèn Decor',
      categorySlug: 'diorama',
      description:
        'Mô hình thu nhỏ tái hiện không gian xưởng in 3D với 2 cụm máy in, trạm máy tính soi file và linh vật kỹ sư, tích hợp dải LED 5V USB.',
      longDescription:
        'Tác phẩm kiến trúc thu nhỏ gồm hơn 40 chi tiết voxel lắp ghép chính xác. Hệ thống dây dẫn và LED 5V được giấu kín dưới sàn, tỏa ánh sáng vàng ấm tạo không gian làm việc tĩnh lặng và ấm cúng vào ban đêm.',
      price: 1290000,
      originalPrice: 1450000,
      image: '/images/minhlab-lab-resin-v2.png',
      material: 'PLA+ đa sắc phối hợp',
      dimensions: '24 × 18 × 16 cm',
      weight: '680 gram',
      printTime: '42 giờ in & lắp ráp',
      layerHeight: '0.16 mm',
      featured: true,
      badge: 'ĐỘC BẢN',
      inStock: true,
      colors: [
        { name: 'Bản phối Studio Đa Sắc', hex: '#2563EB' },
        { name: 'Bản Đen Monochrome Nhám', hex: '#18181B' },
      ],
    },
    {
      id: 'prod-headphone-stand',
      code: '№ 03 / DSK',
      title: 'Giá Treo Tai Nghe Cấu Trúc Kháng Lực Hexa-Mesh',
      category: 'Phụ kiện Desk Setup',
      categorySlug: 'desk-setup',
      description:
        'Thiết kế dạng lưới tổ ong tối ưu trọng lượng và độ cứng. Vòm cong nâng đỡ công thái học, bảo vệ đệm tai nghe không bị lún xẹp.',
      longDescription:
        'Sản phẩm được in nguyên khối bằng nhựa PETG kỹ thuật chống va đập. Chân đế đúc đặc kèm 4 đệm cao su chống trượt giúp giữ thăng bằng vững chãi cho cả những chiếc tai nghe audiophile nặng trên 500g.',
      price: 320000,
      originalPrice: 380000,
      image: '/images/minhlab-mascot-free-v2.png',
      material: 'PETG Matte kháng lực',
      dimensions: '13 × 13 × 27 cm',
      weight: '310 gram',
      printTime: '12 giờ in',
      layerHeight: '0.16 mm',
      featured: false,
      badge: 'MỚI',
      inStock: true,
      colors: [
        { name: 'Matte Charcoal (Xám than chì)', hex: '#27272A' },
        { name: 'Deep Black (Đen mờ)', hex: '#09090B' },
        { name: 'MinhLab Crimson (Đỏ mờ)', hex: '#E60012' },
      ],
    },
    {
      id: 'prod-keycap-artisan',
      code: '№ 04 / KEY',
      title: 'Keycap Artisan Voxel Khỉ Kỹ Sư (Profile OEM / Cherry)',
      category: 'Keycaps Phím Cơ',
      categorySlug: 'keycaps',
      description:
        'Nút phím in 3D FDM siêu nét 0.08mm. Tương thích chuẩn chân switch chữ thập (+) phổ biến trên mọi bàn phím cơ.',
      longDescription:
        'Từng khối pixel trên khuôn mặt chú khỉ kỹ sư được đùn chính xác ở độ phân giải 0.08mm. Nút phím sau khi in được xử lý nhiệt nhẹ để chân cắm bám khít switch mà không làm lỏng stem.',
      price: 190000,
      originalPrice: 220000,
      image: '/images/minhlab-lab-resin-v2.png',
      material: 'PLA Tough chịu mài mòn',
      dimensions: '1.8 × 1.8 × 1.6 cm',
      weight: '12 gram',
      printTime: '3.5 giờ in',
      layerHeight: '0.08 mm',
      featured: false,
      badge: 'BÁN CHẠY',
      inStock: true,
      colors: [
        { name: 'Tím than & Vàng đồng', hex: '#7C3AED' },
        { name: 'Xám xi măng tối giản', hex: '#52525B' },
      ],
    },
    {
      id: 'prod-desk-organizer',
      code: '№ 05 / DSK',
      title: 'Khay Đựng Bút & Dụng Cụ Voxel Modular Cube',
      category: 'Phụ kiện Desk Setup',
      categorySlug: 'desk-setup',
      description:
        'Khay sắp xếp bàn làm việc chia ngăn thông minh cho bút, dao trổ mô hình, USB và thẻ nhớ, có thể ghép nối mô-đun.',
      longDescription:
        'Lấy cảm hứng từ các khối kiến trúc modular tối giản. Sản phẩm có góc vát đáy dễ lấy dụng cụ nhỏ, chất liệu nhựa nhám mờ hạn chế bám bụi và dấu vân tay.',
      price: 260000,
      originalPrice: 300000,
      image: '/images/minhlab-mascot-free-v2.png',
      material: 'PLA+ Matte chống bám vân tay',
      dimensions: '16 × 10 × 9 cm',
      weight: '260 gram',
      printTime: '10 giờ in',
      layerHeight: '0.20 mm',
      featured: false,
      inStock: true,
      colors: [
        { name: 'Đen than mờ (Matte Black)', hex: '#18181B' },
        { name: 'Xám Studio (Concrete Gray)', hex: '#71717A' },
      ],
    },
    {
      id: 'prod-phone-dock',
      code: '№ 06 / DSK',
      title: 'Đế Đỡ Điện Thoại Góc Nghiêng Công Thái Học 65°',
      category: 'Phụ kiện Desk Setup',
      categorySlug: 'desk-setup',
      description:
        'Góc nghiêng 65° tối ưu cho nhận diện FaceID và cuộc gọi video, tích hợp rãnh luồn dây cáp Type-C / Lightning gọn gàng.',
      longDescription:
        'Thiết kế nguyên khối vững chắc, phần gá đặt có gờ nâng tránh che mất phụ đề khi xem video. Chân đế dán sẵn đệm silicone bám chắc trên mặt bàn gỗ hoặc kính.',
      price: 240000,
      originalPrice: 280000,
      image: '/images/minhlab-lab-resin-v2.png',
      material: 'PLA+ đúc dày chịu lực',
      dimensions: '10 × 10 × 12 cm',
      weight: '190 gram',
      printTime: '8 giờ in',
      layerHeight: '0.16 mm',
      featured: false,
      badge: 'MỚI',
      inStock: true,
      colors: [
        { name: 'Đen nhám (Matte Black)', hex: '#09090B' },
        { name: 'Trắng Studio (Warm White)', hex: '#F4F4F5' },
      ],
    },
  ] as ProductItem[],

  // Thông tin tour phòng lab
  labJourney: {
    tag: 'XƯỞNG CHẾ TÁC THỰC TẾ',
    title: 'Bên trong phòng lab in 3D MinhLab',
    description:
      'Từ tệp polygon trên màn hình máy tính đến lớp nhựa nóng chảy được kiểm soát ở 210°C, mời bạn khám phá các công đoạn chế tác nên từng sản phẩm.',
  },

  // Dịch vụ in theo file của khách hàng
  services: [
    {
      id: 'fdm-print',
      title: 'In 3D FDM Theo File Của Bạn',
      description:
        'Gia công mẫu thử nghiệm, vỏ hộp thiết bị, linh kiện thay thế hoặc mô hình từ file 3D (.STL, .OBJ, .STEP) với độ chính xác cao.',
      iconName: 'Printer',
      specs: [
        'Vật liệu: PLA+, PETG, ABS kỹ thuật',
        'Tùy chọn độ mịn lớp: 0.12mm – 0.28mm',
        'Báo giá minh bạch theo gram nhựa thực tế',
      ],
    },
    {
      id: 'file-check',
      title: 'Kiểm Tra Mesh & Tối Ưu Hướng In',
      description:
        'Kỹ sư xưởng soi kỹ bề mặt polygon, xử lý các điểm hở lưới và đặt góc in tối ưu để giảm thiểu support, đảm bảo bề mặt láng mịn.',
      iconName: 'FileCheck',
      specs: [
        'Soi lỗi hở mesh & thành mỏng miễn phí',
        'Tối ưu góc đặt support không để lại sẹo',
        'Tư vấn vật liệu phù hợp với nhu cầu sử dụng',
      ],
    },
    {
      id: 'post-process',
      title: 'Hoàn Thiện Thủ Công & Đóng Gói',
      description:
        'Tách support tỉ mỉ, dũa mịn bavia tiếp giáp và kiểm tra kích thước bằng thước kẹp điện tử trước khi bọc 3 lớp chống sốc giao tận nơi.',
      iconName: 'Sparkles',
      specs: [
        'Gọt bavia thủ công từng chi tiết',
        'Kiểm tra dung sai và độ khớp nối',
        'Bọc xốp khí đa tầng, bảo hiểm gãy vỡ',
      ],
    },
  ] as ServiceItem[],

  // 4 bước quy trình mua hàng & đặt in
  process: [
    {
      step: '01',
      title: 'Chọn Mẫu Hoặc Gửi Tệp 3D',
      description: 'Lựa chọn mô hình có sẵn trong bộ sưu tập hoặc gửi tệp thiết kế riêng qua Zalo để nhận tư vấn.',
      detail: 'Kỹ sư MinhLab phản hồi nhanh trong 15 phút, giải đáp chi tiết về kích thước và màu sắc.',
    },
    {
      step: '02',
      title: 'Xác Nhận Thông Số & Báo Giá',
      description: 'Thống nhất vật liệu nhựa, độ mịn lớp in, thời gian hoàn thành và địa chỉ giao nhận.',
      detail: 'MinhLab cung cấp hình ảnh mẫu in thực tế tương tự để bạn dễ dàng hình dung bề mặt sản phẩm.',
    },
    {
      step: '03',
      title: 'Tiến Hành Chế Tác FDM',
      description: 'Mô hình được đùn từng lớp nhựa nóng chảy trên bàn in PEI phẳng với hệ thống giám sát nhiệt độ vi sai.',
      detail: 'Đảm bảo từng đường đùn nhựa bám dính chắc chắn, không bị cong vênh hay bọt khí.',
    },
    {
      step: '04',
      title: 'Kiểm Định & Giao Tận Tay',
      description: 'Xử lý bề mặt thủ công, đo đạc dung sai và đóng gói bọc khí cẩn thận trước khi giao hàng toàn quốc.',
      detail: 'Quý khách được mở hộp kiểm tra sản phẩm trước khi thanh toán (Ship COD an tâm 100%).',
    },
  ] as ProcessStep[],

  // 5 bước quy trình in theo file (Section 5)
  onDemandSteps: [
    {
      step: '01',
      title: 'Gửi file và mô tả nhu cầu',
      desc: 'Tải tệp .STL, .OBJ, .STEP hoặc .3MF kèm yêu cầu về kích thước, màu sắc và mục đích sử dụng.',
    },
    {
      step: '02',
      title: 'Kiểm tra khả năng in',
      desc: 'Kỹ sư soi lỗi hở mesh, độ dày thành tối thiểu và tối ưu hướng đặt chi tiết để hạn chế support.',
    },
    {
      step: '03',
      title: 'Xác nhận vật liệu & báo giá',
      desc: 'Tư vấn loại sợi nhựa (PLA+, PETG, ABS), độ dày lớp (0.12 – 0.28mm) và báo giá theo khối lượng thực tế.',
    },
    {
      step: '04',
      title: 'Tiến hành in và hoàn thiện',
      desc: 'Đùn nhựa kiểm soát nhiệt độ vi sai, gọt sạch bavia và xử lý mịn các bề mặt tiếp giáp.',
    },
    {
      step: '05',
      title: 'Kiểm tra, đóng gói & giao hàng',
      desc: 'Đo kiểm dung sai bằng thước kẹp điện tử, đóng hộp chống va đập và gửi tận tay qua bưu cục.',
    },
  ],

  // 6 câu hỏi thường gặp (Section 9)
  faqs: [
    {
      question: 'MinhLab nhận những định dạng file nào?',
      answer:
        'MinhLab hỗ trợ các định dạng 3D tiêu chuẩn gồm .STL, .OBJ, .STEP (STP) và .3MF với dung lượng tệp tối đa 100MB. Nếu bạn có file dạng nén (.ZIP, .RAR) chứa nhiều chi tiết rời, bạn cũng có thể đính kèm khi gửi yêu cầu.',
    },
    {
      question: 'File lỗi hoặc không thể in thì xử lý thế nào?',
      answer:
        'Khi nhận file, kỹ sư MinhLab luôn kiểm tra mesh miễn phí. Nếu phát hiện lỗi hở mặt polygon, đảo mặt pháp tuyến (inverted normals) hoặc thành quá mỏng dưới 0.8mm, chúng tôi sẽ thông báo chi tiết và hướng dẫn bạn cách tối ưu lại file trước khi tiến hành in.',
    },
    {
      question: 'Giá in được tính như thế nào?',
      answer:
        'Giá in tại MinhLab được tính toán minh bạch dựa trên 3 yếu tố: khối lượng nhựa thực tế (bao gồm cả support cần thiết), thời gian máy chạy và vật liệu lựa chọn (PLA+, PETG hoặc ABS kỹ thuật). Không phụ thu các chi phí ẩn.',
    },
    {
      question: 'Có hỗ trợ chỉnh sửa hoặc thiết kế file không?',
      answer:
        'MinhLab chỉ hỗ trợ kiểm tra tính khả thi khi in, sửa nhẹ các lỗi mesh đơn giản và đặt góc xoay tối ưu support. Chúng tôi KHÔNG cung cấp dịch vụ vẽ hoặc dựng hình 3D từ đầu.',
    },
    {
      question: 'Thời gian in và hoàn thiện mất bao lâu?',
      answer:
        'Với các mẫu nhỏ hoặc linh kiện đơn chiếc, thời gian in và xử lý bề mặt thường mất từ 24 – 48 giờ. Đối với các đơn hàng số lượng nhiều hoặc mô hình kích thước lớn ghép nhiều mảnh, thời gian hoàn thiện từ 3 – 5 ngày làm việc.',
    },
    {
      question: 'Sản phẩm phục dựng có sẵn hay phải đặt trước?',
      answer:
        'Một số mẫu Art Toy và phụ kiện tiêu biểu có sẵn tại xưởng và có thể đóng gói giao ngay trong ngày. Những mẫu tuỳ biến màu sắc riêng hoặc số lượng đặt đặc biệt sẽ được in mới theo yêu cầu.',
    },
  ] as FAQItem[],

  // Thông tin liên hệ studio
  contact: {
    phone: '0988 888 888',
    zaloPhone: '0988 888 888',
    email: 'contact@minhlab3d.vn',
    address: 'TP. Hồ Chí Minh, Việt Nam (Xưởng Chế Tác MinhLab 3D)',
    workingHours: '08:00 – 21:00 (Thứ Hai – Chủ Nhật)',
    socials: {
      facebook: 'https://facebook.com',
      zalo: 'https://zalo.me',
      github: 'https://github.com',
    },
  } as ContactInfo,
};

export default SITE_CONFIG;
