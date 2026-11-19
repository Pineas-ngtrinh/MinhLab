/** Nội dung thương hiệu và marketing. Catalogue sản phẩm được đọc từ PostgreSQL. */

export type { ProductItem } from '../contracts/catalog';

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
    subtitle: 'Giúp bạn hoàn thiện bộ sưu tập và tìm lại những món đồ gắn liền với ký ức bằng công nghệ in 3D FDM và resin.',
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
    fileFormats: '.STL',
    faqTitle: 'Trước khi bắt đầu.',
    contactTitle: ['Ý tưởng tiếp theo,', 'là của bạn.'],
    contactDescription: 'Chọn một món đã thành hình. Hoặc bắt đầu một điều chưa có.',
    chapterNames: ['Lời chào', 'Ba lối vào', 'Bộ sưu tập', 'Trong xưởng', 'In theo yêu cầu', 'Giải đáp', 'Kết nối'],
    imageAlt: 'Xưởng MinhLab với Khỉ Kỹ Sư tay không, một máy in FDM, một máy in resin và bảng tên đỏ',
    mascotAlt: 'Khỉ Kỹ Sư MinhLab với hai bàn tay trống trong xưởng',
    pause: 'Tạm dừng chuyển động linh vật',
    resume: 'Tiếp tục chuyển động linh vật',
    labImage: '/images/minhlab-lab-resin.png',
    mascotImage: '/images/minhlab-mascot-free.png',
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
      { id: 'in-rieng', label: 'In theo yêu cầu', eyebrow: '04 / Từ file đến sản phẩm', title: 'Bạn có ý tưởng. Xưởng có đôi tay.', guide: 'Có sẵn file STL rồi à? Mình sẽ đọc kích thước, cùng bạn chọn vật liệu, kiểm tra khả năng in và thống nhất báo giá trước khi chạy máy.', detail: '.STL · KÍCH THƯỚC TỰ ĐỌC' },
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
    studioNote: 'In 3D FDM & resin · Hoàn thiện thủ công',
  },

  // Dải thông tin tin cậy (Section 2)
  trustItems: [
    {
      title: 'Kiểm tra file trước khi in',
      desc: 'Soi lỗi hở mesh, góc đặt support tối ưu bề mặt',
    },
    {
      title: 'Tư vấn vật liệu phù hợp',
      desc: 'FDM: PLA, PETG, PLA Silk · Resin nhiều màu',
    },
    {
      title: 'Báo giá rõ ràng',
      desc: 'FDM có giá tham khảo tự động · Resin báo giá tại xưởng',
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
      { label: 'CÔNG NGHỆ', value: 'FDM & resin', sub: 'Vật liệu và màu theo yêu cầu' },
      { label: 'DUNG SAI', value: '±0.05 mm', sub: 'Đo kiểm thước kẹp điện tử' },
      { label: 'HOÀN THIỆN', value: 'Thủ công', sub: 'Tách support & gọt bavia' },
    ],
  },

  // Danh mục sản phẩm (Tabs phong cách Uniqlo)
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
      title: 'In 3D FDM & Resin Theo File Của Bạn',
      description:
        'Gia công mẫu thử nghiệm, vỏ hộp thiết bị, linh kiện thay thế hoặc mô hình từ tệp .STL; MinhLab đọc kích thước và kiểm tra khả năng in trước khi báo giá.',
      iconName: 'Printer',
      specs: [
        'FDM: PLA, PETG, PLA Silk; resin: trắng, đen, xám, clear',
        'Ước tính tự động FDM; resin được xưởng kiểm tra và báo giá riêng',
        'Chọn màu theo vật liệu; xưởng xác nhận màu thực tế trước khi in',
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
      title: 'Tiến Hành In FDM Hoặc Resin',
      description: 'Xưởng chế tác theo công nghệ FDM hoặc resin, vật liệu và màu đã thống nhất với bạn.',
      detail: 'Kiểm tra chất lượng trong quá trình in và hoàn thiện theo yêu cầu đã xác nhận.',
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
      desc: 'Tải tệp .STL; MinhLab tự đọc kích thước X × Y × Z. Ghi thêm màu sắc và mục đích sử dụng mong muốn.',
    },
    {
      step: '02',
      title: 'Kiểm tra khả năng in',
      desc: 'Kỹ sư soi lỗi hở mesh, độ dày thành tối thiểu và tối ưu hướng đặt chi tiết để hạn chế support.',
    },
    {
      step: '03',
      title: 'Xác nhận vật liệu & báo giá',
      desc: 'Chọn FDM hoặc resin, vật liệu và màu. FDM có khoảng giá tham khảo tự động; resin được xưởng báo giá trực tiếp.',
    },
    {
      step: '04',
      title: 'Tiến hành in và hoàn thiện',
      desc: 'In theo công nghệ đã chọn, xử lý support và hoàn thiện bề mặt theo thỏa thuận.',
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
      question: 'MinhLab có nhận in resin và nhiều màu không?',
      answer: 'Xưởng nhận cả FDM và resin. Mỗi vật liệu có bảng màu riêng tại trang in theo file; resin có trắng, đen, xám và clear. Với yêu cầu phối nhiều màu trên một mẫu, bạn mô tả cách phối và gửi ảnh tham khảo để xưởng tư vấn khả năng thực hiện cùng báo giá.',
    },
    {
      question: 'MinhLab nhận những định dạng file nào?',
      answer:
        'MinhLab hiện nhận tệp .STL tối đa 100MB qua biểu mẫu. Tệp được đọc kích thước ngay trên trình duyệt; STL không lưu đơn vị đo nên hệ thống giả định mm và bạn cần xác nhận kích thước trước khi in.',
    },
    {
      question: 'File lỗi hoặc không thể in thì xử lý thế nào?',
      answer:
        'Khi nhận file, kỹ sư MinhLab luôn kiểm tra mesh miễn phí. Nếu phát hiện lỗi hở mặt polygon, đảo mặt pháp tuyến (inverted normals) hoặc thành quá mỏng dưới 0.8mm, chúng tôi sẽ thông báo chi tiết và hướng dẫn bạn cách tối ưu lại file trước khi tiến hành in.',
    },
    {
      question: 'Giá in được tính như thế nào?',
      answer:
        'Báo giá tự động hiện chỉ dành cho FDM, dựa trên cấu hình ước tính vật liệu và thời gian in. Xưởng vẫn nhận in resin và tư vấn báo giá trực tiếp khi bạn gửi file. MinhLab xác nhận chi phí cuối trước khi in.',
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

  checkout: {
    validation: {
      summaryTitle: 'Vui lòng kiểm tra thông tin nhận hàng',
      fullName: 'Vui lòng nhập họ tên người nhận.',
      email: 'Vui lòng nhập email nhận thông tin đơn hàng.',
      emailFormat: 'Email chưa đúng định dạng. Ví dụ: ten@example.com.',
      phone: 'Vui lòng nhập số điện thoại liên hệ.',
      phoneFormat: 'Số điện thoại chưa hợp lệ. Ví dụ: 0901 234 567.',
      address: 'Vui lòng nhập địa chỉ nhận hàng chi tiết.',
    },
    payment: {
      title: 'Thanh toán VietQR',
      description: 'Quét mã bằng ứng dụng ngân hàng để thanh toán đơn hàng.',
      amountLabel: 'Số tiền thanh toán',
      bankLabel: 'Ngân hàng',
      accountLabel: 'Số tài khoản',
      recipientLabel: 'Người nhận',
      transferLabel: 'Nội dung chuyển khoản',
      transferHint: 'Giữ nguyên nội dung để MinhLab đối chiếu đúng đơn hàng.',
      qrHint: 'Mở ứng dụng ngân hàng và chọn quét mã QR',
      qrError: 'Chưa tải được mã QR. Bạn có thể chuyển khoản theo thông tin bên cạnh.',
      retryQr: 'Tải lại mã QR',
      waitingTitle: 'Chờ xác nhận thanh toán',
      waitingDescription: 'Sau khi chuyển khoản, bấm “Tôi đã chuyển khoản” để báo MinhLab đối soát. Khai báo này chưa xác nhận tiền đã vào.',
      pendingMessage: 'Chưa có xác nhận từ MinhLab. Nếu đã chuyển khoản, bấm “Tôi đã chuyển khoản” để báo nhân viên đối soát.',
      cancelledMessage: 'Đơn hàng đã bị hủy. Vui lòng xem lại đơn hàng hoặc liên hệ MinhLab nếu bạn đã chuyển khoản.',
      reviewMessage: 'Khoản thanh toán cần được kiểm tra lại. Vui lòng liên hệ MinhLab qua trang theo dõi đơn hàng.',
      refundedMessage: 'Khoản thanh toán đã được ghi nhận hoàn tiền. Vui lòng xem lại đơn hàng trước khi tiếp tục.',
      unavailableTitle: 'Cần kiểm tra lại đơn hàng',
      checkError: 'Chưa thể kiểm tra thanh toán. Vui lòng thử lại khi có kết nối.',
      checkAction: 'Cập nhật trạng thái',
      checkingAction: 'Đang cập nhật…',
      trackingAction: 'Theo dõi đơn hàng',
      closeAction: 'Thanh toán sau',
      copiedLabel: 'Đã sao chép',
    },
  },

  // Thông tin liên hệ studio
  contact: {
    phone: '0969 620 230',
    zaloPhone: '0969 620 230',
    email: 'contact@minhlab3d.vn',
    address: 'TP. Hồ Chí Minh, Việt Nam (Xưởng Chế Tác MinhLab 3D)',
    workingHours: '08:00 – 21:00 (Thứ Hai – Chủ Nhật)',
    socials: {
      facebook: 'https://facebook.com',
      zalo: 'https://zalo.me/0969620230',
      github: 'https://github.com',
    },
  } as ContactInfo,
};

export default SITE_CONFIG;
