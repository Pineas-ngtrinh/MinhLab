/**
 * =====================================================================
 * MINHLAB 3D - ORDER & PAYMENT SERVICE
 * =====================================================================
 * Tuân thủ tuyệt đối quy tắc bất biến trong MinhLab_database_v2.dbml:
 * 1. Không hard-delete dữ liệu.
 * 2. orders (snapshot địa chỉ, snapshot tên/email/sđt) và order_items là snapshot bất biến.
 * 3. COD chỉ được phép khi 100% item_type='READY_PRODUCT' (có CUSTOM_PRINT bắt buộc PREPAID).
 * 4. Không tự động verify thanh toán: payments.verification_status bắt buộc PENDING -> VERIFIED qua nhân viên.
 * 5. Mã đơn order_number chuẩn định dạng ML-xxxxxx sinh ở SERVER, bảo đảm duy nhất.
 * =====================================================================
 */

import { EmailService } from './email.service';

export interface OrderItemInput {
  productId?: string;
  itemType: 'READY_PRODUCT' | 'CUSTOM_PRINT';
  itemName: string;
  quantity: number;
  unitPrice: number;
  color?: string;
  material?: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  customerNote?: string;
  paymentMethod: 'VIETQR' | 'COD';
  items: OrderItemInput[];
}

