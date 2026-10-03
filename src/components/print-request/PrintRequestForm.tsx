'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SITE_CONFIG } from '../../config/site.config';
import { 
  UploadCloud, 
  FileCheck, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  MessageCircle, 
  Mail, 
  Trash2,
  Settings,
  ArrowRight,
  Box
} from 'lucide-react';

const STLViewerCanvas = dynamic(() => import('./STLViewerCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#090D12] text-xs font-mono text-[#A5ADB8]">
      <div className="w-8 h-8 rounded-full border-2 border-[#EB4037] border-t-transparent animate-spin mb-2" />
      <span>Khởi động bàn in 3D...</span>
    </div>
  ),
});

export const PrintRequestForm: React.FC = () => {
  // Trạng thái Form & 3D Slicer
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [filamentColor, setFilamentColor] = useState('#EB4037');
  const [wireframe, setWireframe] = useState(false);
  const [detectedDims, setDetectedDims] = useState<{ x: number; y: number; z: number; volumeCm3: number } | null>(null);
  const [dimension, setDimension] = useState('');
  const [material, setMaterial] = useState('PLA+ (Độ nét cao)');
  const [layerHeight, setLayerHeight] = useState('0.12mm (Siêu mịn)');
  const [purpose, setPurpose] = useState('Trưng bày sưu tầm');
  const [color, setColor] = useState('Mặc định / Studio tư vấn');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmedRights, setConfirmedRights] = useState(true);

  // Trạng thái kiểm lỗi & tóm tắt
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Danh mục vật liệu kỹ thuật (kèm tùy chọn Cần MinhLab tư vấn)
  const MATERIALS = [
    { label: 'PLA+ (Độ nét cao)', desc: 'Chi tiết sắc nét, bề mặt mịn, thân thiện' },
    { label: 'PETG (Chịu nhiệt/ngoài trời)', desc: 'Độ bền cơ học tốt, chống va đập, kháng ẩm' },
    { label: 'TPU (Đàn hồi dẻo)', desc: 'Chất liệu cao su dẻo, giảm chấn va đập' },
    { label: 'Resin (Siêu chi tiết)', desc: 'Độ phân giải siêu cao cho art toy nhỏ' },
    { label: 'Cần MinhLab tư vấn', desc: 'Kỹ sư xưởng sẽ phân tích hình học tệp và đề xuất vật liệu tối ưu' },
  ];

  // Độ mịn layer
  const LAYER_HEIGHTS = [
    { label: '0.12mm (Siêu mịn)', desc: 'Mịn tối đa, khử bavia, phù hợp art toy' },
    { label: '0.16mm (Chuẩn studio)', desc: 'Cân bằng giữa tốc độ và độ sắc nét' },
    { label: '0.20mm (In nhanh)', desc: 'Mẫu thử prototype, mô hình kết cấu' },
  ];

  // Mục đích in
  const PURPOSES = [
    'Trưng bày sưu tầm',
    'Lắp ráp cơ khí',
    'Phụ kiện bàn làm việc',
    'Mô hình kiến trúc / Diorama',
  ];

  // Xử lý kéo thả tệp
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    const validExtensions = ['.stl', '.obj', '.step', '.stp', '.3mf', '.zip', '.rar'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setErrors((prev) => ({
        ...prev,
        file: 'Định dạng không hỗ trợ. Vui lòng chọn tệp .STL, .OBJ, .STEP, .3MF hoặc .ZIP.',
      }));
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        file: 'Dung lượng tệp vượt quá 100MB. Vui lòng nén file hoặc gửi liên kết trực tiếp.',
      }));
      return;
    }

    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.file;
      return copy;
    });

    setRawFile(file);
    setSelectedFile({
      name: file.name,
      size: `${sizeInMB} MB`,
    });
  };

  const handleDimensionsDetected = (dims: { x: number; y: number; z: number; volumeCm3: number }) => {
    setDetectedDims(dims);
    setDimension(`${dims.x} × ${dims.y} × ${dims.z} mm`);
  };

  // Tạo nội dung tóm tắt yêu cầu
  const generateSummaryText = () => {
    return [
      `=== BẢN TÓM TẮT YÊU CẦU IN 3D TẠI MINHLAB ===`,
      `Khách hàng: ${fullName || 'Chưa cung cấp'}`,
      `Số điện thoại / Zalo: ${phone || 'Chưa cung cấp'}`,
      email ? `Email: ${email}` : '',
      `---------------------------------------`,
      `Tệp đính kèm: ${selectedFile ? `${selectedFile.name} (${selectedFile.size})` : 'Chưa chọn file (sẽ gửi qua Zalo)'}`,
      `Kích thước ước tính: ${dimension || 'Theo tỷ lệ gốc của tệp'}`,
      `Vật liệu mong muốn: ${material}`,
      `Độ mịn layer: ${layerHeight}`,
      `Màu sắc mong muốn: ${color}`,
      `Số lượng cần in: ${quantity}`,
      `Mục đích sử dụng: ${purpose}`,
      notes ? `Ghi chú thêm: ${notes}` : '',
      `Xác nhận quyền sở hữu: ${confirmedRights ? 'Đã xác nhận file trưng bày cá nhân' : 'Chưa xác nhận'}`,
      `Lưu ý: MinhLab kiểm tra khả năng in và báo giá, không thiết kế mô hình mới từ đầu.`,
      `=======================================`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  // Validate form trước khi xem tóm tắt
  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!phone.trim()) {
      errs.phone = 'Vui lòng cung cấp số điện thoại hoặc Zalo để kỹ sư xưởng gửi ảnh cắt lớp slicing.';
    }

    if (!confirmedRights) {
      errs.confirmedRights = 'Vui lòng xác nhận bạn có quyền sử dụng tệp in này.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setShowSummary(true);
  };

  // Gửi qua Zalo
  const handleSendZalo = () => {
    const text = generateSummaryText();
    const zaloNum = SITE_CONFIG.contact.zaloPhone.replace(/\s+/g, '');
    const url = `https://zalo.me/${zaloNum}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Gửi qua Email
  const handleSendEmail = () => {
    const text = generateSummaryText();
    const subject = encodeURIComponent(`[MinhLab 3D] Yêu cầu in theo file từ ${fullName || phone}`);
    const body = encodeURIComponent(text);
    window.location.href = `mailto:${SITE_CONFIG.contact.email}?subject=${subject}&body=${body}`;
  };

  // Sao chép nội dung
  const handleCopy = () => {
    navigator.clipboard.writeText(generateSummaryText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section 
      id="in-theo-file" 
      className="pt-4 sm:pt-6 pb-14 sm:pb-16 px-4 sm:px-8 bg-transparent text-[#F4F1EA] w-full max-w-full overflow-hidden"
      aria-label="Khu vực gửi tệp in 3D theo yêu cầu"
    >
      <div className="max-w-7xl mx-auto w-full">
        {/* Tiêu đề & Giới thiệu Section */}
        <div className="max-w-3xl mb-8 sm:mb-10 space-y-3 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[10px] sm:text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
            <span>ENGINEER WORKBENCH · MINHLAB 3D</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-tight">
            Bàn Kỹ Thuật In 3D Theo Yêu Cầu
          </h1>

          <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
            Tải file 3D (.STL, .OBJ, .STEP, .3MF, .ZIP) để nhận tư vấn thông số đùn nhựa 0.12mm, kiểm tra độ dày thành lưới polygon và báo giá nhanh qua Zalo.
          </p>
        </div>

        {/* BÀN LÀM VIỆC KỸ THUẬT (2 CỘT CHÍNH) */}
        <form onSubmit={handleValidate} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* CỘT TRÁI: KHUNG TẢI FILE & SIMULATED CHECKLIST (5 CỘT) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* SÂN KHẤU 3D BÀN IN FDM (SLICER PREVIEW) */}
            <div className="rounded-2xl bg-[#0E131A] border border-[#27313C] p-3 sm:p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-[#A5ADB8] px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#EB4037] animate-pulse" />
                  <span className="text-[#F4F1EA] font-semibold">BÀN MÁY IN FDM (220×220MM)</span>
                </div>
                <span className="text-[11px] text-[#C8A261] bg-[#C8A261]/10 px-2 py-0.5 rounded border border-[#C8A261]/30">
                  Kéo xoay 360°
                </span>
              </div>

              <div className="w-full h-[280px] sm:h-[320px] rounded-xl overflow-hidden bg-[#070A0E] relative border border-[#27313C]/60">
                <STLViewerCanvas
                  file={rawFile}
                  filamentColor={filamentColor}
                  wireframe={wireframe}
                  onDimensionsDetected={handleDimensionsDetected}
                />

                {/* Color & Wireframe Controls */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0E131A]/90 backdrop-blur-md border border-[#27313C] pointer-events-auto">
                    <span className="text-[10px] font-mono text-[#737D89] px-1 hidden sm:inline">MÀU NHỰA:</span>
                    {[
                      { name: 'Đỏ cam MinhLab', hex: '#EB4037' },
                      { name: 'Vàng kim Champagne', hex: '#C8A261' },
                      { name: 'Đen than chì', hex: '#1F242C' },
                      { name: 'Trắng ngà Tough', hex: '#F0EFEA' },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFilamentColor(c.hex)}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          filamentColor === c.hex ? 'scale-110 border-white ring-2 ring-[#EB4037]' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                        aria-label={`Chọn màu nhựa ${c.name}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setWireframe(!wireframe)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border backdrop-blur-md pointer-events-auto transition-all ${
                      wireframe
                        ? 'bg-[#EB4037] text-white border-[#EB4037]'
                        : 'bg-[#0E131A]/90 text-[#A5ADB8] hover:text-white border-[#27313C]'
                    }`}
                    title="Bật/tắt khung lưới polygon"
                  >
                    {wireframe ? 'Khung lưới' : 'Bề mặt'}
                  </button>
                </div>
              </div>

              {detectedDims ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Đã nhận diện: {detectedDims.x} × {detectedDims.y} × {detectedDims.z} mm (Thể tích ~ {detectedDims.volumeCm3} cm³)
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-mono text-[#737D89] text-center">
                  {rawFile ? 'Đang phân tích cấu trúc 3D tệp...' : 'Bàn in đang hiển thị mẫu chuẩn FDM. Tải file .STL để soi mô hình của bạn.'}
                </p>
              )}
            </div>

            {/* Vùng kéo thả tệp */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
                isDragOver
                  ? 'border-[#EB4037] bg-[#EB4037]/10'
                  : selectedFile
                  ? 'border-[#6F9576] bg-[#141A21]'
                  : 'border-[#27313C] hover:border-[#8492BD]/50 bg-[#141A21]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".stl,.obj,.step,.stp,.3mf,.zip,.rar"
                onChange={handleFileChange}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-[#0B0F14] border border-[#27313C] flex items-center justify-center text-[#EB4037] group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#F4F1EA] block">
                      Kéo thả file vào đây hoặc <span className="text-[#EB4037] underline underline-offset-2">chọn từ thiết bị</span>
                    </span>
                    <span className="text-xs text-[#737D89] font-mono mt-0.5 block">
                      Hỗ trợ .STL, .OBJ, .STEP, .3MF hoặc .ZIP (Tối đa 100MB)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-[#6F9576]/15 border border-[#6F9576]/30 flex items-center justify-center text-[#6F9576]">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#F4F1EA] truncate max-w-[280px] mx-auto font-mono">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs font-mono text-[#6F9576]">
                      {selectedFile.size} · Đã nạp lên bàn máy
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setRawFile(null);
                      setDetectedDims(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0B0F14] hover:bg-[#1A222C] text-xs text-[#EB4037] border border-[#27313C] transition-colors font-mono min-h-[36px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Chọn lại tệp</span>
                  </button>
                </div>
              )}
            </div>

            {errors.file && (
              <p className="text-xs text-[#EB4037] font-mono flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.file}</span>
              </p>
            )}

            {/* Checklist tự động mô phỏng quy chuẩn xưởng in */}
            <div className="p-5 rounded-xl bg-[#141A21] border border-[#27313C] space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#8492BD] uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-[#8492BD]" />
                  <span>Quy chuẩn soi file trước khi in</span>
                </span>
                <span className="text-[10px] font-mono text-[#6F9576]">ISO-FDM</span>
              </div>

              <div className="space-y-2 text-xs text-[#A5ADB8]">
                <div className="flex items-start gap-2.5">
                  <div className="p-0.5 rounded bg-[#0B0F14] text-[#6F9576] mt-0.5 shrink-0 border border-[#27313C]">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Kiểm tra độ dày thành tối thiểu &gt; 1.2mm để không bị rỗng nứt.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="p-0.5 rounded bg-[#0B0F14] text-[#6F9576] mt-0.5 shrink-0 border border-[#27313C]">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Định vị góc đặt mặt đáy tối ưu để giảm thiểu bề mặt tiếp xúc support.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="p-0.5 rounded bg-[#0B0F14] text-[#6F9576] mt-0.5 shrink-0 border border-[#27313C]">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Khuyến nghị tạo support dạng tree hữu cơ giúp bóc tách sạch sẽ.</span>
                </div>
              </div>
            </div>

          </div>

          {/* CỘT PHẢI: THÔNG SỐ KỸ THUẬT & LIÊN HỆ (7 CỘT) */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-6 text-left">
            
            {/* Lựa chọn vật liệu (Có tùy chọn Cần MinhLab tư vấn) */}
            <div className="space-y-2.5">
              <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                1. Lựa chọn vật liệu in
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MATERIALS.map((m) => {
                  const isSelected = material === m.label;
                  return (
                    <button
                      type="button"
                      key={m.label}
                      onClick={() => setMaterial(m.label)}
                      className={`p-3 rounded-lg border text-left transition-all min-h-[44px] ${
                        isSelected
                          ? 'border-[#EB4037] bg-[#EB4037]/10 text-[#F4F1EA]'
                          : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:border-[#8492BD]/40 hover:text-[#F4F1EA]'
                      }`}
                    >
                      <span className="font-semibold text-xs block text-[#F4F1EA] mb-0.5">{m.label}</span>
                      <span className="text-[11px] text-[#737D89] block leading-snug">{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lựa chọn độ mịn layer */}
            <div className="space-y-2.5">
              <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                2. Độ mịn layer (Layer Height)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {LAYER_HEIGHTS.map((l) => {
                  const isSelected = layerHeight === l.label;
                  return (
                    <button
                      type="button"
                      key={l.label}
                      onClick={() => setLayerHeight(l.label)}
                      className={`p-3 rounded-lg border text-left transition-all min-h-[44px] ${
                        isSelected
                          ? 'border-[#EB4037] bg-[#EB4037]/10 text-[#F4F1EA]'
                          : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:border-[#8492BD]/40 hover:text-[#F4F1EA]'
                      }`}
                    >
                      <span className="font-semibold text-xs block text-[#F4F1EA] mb-0.5">{l.label}</span>
                      <span className="text-[11px] text-[#737D89] block leading-snug">{l.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mục đích & Kích thước */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  3. Mục đích sử dụng
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-mono text-[#F4F1EA] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                >
                  {PURPOSES.map((p) => (
                    <option key={p} value={p} className="bg-[#141A21] text-[#F4F1EA]">
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  4. Kích thước ước tính (D x R x C cm)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 15 x 10 x 12 cm"
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-mono text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                />
              </div>
            </div>

            {/* Màu sắc & Số lượng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  Màu sắc mong muốn
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Trắng ngà, Đen mờ, Studio tư vấn..."
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-mono text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  Số lượng sản phẩm
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-mono text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                />
              </div>
            </div>

            {/* Thông tin liên hệ & nhận báo giá */}
            <div className="pt-4 border-t border-[#27313C] space-y-4">
              <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                5. Thông tin nhận slicing preview & báo giá
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Họ tên của bạn"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-sans text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                  />
                </div>

                <div className="space-y-1">
                  <input
                    type="tel"
                    placeholder="Số điện thoại / Zalo *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border text-xs font-mono text-[#F4F1EA] placeholder-[#737D89] focus:outline-none min-h-[44px] ${
                      errors.phone ? 'border-[#EB4037]' : 'border-[#27313C] focus:border-[#EB4037]'
                    }`}
                  />
                  {errors.phone && (
                    <p className="text-[11px] text-[#EB4037] font-mono">{errors.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Ghi chú thêm (yêu cầu khớp lắp ráp, bề mặt hoàn thiện...)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-sans text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                />
              </div>

              {/* Cam kết bản quyền cá nhân */}
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedRights}
                  onChange={(e) => setConfirmedRights(e.target.checked)}
                  className="mt-0.5 rounded border-[#27313C] text-[#EB4037] focus:ring-0 bg-[#0F141A]"
                />
                <span className="text-[11px] text-[#A5ADB8] leading-relaxed">
                  Tôi xác nhận rằng tôi có quyền hợp pháp đối với tệp thiết kế 3D này và chịu trách nhiệm về nội dung của tệp.
                </span>
              </label>
              {errors.confirmedRights && (
                <p className="text-[11px] text-[#EB4037] font-mono">{errors.confirmedRights}</p>
              )}
            </div>

            {/* Nút Submit */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm transition-all duration-200 shadow-subtle flex items-center justify-center gap-2 group min-h-[44px]"
              >
                <span>Tạo bản tóm tắt thông số & gửi Zalo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

        </form>

      </div>

      {/* ============================================================== */}
      {/* MODAL XÁC NHẬN & GỬI TÓM TẮT THÔNG SỐ                          */}
      {/* ============================================================== */}
      {showSummary && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Bản tóm tắt yêu cầu in 3D"
        >
          <div className="bg-[#141A21] border border-[#27313C] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 relative shadow-2xl space-y-5 text-[#F4F1EA] text-left">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#27313C]">
              <div>
                <h3 className="text-base font-bold text-[#F4F1EA]">Bản Tóm Tắt Thông Số Yêu Cầu</h3>
                <p className="text-xs text-[#A5ADB8]">Kỹ sư MinhLab sẽ mở file và trả lời trong 15-30 phút</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="p-1.5 rounded-lg bg-[#0F141A] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C] min-h-[36px] min-w-[36px] flex items-center justify-center"
                aria-label="Đóng tóm tắt"
              >
                ✕
              </button>
            </div>

            {/* Khung Textarea chứa nội dung sao chép */}
            <div className="relative">
              <pre className="p-4 rounded-xl bg-[#0B0F14] border border-[#27313C] text-xs font-mono text-[#A5ADB8] whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {generateSummaryText()}
              </pre>

              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#F4F1EA] border border-[#27313C] text-xs flex items-center gap-1.5 transition-colors font-mono"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#6F9576]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>

            {/* Nút gửi Zalo & Email */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleSendZalo}
                className="w-full py-3 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-subtle min-h-[44px]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Mở chat Zalo ({SITE_CONFIG.contact.zaloPhone})</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmail}
                className="w-full py-3 px-4 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#F4F1EA] font-medium text-sm border border-[#27313C] transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Mail className="w-4 h-4 text-[#A5ADB8]" />
                <span>Gửi qua Email xưởng</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};

export default PrintRequestForm;
