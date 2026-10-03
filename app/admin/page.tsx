'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/context/AuthContext';
import { RoleCode, ROLES } from '../../src/services/auth.service';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  FileCheck,
  Printer,
  Boxes,
  Layers,
  LogOut,
  ExternalLink,
  ChevronRight,
  Zap,
  DollarSign,
  Truck,
  Eye,
  Check,
  X,
  AlertTriangle,
  Download,
  Play,
  Pause,
  Sliders,
  Settings,
  Flame,
  FileText,
  Filter,
} from 'lucide-react';

interface PaymentItem {
  id: string;
  paymentNumber: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  paymentMethod: string;
  paymentPurpose: string;
  transactionReference: string;
  bankName: string;
  senderAccountName: string;
  transferredAt?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  attachments: string[];
  createdAt: string;
}

interface OrderItemAdmin {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  orderStatus: string;
  paymentStatus: string;
  paymentTiming: string;
  grandTotal: number;
  placedAt: string;
  itemsCount: number;
  customerNote?: string;
  items?: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    itemType: string;
    material?: string;
  }[];
}

// Interface cho Tệp in 3D (Mesh Review Station)
interface MeshReviewItem {
  id: string;
  fileName: string;
  fileFormat: '.STL' | '.STEP' | '.OBJ';
  fileSizeMB: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  materialRequested: string;
  layerHeightRequested: string;
  trianglesCount: number;
  dimensionsXYZ: string;
  estimatedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintTime: string;
  wallThicknessMinMm: number;
  maxOverhangAngleDeg: number;
  isWatertight: boolean;
  status: 'PENDING_REVIEW' | 'SLICER_OPTIMIZED' | 'NEEDS_REVISION';
  revisionNote?: string;
  quotedPriceVND?: number;
}