export interface OrderRecord {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name_snapshot: string;
  customer_email_snapshot: string;
  customer_phone_snapshot: string;
  shipping_recipient_name: string;
  shipping_recipient_phone: string;
  shipping_address_line: string;
  shipping_province_name: string;
  order_status: 'PENDING_PAYMENT' | 'DEPOSIT_PAID' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  payment_timing: 'PREPAID' | 'COD';
  currency: 'VND';
  subtotal: number;
  shipping_fee: number;
  grand_total: number;
  required_deposit_amount: number;
  customer_note?: string;
  placed_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  item_type: 'READY_PRODUCT' | 'CUSTOM_PRINT';
  item_name_snapshot: string;
  quantity: number;
  unitPrice: number;
  line_total: number;
  color_snapshot?: string;
  material_snapshot?: string;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  payment_number: string;
  payment_method: 'VIETQR' | 'BANK_TRANSFER' | 'CASH';
  payment_purpose: 'FULL_PAYMENT' | 'DEPOSIT' | 'BALANCE';
  amount: number;
  currency: 'VND';
  transaction_reference?: string;
  bank_name?: string;
  sender_account_name?: string;
  transferred_at?: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';
  verified_by?: string;
  verified_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface AttachmentRecord {
  id: string;
  entity_type: 'PAYMENT';
  entity_id: string;
  file_url: string;
  purpose: 'PAYMENT_PROOF';
  created_at: string;
}

// Attach stores to globalThis to share state across Next.js App Router routes in development
const globalForOrders = globalThis as unknown as {
  ordersStore?: Map<string, OrderRecord>;
  orderItemsStore?: Map<string, OrderItemRecord[]>;
  paymentsStore?: Map<string, PaymentRecord>;
  attachmentsStore?: Map<string, AttachmentRecord[]>;
};

const ordersStore = globalForOrders.ordersStore ?? new Map<string, OrderRecord>();
const orderItemsStore = globalForOrders.orderItemsStore ?? new Map<string, OrderItemRecord[]>();
const paymentsStore = globalForOrders.paymentsStore ?? new Map<string, PaymentRecord>();
const attachmentsStore = globalForOrders.attachmentsStore ?? new Map<string, AttachmentRecord[]>();

globalForOrders.ordersStore = ordersStore;
globalForOrders.orderItemsStore = orderItemsStore;
globalForOrders.paymentsStore = paymentsStore;
globalForOrders.attachmentsStore = attachmentsStore;

export const OrderService = {
  /**
   * Sinh mã đơn hàng duy nhất trên SERVER (ML-xxxxxx)
   */
  generateOrderNumber(): string {
    let orderNum: string;
    let attempts = 0;
    do {
      const code = Math.floor(100000 + Math.random() * 900000);
      orderNum = `ML-${code}`;
      attempts++;
      if (attempts > 100) {
        orderNum = `ML-${Date.now().toString().slice(-6)}`;
        break;
      }
    } while (Array.from(ordersStore.values()).some((o) => o.order_number === orderNum));

    return orderNum;
  },

  /**
   * Tạo đơn hàng mới theo quy tắc schema v2
   */
  async createOrder(input: CreateOrderInput, baseUrl: string = 'http://localhost:3000') {
    // 1. Kiểm tra tính hợp lệ cơ bản
    if (!input.customerName?.trim() || !input.customerEmail?.trim() || !input.customerPhone?.trim() || !input.shippingAddress?.trim()) {
      throw new Error('Thiếu thông tin bắt buộc: Họ tên, Email, Số điện thoại hoặc Địa chỉ giao hàng.');
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Giỏ hàng trống. Không thể tạo đơn.');
    }

    // 2. Kiểm tra điều kiện COD: Chỉ cho phép khi 100% là READY_PRODUCT
    const hasCustomPrint = input.items.some((i) => i.itemType === 'CUSTOM_PRINT');
    if (input.paymentMethod === 'COD' && hasCustomPrint) {
      throw new Error('Đơn hàng có sản phẩm in theo yêu cầu (CUSTOM_PRINT) bắt buộc thanh toán trả trước (PREPAID). Không hỗ trợ COD.');
    }

    // 3. Tính toán tổng tiền
    const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const grandTotal = subtotal + shippingFee;

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();

    const paymentTiming = input.paymentMethod === 'COD' ? 'COD' : 'PREPAID';

    // 4. Nhánh A vs Nhánh B
    const orderStatus = paymentTiming === 'COD' ? 'CONFIRMED' : 'PENDING_PAYMENT';

    const order: OrderRecord = {
      id: orderId,
      order_number: orderNumber,
      customer_name_snapshot: input.customerName.trim(),
      customer_email_snapshot: input.customerEmail.trim(),
      customer_phone_snapshot: input.customerPhone.trim(),
      shipping_recipient_name: input.customerName.trim(),
      shipping_recipient_phone: input.customerPhone.trim(),
      shipping_address_line: input.shippingAddress.trim(),
      shipping_province_name: 'Việt Nam',
      order_status: orderStatus,
      payment_status: 'UNPAID',
      payment_timing: paymentTiming,
      currency: 'VND',
      subtotal,
      shipping_fee: shippingFee,
      grand_total: grandTotal,
      required_deposit_amount: paymentTiming === 'PREPAID' ? grandTotal : 0,
      customer_note: input.customerNote?.trim(),
      placed_at: now,
      created_at: now,
      updated_at: now,
    };

    // Lưu order items
    const items: OrderItemRecord[] = input.items.map((item, idx) => ({
      id: `item-${orderId}-${idx + 1}`,
      order_id: orderId,
      item_type: item.itemType,
      item_name_snapshot: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      line_total: item.unitPrice * item.quantity,
      color_snapshot: item.color,
      material_snapshot: item.material,
    }));

    ordersStore.set(orderId, order);
    orderItemsStore.set(orderId, items);

    let paymentRecord: PaymentRecord | undefined;

    if (paymentTiming === 'PREPAID') {
      // Tạo 1 dòng payments với verification_status='PENDING'
      const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      paymentRecord = {
        id: paymentId,
        order_id: orderId,
        payment_number: `PAY-${orderNumber.replace('ML-', '')}`,
        payment_method: 'VIETQR',
        payment_purpose: 'FULL_PAYMENT',
        amount: grandTotal,
        currency: 'VND',
        verification_status: 'PENDING',
        created_at: now,
      };
      paymentsStore.set(paymentId, paymentRecord);
    } else {
      // Nhánh B: COD -> Gửi email xác nhận đặt hàng thành công cho khách hàng ngay lập tức
      await EmailService.sendCustomerCodConfirmedEmail({
        orderNumber,
        customerEmailSnapshot: order.customer_email_snapshot,
        customerNameSnapshot: order.customer_name_snapshot,
        grandTotal,
        orderItems: items.map((i) => ({ itemName: i.item_name_snapshot, quantity: i.quantity, unitPrice: i.unitPrice })),
        shippingAddress: order.shipping_address_line,
        trackingUrl: `${baseUrl}/theo-doi-don?order=${orderNumber}`,
      });
    }

    return {
      order,
      items,
      payment: paymentRecord,
    };
  },

  /**
   * Khách hàng bấm "Tôi đã chuyển khoản" và khai báo thông tin đối soát
   * verification_status VẪN LÀ PENDING (không được tự động verify).
   * Kích hoạt gửi email tới CỬA HÀNG/ADMIN.
   */
  async declarePayment(payload: {
    orderNumber: string;
    transactionReference: string;
    bankName: string;
    senderAccountName: string;
    paymentProofUrl?: string;
  }, baseUrl: string = 'http://localhost:3000') {
    const order = Array.from(ordersStore.values()).find((o) => o.order_number === payload.orderNumber);
    if (!order) {
      throw new Error(`Không tìm thấy đơn hàng với mã [${payload.orderNumber}]`);
    }

    const payment = Array.from(paymentsStore.values()).find((p) => p.order_id === order.id);
    if (!payment) {
      throw new Error(`Đơn hàng [${payload.orderNumber}] không có bản ghi thanh toán trả trước.`);
    }

    const now = new Date().toISOString();

    // Cập nhật thông tin đối soát, trạng thái VẪN LÀ PENDING
    payment.transaction_reference = payload.transactionReference.trim();
    payment.bank_name = payload.bankName.trim();
    payment.sender_account_name = payload.senderAccountName.trim();
    payment.transferred_at = now;
    payment.verification_status = 'PENDING';

    paymentsStore.set(payment.id, payment);

    // Nếu có ảnh proof, lưu vào attachments
    if (payload.paymentProofUrl) {
      const attachId = `att-${Date.now()}`;
      const attachment: AttachmentRecord = {
        id: attachId,
        entity_type: 'PAYMENT',
        entity_id: payment.id,
        file_url: payload.paymentProofUrl,
        purpose: 'PAYMENT_PROOF',
        created_at: now,
      };
      const existing = attachmentsStore.get(payment.id) || [];
      attachmentsStore.set(payment.id, [...existing, attachment]);
    }

    // Gửi email cho CỬA HÀNG/ADMIN
    const adminVerifyUrl = `${baseUrl}/api/admin/payments/verify?order=${order.order_number}&payment=${payment.id}`;
    await EmailService.sendPaymentDeclaredToStore({
      orderNumber: order.order_number,
      amount: payment.amount,
      transactionReference: payload.transactionReference,
      bankName: payload.bankName,
      senderAccountName: payload.senderAccountName,
      paymentProofUrl: payload.paymentProofUrl,
      adminVerifyUrl,
    });

    return {
      order,
      payment,
    };
  },

  /**
   * Nhân viên xác nhận đã nhận tiền (Thủ công)
   * verification_status: PENDING -> VERIFIED
   * orders.payment_status -> PAID
   * orders.order_status -> CONFIRMED
   * Kích hoạt gửi email xác nhận cho KHÁCH HÀNG
   */
  async verifyPayment(orderNumber: string, verifiedBy: string = 'STAFF_ADMIN', baseUrl: string = 'http://localhost:3000') {
    const order = Array.from(ordersStore.values()).find((o) => o.order_number === orderNumber);
    if (!order) {
      throw new Error(`Không tìm thấy đơn hàng [${orderNumber}]`);
    }

    const payment = Array.from(paymentsStore.values()).find((p) => p.order_id === order.id);
    if (!payment) {
      throw new Error(`Không tìm thấy thanh toán cho đơn hàng [${orderNumber}]`);
    }

    // Idempotent: Nếu đã VERIFIED thì không làm lại
    if (payment.verification_status === 'VERIFIED') {
      return {
        order,
        payment,
        alreadyVerified: true,
      };
    }

    const now = new Date().toISOString();
    payment.verification_status = 'VERIFIED';
    payment.verified_by = verifiedBy;
    payment.verified_at = now;
    paymentsStore.set(payment.id, payment);

    order.payment_status = 'PAID';
    order.order_status = 'CONFIRMED';
    order.updated_at = now;
    ordersStore.set(order.id, order);

    const items = orderItemsStore.get(order.id) || [];

    // Gửi email xác nhận đặt hàng thành công cho KHÁCH HÀNG
    await EmailService.sendCustomerPaymentVerifiedEmail({
      orderNumber: order.order_number,
      customerEmailSnapshot: order.customer_email_snapshot,
      customerNameSnapshot: order.customer_name_snapshot,
      amountPaid: payment.amount,
      paymentPurpose: payment.payment_purpose === 'DEPOSIT' ? 'DEPOSIT' : 'FULL_PAYMENT',
      grandTotal: order.grand_total,
      remainingBalance: 0,
      orderItems: items.map((i) => ({ itemName: i.item_name_snapshot, quantity: i.quantity, unitPrice: i.unitPrice })),
      trackingUrl: `${baseUrl}/theo-doi-don?order=${order.order_number}`,
    });

    return {
      order,
      payment,
      alreadyVerified: false,
    };
  },

  /**
   * Nhân viên từ chối khoản thanh toán (Thủ công)
   * verification_status: PENDING -> REJECTED
   */
  async rejectPayment(orderNumber: string, rejectedBy: string = 'STAFF_ADMIN', reason: string = 'Giao dịch không hợp lệ hoặc chưa nhận được tiền') {
    const order = Array.from(ordersStore.values()).find((o) => o.order_number === orderNumber);
    if (!order) {
      throw new Error(`Không tìm thấy đơn hàng [${orderNumber}]`);
    }

    const payment = Array.from(paymentsStore.values()).find((p) => p.order_id === order.id);
    if (!payment) {
      throw new Error(`Không tìm thấy thanh toán cho đơn hàng [${orderNumber}]`);
    }

    const now = new Date().toISOString();
    payment.verification_status = 'REJECTED';
    payment.verified_by = rejectedBy;
    payment.rejection_reason = reason;
    payment.verified_at = now;
    paymentsStore.set(payment.id, payment);

    return {
      order,
      payment,
    };
  },

  /**
   * Tra cứu đơn hàng theo mã
   */
  getOrderByNumber(orderNumber: string) {
    const order = Array.from(ordersStore.values()).find((o) => o.order_number === orderNumber);
    if (!order) return null;

    const items = orderItemsStore.get(order.id) || [];
    const payment = Array.from(paymentsStore.values()).find((p) => p.order_id === order.id);
    const attachments = payment ? attachmentsStore.get(payment.id) || [] : [];

    return {
      order,
      items,
      payment,
      attachments,
    };
  },

  /**
   * Lấy toàn bộ đơn hàng (dành cho Admin / Staff)
   */
  getAllOrders() {
    return Array.from(ordersStore.values()).map((order) => {
      const items = orderItemsStore.get(order.id) || [];
      const payment = Array.from(paymentsStore.values()).find((p) => p.order_id === order.id);
      const attachments = payment ? attachmentsStore.get(payment.id) || [] : [];
      return { order, items, payment, attachments };
    }).sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime());
  },

