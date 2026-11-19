/** Payment email composition and transactional PostgreSQL outbox adapter. */

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query } from '../../lib/db';
import { SITE_CONFIG } from '../../config/site.config';

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  bodyText: string;
  type: 'STORE_PAYMENT_DECLARED' | 'CUSTOMER_PAYMENT_VERIFIED';
  orderNumber: string;
  /** Creation time of the notification; delivery is tracked in email_outbox.sent_at. */
  sentAt: string;
}

// Queue in PostgreSQL; a worker delivers after commit, never during checkout.
async function persistEmail(log: EmailLog, dedupKey: string, client?: PoolClient): Promise<EmailLog | null> {
  const sql = `INSERT INTO email_outbox (id,dedup_key,recipient,subject,body_text,notification_type,order_number)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (dedup_key) DO NOTHING RETURNING id`;
  const values = [log.id,dedupKey,log.to,log.subject,log.bodyText,log.type,log.orderNumber];
  const result = client ? await client.query(sql,values) : await query(sql,values);
  return result.rowCount ? log : null;
}

export const EmailService = {
  /**
   * 1. Gửi email thông báo cho CỬA HÀNG/ADMIN khi khách hàng vừa khai báo chuyển khoản
   * Kích hoạt tại Bước 3 Nhánh A.
   */
  async sendPaymentDeclaredToStore(payload: {
    orderNumber: string;
    amount: number;
    transactionReference?: string;
    bankName?: string;
    senderAccountName?: string;
    adminVerifyUrl: string;
  }, client?: PoolClient): Promise<EmailLog> {
    const storeEmail = SITE_CONFIG.contact.email || 'order@minhlab.com';
    const formatVND = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    const subject = `[MinhLab 3D] Khách hàng khai báo chuyển khoản đơn ${payload.orderNumber}`;
    const bodyText = `
Xin chào Bộ phận Kế toán & Vận hành MinhLab 3D,

Khách hàng vừa khai báo đã chuyển khoản cho đơn hàng:
- Mã đơn hàng: ${payload.orderNumber}
- Số tiền cần đối soát: ${formatVND(payload.amount)}
- Nội dung chuyển khoản / mã giao dịch: ${payload.transactionReference || 'Chưa cung cấp'}
- Ngân hàng chuyển: ${payload.bankName || 'Chưa cung cấp'}
- Tên chủ tài khoản chuyển: ${payload.senderAccountName || 'Chưa cung cấp'}

Vui lòng kiểm tra tài khoản ngân hàng thực tế và bấm vào liên kết sau để xác nhận đơn:
👉 ${payload.adminVerifyUrl}

Lưu ý: Đây là khai báo của khách, chưa xác nhận tiền đã vào. Hệ thống KHÔNG tự động duyệt thanh toán.
Trân trọng,
MinhLab 3D Core System
    `.trim();

    const log: EmailLog = {
      id: randomUUID(),
      to: storeEmail,
      subject,
      bodyText,
      type: 'STORE_PAYMENT_DECLARED',
      orderNumber: payload.orderNumber,
      sentAt: new Date().toISOString(),
    };

    return await persistEmail(log, `DECLARED-${payload.orderNumber}-${payload.transactionReference}`, client) ?? log;
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
  }, client?: PoolClient): Promise<EmailLog | null> {
    const idempotencyKey = `VERIFIED-${payload.orderNumber}-${payload.amountPaid}`;
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
      id: randomUUID(),
      to: payload.customerEmailSnapshot,
      subject,
      bodyText,
      type: 'CUSTOMER_PAYMENT_VERIFIED',
      orderNumber: payload.orderNumber,
      sentAt: new Date().toISOString(),
    };

    return persistEmail(log, idempotencyKey, client);
  },

};
