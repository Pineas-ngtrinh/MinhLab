'use client';

import { useRef, useState } from 'react';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { ListPagination } from '../common/ListPagination';
import { shortOrderNumber } from '../../lib/format';
import type { ProductionQueueItem } from '../../contracts/workshop';
import type { RoleCode } from '../../lib/auth-roles';
import { ProductionDecisionInbox } from './production/ProductionDecisionInbox';
import { Button, EmptyState, Select, StatusBadge, Toast } from './ui';

interface ProductionQueueProps {
  scope: string;
  role: RoleCode;
}
export function ProductionQueue({ scope, role }: ProductionQueueProps) {
  const queue = usePaginatedList<ProductionQueueItem>('/api/workshop/orders', true, scope);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  async function complete(number: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(number);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: number, newStatus: 'READY_TO_SHIP' }),
      });
      const body: { success?: boolean; error?: string } = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error || 'Không thể cập nhật đơn hàng.');
      queue.reload();
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Không thể kết nối máy chủ. Hãy kiểm tra mạng rồi thử lại.' : cause instanceof Error ? cause.message : 'Không thể cập nhật đơn hàng.');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  return (
    <section className="min-w-0 space-y-5" aria-label="Hàng đợi in">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Hàng đợi in</h1>
        <p className="text-sm leading-6 text-[#A5ADB8]">
          Chỉ chuyển trạng thái đơn sau khi đã kiểm tra sản phẩm hoàn thiện. Cấu hình máy in và tệp in được quản lý trong khu vực sản xuất.
        </p>
      </div>
      <ProductionDecisionInbox role={role} />
      <div className="flex flex-wrap items-end gap-3">
          <Select label="Trạng thái"
            id="production-status"
            aria-label="Trạng thái"
            value={queue.status === 'ALL' ? 'IN_PRODUCTION' : queue.status}
            onChange={(event) => queue.setFilter(event.target.value)}
          >
            <option value="IN_PRODUCTION">Đang sản xuất</option>
            <option value="READY_TO_SHIP">Sẵn sàng giao</option>
          </Select>
        <Button onClick={queue.reload} disabled={queue.isLoading}>
          Làm mới
        </Button>
      </div>
      {(queue.error || error) && (
        <Toast tone="danger" message={error || queue.error} />
      )}
      {queue.isLoading ? (
        <p role="status" className="py-8 text-sm text-[#A5ADB8]">
          Đang tải hàng đợi in…
        </p>
      ) : queue.data.length === 0 ? (
        <EmptyState title="Không có đơn hàng ở trạng thái này" description="Đổi bộ lọc để xem các đơn đang sản xuất hoặc sẵn sàng giao." />
      ) : (
        <ul className="divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
          {queue.data.map((order) => (
            <li key={order.orderNumber} className="grid gap-4 p-4 xl:grid-cols-[150px_1fr_auto] xl:items-start">
              <div className="space-y-2"><h2 className="font-mono text-sm font-semibold text-admin-text" title={order.orderNumber}>Đơn {shortOrderNumber(order.orderNumber)}</h2><StatusBadge tone={order.status === 'IN_PRODUCTION' ? 'accent' : 'success'}>{order.status === 'IN_PRODUCTION' ? 'Đang sản xuất' : 'Sẵn sàng giao'}</StatusBadge></div>
              <ul className="space-y-2 text-sm text-admin-secondary">
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.name} · SL {item.quantity}
                    {item.material ? ` · ${item.material}` : ''}
                    {item.color ? ` · ${item.color}` : ''}
                  </li>
                ))}
              </ul>
              {order.status === 'IN_PRODUCTION' && (
                <Button variant="primary" className="min-h-11 w-full xl:w-auto"
                  disabled={Boolean(busy)}
                  onClick={() => void complete(order.orderNumber)}
                >
                  {busy === order.orderNumber
                    ? 'Đang lưu…'
                    : 'Hoàn tất kiểm tra, chuyển đóng gói'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ListPagination
        variant="admin"
        pagination={queue.pagination}
        isLoading={queue.isLoading}
        onPageChange={queue.setPage}
      />
    </section>
  );
}