  /**
   * Lấy danh sách đơn hàng theo email khách hàng (dành cho trang cá nhân /tai-khoan)
   */
  getOrdersByCustomerEmail(email: string) {
    const norm = email.toLowerCase().trim();
    return Array.from(ordersStore.values())
      .filter((o) => o.customer_email_snapshot.toLowerCase().trim() === norm)
      .map((order) => {
        const items = orderItemsStore.get(order.id) || [];
        const payment = Array.from(paymentsStore.values()).find((p) => p.order_id === order.id);
        return { order, items, payment };
      })
      .sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime());
  },

  /**
   * Lấy toàn bộ danh sách thanh toán (dành cho Kế toán đối soát)
   */
  getAllPayments() {
    return Array.from(paymentsStore.values()).map((payment) => {
      const order = ordersStore.get(payment.order_id);
      const attachments = attachmentsStore.get(payment.id) || [];
      return { payment, order, attachments };
    }).sort((a, b) => new Date(b.payment.created_at).getTime() - new Date(a.payment.created_at).getTime());
  },

  /**
   * Cập nhật trạng thái sản xuất đơn hàng (dành cho Print Operator)
   */
  updateOrderStatus(orderNumber: string, newStatus: OrderRecord['order_status']) {
    const order = Array.from(ordersStore.values()).find((o) => o.order_number === orderNumber);
    if (!order) throw new Error(`Không tìm thấy đơn hàng [${orderNumber}]`);
    order.order_status = newStatus;
    order.updated_at = new Date().toISOString();
    ordersStore.set(order.id, order);
    return order;
  },

  /**
   * Reset store (hỗ trợ test)
   */
  clearAll() {
    ordersStore.clear();
    orderItemsStore.clear();
    paymentsStore.clear();
    attachmentsStore.clear();
    EmailService.clearLogs();
  }
};
