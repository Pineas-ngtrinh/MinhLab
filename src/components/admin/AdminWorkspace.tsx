'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Boxes, ChevronLeft, ChevronRight, CreditCard, FileCheck, LayoutDashboard, LogOut, Package, Printer, RefreshCw, Search, Users } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { RoleCode } from '../../lib/auth-roles';
import { Button, Toast } from './ui';
import { PaymentsPanel } from './PaymentsPanel';
import { OrdersPanel } from './OrdersPanel';
import { AdminDialogs } from './AdminDialogs';
import { ProductionQueue } from './ProductionQueue';
import { AdminOverview } from './AdminOverview';
import { useAdminWorkspace } from './useAdminWorkspace';

const WORKSPACE_COPY: Record<RoleCode, { title: string; summary: string }> = {
  ADMIN: { title: 'Quản trị cửa hàng', summary: 'Theo dõi đơn hàng, thanh toán và hoạt động cửa hàng.' },
  WORKSHOP_OPERATOR: { title: 'Vận hành xưởng', summary: 'Quản lý dữ liệu sản phẩm, duyệt kế hoạch in và ghi nhận kiểm tra chất lượng.' },
  FILE_REVIEWER: { title: 'Duyệt tệp in', summary: 'Kiểm tra tệp STL và chuẩn bị tệp đã duyệt cho sản xuất.' },
  PRINT_OPERATOR: { title: 'Hàng đợi in', summary: 'Theo dõi việc in và cập nhật tiến độ tại xưởng.' },
  CUSTOMER: { title: 'Tài khoản khách hàng', summary: 'Theo dõi đơn hàng và tiến độ sản xuất.' },
};

type AdminTab = 'OVERVIEW' | 'PAYMENTS' | 'ORDERS' | 'FILE_REVIEW' | 'PRINTERS';

const TAB_COPY: Record<AdminTab, { label: string; icon: ReactNode }> = {
  OVERVIEW: { label: 'Tổng quan', icon: <LayoutDashboard aria-hidden="true" className="h-4 w-4" /> },
  ORDERS: { label: 'Đơn hàng', icon: <Boxes aria-hidden="true" className="h-4 w-4" /> },
  PAYMENTS: { label: 'Thanh toán', icon: <CreditCard aria-hidden="true" className="h-4 w-4" /> },
  FILE_REVIEW: { label: 'Báo giá & duyệt tệp', icon: <FileCheck aria-hidden="true" className="h-4 w-4" /> },
  PRINTERS: { label: 'Hàng đợi in', icon: <Printer aria-hidden="true" className="h-4 w-4" /> },
};

