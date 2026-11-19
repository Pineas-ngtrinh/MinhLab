'use client';

import { ArrowUpRight } from 'lucide-react';
import type { PaymentItem } from './admin.types';
import type { AdminList } from './useAdminList';
import { ListPagination } from '../common/ListPagination';
import { Button, DataTable, Select, StatusBadge } from './ui';
import { formatVND, shortOrderNumber } from '../../lib/format';

interface PaymentsPanelProps {
  list: AdminList<PaymentItem>;
  onReview: (payment: PaymentItem) => void;
}

export function PaymentsPanel({ list, onReview }: PaymentsPanelProps) {
  const columns = [
    { key: 'order', label: 'Đơn hàng', sortValue: (payment: PaymentItem) => payment.orderNumber, render: (payment: PaymentItem) => <button type="button" title={payment.orderNumber} onClick={() => onReview(payment)} className="min-h-10 whitespace-nowrap rounded font-mono text-xs font-semibold text-admin-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent">{payment.orderNumber === 'N/A' ? 'Đơn chưa xác định' : shortOrderNumber(payment.orderNumber)}</button> },
    { key: 'customer', label: 'Khách hàng', sortValue: (payment: PaymentItem) => payment.customerName, render: (payment: PaymentItem) => <div><p className="font-medium">{payment.customerName}</p><p className="text-xs text-admin-muted">{payment.customerPhone === 'N/A' ? 'Chưa cung cấp số điện thoại' : payment.customerPhone}</p></div> },
    { key: 'amount', label: 'Số tiền', className: 'text-right', sortValue: (payment: PaymentItem) => payment.amount, render: (payment: PaymentItem) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatVND(payment.amount)}</span> },
    { key: 'reference', label: 'Mã giao dịch', sortValue: (payment: PaymentItem) => payment.transactionReference, render: (payment: PaymentItem) => <div><p className="max-w-44 break-all font-mono">{payment.transactionReference || 'Chưa cung cấp'}</p><p className="text-xs text-admin-muted">{payment.bankName === 'N/A' ? 'Chưa có thông tin ngân hàng' : payment.bankName || 'Chưa có thông tin ngân hàng'}</p></div> },
    { key: 'sender', label: 'Người chuyển', sortValue: (payment: PaymentItem) => payment.senderAccountName, render: (payment: PaymentItem) => payment.senderAccountName === 'N/A' ? 'Chưa cung cấp' : payment.senderAccountName || '—' },
    { key: 'status', label: 'Trạng thái', sortValue: (payment: PaymentItem) => payment.verificationStatus, render: (payment: PaymentItem) => <StatusBadge tone={payment.verificationStatus === 'VERIFIED' ? 'success' : payment.verificationStatus === 'PENDING' ? 'warning' : payment.verificationStatus === 'REFUNDED' ? 'neutral' : 'danger'}>{payment.verificationStatus === 'VERIFIED' ? 'Đã đối soát' : payment.verificationStatus === 'PENDING' ? 'Chờ kiểm tra' : payment.verificationStatus === 'REFUNDED' ? 'Đã hoàn tiền' : 'Đã từ chối'}</StatusBadge> },
    { key: 'actions', label: 'Thao tác', className: 'text-right', render: (payment: PaymentItem) => <Button onClick={() => onReview(payment)} className="whitespace-nowrap text-xs" aria-label={`Xem thanh toán đơn ${shortOrderNumber(payment.orderNumber)}`}>{payment.verificationStatus === 'PENDING' ? 'Đối chiếu' : 'Chi tiết'} <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Button> },
  ];

  return <section className="space-y-4" aria-labelledby="payments-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 id="payments-title" className="text-xl font-semibold tracking-tight text-admin-text">Đối soát thanh toán</h1>
        <p className="mt-1 text-xs text-admin-muted">Kiểm tra giao dịch trong tài khoản ngân hàng của xưởng trước khi xác nhận đơn đã thanh toán.</p>
      </div>
      <Select id="payment-status-filter" label="Lọc theo trạng thái" value={list.status} onChange={(event) => list.setFilter(event.target.value)}>
        <option value="ALL">Tất cả giao dịch</option>
        <option value="PENDING">Chờ kiểm tra</option>
        <option value="VERIFIED">Đã đối soát</option>
        <option value="REJECTED">Đã từ chối</option>
        <option value="REFUNDED">Đã hoàn tiền</option>
      </Select>
    </div>
    <DataTable columns={columns} rows={list.data} rowKey={(payment) => payment.id} loading={list.isLoading} error={list.error} emptyTitle="Không tìm thấy giao dịch" emptyDescription="Không có giao dịch nào ở trạng thái này." />
    <ListPagination pagination={list.pagination} isLoading={list.isLoading} onPageChange={list.setPage} variant="admin" />
  </section>;
}
