'use client';

import { useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import type { OrderItemAdmin } from './admin.types';
import type { RoleCode } from '../../lib/auth-roles';
import type { AdminList } from './useAdminList';
import { ListPagination } from '../common/ListPagination';
import { formatVND, shortOrderNumber } from '../../lib/format';
import { Button, DataTable, Dialog, Select, StatusBadge } from './ui';

const statuses = [
  ['ALL', 'Tất cả đơn hàng'],
  ['PENDING_PAYMENT', 'Chờ thanh toán'],
  ['DEPOSIT_PAID', 'Đã nhận tiền cọc'],
  ['CONFIRMED', 'Đã xác nhận'],
  ['IN_PRODUCTION', 'Đang sản xuất'],
  ['READY_TO_SHIP', 'Sẵn sàng giao'],
  ['SHIPPED', 'Đang giao'],
  ['COMPLETED', 'Hoàn tất'],
  ['CANCELLED', 'Đã hủy'],
] as const;

const statusLabels: Record<string, string> = Object.fromEntries(statuses.filter(([status]) => status !== 'ALL'));
const returnStatusLabels = { REQUESTED: 'Chờ nhận hàng', RETURN_RECEIVED: 'Chờ ghi hoàn', REFUNDED: 'Đã ghi hoàn' } as const;

interface OrdersPanelProps {
  list: AdminList<OrderItemAdmin>;
  role: RoleCode;
  onViewPayments: () => void;
  onViewProduction: () => void;
  actions: {
    updatingOrderNumber: string | null;
    deletingOrderNumber: string | null;
    handleUpdateOrderStatus: (number: string, status: string) => Promise<boolean>;
    handleDeleteOrder: (number: string) => Promise<boolean>;
    setSelectedOrderDetails: (order: OrderItemAdmin) => void;
  };
}

export function OrdersPanel({ list, role, actions, onViewPayments, onViewProduction }: OrdersPanelProps) {
  const { updatingOrderNumber, deletingOrderNumber, handleUpdateOrderStatus, handleDeleteOrder, setSelectedOrderDetails } = actions;
  const [orderToDelete, setOrderToDelete] = useState<OrderItemAdmin | null>(null);
  const columns = [
    { key: 'order', label: 'Đơn hàng', sortValue: (order: OrderItemAdmin) => order.orderNumber, render: (order: OrderItemAdmin) => <button type="button" onClick={() => setSelectedOrderDetails(order)} title={order.orderNumber} className="min-h-10 whitespace-nowrap rounded font-mono text-xs font-semibold text-admin-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent">{shortOrderNumber(order.orderNumber)}</button> },
    { key: 'customer', label: 'Khách hàng', sortValue: (order: OrderItemAdmin) => order.customerName, render: (order: OrderItemAdmin) => <div><p className="font-medium">{order.customerName}</p><p className="text-xs text-admin-muted">{order.customerPhone}</p></div> },
    { key: 'items', label: 'Số mặt hàng', sortValue: (order: OrderItemAdmin) => order.itemsCount, render: (order: OrderItemAdmin) => <span className="tabular-nums">{order.itemsCount}</span> },
    { key: 'payment', label: 'Thanh toán', sortValue: (order: OrderItemAdmin) => order.paymentTiming, render: (order: OrderItemAdmin) => <span className="text-admin-secondary">{order.paymentTiming === 'COD' ? 'Thu tiền khi giao' : 'VietQR'}</span> },
    { key: 'total', label: 'Tổng tiền', className: 'text-right', sortValue: (order: OrderItemAdmin) => order.grandTotal, render: (order: OrderItemAdmin) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatVND(order.grandTotal)}</span> },
    { key: 'status', label: 'Trạng thái', sortValue: (order: OrderItemAdmin) => order.orderStatus, render: (order: OrderItemAdmin) => <StatusBadge tone={statusTone(order.orderStatus)}>{statusLabels[order.orderStatus] ?? 'Trạng thái khác'}</StatusBadge> },
    { key: 'return', label: 'Hoàn hàng', sortValue: (order: OrderItemAdmin) => order.returnRequest?.status ?? '', render: (order: OrderItemAdmin) => order.returnRequest ? <StatusBadge tone={order.returnRequest.status === 'REFUNDED' ? 'success' : 'warning'}>{returnStatusLabels[order.returnRequest.status]}</StatusBadge> : <span className="text-admin-muted">—</span> },
    { key: 'actions', label: 'Thao tác', className: 'text-right', render: (order: OrderItemAdmin) => {
      const deleteReason = orderDeletionReason(order);
      return <div className="flex flex-wrap justify-end gap-1.5">
      <Button variant="quiet" className="min-h-9 px-2 text-xs" onClick={() => setSelectedOrderDetails(order)} aria-label={`Xem đơn ${shortOrderNumber(order.orderNumber)}`} title="Xem chi tiết đơn hàng"><Eye aria-hidden="true" className="h-4 w-4" /> Chi tiết</Button>
      {order.orderStatus === 'CONFIRMED' && (role === 'ADMIN') && (order.paymentStatus === 'PAID' || order.paymentTiming === 'COD') && <Button variant="secondary" className="min-h-8 px-2 text-xs" disabled={updatingOrderNumber === order.orderNumber} onClick={() => void handleUpdateOrderStatus(order.orderNumber, 'IN_PRODUCTION')}>{updatingOrderNumber === order.orderNumber ? 'Đang lưu…' : 'Đưa vào in'}</Button>}
      {order.orderStatus === 'IN_PRODUCTION' && role === 'ADMIN' && <Button variant="secondary" className="min-h-8 px-2 text-xs" disabled={updatingOrderNumber === order.orderNumber} onClick={() => void handleUpdateOrderStatus(order.orderNumber, 'READY_TO_SHIP')}>{updatingOrderNumber === order.orderNumber ? 'Đang lưu…' : 'Sẵn sàng giao'}</Button>}
      {order.orderStatus === 'READY_TO_SHIP' && (role === 'ADMIN') && <Button variant="secondary" className="min-h-8 px-2 text-xs" disabled={updatingOrderNumber === order.orderNumber} onClick={() => void handleUpdateOrderStatus(order.orderNumber, 'SHIPPED')}>{updatingOrderNumber === order.orderNumber ? 'Đang lưu…' : 'Bàn giao đơn vị vận chuyển'}</Button>}
      {order.orderStatus === 'SHIPPED' && (role === 'ADMIN') && <Button variant="secondary" className="min-h-8 px-2 text-xs" disabled={updatingOrderNumber === order.orderNumber} onClick={() => void handleUpdateOrderStatus(order.orderNumber, 'COMPLETED')}>{updatingOrderNumber === order.orderNumber ? 'Đang lưu…' : 'Khách đã nhận hàng'}</Button>}
      {role === 'ADMIN' && <div className="flex max-w-44 flex-col items-end gap-1">
        <Button variant="danger" className="min-h-9 px-2 text-xs" disabled={!!deleteReason || deletingOrderNumber === order.orderNumber || updatingOrderNumber === order.orderNumber} onClick={() => setOrderToDelete(order)} aria-label={`Xóa đơn ${shortOrderNumber(order.orderNumber)}`} aria-describedby={deleteReason ? `delete-order-reason-${order.orderNumber}` : undefined} title={deleteReason ?? 'Xóa đơn khỏi danh sách quản trị'}><Trash2 aria-hidden="true" className="h-4 w-4" /> Xóa đơn</Button>
        {deleteReason && <span id={`delete-order-reason-${order.orderNumber}`} className="text-xs leading-5 text-admin-muted">{deleteReason}</span>}
      </div>}
    </div>; } },
  ];

  return <section className="space-y-4" aria-labelledby="orders-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 id="orders-title" className="text-xl font-semibold tracking-tight text-admin-text">Đơn hàng</h1>
        <p className="mt-1 text-xs text-admin-muted">{list.pagination.total.toLocaleString('vi-VN')} đơn hàng</p>
      </div>
      <Select id="order-status-filter" label="Lọc theo trạng thái" value={list.status} onChange={(event) => list.setFilter(event.target.value)}>
        {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
    </div>

    <section aria-label="Quy trình xử lý đơn hàng" className="space-y-3 rounded-lg border border-admin-border bg-admin-surface p-4">
      <h2 className="text-sm font-semibold text-admin-text">Quy trình xử lý đơn</h2>
      <p className="text-sm leading-6 text-admin-secondary">Nhận đơn → Đối soát VietQR → Đưa vào in → Kiểm tra &amp; đóng gói → Bàn giao vận chuyển → Khách nhận hàng.</p>
      <p className="text-xs leading-5 text-admin-muted">Xác nhận tiền trong mục Thanh toán. Các nút bước tiếp theo xuất hiện trên từng đơn theo trạng thái và quyền tài khoản. Xưởng tự đóng gói và bàn giao; cập nhật khách nhận hàng sau khi giao thành công.</p>
      {role === 'ADMIN' && <p className="text-xs leading-5 text-admin-muted">Nút Xóa đơn nằm trong cột Thao tác. Chỉ xóa được đơn chưa thanh toán, chưa bàn giao và chưa hoàn tất; hệ thống vẫn kiểm tra phân công sản xuất trước khi xóa. Đơn được gỡ khỏi danh sách quản trị, lịch sử vẫn được lưu.</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onViewPayments}>Đối soát thanh toán</Button>
        {role === 'ADMIN' && <Button onClick={onViewProduction}>Xem hàng đợi in</Button>}
      </div>
    </section>

    <DataTable
      columns={columns}
      rows={list.data}
      rowKey={(order) => order.orderNumber}
      loading={list.isLoading}
      error={list.error}
      emptyTitle="Không tìm thấy đơn hàng"
      emptyDescription="Hãy chọn trạng thái khác hoặc tìm theo tên khách hay mã đơn."
    />
    <ListPagination pagination={list.pagination} isLoading={list.isLoading} onPageChange={list.setPage} variant="admin" />
    {orderToDelete && <Dialog open title="Xóa đơn khỏi danh sách quản trị?" onClose={() => setOrderToDelete(null)}>
      <div className="space-y-4">
        <p className="text-sm text-admin-secondary">Đơn <span className="font-mono font-medium text-admin-text">{orderToDelete.orderNumber}</span> chưa thanh toán. Hệ thống sẽ hủy đơn nếu cần rồi ẩn đơn khỏi danh sách quản trị.</p>
        <p className="text-xs leading-5 text-admin-muted">Lịch sử đơn hàng và thanh toán vẫn được lưu. Đơn đã bàn giao, hoàn tất, đã thanh toán hoặc đang có phân công sản xuất không thể xóa.</p>
        <footer className="flex justify-end gap-2 border-t border-admin-border pt-3">
          <Button disabled={deletingOrderNumber === orderToDelete.orderNumber} onClick={() => setOrderToDelete(null)}>Quay lại</Button>
          <Button variant="danger" disabled={deletingOrderNumber === orderToDelete.orderNumber} onClick={() => {
            void handleDeleteOrder(orderToDelete.orderNumber).then((deleted) => { if (deleted) setOrderToDelete(null); });
          }}>{deletingOrderNumber === orderToDelete.orderNumber ? 'Đang xóa…' : 'Xóa đơn'}</Button>
        </footer>
      </div>
    </Dialog>}
  </section>;
}

function orderDeletionReason(order: OrderItemAdmin): string | null {
  if (order.paymentStatus !== 'UNPAID') return 'Đơn đã có thanh toán; cần giữ lịch sử.';
  if (order.orderStatus === 'SHIPPED' || order.orderStatus === 'COMPLETED')
    return 'Đơn đã bàn giao hoặc hoàn tất; cần giữ lịch sử.';
  return null;
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'PENDING_PAYMENT') return 'warning';
  if (status === 'IN_PRODUCTION') return 'accent';
  return 'neutral';
}
