'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/context/AuthContext';
import {
  User,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  ArrowRight,
  LogOut,
  ShieldCheck,
  QrCode,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface CustomerOrder {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentTiming: string;
  grandTotal: number;
  placedAt: string;
  shippingAddress: string;
  items: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payment: {
    paymentMethod: string;
    verificationStatus: string;
    amount: number;
  } | null;
}

export default function TaiKhoanPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, roleInfo } = useAuth();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  const formatVND = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/dang-nhap');
      return;
    }

    const fetchOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const res = await fetch(`/api/customer/orders?email=${encodeURIComponent(user.email)}`);
        const json = await res.json();
        if (json.success) {
          setOrders(json.data);
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.push('/dang-nhap');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-sm font-mono text-[#A5ADB8]">Đang chuyển hướng tới trang đăng nhập...</p>
      </div>
    );
  }

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return { label: 'Chờ Chuyển Khoản', color: '#D97706', bg: 'bg-[#D97706]/15 border-[#D97706]/30' };
      case 'CONFIRMED':
        return { label: 'Đã Xác Nhận Đơn', color: '#6F9576', bg: 'bg-[#6F9576]/15 border-[#6F9576]/30' };
      case 'IN_PRODUCTION':
        return { label: 'Đang In FDM Tại Xưởng', color: '#3B82F6', bg: 'bg-[#3B82F6]/15 border-[#3B82F6]/30' };
      case 'READY_TO_SHIP':
        return { label: 'Đã Đóng Gói Sẵn Sàng', color: '#8B5CF6', bg: 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30' };
      case 'COMPLETED':
        return { label: 'Đã Hoàn Thành', color: '#6F9576', bg: 'bg-[#6F9576]/15 border-[#6F9576]/30' };
      default:
        return { label: status, color: '#A5ADB8', bg: 'bg-[#A5ADB8]/15 border-[#A5ADB8]/30' };
    }
  };

  return (
    <div className="min-h-[85vh] max-w-7xl mx-auto px-4 sm:px-8 pt-28 sm:pt-32 pb-20 text-left space-y-8">
      
      {/* Tiêu đề & Thông tin Hồ sơ */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#141A21] border border-[#27313C] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#EB4037]/15 border border-[#EB4037]/30 flex items-center justify-center text-[#EB4037] font-bold text-xl font-mono">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">{user.fullName}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6F9576]/15 text-[#6F9576] font-bold border border-[#6F9576]/30">
                THÀNH VIÊN COLLECTOR
              </span>
            </div>
            <p className="text-xs text-[#A5ADB8] font-mono">
              Email: {user.email} {user.phone && `· SĐT: ${user.phone}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {user.role !== 'CUSTOMER' && (
            <Link
              href="/admin"
              className="py-2.5 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-mono font-semibold transition-colors flex items-center gap-2"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vào Cổng Quản Trị ({user.role})</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="py-2.5 px-4 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] text-xs font-mono border border-[#27313C] transition-colors flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Danh Sách Đơn Hàng Của Khách */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#F4F1EA] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#EB4037]" />
              <span>Lịch Sử Đơn Hàng Của Bạn</span>
            </h2>
            <p className="text-xs text-[#A5ADB8]">
              Theo dõi tình trạng đối soát thanh toán và tiến độ chế tác FDM của xưởng MinhLab.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (user) {
                setIsLoadingOrders(true);
                fetch(`/api/customer/orders?email=${encodeURIComponent(user.email)}`)
                  .then((r) => r.json())
                  .then((d) => d.success && setOrders(d.data))
                  .finally(() => setIsLoadingOrders(false));
              }
            }}
            className="p-2 rounded-lg bg-[#141A21] hover:bg-[#1A222C] border border-[#27313C] text-[#A5ADB8] text-xs flex items-center gap-1.5"
            title="Tải lại đơn hàng"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>

        {isLoadingOrders ? (
          <div className="p-12 text-center rounded-2xl bg-[#141A21] border border-[#27313C]">
            <p className="text-xs font-mono text-[#A5ADB8]">Đang tải dữ liệu đơn hàng...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#141A21] border border-[#27313C] space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center justify-center mx-auto text-[#737D89]">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#F4F1EA]">Bạn chưa có đơn hàng nào</h3>
              <p className="text-xs text-[#A5ADB8] max-w-sm mx-auto">
                Khám phá bộ sưu tập Art Toy độc bản hoặc gửi file 3D để chúng tôi gia công cho bạn.
              </p>
            </div>
            <Link
              href="/bo-suu-tap"
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors"
            >
              <span>Xem bộ sưu tập</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusBadge = getOrderStatusBadge(order.orderStatus);
              return (
                <div
                  key={order.orderNumber}
                  className="p-5 sm:p-6 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-4 text-xs font-mono"
                >
                  {/* Header Đơn hàng */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27313C]">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-[#EB4037]">{order.orderNumber}</span>
                      <span className="text-[#737D89]">·</span>
                      <span className="text-[#A5ADB8]">
                        {new Date(order.placedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded border text-[11px] font-bold ${statusBadge.bg}`}
                        style={{ color: statusBadge.color }}
                      >
                        {statusBadge.label}
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-[#6F9576]/15 border-[#6F9576]/30 text-[#6F9576]'
                            : 'bg-[#D97706]/15 border-[#D97706]/30 text-[#D97706]'
                        }`}
                      >
                        {order.paymentStatus === 'PAID' ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết sản phẩm */}
                  <div className="divide-y divide-[#27313C]/60 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center pt-2 first:pt-0">
                        <div className="text-[#F4F1EA]">
                          <span>{item.itemName}</span>
                          <span className="text-[#737D89] ml-2">x{item.quantity}</span>
                        </div>
                        <span className="font-bold text-[#F4F1EA]">{formatVND(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Footer Đơn hàng */}
                  <div className="pt-3 border-t border-[#27313C] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[#A5ADB8]">
                      <span>Giao đến: </span>
                      <span className="text-[#F4F1EA]">{order.shippingAddress}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[#737D89] block text-[10px]">Tổng đơn:</span>
                        <span className="text-base font-bold text-[#EB4037]">{formatVND(order.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