export function AdminWorkspace() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    user, isAuthenticated, isAuthReady,
    activeTab, setActiveTab, queueRevision,
    actionSuccessMessage, setActionSuccessMessage,
    setActionErrorMessage, listError, visibleError, isLoading, loadData,
    verifyingOrderNum, updatingOrderNumber, deletingOrderNumber, updatingReturnOrderNumber,
    selectedReceiptPayment, setSelectedReceiptPayment,
    rejectingPayment, setRejectingPayment,
    rejectionReasonInput, setRejectionReasonInput,
    selectedOrderDetails, setSelectedOrderDetails,
    paymentsList, ordersList,
    handleVerifyPayment, handleRejectPayment, handleUpdateOrderStatus, handleDeleteOrder, handleOrderReturnAction, handleLogout,
  } = useAdminWorkspace();

  if (!isAuthReady || !isAuthenticated || !user || user.role === 'CUSTOMER') {
    return <div className="admin-theme flex min-h-[65vh] items-center justify-center bg-admin-canvas px-4 text-sm text-admin-secondary" role="status">Đang kiểm tra tài khoản…</div>;
  }

  const role = user.role;
  const workspace = WORKSPACE_COPY[role];
  const canViewPayments = role === 'ADMIN';
  const canViewOrders = role === 'ADMIN';
  const canViewOverview = role === 'ADMIN';
  const canReviewFiles = role === 'ADMIN' || role === 'FILE_REVIEWER';
  const canViewPrinters = role === 'ADMIN' || role === 'PRINT_OPERATOR' || role === 'WORKSHOP_OPERATOR';
  const tabs: AdminTab[] = [
    ...(canViewOverview ? ['OVERVIEW' as const] : []),
    ...(canViewOrders ? ['ORDERS' as const] : []),
    ...(canViewPayments ? ['PAYMENTS' as const] : []),
    ...(canReviewFiles ? ['FILE_REVIEW' as const] : []),
    ...(canViewPrinters ? ['PRINTERS' as const] : []),
  ];
  const activeTitle = activeTab === 'OVERVIEW' ? 'Tổng quan' : TAB_COPY[activeTab].label;

  return (
    <div className="admin-theme h-dvh overflow-hidden bg-admin-canvas text-admin-text">
      <div className="flex h-full">
        <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-admin-border bg-admin-surface transition-[width] duration-150 lg:flex ${sidebarCollapsed ? 'w-16' : 'w-60'}`}>
          <div className={`relative flex h-14 items-center border-b border-admin-border px-3 ${sidebarCollapsed ? 'justify-center' : 'gap-2 px-5'}`}>
          <Link href="/" className="flex min-w-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-admin-accent" title="Về trang chủ MinhLab" aria-label="Về trang chủ MinhLab">
            <Image src="/images/logo.png" alt="" width={112} height={40} sizes={sidebarCollapsed ? '40px' : '112px'} className={`shrink-0 object-contain ${sidebarCollapsed ? 'h-4 w-10' : 'h-10 w-28'}`} />
          </Link>
          {!sidebarCollapsed && <Button variant="quiet" onClick={() => setSidebarCollapsed(true)} aria-label="Thu gọn thanh bên" title="Thu gọn thanh bên" className="ml-auto min-h-8 px-1.5"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button>}
          {sidebarCollapsed && <Button variant="quiet" onClick={() => setSidebarCollapsed(false)} aria-label="Mở rộng thanh bên" title="Mở rộng thanh bên" className="absolute right-0 top-1/2 min-h-8 -translate-y-1/2 px-1"><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
            {!sidebarCollapsed && <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-admin-muted">Không gian làm việc</p>}
            <nav aria-label="Điều hướng chính" className="space-y-1">
              {tabs.map((tab) => <WorkspaceNavButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} collapsed={sidebarCollapsed} />)}
            </nav>
            {!sidebarCollapsed && <p className="px-2 pb-2 pt-6 text-[11px] font-medium uppercase tracking-wide text-admin-muted">Quản lý</p>}
            <nav aria-label="Điều hướng quản lý" className="space-y-1">
              {(role === 'ADMIN' || role === 'WORKSHOP_OPERATOR') && <SidebarLink href="/admin/san-pham" icon={<Package aria-hidden="true" className="h-4 w-4" />} collapsed={sidebarCollapsed}>Sản phẩm & định mức</SidebarLink>}
              {(role === 'ADMIN' || role === 'WORKSHOP_OPERATOR') && <SidebarLink href="/admin/san-xuat" icon={<Printer aria-hidden="true" className="h-4 w-4" />} collapsed={sidebarCollapsed}>Thiết lập sản xuất</SidebarLink>}
              {role === 'ADMIN' && <SidebarLink href="/admin/nhan-su" icon={<Users aria-hidden="true" className="h-4 w-4" />} collapsed={sidebarCollapsed}>Tài khoản & phân quyền</SidebarLink>}
            </nav>
          </div>
          <div className="mt-auto border-t border-admin-border px-4 py-3">
            <SidebarLink href="/" icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />} collapsed={sidebarCollapsed}>Về cửa hàng</SidebarLink>
            {!sidebarCollapsed && <><p className="truncate text-sm font-medium text-admin-text">{user.fullName}</p><p className="truncate text-xs text-admin-muted">{user.email}</p></>}
            <Button variant="quiet" onClick={handleLogout} className={`${sidebarCollapsed ? 'mx-auto mt-1' : 'mt-2 w-full justify-start'} px-2 text-admin-secondary`} aria-label="Đăng xuất" title="Đăng xuất">
              <LogOut aria-hidden="true" className="h-4 w-4" /> {!sidebarCollapsed && 'Đăng xuất'}
            </Button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-admin-border bg-admin-surface px-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link href="/" className="flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent lg:hidden" aria-label="Về trang chủ MinhLab">
                <Image src="/images/logo.png" alt="" width={96} height={34} sizes="96px" className="h-7 w-24 object-contain" />
              </Link>
              {canViewOrders && activeTab !== 'PAYMENTS' && <label className="relative block min-w-0 w-full max-w-md">
                <span className="sr-only">Tìm đơn hàng và khách hàng</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
                <input
                  type="search"
                  value={ordersList.search}
                  onChange={(event) => { ordersList.setSearch(event.target.value); if (event.target.value) setActiveTab('ORDERS'); }}
                  placeholder="Tìm mã đơn, khách hàng hoặc số điện thoại…"
                  className="min-h-10 w-full rounded-md border border-admin-border bg-admin-canvas pl-9 pr-3 text-base sm:text-sm text-admin-text placeholder:text-admin-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent"
                />
              </label>}
              {(!canViewOrders || activeTab === 'PAYMENTS') && <p className="truncate text-sm font-medium text-admin-secondary">{workspace.title}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeTab !== 'OVERVIEW' && <Button variant="quiet" onClick={loadData} disabled={isLoading} className="h-10 w-10 px-2 text-admin-secondary" aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${isLoading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button>}
              <Link href="/lien-ket-telegram" className="inline-flex min-h-11 items-center rounded-md px-2 text-xs text-admin-accent focus-visible:ring-2 focus-visible:ring-admin-accent">Liên kết Telegram</Link>
              <span className="hidden max-w-44 truncate text-xs text-admin-secondary sm:inline">{user.fullName}</span>
              <Button variant="quiet" onClick={handleLogout} className="px-2 lg:hidden" aria-label="Đăng xuất">
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <nav aria-label="Điều hướng không gian làm việc" className="flex shrink-0 gap-1 overflow-x-auto overscroll-x-contain border-b border-admin-border bg-admin-surface px-3 py-2 lg:hidden">
            {tabs.map((tab) => <WorkspaceNavButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} compact />)}
            {(role === 'ADMIN' || role === 'WORKSHOP_OPERATOR') && <SidebarLink href="/admin/san-pham" icon={<Package aria-hidden="true" className="h-4 w-4" />}>Sản phẩm</SidebarLink>}
            {(role === 'ADMIN' || role === 'WORKSHOP_OPERATOR') && <SidebarLink href="/admin/san-xuat" icon={<Printer aria-hidden="true" className="h-4 w-4" />}>Sản xuất</SidebarLink>}
            {role === 'ADMIN' && <SidebarLink href="/admin/nhan-su" icon={<Users aria-hidden="true" className="h-4 w-4" />}>Phân quyền</SidebarLink>}
            <SidebarLink href="/" icon={<ChevronLeft aria-hidden="true" className="h-4 w-4" />}>Cửa hàng</SidebarLink>
          </nav>

          <section key={activeTab} aria-label={`Vùng làm việc: ${activeTitle}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-admin-info">
          <div className="mx-auto w-full max-w-screen-2xl space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            {activeTab === 'FILE_REVIEW' && <header className="border-b border-admin-border pb-4">
              <h1 className="text-xl font-semibold tracking-tight text-admin-text">{activeTitle}</h1>
              <p className="mt-1 text-sm text-admin-muted">{workspace.summary}</p>
            </header>}

            {(actionSuccessMessage || visibleError) && <div className="flex flex-wrap items-center gap-2">
              {actionSuccessMessage && <Toast tone="success" message={actionSuccessMessage} />}
              {visibleError && <Toast tone="danger" message={visibleError} />}
              {(actionSuccessMessage || visibleError) && <Button variant="quiet" onClick={() => { setActionSuccessMessage(''); setActionErrorMessage(''); if (listError) loadData(); }} aria-label="Ẩn thông báo" className="min-h-8 px-2">Ẩn thông báo</Button>}
            </div>}

            {canViewOverview && activeTab === 'OVERVIEW' && <AdminOverview key={queueRevision} onOpenOrders={() => setActiveTab('ORDERS')} />}
            {canViewPayments && activeTab === 'PAYMENTS' && <PaymentsPanel list={paymentsList} onReview={setSelectedReceiptPayment} />}
            {canViewOrders && activeTab === 'ORDERS' && <OrdersPanel list={ordersList} role={role} onViewPayments={() => setActiveTab('PAYMENTS')} onViewProduction={() => setActiveTab('PRINTERS')} actions={{ updatingOrderNumber, deletingOrderNumber, handleUpdateOrderStatus, handleDeleteOrder, setSelectedOrderDetails }} />}
            {canReviewFiles && activeTab === 'FILE_REVIEW' && <section className="space-y-3">
              <p className="text-sm text-admin-secondary">Kiểm tra tệp khách đã gửi, xác nhận phiên bản hiện tại và chuẩn bị báo giá.</p>
              <Link className="inline-flex min-h-9 items-center rounded-md border border-admin-border bg-admin-surface px-3 text-sm font-medium text-admin-accent hover:bg-admin-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" href="/yeu-cau-in">Mở danh sách yêu cầu báo giá</Link>
            </section>}
            {canViewPrinters && activeTab === 'PRINTERS' && <ProductionQueue key={`${user.id}:${queueRevision}`} scope={user.id} role={role} />}
          </div>
          </section>
        </div>
      </div>

      <AdminDialogs selectedReceiptPayment={selectedReceiptPayment} setSelectedReceiptPayment={setSelectedReceiptPayment} rejectingPayment={rejectingPayment} setRejectingPayment={setRejectingPayment} rejectionReasonInput={rejectionReasonInput} setRejectionReasonInput={setRejectionReasonInput} selectedOrderDetails={selectedOrderDetails} setSelectedOrderDetails={setSelectedOrderDetails} verifyingOrderNum={verifyingOrderNum} handleVerifyPayment={handleVerifyPayment} handleRejectPayment={handleRejectPayment} canProcessReturns={role === 'ADMIN'} updatingReturnOrderNumber={updatingReturnOrderNumber} handleOrderReturnAction={handleOrderReturnAction} />
    </div>
  );
}

function WorkspaceNavButton({ tab, active, onClick, compact = false, collapsed = false }: { tab: AdminTab; active: boolean; onClick: () => void; compact?: boolean; collapsed?: boolean }) {
  const item = TAB_COPY[tab];
  return <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} aria-label={item.label} title={collapsed ? item.label : undefined} className={`flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent ${compact ? 'shrink-0 whitespace-nowrap' : collapsed ? 'mx-auto w-10 justify-center px-0' : 'w-full'} ${active ? 'bg-admin-accent-soft font-medium text-admin-accent' : 'text-admin-secondary hover:bg-admin-subtle hover:text-admin-text'}`}>
    {item.icon}{(!collapsed || compact) && <span>{item.label}</span>}
  </button>;
}

function SidebarLink({ href, icon, children, collapsed = false }: { href: string; icon: ReactNode; children: ReactNode; collapsed?: boolean }) {
  return <Link href={href} title={collapsed ? String(children) : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-sm text-admin-secondary hover:bg-admin-subtle hover:text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent ${collapsed ? 'mx-auto w-10 justify-center px-0' : ''}`}>{icon}{!collapsed && <span>{children}</span>}</Link>;
}
