'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import type { RoleCode } from '../../lib/auth-roles';
import type { ApiResponse } from '../../contracts/api';
import type { PaymentItem, OrderItemAdmin } from './admin.types';
import { useAdminList } from './useAdminList';
import { ORDER_STATUS_BADGES } from '../../lib/order-presentation';

type AdminTab = 'OVERVIEW' | 'PAYMENTS' | 'ORDERS' | 'FILE_REVIEW' | 'PRINTERS';

export function useAdminWorkspace() {
  const router = useRouter();
  const { user, isAuthenticated, isAuthReady, logout } = useAuth();

  const [tabSelection, setTabSelection] = useState<{ role: RoleCode; tab: AdminTab } | null>(null);
  const defaultTab: AdminTab = user?.role === 'ADMIN' ? 'OVERVIEW' : user?.role === 'FILE_REVIEWER' ? 'FILE_REVIEW' : user?.role === 'PRINT_OPERATOR' || user?.role === 'WORKSHOP_OPERATOR' ? 'PRINTERS' : 'ORDERS';
  const activeTab = tabSelection && tabSelection.role === user?.role ? tabSelection.tab : defaultTab;
  const setActiveTab = (tab: AdminTab) => { if (user) setTabSelection({ role: user.role, tab }); };
  const [queueRevision,setQueueRevision]=useState(0);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');
  const [verifyingOrderNum, setVerifyingOrderNum] = useState<string | null>(null);
  const [updatingOrderNumber, setUpdatingOrderNumber] = useState<string | null>(null);
  const [deletingOrderNumber, setDeletingOrderNumber] = useState<string | null>(null);
  const [updatingReturnOrderNumber, setUpdatingReturnOrderNumber] = useState<string | null>(null);

  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentItem | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentItem | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('Chưa nhận được giao dịch chuyển khoản vào tài khoản ngân hàng');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderItemAdmin | null>(null);


  const enabled = isAuthReady && (user?.role === 'ADMIN');
  const paymentsList = useAdminList<PaymentItem>('/api/admin/payments', enabled);
  const ordersList = useAdminList<OrderItemAdmin>('/api/admin/orders', enabled);
  const listError = activeTab === 'PAYMENTS' ? paymentsList.error : activeTab === 'ORDERS' ? ordersList.error : '';
  const visibleError = actionErrorMessage || listError;
  const isLoading = paymentsList.isLoading || ordersList.isLoading;
  const loadData = () => { paymentsList.reload(); ordersList.reload(); setQueueRevision(value=>value+1); };

  useEffect(() => {
    if (!isAuthReady) return;

    if (!isAuthenticated || !user) {
      router.replace('/dang-nhap');
      return;
    }

    if (user.role === 'CUSTOMER') {
      router.replace('/tai-khoan');
      return;
    }

  }, [isAuthReady, isAuthenticated, user, router]);

  const handleVerifyPayment = async (orderNumber: string) => {
    setActionSuccessMessage('');
    setActionErrorMessage('');
    setVerifyingOrderNum(orderNumber);

    try {
      const res = await fetch('/api/admin/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
        }),
      });

      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xác nhận thanh toán thất bại.');
      }

      setActionSuccessMessage(
        `Đã xác nhận thanh toán cho đơn [${orderNumber}] thành công.`
      );

      loadData();
    } catch (err: unknown) {
      setActionErrorMessage(err instanceof Error ? err.message : 'Lỗi khi duyệt thanh toán');
    } finally {
      setVerifyingOrderNum(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectingPayment) return;
    setActionSuccessMessage('');
    setActionErrorMessage('');

    try {
      const res = await fetch('/api/admin/payments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: rejectingPayment.orderNumber,
          reason: rejectionReasonInput,
        }),
      });

      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Từ chối thanh toán thất bại.');
      }

      setActionSuccessMessage(`Đã từ chối giao dịch của đơn [${rejectingPayment.orderNumber}].`);
      setRejectingPayment(null);
      loadData();
    } catch (err: unknown) {
      setActionErrorMessage(err instanceof Error ? err.message : 'Lỗi khi từ chối');
    }
  };

  const handleUpdateOrderStatus = async (orderNumber: string, newStatus: string): Promise<boolean> => {
    setActionSuccessMessage('');
    setActionErrorMessage('');
    setUpdatingOrderNumber(orderNumber);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, newStatus }),
      });
      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể cập nhật trạng thái đơn hàng.');
      }
      const statusLabel = ORDER_STATUS_BADGES[newStatus as keyof typeof ORDER_STATUS_BADGES]?.label ?? 'trạng thái mới';
      setActionSuccessMessage(`Đã cập nhật đơn [${orderNumber}] thành ${statusLabel}.`);
      loadData();
      return true;
    } catch (error: unknown) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái đơn hàng.');
      return false;
    } finally {
      setUpdatingOrderNumber(null);
    }
  };

  const handleDeleteOrder = async (orderNumber: string): Promise<boolean> => {
    setActionSuccessMessage('');
    setActionErrorMessage('');
    setDeletingOrderNumber(orderNumber);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });
      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể xóa đơn hàng.');
      setActionSuccessMessage(`Đã xóa đơn [${orderNumber}] khỏi danh sách quản trị.`);
      loadData();
      return true;
    } catch (error: unknown) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Không thể xóa đơn hàng.');
      return false;
    } finally {
      setDeletingOrderNumber(null);
    }
  };

  const handleOrderReturnAction = async (orderNumber: string, action: 'RECEIVE' | 'REFUND', details?: { amount: number; transactionReference: string }): Promise<boolean> => {
    setActionSuccessMessage('');
    setActionErrorMessage('');
    setUpdatingReturnOrderNumber(orderNumber);
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderNumber)}/return-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...details }),
      });
      const data: ApiResponse<NonNullable<OrderItemAdmin['returnRequest']>> = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể cập nhật yêu cầu hoàn hàng.');
      setSelectedOrderDetails((current) => current ? { ...current, returnRequest: data.data } : current);
      setActionSuccessMessage(action === 'RECEIVE'
        ? `Đã xác nhận nhận lại và kiểm tra hàng của đơn [${orderNumber}].`
        : `Đã ghi nhận khoản chuyển khoản hoàn cho đơn [${orderNumber}].`);
      loadData();
      return true;
    } catch (error: unknown) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật yêu cầu hoàn hàng.');
      return false;
    } finally {
      setUpdatingReturnOrderNumber(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/dang-nhap');
    } catch {
      setActionErrorMessage('Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.');
    }
  };

  return {
    user, isAuthenticated, isAuthReady,
    activeTab, setActiveTab, queueRevision,
    actionSuccessMessage, setActionSuccessMessage,
    setActionErrorMessage, listError, visibleError, isLoading, loadData,
    verifyingOrderNum, updatingOrderNumber, deletingOrderNumber,
    updatingReturnOrderNumber,
    selectedReceiptPayment, setSelectedReceiptPayment,
    rejectingPayment, setRejectingPayment,
    rejectionReasonInput, setRejectionReasonInput,
    selectedOrderDetails, setSelectedOrderDetails,
    paymentsList, ordersList,
    handleVerifyPayment, handleRejectPayment, handleUpdateOrderStatus, handleDeleteOrder, handleOrderReturnAction, handleLogout,
  };
}