// Interface cho Máy in FDM (Fleet Telemetry)
interface PrinterMachine {
  id: string;
  name: string;
  model: string;
  status: 'PRINTING' | 'STANDBY' | 'PAUSED' | 'MAINTENANCE';
  progressPercent: number;
  currentOrderNumber?: string;
  currentJobName?: string;
  timeRemaining?: string;
  totalPrintTime?: string;
  nozzleTemp: number;
  nozzleTarget: number;
  bedTemp: number;
  bedTarget: number;
  coolingFanPercent: number;
  currentFilament: string;
  filamentRemainingGrams: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, role, isAuthenticated, logout, switchRoleQuickly } = useAuth();

  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'ORDERS' | 'FILE_REVIEW' | 'PRINTERS'>('FILE_REVIEW');
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [orders, setOrders] = useState<OrderItemAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');
  const [verifyingOrderNum, setVerifyingOrderNum] = useState<string | null>(null);

  // Bộ lọc
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY_TO_SHIP' | 'COMPLETED'>('ALL');
  const [meshFilter, setMeshFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'SLICER_OPTIMIZED' | 'NEEDS_REVISION'>('ALL');

  // Modals
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentItem | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentItem | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('Chưa nhận được giao dịch chuyển khoản vào tài khoản ngân hàng');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderItemAdmin | null>(null);
  const [selectedMeshSpec, setSelectedMeshSpec] = useState<MeshReviewItem | null>(null);
  const [revisingMeshItem, setRevisingMeshItem] = useState<MeshReviewItem | null>(null);
  const [revisionNoteInput, setRevisionNoteInput] = useState('Độ dày thành vỏ mỏng <1.0mm tại các khớp nối, nguy cơ gãy khi in FDM. Vui lòng làm dày tối thiểu 1.5mm.');

  // Dữ liệu mẫu Ban Thẩm Định Tệp 3D
  const [meshItems, setMeshItems] = useState<MeshReviewItem[]>([
    {
      id: 'mesh-01',
      fileName: 'mech_monkey_custom_armor.stl',
      fileFormat: '.STL',
      fileSizeMB: 18.4,
      orderNumber: 'ML-849201',
      customerName: 'Trần Nam Phong',
      customerPhone: '0912.345.678',
      materialRequested: 'PLA-CF Carbon (Đen nhám)',
      layerHeightRequested: '0.12mm (Siêu mịn)',
      trianglesCount: 485000,
      dimensionsXYZ: '85 x 64 x 115 mm',
      estimatedVolumeCm3: 48.5,
      estimatedWeightGrams: 60,
      estimatedPrintTime: '4 giờ 30 phút',
      wallThicknessMinMm: 1.8,
      maxOverhangAngleDeg: 52,
      isWatertight: true,
      status: 'PENDING_REVIEW',
      quotedPriceVND: 350000,
    },
    {
      id: 'mesh-02',
      fileName: 'desk_headphone_hook_heavy.step',
      fileFormat: '.STEP',
      fileSizeMB: 24.2,
      orderNumber: 'ML-724183',
      customerName: 'Vũ Hoàng Long',
      customerPhone: '0988.112.233',
      materialRequested: 'PETG Kháng lực (Xám Titan)',
      layerHeightRequested: '0.16mm (Chuẩn)',
      trianglesCount: 210000,
      dimensionsXYZ: '140 x 50 x 80 mm',
      estimatedVolumeCm3: 75.0,
      estimatedWeightGrams: 92,
      estimatedPrintTime: '5 giờ 15 phút',
      wallThicknessMinMm: 2.4,
      maxOverhangAngleDeg: 35,
      isWatertight: true,
      status: 'SLICER_OPTIMIZED',
      quotedPriceVND: 290000,
    },
    {
      id: 'mesh-03',
      fileName: 'mini_diorama_building_corner.stl',
      fileFormat: '.STL',
      fileSizeMB: 42.0,
      orderNumber: 'ML-910452',
      customerName: 'Nguyễn Minh Quân',
      customerPhone: '0903.456.789',
      materialRequested: 'PLA+ Nguyên sinh (Trắng sứ)',
      layerHeightRequested: '0.12mm (Siêu mịn)',
      trianglesCount: 720000,
      dimensionsXYZ: '120 x 120 x 95 mm',
      estimatedVolumeCm3: 110.0,
      estimatedWeightGrams: 135,
      estimatedPrintTime: '8 giờ 20 phút',
      wallThicknessMinMm: 0.8,
      maxOverhangAngleDeg: 65,
      isWatertight: false,
      status: 'NEEDS_REVISION',
      revisionNote: 'Phát hiện thành mỏng 0.8mm tại ban công lầu 2 và góc overhang 65° có rủi ro sập khi in FDM không support.',
      quotedPriceVND: 480000,
    },
    {
      id: 'mesh-04',
      fileName: 'custom_cooling_duct_v3.stl',
      fileFormat: '.STL',
      fileSizeMB: 8.6,
      orderNumber: 'ML-638291',
      customerName: 'Bùi Thành Đạt',
      customerPhone: '0977.890.123',
      materialRequested: 'ABS Chịu nhiệt (Đen tuyền)',
      layerHeightRequested: '0.16mm (Chuẩn)',
      trianglesCount: 145000,
      dimensionsXYZ: '60 x 45 x 35 mm',
      estimatedVolumeCm3: 22.0,
      estimatedWeightGrams: 28,
      estimatedPrintTime: '1 giờ 45 phút',
      wallThicknessMinMm: 1.6,
      maxOverhangAngleDeg: 40,
      isWatertight: true,
      status: 'PENDING_REVIEW',
      quotedPriceVND: 180000,
    },
  ]);

  // Dữ liệu cụm máy in FDM
  const [printers, setPrinters] = useState<PrinterMachine[]>([
    {
      id: 'printer-01',
      name: 'Máy 01 — Bambu Lab X1-Carbon #01',
      model: 'Bambu Lab X1-Carbon (CoreXY / Buồng Kín)',
      status: 'PRINTING',
      progressPercent: 78,
      currentOrderNumber: 'ML-849201',
      currentJobName: 'Mascot Khỉ Kỹ Sư MinhLab (Giáp Vàng)',
      timeRemaining: '1h 05m',
      totalPrintTime: '4h 30m',
      nozzleTemp: 215,
      nozzleTarget: 215,
      bedTemp: 55,
      bedTarget: 55,
      coolingFanPercent: 100,
      currentFilament: 'PLA-CF Carbon (Đen Nhám)',
      filamentRemainingGrams: 620,
    },
    {
      id: 'printer-02',
      name: 'Máy 02 — Prusa MK4 #02',
      model: 'Prusa MK4 (Nextruder / Bàn PEI Sần)',
      status: 'PRINTING',
      progressPercent: 45,
      currentOrderNumber: 'ML-724183',
      currentJobName: 'Giá Treo Tai Nghe Cân Bằng FDM',
      timeRemaining: '2h 45m',
      totalPrintTime: '5h 15m',
      nozzleTemp: 240,
      nozzleTarget: 240,
      bedTemp: 80,
      bedTarget: 80,
      coolingFanPercent: 60,
      currentFilament: 'PETG Kháng Lực (Xám Titan)',
      filamentRemainingGrams: 480,
    },
    {
      id: 'printer-03',
      name: 'Máy 03 — Creality K1 Max #03',
      model: 'Creality K1 Max (Khổ 300x300mm / 600mm/s)',
      status: 'PRINTING',
      progressPercent: 92,
      currentOrderNumber: 'ML-910452',
      currentJobName: 'Mô Hình Diorama Phòng Lab Mini',
      timeRemaining: '35m',
      totalPrintTime: '8h 20m',
      nozzleTemp: 220,
      nozzleTarget: 220,
      bedTemp: 60,
      bedTarget: 60,
      coolingFanPercent: 100,
      currentFilament: 'PLA Tough (Trắng Sứ)',
      filamentRemainingGrams: 310,
    },
    {
      id: 'printer-04',
      name: 'Máy 04 — Voron 2.4 Pro Custom #04',
      model: 'Voron 2.4r2 (Flying Gantry / Buồng Sấy 65°C)',
      status: 'STANDBY',
      progressPercent: 0,
      nozzleTemp: 25,
      nozzleTarget: 0,
      bedTemp: 25,
      bedTarget: 0,
      coolingFanPercent: 0,
      currentFilament: 'Sẵn sàng nạp cuộn nhựa mới',
      filamentRemainingGrams: 1000,
    },
  ]);

  const formatVND = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // Tải dữ liệu ban đầu
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resPay, resOrd] = await Promise.all([
        fetch('/api/admin/payments'),
        fetch('/api/admin/orders'),
      ]);
      const dataPay = await resPay.json();
      const dataOrd = await resOrd.json();

      if (dataPay.success) setPayments(dataPay.data);
      if (dataOrd.success) setOrders(dataOrd.data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/dang-nhap');
      return;
    }

    // Tự động chuyển tab phù hợp với vai trò người dùng
    if (user.role === 'FILE_REVIEWER') setActiveTab('FILE_REVIEW');
    else if (user.role === 'PRINT_OPERATOR') setActiveTab('PRINTERS');
    else if (user.role === 'STAFF') setActiveTab('PAYMENTS');
    else setActiveTab('FILE_REVIEW');

    loadData();
  }, [isAuthenticated, user, router]);

  // Hành động Kế toán: Xác nhận tiền về (Verify)
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
          verifiedBy: user?.fullName || 'STAFF_ACCOUNTANT',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xác nhận thanh toán thất bại.');
      }

      setActionSuccessMessage(
        `Đã xác nhận tiền về cho đơn [${orderNumber}] thành công! Hệ thống đã tự động gửi email thông báo tới khách hàng.`
      );

      await loadData();
    } catch (err: unknown) {
      setActionErrorMessage(err instanceof Error ? err.message : 'Lỗi khi duyệt thanh toán');
    } finally {
      setVerifyingOrderNum(null);
    }
  };

  // Hành động Kế toán: Từ chối thanh toán (Reject)
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
          rejectedBy: user?.fullName || 'STAFF_ACCOUNTANT',
          reason: rejectionReasonInput,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Từ chối thanh toán thất bại.');
      }

      setActionSuccessMessage(`Đã từ chối giao dịch của đơn [${rejectingPayment.orderNumber}].`);
      setRejectingPayment(null);
      await loadData();
    } catch (err: unknown) {
      setActionErrorMessage(err instanceof Error ? err.message : 'Lỗi khi từ chối');
    }
  };

  // Hành động: Cập nhật trạng thái đơn hàng
  const handleUpdateOrderStatus = async (orderNumber: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMessage(`Đã chuyển đơn [${orderNumber}] sang trạng thái: ${newStatus}`);
        await loadData();
      }
    } catch {
      // ignore
    }
  };

  // Hành động Kỹ sư 3D: Duyệt File sang Slicer
  const handleApproveMeshItem = (meshId: string) => {
    setMeshItems((prev) =>
      prev.map((item) =>
        item.id === meshId ? { ...item, status: 'SLICER_OPTIMIZED' } : item
      )
    );
    setActionSuccessMessage('Đã duyệt file 3D và tối ưu thông số cắt lớp Slicer thành công!');
  };

  // Hành động Kỹ sư 3D: Gửi yêu cầu sửa mesh
  const handleConfirmRevisionNote = () => {
    if (!revisingMeshItem) return;
    setMeshItems((prev) =>
      prev.map((item) =>
        item.id === revisingMeshItem.id
          ? { ...item, status: 'NEEDS_REVISION', revisionNote: revisionNoteInput }
          : item
      )
    );
    setActionSuccessMessage(`Đã lưu yêu cầu chỉnh sửa cho file [${revisingMeshItem.fileName}].`);
    setRevisingMeshItem(null);
  };

  // Hành động Thợ in: Tạm dừng / Tiếp tục in
  const handleTogglePrinterPause = (printerId: string) => {
    setPrinters((prev) =>
      prev.map((p) => {
        if (p.id === printerId) {
          const nextStatus = p.status === 'PRINTING' ? 'PAUSED' : 'PRINTING';
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
  };

  // Hành động Thợ in: Báo in hoàn tất 100%
  const handleCompletePrintJob = (printerId: string) => {
    const target = printers.find((p) => p.id === printerId);
    if (!target) return;

    setPrinters((prev) =>
      prev.map((p) =>
        p.id === printerId
          ? {
              ...p,
              status: 'STANDBY',
              progressPercent: 0,
              currentJobName: undefined,
              timeRemaining: undefined,
              currentOrderNumber: undefined,
            }
          : p
      )
    );

    if (target.currentOrderNumber) {
      handleUpdateOrderStatus(target.currentOrderNumber, 'READY_TO_SHIP');
    }

    setActionSuccessMessage(
      `Máy in [${target.name}] đã hoàn tất in thành công! Đơn [${target.currentOrderNumber || ''}] đã được chuyển sang trạng thái SẴN SÀNG ĐÓNG GÓI.`
    );
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center pt-28">
        <p className="text-sm font-mono text-[#A5ADB8]">Đang chuyển hướng tới trang đăng nhập...</p>
      </div>
    );
  }

  const roleInfo = ROLES[user.role];

  // Tính toán bộ lọc
  const filteredPayments = payments.filter((p) => {
    if (paymentFilter === 'ALL') return true;
    return p.verificationStatus === paymentFilter;
  });

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'ALL') return true;
    return o.orderStatus === orderFilter;
  });

  const filteredMeshItems = meshItems.filter((m) => {
    if (meshFilter === 'ALL') return true;
    return m.status === meshFilter;
  });

  const totalVerifiedRevenue = payments
    .filter((p) => p.verificationStatus === 'VERIFIED')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPendingRevenue = payments
    .filter((p) => p.verificationStatus === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-[90vh] max-w-7xl mx-auto px-4 sm:px-8 pt-28 sm:pt-32 pb-20 text-left space-y-6">
      
      {/* ============================================================== */}
      {/* THANH HEADER BÀN QUẢN TRỊ VIÊN                                  */}
      {/* ============================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#141A21] border border-[#27313C] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-base text-white shadow-md shrink-0"
            style={{ backgroundColor: roleInfo.badgeColor }}
          >
            {user.role === 'ADMIN' ? 'AD' : user.role === 'STAFF' ? 'KT' : user.role === 'FILE_REVIEWER' ? 'KS' : 'TO'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-[#F4F1EA]">{user.fullName}</h1>
              <span
                className="text-[10px] font-mono px-2.5 py-0.5 rounded font-bold border uppercase tracking-wider"
                style={{
                  color: roleInfo.badgeColor,
                  borderColor: `${roleInfo.badgeColor}40`,
                  backgroundColor: `${roleInfo.badgeColor}15`,
                }}
              >
                {roleInfo.name}
              </span>
            </div>
            <p className="text-xs text-[#A5ADB8] font-mono flex items-center gap-2">
              <span>Bàn Làm Việc Studio MinhLab</span>
              <span>·</span>
              <span className="text-[#F4F1EA]">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Thanh chuyển vai trò nhanh (Demo Role Switcher) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0F141A] p-1.5 rounded-xl border border-[#27313C] self-stretch md:self-auto">
          <span className="text-[10px] font-mono text-[#737D89] px-2 flex items-center gap-1 font-bold">
            <Zap className="w-3 h-3 text-[#D48955]" />
            <span>TEST VAI TRÒ:</span>
          </span>
          {(['STAFF', 'FILE_REVIEWER', 'PRINT_OPERATOR', 'ADMIN'] as RoleCode[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => switchRoleQuickly(r)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                user.role === r
                  ? 'bg-[#EB4037] text-white shadow-sm'
                  : 'bg-[#141A21] text-[#A5ADB8] hover:text-[#F4F1EA] hover:bg-[#1A222C]'
              }`}
            >
              {r === 'STAFF' ? 'Kế Toán' : r === 'FILE_REVIEWER' ? 'Kỹ Sư 3D' : r === 'PRINT_OPERATOR' ? 'Thợ In' : 'Admin'}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/dang-nhap');
            }}
            className="p-1.5 rounded text-[#737D89] hover:text-[#EB4037] ml-1 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thông báo thao tác */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-[#6F9576]/15 border border-[#6F9576]/40 flex items-start justify-between gap-3 text-xs text-[#6F9576]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button type="button" onClick={() => setActionSuccessMessage('')} className="hover:opacity-70">
            &times;
          </button>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-3.5 rounded-xl bg-[#EB4037]/15 border border-[#EB4037]/40 flex items-start justify-between gap-3 text-xs text-[#EB4037]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionErrorMessage}</span>
          </div>
          <button type="button" onClick={() => setActionErrorMessage('')} className="hover:opacity-70">
            &times;
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* THANH TABS 4 TRẠM CHUYÊN MÔN                                   */}
      {/* ============================================================== */}
      <div className="flex items-center gap-2 border-b border-[#27313C] pb-3 overflow-x-auto text-xs font-mono scrollbar-thin">
        {/* Tab 1: Kế toán */}
        <button
          type="button"
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'PAYMENTS'
              ? 'bg-[#D97706] text-white shadow-md'
              : 'bg-[#141A21] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Kế Toán — Đối Soát VietQR</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/30">
            {payments.filter((p) => p.verificationStatus === 'PENDING').length}
          </span>
        </button>

        {/* Tab 2: Quản lý đơn hàng */}
        <button
          type="button"
          onClick={() => setActiveTab('ORDERS')}
          className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ORDERS'
              ? 'bg-[#EB4037] text-white shadow-md'
              : 'bg-[#141A21] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Quản Lý Đơn Hàng</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/30">{orders.length}</span>
        </button>

        {/* Tab 3: Thẩm định 3D */}
        <button
          type="button"
          onClick={() => setActiveTab('FILE_REVIEW')}
          className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'FILE_REVIEW'
              ? 'bg-[#3B82F6] text-white shadow-md'
              : 'bg-[#141A21] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C]'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Kỹ Sư — Thẩm Định File 3D</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/30">
            {meshItems.filter((m) => m.status === 'PENDING_REVIEW').length}
          </span>
        </button>

        {/* Tab 4: Cụm máy in */}
        <button
          type="button"
          onClick={() => setActiveTab('PRINTERS')}
          className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'PRINTERS'
              ? 'bg-[#8B5CF6] text-white shadow-md'
              : 'bg-[#141A21] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C]'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Xưởng FDM — Cụm Máy In</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/30">
            {printers.filter((p) => p.status === 'PRINTING').length}/4
          </span>
        </button>

        <button
          type="button"
          onClick={loadData}
          className="ml-auto p-2 rounded-lg bg-[#141A21] hover:bg-[#1A222C] border border-[#27313C] text-[#A5ADB8] shrink-0"
          title="Tải lại dữ liệu"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: KẾ TOÁN & ĐỐI SOÁT THANH TOÁN (STAFF / ADMIN)            */}
      {/* ============================================================== */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-4">
          
          {/* Card Thống Kê Tài Chính Đối Soát */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#141A21] border border-[#27313C] space-y-1">
              <span className="text-[11px] font-mono text-[#737D89]">TỔNG TIỀN ĐÃ DUYỆT (VERIFIED):</span>
              <p className="text-xl font-bold text-[#6F9576] font-mono">{formatVND(totalVerifiedRevenue)}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#141A21] border border-[#27313C] space-y-1">
              <span className="text-[11px] font-mono text-[#737D89]">TIỀN CHỜ ĐỐI SOÁT (PENDING):</span>
              <p className="text-xl font-bold text-[#D97706] font-mono">{formatVND(totalPendingRevenue)}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#141A21] border border-[#27313C] space-y-1">
              <span className="text-[11px] font-mono text-[#737D89]">SỐ GIAO DỊCH VIETQR:</span>
              <p className="text-xl font-bold text-[#F4F1EA] font-mono">{payments.length} Giao dịch</p>
            </div>
          </div>

          {/* Bộ lọc trạng thái */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-[#0F141A] p-1 rounded-lg border border-[#27313C]">
              {(['ALL', 'PENDING', 'VERIFIED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setPaymentFilter(st)}
                  className={`px-3 py-1 rounded text-[11px] transition-all ${
                    paymentFilter === st
                      ? 'bg-[#D97706] text-white font-bold'
                      : 'text-[#A5ADB8] hover:text-[#F4F1EA]'
                  }`}
                >
                  {st === 'ALL' ? 'Tất cả' : st === 'PENDING' ? 'Chờ duyệt' : st === 'VERIFIED' ? 'Đã xác nhận' : 'Từ chối'}
                </button>
              ))}
            </div>
            <span className="text-[#737D89] text-[11px]">
              Hiển thị {filteredPayments.length} giao dịch
            </span>
          </div>

          {/* Bảng danh sách thanh toán */}
          <div className="overflow-x-auto rounded-2xl border border-[#27313C] bg-[#141A21]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0F141A] text-[#737D89] uppercase border-b border-[#27313C] text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Mã Đơn</th>
                  <th className="p-4">Khách Hàng</th>
                  <th className="p-4">Số Tiền</th>
                  <th className="p-4">Mã Giao Dịch Ngân Hàng</th>
                  <th className="p-4">Người Chuyển</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 text-right">Thao Tác Kế Toán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27313C]">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#737D89]">
                      Không có khoản thanh toán VietQR nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const isPending = p.verificationStatus === 'PENDING';
                    const isVerified = p.verificationStatus === 'VERIFIED';
                    const isRejected = p.verificationStatus === 'REJECTED';

                    return (
                      <tr key={p.id} className="hover:bg-[#1A222C]/60 transition-colors">
                        <td className="p-4 font-bold text-[#EB4037]">{p.orderNumber}</td>
                        <td className="p-4">
                          <div className="font-medium text-[#F4F1EA]">{p.customerName}</div>
                          <div className="text-[10px] text-[#737D89]">{p.customerPhone}</div>
                        </td>
                        <td className="p-4 font-bold text-[#F4F1EA]">{formatVND(p.amount)}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-[#0F141A] border border-[#27313C] text-[#A5ADB8]">
                            {p.transactionReference || 'Chưa khai báo'}
                          </span>
                          <span className="block text-[10px] text-[#737D89] mt-0.5">{p.bankName || 'MB Bank'}</span>
                        </td>
                        <td className="p-4 text-[#A5ADB8]">{p.senderAccountName || '—'}</td>
                        <td className="p-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#D97706]/15 border border-[#D97706]/30 text-[#D97706] font-bold text-[10px] animate-pulse">
                              <Clock className="w-3 h-3" />
                              CHỜ DUYỆT
                            </span>
                          )}
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#6F9576]/15 border border-[#6F9576]/30 text-[#6F9576] font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              ĐÃ XÁC NHẬN
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#EB4037]/15 border border-[#EB4037]/30 text-[#EB4037] font-bold text-[10px]">
                              <AlertCircle className="w-3 h-3" />
                              TỪ CHỐI
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptPayment(p)}
                              className="p-1.5 rounded bg-[#0F141A] hover:bg-[#1A222C] border border-[#27313C] text-[#A5ADB8] hover:text-[#F4F1EA]"
                              title="Xem biên lai"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  disabled={verifyingOrderNum === p.orderNumber}
                                  onClick={() => handleVerifyPayment(p.orderNumber)}
                                  className="py-1 px-3 rounded-lg bg-[#6F9576] hover:bg-[#5E8364] text-white font-bold text-[11px] transition-all shadow-sm flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{verifyingOrderNum === p.orderNumber ? 'Đang duyệt...' : 'Duyệt tiền'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingPayment(p);
                                    setRejectionReasonInput('Chưa nhận được giao dịch chuyển khoản vào tài khoản MB Bank');
                                  }}
                                  className="py-1 px-2 rounded-lg bg-[#EB4037]/15 hover:bg-[#EB4037]/30 text-[#EB4037] border border-[#EB4037]/30 text-[11px] font-bold transition-all"
                                  title="Từ chối thanh toán"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {isVerified && (
                              <span className="text-[10px] text-[#737D89]">
                                Duyệt bởi: {p.verifiedBy || 'STAFF'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: QUẢN LÝ TẤT CẢ ĐƠN HÀNG (STAFF / ADMIN)                  */}
      {/* ============================================================== */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          
          {/* Bộ lọc đơn hàng */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-[#0F141A] p-1 rounded-lg border border-[#27313C]">
              {(['ALL', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'COMPLETED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOrderFilter(st)}
                  className={`px-3 py-1 rounded text-[11px] transition-all ${
                    orderFilter === st
                      ? 'bg-[#EB4037] text-white font-bold'
                      : 'text-[#A5ADB8] hover:text-[#F4F1EA]'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Tất cả'
                    : st === 'CONFIRMED'
                    ? 'Đã xác nhận'
                    : st === 'IN_PRODUCTION'
                    ? 'Đang in'
                    : st === 'READY_TO_SHIP'
                    ? 'Sẵn sàng giao'
                    : 'Hoàn thành'}
                </button>
              ))}
            </div>
            <span className="text-[#737D89] text-[11px]">
              Tổng số {filteredOrders.length} đơn hàng
            </span>
          </div>

          {/* Bảng danh sách đơn hàng */}
          <div className="overflow-x-auto rounded-2xl border border-[#27313C] bg-[#141A21]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0F141A] text-[#737D89] uppercase border-b border-[#27313C] text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Mã Đơn</th>
                  <th className="p-4">Khách Hàng</th>
                  <th className="p-4">Địa Chỉ Giao</th>
                  <th className="p-4">Phương Thức</th>
                  <th className="p-4">Tổng Tiền</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 text-right">Thao Tác Sản Xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27313C]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#737D89]">
                      Không có đơn hàng nào trong mục này.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.orderNumber} className="hover:bg-[#1A222C]/60 transition-colors">
                      <td className="p-4 font-bold text-[#EB4037]">{o.orderNumber}</td>
                      <td className="p-4">
                        <div className="font-medium text-[#F4F1EA]">{o.customerName}</div>
                        <div className="text-[10px] text-[#737D89]">{o.customerPhone}</div>
                      </td>
                      <td className="p-4 max-w-xs truncate text-[#A5ADB8]">{o.shippingAddress}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-[#0F141A] border border-[#27313C] text-[11px] font-bold">
                          {o.paymentTiming === 'COD' ? '🚚 COD (Tiền mặt)' : '⚡ VietQR'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-[#F4F1EA]">{formatVND(o.grandTotal)}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-[#0F141A] border border-[#27313C] text-[11px] font-bold text-[#D48955]">
                          {o.orderStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(o)}
                            className="p-1.5 rounded bg-[#0F141A] hover:bg-[#1A222C] border border-[#27313C] text-[#A5ADB8] hover:text-[#F4F1EA]"
                            title="Xem chi tiết đơn"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {o.orderStatus === 'CONFIRMED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(o.orderNumber, 'IN_PRODUCTION')}
                              className="py-1 px-2.5 rounded bg-[#3B82F6]/15 hover:bg-[#3B82F6]/30 text-[#3B82F6] border border-[#3B82F6]/30 text-[10px] font-bold"
                            >
                              Đưa vào in FDM
                            </button>
                          )}
                          {o.orderStatus === 'IN_PRODUCTION' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(o.orderNumber, 'READY_TO_SHIP')}
                              className="py-1 px-2.5 rounded bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/30 text-[#8B5CF6] border border-[#8B5CF6]/30 text-[10px] font-bold"
                            >
                              Đóng gói xong
                            </button>
                          )}
                          {o.orderStatus === 'READY_TO_SHIP' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(o.orderNumber, 'COMPLETED')}
                              className="py-1 px-2.5 rounded bg-[#6F9576]/15 hover:bg-[#6F9576]/30 text-[#6F9576] border border-[#6F9576]/30 text-[10px] font-bold"
                            >
                              Giao thành công
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: TRẠM KỸ SƯ THẨM ĐỊNH FILE 3D (FILE_REVIEWER / ADMIN)     */}
      {/* ============================================================== */}
      {activeTab === 'FILE_REVIEW' && (
        <div className="space-y-4 text-xs font-mono">
          
          {/* Header Bàn Thẩm Định Mesh Doctor */}
          <div className="p-5 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#F4F1EA] flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#3B82F6]" />
                  <span>Trạm Kỹ Sư Thẩm Định File Lưới 3D (.STL, .STEP, .OBJ)</span>
                </h3>
                <p className="text-xs text-[#A5ADB8] mt-1">
                  Kiểm tra độ dày thành vỏ (&gt;1.2mm), góc nghiêng support overhang, đếm số đa giác lưới và xuất thông số cắt lớp G-code.
                </p>
              </div>

              {/* Bộ lọc trạng thái file */}
              <div className="flex items-center gap-1.5 bg-[#0F141A] p-1 rounded-lg border border-[#27313C] shrink-0">
                {(['ALL', 'PENDING_REVIEW', 'SLICER_OPTIMIZED', 'NEEDS_REVISION'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setMeshFilter(st)}
                    className={`px-3 py-1 rounded text-[11px] transition-all ${
                      meshFilter === st
                        ? 'bg-[#3B82F6] text-white font-bold'
                        : 'text-[#A5ADB8] hover:text-[#F4F1EA]'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Tất cả'
                      : st === 'PENDING_REVIEW'
                      ? 'Chờ thẩm định'
                      : st === 'SLICER_OPTIMIZED'
                      ? 'Đã tối ưu Slicer'
                      : 'Cần sửa file'}
                  </button>
                ))}
              </div>
            </div>

            {/* Thống kê nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">TỔNG FILE ĐÃ TIẾP NHẬN:</span>
                <span className="font-bold text-base text-[#F4F1EA] block">{meshItems.length} Tệp 3D</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">ĐÃ TỐI ƯU SLICER (SẴN SÀNG IN):</span>
                <span className="font-bold text-base text-[#6F9576] block">
                  {meshItems.filter((m) => m.status === 'SLICER_OPTIMIZED').length} Tệp
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">CẦN KHÁCH SỬA MESH:</span>
                <span className="font-bold text-base text-[#D97706] block">
                  {meshItems.filter((m) => m.status === 'NEEDS_REVISION').length} Tệp
                </span>
              </div>
            </div>
          </div>

          {/* Danh sách các tệp 3D thực tế cần thẩm định */}
          <div className="space-y-3">
            {filteredMeshItems.map((item) => {
              const isPending = item.status === 'PENDING_REVIEW';
              const isOptimized = item.status === 'SLICER_OPTIMIZED';
              const isRevision = item.status === 'NEEDS_REVISION';

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-[#141A21] border border-[#27313C] hover:border-[#3B82F6]/50 transition-all space-y-4 shadow-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#27313C] pb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6] font-bold text-xs">
                        {item.fileFormat}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-[#F4F1EA]">{item.fileName}</h4>
                        <p className="text-[11px] text-[#A5ADB8]">
                          Đơn: <strong className="text-[#EB4037]">{item.orderNumber}</strong> · Khách:{' '}
                          {item.customerName} ({item.customerPhone})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <span className="px-2.5 py-1 rounded bg-[#D97706]/15 border border-[#D97706]/30 text-[#D97706] font-bold text-[10px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          CHỜ THẨM ĐỊNH
                        </span>
                      )}
                      {isOptimized && (
                        <span className="px-2.5 py-1 rounded bg-[#6F9576]/15 border border-[#6F9576]/30 text-[#6F9576] font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          ĐÃ TỐI ƯU SLICER (SẴN SÀNG IN)
                        </span>
                      )}
                      {isRevision && (
                        <span className="px-2.5 py-1 rounded bg-[#EB4037]/15 border border-[#EB4037]/30 text-[#EB4037] font-bold text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          CẦN KHÁCH SỬA MESH
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thông số kỹ thuật chi tiết của tệp 3D */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C]">
                      <span className="text-[#737D89] block text-[10px]">ĐA GIÁC (TRIANGLES):</span>
                      <strong className="text-[#F4F1EA] text-xs">{item.trianglesCount.toLocaleString()} tris</strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C]">
                      <span className="text-[#737D89] block text-[10px]">KÍCH THƯỚC PHỦ BÌ:</span>
                      <strong className="text-[#F4F1EA] text-xs">{item.dimensionsXYZ}</strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C]">
                      <span className="text-[#737D89] block text-[10px]">THỂ TÍCH & NHỰA:</span>
                      <strong className="text-[#F4F1EA] text-xs">
                        {item.estimatedVolumeCm3} cm³ (~{item.estimatedWeightGrams}g)
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C]">
                      <span className="text-[#737D89] block text-[10px]">THỜI GIAN CHẠY MÁY:</span>
                      <strong className="text-[#6F9576] text-xs">{item.estimatedPrintTime}</strong>
                    </div>
                  </div>

                  {/* Kiểm tra an toàn Mesh Doctor */}
                  <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] flex flex-wrap items-center justify-between gap-3 text-[11px]">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#737D89]">Thành mỏng nhất:</span>
                        <span
                          className={`font-bold ${
                            item.wallThicknessMinMm >= 1.2 ? 'text-[#6F9576]' : 'text-[#EB4037]'
                          }`}
                        >
                          {item.wallThicknessMinMm} mm {item.wallThicknessMinMm >= 1.2 ? '(ĐẠT)' : '(QUÁ MỎNG <1.2mm)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[#737D89]">Góc Overhang lớn nhất:</span>
                        <span
                          className={`font-bold ${
                            item.maxOverhangAngleDeg > 45 ? 'text-[#D97706]' : 'text-[#6F9576]'
                          }`}
                        >
                          {item.maxOverhangAngleDeg}° {item.maxOverhangAngleDeg > 45 ? '(Cần Tree Support)' : '(An toàn)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[#737D89]">Kín khít Manifold:</span>
                        <span className={`font-bold ${item.isWatertight ? 'text-[#6F9576]' : 'text-[#EB4037]'}`}>
                          {item.isWatertight ? 'Watertight OK' : 'Có Lỗ Thủng Mesh'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-bold text-xs text-[#EB4037]">
                      Giá gia công dự tính: {formatVND(item.quotedPriceVND || 0)}
                    </div>
                  </div>

                  {/* Ghi chú phản hồi lỗi nếu có */}
                  {item.revisionNote && (
                    <div className="p-3 rounded-xl bg-[#EB4037]/10 border border-[#EB4037]/30 text-[#EB4037] text-[11px] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{item.revisionNote}</span>
                    </div>
                  )}

                  {/* Thao tác kỹ sư */}
                  <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedMeshSpec(item)}
                      className="px-3 py-1.5 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] border border-[#27313C] text-[#F4F1EA] text-[11px] flex items-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Xem Cấu Hình Slicer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRevisingMeshItem(item);
                        setRevisionNoteInput(
                          item.revisionNote ||
                            'Độ dày thành vỏ mỏng <1.0mm tại các khớp nối, nguy cơ gãy khi in FDM. Vui lòng làm dày tối thiểu 1.5mm.'
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#EB4037]/15 hover:bg-[#EB4037]/30 text-[#EB4037] border border-[#EB4037]/30 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Yêu Cầu Sửa Mesh</span>
                    </button>

                    {item.status !== 'SLICER_OPTIMIZED' && (
                      <button
                        type="button"
                        onClick={() => handleApproveMeshItem(item.id)}
                        className="px-4 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Duyệt File & Xuất Slicer</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: ĐIỀU PHỐI CỤM MÁY IN FDM (PRINT_OPERATOR / ADMIN)         */}
      {/* ============================================================== */}
      {activeTab === 'PRINTERS' && (
        <div className="space-y-4 text-xs font-mono">
          
          {/* Header Bàn Điều Phối Máy In */}
          <div className="p-5 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#F4F1EA] flex items-center gap-2">
                  <Printer className="w-5 h-5 text-[#8B5CF6]" />
                  <span>Trạm Giám Sát Cụm Máy In FDM Xưởng MinhLab</span>
                </h3>
                <p className="text-xs text-[#A5ADB8] mt-1">
                  Điều khiển nhiệt độ đầu đùn, bàn nhiệt PEI, tốc độ quạt làm mát và tiến trình in của 4 trạm máy công nghiệp.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-[#737D89] block">CỤM MÁY HOẠT ĐỘNG:</span>
                <strong className="text-sm text-[#6F9576] font-bold">
                  {printers.filter((p) => p.status === 'PRINTING').length} / 4 MÁY ĐANG CHẠY
                </strong>
              </div>
            </div>
          </div>

          {/* Lưới 4 Máy In FDM Thực Tế */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {printers.map((printer) => {
              const isPrinting = printer.status === 'PRINTING';
              const isStandby = printer.status === 'STANDBY';
              const isPaused = printer.status === 'PAUSED';

              return (
                <div
                  key={printer.id}
                  className={`p-5 rounded-2xl bg-[#141A21] border transition-all space-y-4 shadow-xl ${
                    isPrinting
                      ? 'border-[#6F9576]/50'
                      : isPaused
                      ? 'border-[#D97706]/50'
                      : 'border-[#27313C]'
                  }`}
                >
                  {/* Header Máy */}
                  <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-[#F4F1EA]">{printer.name}</h4>
                      <p className="text-[10px] text-[#737D89]">{printer.model}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isPrinting
                            ? 'bg-[#6F9576] animate-pulse'
                            : isPaused
                            ? 'bg-[#D97706]'
                            : 'bg-[#737D89]'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          isPrinting
                            ? 'bg-[#6F9576]/15 text-[#6F9576] border border-[#6F9576]/30'
                            : isPaused
                            ? 'bg-[#D97706]/15 text-[#D97706] border border-[#D97706]/30'
                            : 'bg-[#0F141A] text-[#737D89] border border-[#27313C]'
                        }`}
                      >
                        {printer.status}
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết lệnh in hiện tại */}
                  {isStandby ? (
                    <div className="p-4 rounded-xl bg-[#0F141A] border border-[#27313C] text-center space-y-2">
                      <p className="text-[#A5ADB8] text-xs">Máy in đang ở chế độ chờ (Standby)</p>
                      <p className="text-[11px] text-[#737D89]">Sẵn sàng nhận lệnh in đơn hàng mới từ Slicer</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-[#F4F1EA] font-medium truncate max-w-[200px]">
                            {printer.currentJobName}
                          </span>
                          <span className="text-[#6F9576] font-bold">{printer.progressPercent}%</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-2 bg-[#0F141A] rounded-full overflow-hidden border border-[#27313C]">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isPaused ? 'bg-[#D97706]' : 'bg-[#6F9576]'
                            }`}
                            style={{ width: `${printer.progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#737D89] mt-1">
                          <span>Mã đơn: <strong className="text-[#EB4037]">{printer.currentOrderNumber}</strong></span>
                          <span>Còn lại: {printer.timeRemaining}</span>
                        </div>
                      </div>

                      {/* Thông số Telemetry Nhiệt độ */}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="p-2.5 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center gap-2">
                          <Flame className="w-4 h-4 text-[#EB4037]" />
                          <div>
                            <span className="text-[#737D89] block">ĐẦU ĐÙN:</span>
                            <strong className="text-[#F4F1EA] text-xs">{printer.nozzleTemp}°C</strong>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#D97706]" />
                          <div>
                            <span className="text-[#737D89] block">BÀN NHIỆT:</span>
                            <strong className="text-[#F4F1EA] text-xs">{printer.bedTemp}°C</strong>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-[#3B82F6]" />
                          <div>
                            <span className="text-[#737D89] block">QUẠT GIÓ:</span>
                            <strong className="text-[#F4F1EA] text-xs">{printer.coolingFanPercent}%</strong>
                          </div>
                        </div>
                      </div>

                      {/* Cuộn Filament */}
                      <div className="p-2.5 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center justify-between text-[10px]">
                        <span className="text-[#A5ADB8]">Cuộn nhựa: <strong>{printer.currentFilament}</strong></span>
                        <span className="text-[#6F9576] font-bold">Còn {printer.filamentRemainingGrams}g</span>
                      </div>
                    </div>
                  )}

                  {/* Thao tác thợ in */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27313C]">
                    {!isStandby && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTogglePrinterPause(printer.id)}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                            isPaused
                              ? 'bg-[#6F9576]/15 hover:bg-[#6F9576]/30 text-[#6F9576] border-[#6F9576]/30'
                              : 'bg-[#D97706]/15 hover:bg-[#D97706]/30 text-[#D97706] border-[#D97706]/30'
                          }`}
                        >
                          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          <span>{isPaused ? 'Tiếp tục in' : 'Tạm dừng'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCompletePrintJob(printer.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#6F9576] hover:bg-[#5E8364] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Báo in xong (100%)</span>
                        </button>
                      </>
                    )}

                    {isStandby && (
                      <button
                        type="button"
                        onClick={() => {
                          // Gán lệnh in mẫu vào máy standby
                          setPrinters((prev) =>
                            prev.map((p) =>
                              p.id === printer.id
                                ? {
                                    ...p,
                                    status: 'PRINTING',
                                    progressPercent: 5,
                                    currentOrderNumber: 'ML-998822',
                                    currentJobName: 'Art Toy Khỉ Kỹ Sư Custom Armor',
                                    timeRemaining: '4h 10m',
                                    nozzleTemp: 215,
                                    bedTemp: 55,
                                    coolingFanPercent: 100,
                                    currentFilament: 'PLA Tough (Đỏ MinhLab)',
                                    filamentRemainingGrams: 850,
                                  }
                                : p
                            )
                          );
                          setActionSuccessMessage(`Đã nạp lệnh in mới cho máy [${printer.name}] thành công!`);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Nạp Lệnh In Mới</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: XEM BIÊN LAI CHUYỂN KHOẢN VIETQR (KẾ TOÁN)             */}
      {/* ============================================================== */}
      {selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141A21] border border-[#27313C] rounded-2xl w-full max-w-md p-6 space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#F4F1EA]">Biên Lai Chuyển Khoản Ngân Hàng</h3>
                <p className="text-[11px] font-mono text-[#EB4037]">{selectedReceiptPayment.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptPayment(null)}
                className="p-1 rounded text-[#737D89] hover:text-[#F4F1EA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-2.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#737D89]">Số tiền:</span>
                <strong className="text-[#6F9576] text-sm">{formatVND(selectedReceiptPayment.amount)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737D89]">Mã FT ngân hàng:</span>
                <strong className="text-[#F4F1EA]">{selectedReceiptPayment.transactionReference || 'FT-MINHLAB-9928'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737D89]">Tài khoản chuyển:</span>
                <span className="text-[#F4F1EA]">{selectedReceiptPayment.senderAccountName || selectedReceiptPayment.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737D89]">Ngân hàng:</span>
                <span className="text-[#F4F1EA]">{selectedReceiptPayment.bankName || 'MB Bank'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737D89]">Thời gian:</span>
                <span className="text-[#A5ADB8]">{selectedReceiptPayment.transferredAt || selectedReceiptPayment.createdAt}</span>
              </div>
            </div>

            {/* Mô phỏng ảnh biên lai */}
            <div className="p-6 rounded-xl bg-[#0B0F14] border border-[#27313C] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#6F9576] mx-auto" />
              <p className="text-xs font-bold text-[#F4F1EA]">Giao Dịch Đã Khai Báo</p>
              <p className="text-[10px] text-[#737D89] font-mono">
                Số tài khoản thụ hưởng: 0912345678 (MB Bank - MinhLab Studio)
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedReceiptPayment(null)}
                className="px-4 py-2 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#A5ADB8] text-xs font-mono"
              >
                Đóng
              </button>
              {selectedReceiptPayment.verificationStatus === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => {
                    handleVerifyPayment(selectedReceiptPayment.orderNumber);
                    setSelectedReceiptPayment(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#6F9576] hover:bg-[#5E8364] text-white text-xs font-mono font-bold"
                >
                  Xác nhận nhận tiền ngay
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: TỪ CHỐI THANH TOÁN (KẾ TOÁN)                           */}
      {/* ============================================================== */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141A21] border border-[#EB4037]/50 rounded-2xl w-full max-w-md p-6 space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
              <h3 className="text-sm font-bold text-[#EB4037] flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Từ Chối Thanh Toán Cho Đơn [{rejectingPayment.orderNumber}]</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="p-1 rounded text-[#737D89] hover:text-[#F4F1EA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <label className="text-[#A5ADB8] block">Lý do từ chối (Gửi thông báo tới khách):</label>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full p-3 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs focus:outline-none focus:border-[#EB4037]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="px-4 py-2 rounded-lg bg-[#0F141A] text-[#A5ADB8] text-xs font-mono"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleRejectPayment}
                className="px-4 py-2 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-mono font-bold"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: XEM CẤU HÌNH SLICER CỦA TỆP 3D (KỸ SƯ MESH)            */}
      {/* ============================================================== */}
      {selectedMeshSpec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141A21] border border-[#3B82F6]/50 rounded-2xl w-full max-w-lg p-6 space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#F4F1EA] flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#3B82F6]" />
                  <span>Cấu Hình Cắt Lớp Slicer — {selectedMeshSpec.fileName}</span>
                </h3>
                <p className="text-[11px] font-mono text-[#A5ADB8]">
                  Đơn: {selectedMeshSpec.orderNumber} · Khách: {selectedMeshSpec.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMeshSpec(null)}
                className="p-1 rounded text-[#737D89] hover:text-[#F4F1EA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">ĐỘ MỊN LỚP IN (LAYER):</span>
                <strong className="text-[#F4F1EA] block">0.12 mm (Siêu nét)</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">MẬT ĐỘ RUỘT (INFILL):</span>
                <strong className="text-[#F4F1EA] block">20% Gyroid (Chống cong vênh)</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">SỐ VỎ THÀNH (WALL LOOPS):</span>
                <strong className="text-[#F4F1EA] block">4 Vòng (Độ dày 1.6mm)</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">GIÁ ĐỠ (SUPPORT TYPE):</span>
                <strong className="text-[#3B82F6] block">Tree Support Tự Động (Góc &gt;48°)</strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1 text-xs font-mono">
              <span className="text-[#737D89] text-[10px]">VẬT LIỆU KHUYÊN DÙNG:</span>
              <p className="text-[#F4F1EA]">{selectedMeshSpec.materialRequested}</p>
              <p className="text-[11px] text-[#A5ADB8]">
                Nhiệt độ đùn: 215°C · Nhiệt độ bàn PEI: 55°C · Tốc độ in: 180 mm/s
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedMeshSpec(null)}
                className="px-4 py-2 rounded-lg bg-[#0F141A] text-[#A5ADB8] text-xs font-mono"
              >
                Đóng
              </button>
              {selectedMeshSpec.status !== 'SLICER_OPTIMIZED' && (
                <button
                  type="button"
                  onClick={() => {
                    handleApproveMeshItem(selectedMeshSpec.id);
                    setSelectedMeshSpec(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-mono font-bold"
                >
                  Duyệt File & Xuất Slicer Ngay
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: YÊU CẦU CHỈNH SỬA MESH (KỸ SƯ 3D)                       */}
      {/* ============================================================== */}
      {revisingMeshItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141A21] border border-[#EB4037]/50 rounded-2xl w-full max-w-md p-6 space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
              <h3 className="text-sm font-bold text-[#EB4037] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Yêu Cầu Chỉnh Sửa Mesh Cho [{revisingMeshItem.fileName}]</span>
              </h3>
              <button
                type="button"
                onClick={() => setRevisingMeshItem(null)}
                className="p-1 rounded text-[#737D89] hover:text-[#F4F1EA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <label className="text-[#A5ADB8] block">Nhập chẩn đoán kỹ thuật gửi khách hàng:</label>
              <textarea
                rows={4}
                value={revisionNoteInput}
                onChange={(e) => setRevisionNoteInput(e.target.value)}
                className="w-full p-3 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs focus:outline-none focus:border-[#EB4037]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevisingMeshItem(null)}
                className="px-4 py-2 rounded-lg bg-[#0F141A] text-[#A5ADB8] text-xs font-mono"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRevisionNote}
                className="px-4 py-2 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-mono font-bold"
              >
                Lưu và Gửi Phản Hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: XEM CHI TIẾT ĐƠN HÀNG                                   */}
      {/* ============================================================== */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141A21] border border-[#27313C] rounded-2xl w-full max-w-lg p-6 space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#F4F1EA]">Chi Tiết Đơn Hàng #{selectedOrderDetails.orderNumber}</h3>
                <p className="text-[11px] font-mono text-[#A5ADB8]">
                  Khách: {selectedOrderDetails.customerName} · {selectedOrderDetails.customerPhone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1 rounded text-[#737D89] hover:text-[#F4F1EA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-1">
                <span className="text-[#737D89] text-[10px]">ĐỊA CHỈ GIAO HÀNG:</span>
                <p className="text-[#F4F1EA]">{selectedOrderDetails.shippingAddress}</p>
                <p className="text-[11px] text-[#A5ADB8]">Email: {selectedOrderDetails.customerEmail}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F141A] border border-[#27313C] space-y-2">
                <div className="flex justify-between border-b border-[#27313C] pb-2 text-[10px] text-[#737D89]">
                  <span>PHƯƠNG THỨC THANH TOÁN:</span>
                  <span className="text-[#F4F1EA] font-bold">
                    {selectedOrderDetails.paymentTiming === 'COD' ? 'Thanh toán tiền mặt khi nhận hàng (COD)' : 'Chuyển khoản VietQR'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Trạng thái đơn:</span>
                  <strong className="text-[#D48955]">{selectedOrderDetails.orderStatus}</strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Trạng thái thanh toán:</span>
                  <strong className="text-[#6F9576]">{selectedOrderDetails.paymentStatus}</strong>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-[#27313C]">
                  <span>Tổng tiền thanh toán:</span>
                  <strong className="text-[#EB4037] text-sm">{formatVND(selectedOrderDetails.grandTotal)}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="px-4 py-2 rounded-lg bg-[#0F141A] text-[#A5ADB8] text-xs font-mono"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
