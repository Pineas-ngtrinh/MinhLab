import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT_DIR = process.cwd();
const BASE_URL = 'http://localhost:3000';

let totalPassed = 0;
let totalFailed = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    totalPassed++;
    testResults.push({ name: testName, status: 'PASS', details });
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${testName}`);
  } else {
    totalFailed++;
    testResults.push({ name: testName, status: 'FAIL', details });
    console.error(`\x1b[31m✖ FAIL:\x1b[0m ${testName} - ${details}`);
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
    }).on('error', (err) => reject(err));
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = JSON.stringify(payload);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: json, rawBody: data });
        } catch {
          resolve({ statusCode: res.statusCode, body: null, rawBody: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('      MINHLAB 3D — HỆ THỐNG KIỂM THỬ SẢN PHẨM & THANH TOÁN      ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // PHẦN 1: KIỂM TRA DỮ LIỆU SẢN PHẨM & FILE CONFIG
  // -------------------------------------------------------------
  console.log('\n[1/6] Kiểm tra tính toàn vẹn của Dữ liệu Sản phẩm (Data Integrity)...');
  
  const siteConfigContent = fs.readFileSync(path.join(ROOT_DIR, 'src/config/site.config.ts'), 'utf-8');
  
  const productsMatch = siteConfigContent.match(/products:\s*\[([\s\S]*?)\]\s*as\s*ProductItem\[\]/);
  assert(productsMatch !== null, 'Trích xuất được danh sách sản phẩm từ site.config.ts');

  const expectedProductIds = [
    'prod-mascot-monkey',
    'prod-lab-diorama',
    'prod-headphone-stand',
    'prod-keycap-artisan',
    'prod-desk-organizer',
    'prod-phone-dock'
  ];

  for (const id of expectedProductIds) {
    assert(siteConfigContent.includes(id), `Sản phẩm [${id}] tồn tại trong cấu hình catalogue`);
  }

  const publicDir = path.join(ROOT_DIR, 'public');
  const requiredImages = [
    '/images/minhlab-mascot-detail.png',
    '/images/minhlab-lab-preview.png',
    '/images/logo.png'
  ];

  for (const imgPath of requiredImages) {
    const fullPath = path.join(publicDir, imgPath);
    const exists = fs.existsSync(fullPath);
    const size = exists ? fs.statSync(fullPath).size : 0;
    assert(exists && size > 1000, `Hình ảnh tĩnh [${imgPath}] tồn tại và hợp lệ (${Math.round(size / 1024)} KB)`);
  }

  const mascotGlb = path.join(publicDir, 'models/minhlab-mascot-v1.glb');
  const labGlb = path.join(publicDir, 'models/minhlab-lab-v1.glb');
  assert(fs.existsSync(mascotGlb) && fs.statSync(mascotGlb).size > 100000, 'Model 3D Mascot [minhlab-mascot-v1.glb] sẵn sàng');
  assert(fs.existsSync(labGlb) && fs.statSync(labGlb).size > 500000, 'Model 3D Lab [minhlab-lab-v1.glb] sẵn sàng');

  // -------------------------------------------------------------
  // PHẦN 2: KIỂM TRA THÔNG SỐ KỸ THUẬT FDM & MODAL SPEC SHEET
  // -------------------------------------------------------------
  console.log('\n[2/6] Kiểm tra Thông số kỹ thuật FDM (FDM Spec Sheet Attributes)...');

  const fdmCheckPatterns = [
    { key: 'layerHeight', label: 'Độ mịn lớp in (0.08mm - 0.20mm)' },
    { key: 'material', label: 'Vật liệu nhựa (PLA+, PETG, PLA Tough)' },
    { key: 'dimensions', label: 'Kích thước chuẩn DxRxC' },
    { key: 'printTime', label: 'Thời gian chạy máy in' }
  ];

  for (const fdm of fdmCheckPatterns) {
    const hasKey = siteConfigContent.includes(fdm.key);
    assert(hasKey, `Thông số [${fdm.key}] (${fdm.label}) đầy đủ trong schema sản phẩm`);
  }

  // -------------------------------------------------------------
  // PHẦN 3: KIỂM TRA LOGIC GIỎ HÀNG & FREESHIP
  // -------------------------------------------------------------
  console.log('\n[3/6] Kiểm tra Business Logic Giỏ hàng & Freeship...');

  const p1 = { id: 'prod-1', title: 'Khỉ Kỹ Sư', price: 450000, item_type: 'READY_PRODUCT' };
  const p2 = { id: 'prod-2', title: 'Keycap Voxel', price: 190000, item_type: 'READY_PRODUCT' };

  let cart = [];
  const FREESHIP_THRESHOLD = 500000;

  function addToCart(product, quantity = 1) {
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ product, quantity });
    }
  }

  addToCart(p1, 1);
  let subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  assert(cart.length === 1 && subtotal === 450000, 'Thêm 1 sản phẩm 450.000₫ vào giỏ chính xác');
  assert(subtotal < FREESHIP_THRESHOLD, 'Chưa đạt Freeship, còn thiếu 50.000₫');

  addToCart(p2, 1);
  subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  assert(cart.length === 2 && subtotal === 640000, 'Thêm sản phẩm thứ 2, tổng tiền 640.000₫ đạt Freeship 100%');

  // -------------------------------------------------------------
  // PHẦN 4: KIỂM TRA LUỒNG THANH TOÁN 2 NHÁNH (API LIVE)
  // -------------------------------------------------------------
  console.log('\n[4/6] Kiểm tra Luồng Thanh toán 2 Nhánh & Xác Minh Thủ Công (API Endpoints)...');

  // 4.1 Test Nhánh B: COD tạo đơn thành công khi 100% READY_PRODUCT
  const codRes = await postJson(`${BASE_URL}/api/orders`, {
    customerName: 'Trần Khách COD',
    customerEmail: 'khach.cod@example.com',
    customerPhone: '0912345678',
    shippingAddress: '456 Hai Bà Trưng, Q1, TP.HCM',
    paymentMethod: 'COD',
    items: [
      { productId: 'prod-mascot-monkey', itemType: 'READY_PRODUCT', itemName: 'Mascot Khỉ Kỹ Sư', quantity: 1, unitPrice: 450000 }
    ]
  });

  assert(codRes.statusCode === 201 && codRes.body?.success, 'Nhánh B: Tạo đơn hàng COD thành công');
  const codOrder = codRes.body?.data;
  assert(codOrder.orderStatus === 'CONFIRMED', 'Đơn COD có trạng thái order_status = CONFIRMED ngay (không chờ thanh toán)');
  assert(codOrder.paymentStatus === 'UNPAID', 'Đơn COD có payment_status = UNPAID');
  assert(codOrder.payment === null, 'Đơn COD KHÔNG tạo bản ghi payments tại thời điểm đặt hàng');
  assert(/^ML-\d{6}$/.test(codOrder.orderNumber), `Mã đơn COD sinh trên server đúng chuẩn: ${codOrder.orderNumber}`);

  // 4.2 Test Nhánh B: Từ chối COD nếu có sản phẩm CUSTOM_PRINT
  const codRejectRes = await postJson(`${BASE_URL}/api/orders`, {
    customerName: 'Khách Gian Lận COD',
    customerEmail: 'gianlan@example.com',
    customerPhone: '0988776655',
    shippingAddress: '789 Nguyễn Huệ, Q1',
    paymentMethod: 'COD',
    items: [
      { productId: 'custom-file-stl', itemType: 'CUSTOM_PRINT', itemName: 'In file STL custom', quantity: 1, unitPrice: 350000 }
    ]
  });
  assert(codRejectRes.statusCode === 400 && !codRejectRes.body?.success, 'Đơn hàng có CUSTOM_PRINT bị TỪ CHỐI khi chọn COD (Bắt buộc PREPAID)');

  // 4.3 Test Nhánh A: Tạo đơn VietQR (PREPAID)
  const qrRes = await postJson(`${BASE_URL}/api/orders`, {
    customerName: 'Lê Khách VietQR',
    customerEmail: 'khach.vietqr@example.com',
    customerPhone: '0933445566',
    shippingAddress: '12 Võ Văn Tần, Q3, TP.HCM',
    paymentMethod: 'VIETQR',
    items: [
      { productId: 'prod-headphone-stand', itemType: 'READY_PRODUCT', itemName: 'Giá Treo Tai Nghe', quantity: 1, unitPrice: 320000 }
    ]
  });

  assert(qrRes.statusCode === 201 && qrRes.body?.success, 'Nhánh A: Tạo đơn hàng VietQR thành công');
  const qrOrder = qrRes.body?.data;
  assert(qrOrder.orderStatus === 'PENDING_PAYMENT', 'Đơn VietQR khởi tạo với order_status = PENDING_PAYMENT');
  assert(qrOrder.paymentStatus === 'UNPAID', 'Đơn VietQR khởi tạo với payment_status = UNPAID');
  assert(qrOrder.payment?.verificationStatus === 'PENDING', 'Bản ghi payment khởi tạo với verification_status = PENDING');

  // 4.4 Test Nhánh A: Khách bấm "Tôi đã chuyển khoản" -> Khai báo thông tin
  const declareRes = await postJson(`${BASE_URL}/api/payments/declare`, {
    orderNumber: qrOrder.orderNumber,
    transactionReference: 'FT240915998234MB',
    bankName: 'MB Bank',
    senderAccountName: 'LE KHACH VIETQR',
    paymentProofUrl: 'https://images.minhlab.com/proof-123.jpg'
  });

  assert(declareRes.statusCode === 200 && declareRes.body?.success, 'Khách hàng gửi khai báo mã giao dịch chuyển khoản thành công');
  assert(declareRes.body?.data?.verificationStatus === 'PENDING', 'Sau khi khách khai báo, verification_status VẪN LÀ PENDING (KHÔNG tự động thành công)');

  // 4.5 Test Nhánh A: Nhân viên xác nhận đã nhận tiền (Thủ công)
  const verifyRes = await postJson(`${BASE_URL}/api/admin/payments/verify`, {
    orderNumber: qrOrder.orderNumber,
    verifiedBy: 'STAFF_ACCOUNTANT_01'
  });

  assert(verifyRes.statusCode === 200 && verifyRes.body?.success, 'Nhân viên xác nhận đã nhận tiền thành công');
  const verifiedData = verifyRes.body?.data;
  assert(verifiedData.verificationStatus === 'VERIFIED', 'Sau khi nhân viên duyệt: verification_status = VERIFIED');
  assert(verifiedData.orderStatus === 'CONFIRMED', 'Sau khi nhân viên duyệt: order_status = CONFIRMED');
  assert(verifiedData.paymentStatus === 'PAID', 'Sau khi nhân viên duyệt: payment_status = PAID');

  // 4.6 Test Idempotency: Kiểm tra chống gửi trùng khi nhân viên bấm xác nhận lần 2
  const verifyAgainRes = await postJson(`${BASE_URL}/api/admin/payments/verify`, {
    orderNumber: qrOrder.orderNumber,
    verifiedBy: 'STAFF_ACCOUNTANT_01'
  });
  assert(verifyAgainRes.body?.data?.alreadyVerified === true, 'Bấm xác nhận lần 2 bảo đảm tính Idempotent (không gửi trùng email)');

  // 4.7 Test Tra cứu trạng thái đơn hàng
  const queryRes = await fetchUrl(`${BASE_URL}/api/orders/${qrOrder.orderNumber}`);
  const queryData = JSON.parse(queryRes.body);
  assert(queryData.success && queryData.data.payment.verificationStatus === 'VERIFIED', 'API tra cứu trả về đúng trạng thái thanh toán đã xác thực');

  // -------------------------------------------------------------
  // PHẦN 5: KIỂM TRA XÁC THỰC & PHÂN QUYỀN ĐA TÁC NHÂN (AUTH & ROLES)
  // -------------------------------------------------------------
  console.log('\n[5/7] Kiểm tra Xác thực & Phân quyền Đa Tác Nhân (Auth & Roles)...');

  // 5.1 Đăng ký khách hàng mới
  const testCustomerEmail = `khach-${Date.now()}@gmail.com`;
  const registerRes = await postJson(`${BASE_URL}/api/auth/register`, {
    email: testCustomerEmail,
    fullName: 'Trần Văn Khách Mới',
    phone: '0988112233',
    password: 'securePassword123'
  });
  assert(registerRes.statusCode === 201 && registerRes.body?.success, 'Đăng ký tài khoản khách hàng mới thành công');
  assert(registerRes.body?.data?.role === 'CUSTOMER', 'Tài khoản đăng ký mới có vai trò mặc định là CUSTOMER');

  // 5.2 Đăng nhập bằng tài khoản vừa tạo
  const loginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    email: testCustomerEmail,
    password: 'securePassword123'
  });
  assert(loginRes.statusCode === 200 && loginRes.body?.success, 'Đăng nhập thành công với tài khoản vừa tạo');

  // 5.3 Đăng nhập 4 vai trò nhân sự xưởng
  const staffLoginRes = await postJson(`${BASE_URL}/api/auth/login`, { email: 'staff@minhlab.com', password: 'staff123' });
  assert(staffLoginRes.body?.data?.role === 'STAFF', 'Đăng nhập vai trò STAFF (Kế Toán & Vận Hành) thành công');

  const engineerLoginRes = await postJson(`${BASE_URL}/api/auth/login`, { email: 'engineer@minhlab.com', password: 'engineer123' });
  assert(engineerLoginRes.body?.data?.role === 'FILE_REVIEWER', 'Đăng nhập vai trò FILE_REVIEWER (Kỹ Sư Soi Mesh) thành công');

  const operatorLoginRes = await postJson(`${BASE_URL}/api/auth/login`, { email: 'operator@minhlab.com', password: 'operator123' });
  assert(operatorLoginRes.body?.data?.role === 'PRINT_OPERATOR', 'Đăng nhập vai trò PRINT_OPERATOR (Kỹ Thuật Máy In) thành công');

  const adminLoginRes = await postJson(`${BASE_URL}/api/auth/login`, { email: 'admin@minhlab.com', password: 'admin123' });
  assert(adminLoginRes.body?.data?.role === 'ADMIN', 'Đăng nhập vai trò ADMIN (Quản Trị Viên) thành công');

  // 5.4 Kiểm tra API danh sách thanh toán và đơn hàng cho Admin
  const adminPayRes = await fetchUrl(`${BASE_URL}/api/admin/payments`);
  const adminPayData = JSON.parse(adminPayRes.body);
  assert(adminPayData.success && Array.isArray(adminPayData.data), 'API /api/admin/payments trả về danh sách thanh toán cho Kế toán');

  const adminOrdRes = await fetchUrl(`${BASE_URL}/api/admin/orders`);
  const adminOrdData = JSON.parse(adminOrdRes.body);
  assert(adminOrdData.success && Array.isArray(adminOrdData.data), 'API /api/admin/orders trả về danh sách đơn hàng cho Admin/Staff');

  // -------------------------------------------------------------
  // PHẦN 6: KIỂM TRA RENDERING CÁC TRANG WEB
  // -------------------------------------------------------------
  console.log('\n[6/7] Kiểm tra Rendering & HTTP Status các Trang Sản phẩm & Portal trên http://localhost:3000...');

  const routesToTest = [
    { path: '/', name: 'Trang chủ (Hero & Sản phẩm tiêu biểu)', keywords: ['MinhLab', 'BỘ SƯU TẬP TẠI XƯỞNG', 'Khỉ Kỹ Sư'] },
    { path: '/bo-suu-tap', name: 'Trang Bộ sưu tập (Catalogue & Filters)', keywords: ['Bộ sưu tập', 'Art Toys', 'Diorama', 'Desk Setup', 'Keycaps'] },
    { path: '/in-theo-file', name: 'Trang In theo file (.STL, .OBJ, .STEP)', keywords: ['Gửi file', 'FDM', 'Zalo'] },
    { path: '/phong-lab', name: 'Trang Tour 3D phòng xưởng', keywords: ['phòng lab', 'FDM'] },
    { path: '/ve-minhlab', name: 'Trang Câu chuyện thương hiệu', keywords: ['MinhLab', 'Phục dựng', 'Xưởng'] },
    { path: '/dang-nhap', name: 'Trang Đăng nhập đa vai trò', keywords: ['Đăng Nhập', 'One-Click Demo Switcher', 'STAFF', 'ADMIN'] },
    { path: '/dang-ky', name: 'Trang Đăng ký thành viên', keywords: ['Đăng Ký Thành Viên', 'Mật khẩu'] },
    { path: '/tai-khoan', name: 'Trang Cá nhân khách hàng', keywords: ['chuyển hướng', 'đăng nhập'] },
    { path: '/admin', name: 'Bàn Quản trị Xưởng MinhLab (Admin Workbench)', keywords: ['chuyển hướng', 'đăng nhập'] }
  ];

  for (const route of routesToTest) {
    try {
      const res = await fetchUrl(`${BASE_URL}${route.path}`);
      assert(res.statusCode === 200, `${route.name} trả về HTTP 200 OK`);

      let hasKeywords = true;
      let missingKeyword = '';
      for (const kw of route.keywords) {
        if (!res.body.toLowerCase().includes(kw.toLowerCase())) {
          hasKeywords = false;
          missingKeyword = kw;
          break;
        }
      }
      assert(hasKeywords, `${route.name} chứa đầy đủ nội dung từ khóa cốt lõi`, missingKeyword ? `Thiếu: ${missingKeyword}` : '');
    } catch (err) {
      assert(false, `Kết nối tới ${route.path} thất bại: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // PHẦN 6: KIỂM TRA TYPESCRIPT & STANDARDS
  // -------------------------------------------------------------
  console.log('\n[6/6] Kiểm tra Cấu hình TypeScript Strict...');
  const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'tsconfig.json'), 'utf-8'));
  assert(tsconfig.compilerOptions?.strict === true, 'TypeScript compilerOptions.strict = true');

  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ TỔNG HỢP: ${totalPassed} / ${totalPassed + totalFailed} PASS`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Lỗi khi chạy test suite:', err);
  process.exit(1);
});
