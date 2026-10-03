/**
 * =====================================================================
 * MINHLAB 3D - EMAIL NOTIFICATION SERVICE
 * =====================================================================
 * Tuân thủ schema MinhLab_database_v2.dbml:
 * - Gửi email cho CỬA HÀNG: Chỉ kích hoạt khi khách bấm "Tôi đã chuyển khoản" (khai báo mã GD).
 * - Gửi email cho KHÁCH HÀNG:
 *   + Nhánh A (PREPAID/VietQR): Chỉ kích hoạt khi nhân viên bấm "Xác nhận đã nhận tiền" (PENDING -> VERIFIED).
 *   + Nhánh B (COD): Kích hoạt ngay khi tạo đơn thành công (order_status='CONFIRMED').
 * - Idempotent: Chống gửi trùng email nếu webhook/thao tác xác nhận bị gọi lại nhiều lần.
 * =====================================================================
 */

import { SITE_CONFIG } from '../config/site.config';

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  bodyText: string;
  type: 'STORE_PAYMENT_DECLARED' | 'CUSTOMER_PAYMENT_VERIFIED' | 'CUSTOMER_COD_CONFIRMED';
  orderNumber: string;
  sentAt: string;
}

// Lưu trữ nhật ký email trong bộ nhớ toàn cục (globalThis)
const globalForEmail = globalThis as unknown as {
  emailLogs?: EmailLog[];
  sentOrderConfirmationKeys?: Set<string>;
};

const emailLogs: EmailLog[] = globalForEmail.emailLogs ?? [];
const sentOrderConfirmationKeys: Set<string> = globalForEmail.sentOrderConfirmationKeys ?? new Set<string>();

globalForEmail.emailLogs = emailLogs;
globalForEmail.sentOrderConfirmationKeys = sentOrderConfirmationKeys;

