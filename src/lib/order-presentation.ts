import type { OrderStatus, PaymentStatus } from '../domain/orders/order';

interface OrderBadge {
  label: string;
  className: string;
}

export function paymentRejectionNotice(reason?: string): string {
  return `Khai báo chuyển khoản chưa được chấp nhận${reason?.trim() ? `: ${reason.trim()}` : '.'} Bạn có thể kiểm tra, bổ sung và gửi lại khai báo; đơn vẫn chờ thanh toán.`;
}

export const ORDER_STATUS_BADGES: Record<OrderStatus, OrderBadge> = {
  PENDING_PAYMENT: { label: 'Chờ Chuyển Khoản', className: 'bg-[#D97706]/15 border-[#D97706]/30 text-[#D97706]' },
  DEPOSIT_PAID: { label: 'Đã Thanh Toán Cọc', className: 'bg-[#C8A261]/15 border-[#C8A261]/30 text-[#C8A261]' },
  CONFIRMED: { label: 'Đã Xác Nhận Đơn', className: 'bg-[#6F9576]/15 border-[#6F9576]/30 text-[#6F9576]' },
  IN_PRODUCTION: { label: 'Đang In FDM Tại Xưởng', className: 'bg-[#3B82F6]/15 border-[#3B82F6]/30 text-[#3B82F6]' },
  READY_TO_SHIP: { label: 'Đã Đóng Gói Sẵn Sàng', className: 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#8B5CF6]' },
  SHIPPED: { label: 'Đang Giao Hàng', className: 'bg-[#C8A261]/15 border-[#C8A261]/30 text-[#C8A261]' },
  COMPLETED: { label: 'Đã Hoàn Thành', className: 'bg-[#6F9576]/15 border-[#6F9576]/30 text-[#6F9576]' },
  CANCELLED: { label: 'Đã Hủy', className: 'bg-[#A5ADB8]/15 border-[#A5ADB8]/30 text-[#A5ADB8]' },
};

export const PAYMENT_STATUS_BADGES: Record<PaymentStatus, OrderBadge> = {
  UNPAID: { label: 'Chưa Thanh Toán', className: 'bg-[#D97706]/15 border-[#D97706]/30 text-[#D97706]' },
  PARTIALLY_PAID: { label: 'Đã Thanh Toán Một Phần', className: 'bg-[#C8A261]/15 border-[#C8A261]/30 text-[#C8A261]' },
  PAID: { label: 'Đã Thanh Toán', className: 'bg-[#6F9576]/15 border-[#6F9576]/30 text-[#6F9576]' },
  PARTIALLY_REFUNDED: { label: 'Đã Hoàn Tiền Một Phần', className: 'bg-[#A5ADB8]/15 border-[#A5ADB8]/30 text-[#A5ADB8]' },
  REFUNDED: { label: 'Đã Hoàn Tiền', className: 'bg-[#A5ADB8]/15 border-[#A5ADB8]/30 text-[#A5ADB8]' },
};