export const EmailService = {
  /**
   * 1. Gửi email thông báo cho CỬA HÀNG/ADMIN khi khách hàng vừa khai báo chuyển khoản
   * Kích hoạt tại Bước 3 Nhánh A.
   */
  async sendPaymentDeclaredToStore(payload: {
    orderNumber: string;
    amount: number;
    transactionReference: string;
    bankName: string;
    senderAccountName: string;
    paymentProofUrl?: string;
    adminVerifyUrl: string;
  }): Promise<EmailLog> {
    const storeEmail = SITE_CONFIG.contact.email || 'order@minhlab.com';
    const formatVND = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    const subject = `[MinhLab 3D] Khách hàng khai báo chuyển khoản đơn ${payload.orderNumber}`;
    const bodyText = `
Xin chào Bộ phận Kế toán & Vận hành MinhLab 3D,

Khách hàng vừa hoàn tất thao tác chuyển khoản và gửi thông tin xác nhận cho đơn hàng:
- Mã đơn hàng: ${payload.orderNumber}
- Số tiền cần đối soát: ${formatVND(payload.amount)}
- Mã tham chiếu / Mã GD ngân hàng: ${payload.transactionReference}
- Ngân hàng chuyển: ${payload.bankName}
- Tên chủ tài khoản chuyển: ${payload.senderAccountName}
${payload.paymentProofUrl ? `- Ảnh chụp biên lai: ${payload.paymentProofUrl}` : ''}

Vui lòng kiểm tra tài khoản ngân hàng thực tế và bấm vào liên kết sau để xác nhận đơn:
👉 ${payload.adminVerifyUrl}

Lưu ý: Hệ thống KHÔNG tự động duyệt thanh toán. Trạng thái đơn vẫn là 'PENDING' cho đến khi bạn xác nhận.
Trân trọng,
MinhLab 3D Core System
    `.trim();

    const log: EmailLog = {
      id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      to: storeEmail,
      subject,
      bodyText,
      type: 'STORE_PAYMENT_DECLARED',
      orderNumber: payload.orderNumber,
      sentAt: new Date().toISOString(),
    };

    emailLogs.push(log);
    console.log(`\x1b[36m[EMAIL TO STORE]\x1b[0m Gửi tới: ${storeEmail} | Tiêu đề: ${subject}`);
    return log;
  },

  /**
   * 2. Gửi email xác nhận đặt hàng thành công cho KHÁCH HÀNG sau khi nhân viên bấm "Xác nhận đã nhận tiền"
   * (Áp dụng cho Nhánh A: PREPAID / VietQR)
   * Chống gửi trùng nếu bấm nhiều lần.
   */
  async sendCustomerPaymentVerifiedEmail(payload: {
    orderNumber: string;
    customerEmailSnapshot: string;
    customerNameSnapshot: string;
    amountPaid: number;
    paymentPurpose: 'FULL_PAYMENT' | 'DEPOSIT';
    grandTotal: number;
    remainingBalance: number;
    orderItems: { itemName: string; quantity: number; unitPrice: number }[];
    trackingUrl: string;
  }): Promise<EmailLog | null> {
    const idempotencyKey = `VERIFIED-${payload.orderNumber}-${payload.amountPaid}`;
    if (sentOrderConfirmationKeys.has(idempotencyKey)) {
      console.log(`\x1b[33m[EMAIL DUPLICATE BLOCKED]\x1b[0m Đã gửi email xác nhận cho đơn ${payload.orderNumber}, bỏ qua gửi lặp.`);
      return null;
    }

    const formatVND = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    const subject = `Đặt hàng thành công — Mã đơn ${payload.orderNumber}`;
    
    const itemsList = payload.orderItems
      .map((item) => `- ${item.itemName} x${item.quantity}: ${formatVND(item.unitPrice * item.quantity)}`)
      .join('\n');

    const paymentDetailText = payload.paymentPurpose === 'DEPOSIT'
      ? `Số tiền cọc đã xác nhận: ${formatVND(payload.amountPaid)}\nSố tiền còn lại cần thanh toán khi nhận hàng: ${formatVND(payload.remainingBalance)}`
      : `Số tiền đã thanh toán đủ 100%: ${formatVND(payload.amountPaid)}`;

    const bodyText = `
Xin chào ${payload.customerNameSnapshot},

MinhLab 3D xin trân trọng thông báo: Khoản thanh toán cho đơn hàng [${payload.orderNumber}] của bạn đã được kỹ sư xưởng kiểm tra và xác nhận thành công!

THÔNG TIN ĐƠN HÀNG:
- Mã đơn hàng: ${payload.orderNumber}
- Trạng thái: ĐÃ XÁC NHẬN THANH TOÁN (CONFIRMED)
- ${paymentDetailText}
- Tổng giá trị đơn hàng: ${formatVND(payload.grandTotal)}

DANH SÁCH SẢN PHẨM:
${itemsList}

Đơn hàng đang được chuyển vào hàng đợi chế tác FDM và chuẩn bị đóng gói theo tiêu chuẩn xưởng MinhLab.
Bạn có thể theo dõi tiến độ chi tiết tại: ${payload.trackingUrl}

Cảm ơn bạn đã tin tưởng sản phẩm thủ công & dịch vụ in 3D của MinhLab 3D!
Hotline/Zalo hỗ trợ: ${SITE_CONFIG.contact.phone}
    `.trim();

    const log: EmailLog = {
      id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      to: payload.customerEmailSnapshot,
      subject,
      bodyText,
      type: 'CUSTOMER_PAYMENT_VERIFIED',
      orderNumber: payload.orderNumber,
      sentAt: new Date().toISOString(),
    };

    sentOrderConfirmationKeys.add(idempotencyKey);
    emailLogs.push(log);
    console.log(`\x1b[32m[EMAIL TO CUSTOMER (PREPAID)]\x1b[0m Gửi tới: ${payload.customerEmailSnapshot} | Tiêu đề: ${subject}`);
    return log;
  },

  /**
   * 3. Gửi email đặt hàng thành công cho KHÁCH HÀNG với đơn COD (Nhánh B)
   * Kích hoạt ngay khi tạo đơn thành công vì không cần chờ thanh toán trước.
   */
  async sendCustomerCodConfirmedEmail(payload: {
    orderNumber: string;
    customerEmailSnapshot: string;
    customerNameSnapshot: string;
    grandTotal: number;
    orderItems: { itemName: string; quantity: number; unitPrice: number }[];
    shippingAddress: string;
    trackingUrl: string;
  }): Promise<EmailLog | null> {
    const idempotencyKey = `COD-${payload.orderNumber}`;
    if (sentOrderConfirmationKeys.has(idempotencyKey)) {
      return null;
    }

    const formatVND = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    const subject = `Đặt hàng thành công — Mã đơn ${payload.orderNumber}, thanh toán khi nhận hàng ${formatVND(payload.grandTotal)}`;

    const itemsList = payload.orderItems
      .map((item) => `- ${item.itemName} x${item.quantity}: ${formatVND(item.unitPrice * item.quantity)}`)
      .join('\n');

    const bodyText = `
Xin chào ${payload.customerNameSnapshot},

Đơn hàng [${payload.orderNumber}] của bạn đã được ghi nhận thành công tại xưởng MinhLab 3D.

THÔNG TIN ĐƠN HÀNG COD:
- Mã đơn hàng: ${payload.orderNumber}
- Phương thức thanh toán: Thanh toán khi nhận hàng (COD)
- Số tiền cần thanh toán cho shipper: ${formatVND(payload.grandTotal)}
- Địa chỉ nhận hàng: ${payload.shippingAddress}

DANH SÁCH SẢN PHẨM:
${itemsList}

Bạn được phép mở hộp kiểm tra sản phẩm trước khi thanh toán cho nhân viên giao vận.
Theo dõi đơn hàng tại: ${payload.trackingUrl}

Cảm ơn bạn!
MinhLab 3D
    `.trim();

    const log: EmailLog = {
      id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      to: payload.customerEmailSnapshot,
      subject,
      bodyText,
      type: 'CUSTOMER_COD_CONFIRMED',
      orderNumber: payload.orderNumber,
      sentAt: new Date().toISOString(),
    };

    sentOrderConfirmationKeys.add(idempotencyKey);
    emailLogs.push(log);
    console.log(`\x1b[32m[EMAIL TO CUSTOMER (COD)]\x1b[0m Gửi tới: ${payload.customerEmailSnapshot} | Tiêu đề: ${subject}`);
    return log;
  },

  /**
   * Lấy lịch sử email phục vụ kiểm thử
   */
  getLogs(): EmailLog[] {
    return [...emailLogs];
  },

  clearLogs(): void {
    emailLogs.length = 0;
    sentOrderConfirmationKeys.clear();
  }
};
