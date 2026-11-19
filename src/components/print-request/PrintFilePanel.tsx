'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { UploadCloud, FileCheck, CheckCircle2, AlertCircle, Check, Trash2, Settings } from 'lucide-react';

import { PrintPartsList } from './PrintPartsList';
import { PrintColorFields } from './PrintColorFields';

import type { usePrintRequest } from './usePrintRequest';

const STLViewerCanvas = dynamic(() => import('./STLViewerCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#090D12] text-xs font-mono text-[#A5ADB8]">
      <div className="w-8 h-8 rounded-full border-2 border-[#EB4037] border-t-transparent animate-spin mb-2" />
      <span>Khởi động bàn in 3D...</span>
    </div>
  ),
});

interface PrintFilePanelProps {
  model: ReturnType<typeof usePrintRequest>;
}

export function PrintFilePanel({ model }: PrintFilePanelProps) {
  const [showAll, setShowAll] = useState(true);
  const [fdmSurface, setFdmSurface] = useState(true);
  const {
    rawFile,
    color,
    setColor,
    filamentColor,
    wireframe,
    hasValidScale,
    scaleValue,
    handleDimensionsDetected,
    setWireframe,
    detectedDims,
    formatDimension,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDragOver,
    selectedFile,
    fileInputRef,
    handleFileChange,
    errors,
  } = model;
  return (<>
<div className="lg:col-span-5 space-y-6">
            <div className="grid grid-cols-1 gap-6">
            {/* Xem hình học và minh họa bề mặt, không phải toolpath slicer. */}
            <div className="order-2 space-y-3 rounded-2xl border border-[#27313C] bg-[#0E131A] p-3 shadow-xl sm:p-4 lg:order-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#A5ADB8] px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#EB4037] animate-pulse" />
                  <span className="text-[#F4F1EA] font-semibold">BÀN MÁY IN A1 MINI (180 × 180 MM)</span>
                </div>
                <span className="text-[11px] text-[#C8A261] bg-[#C8A261]/10 px-2 py-0.5 rounded border border-[#C8A261]/30">
                  Kéo xoay 360°
                </span>
              </div>

              <div className="flex flex-wrap gap-2" aria-label="Chế độ xem STL">
                <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)} className={`min-h-11 rounded-lg border px-3 text-xs focus-visible:ring-2 focus-visible:ring-[#C8A261] ${showAll ? 'border-[#C8A261] text-[#C8A261]' : 'border-[#27313C] text-[#A5ADB8]'}`}>Tất cả ({model.files.length})</button>
                <button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)} className={`min-h-11 rounded-lg border px-3 text-xs focus-visible:ring-2 focus-visible:ring-[#C8A261] ${!showAll ? 'border-[#C8A261] text-[#C8A261]' : 'border-[#27313C] text-[#A5ADB8]'}`}>Linh kiện đang chọn</button>
                <button type="button" aria-pressed={fdmSurface} disabled={wireframe} onClick={() => setFdmSurface(value => !value)} className="min-h-11 rounded-lg border border-[#27313C] px-3 text-xs text-[#A5ADB8] focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:opacity-50">{fdmSurface ? 'Vân FDM · 0,20 mm' : 'Bề mặt láng'}</button>
              </div>
              <div className="w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden bg-[#070A0E] relative border border-[#27313C]/60">
                <STLViewerCanvas
                  files={model.files}
                  selectedFile={rawFile}
                  showAll={showAll}
                  fdmSurface={fdmSurface}
                  onSelect={model.selectPart}
                  filamentColor={filamentColor}
                  wireframe={wireframe}
                  scalePercent={hasValidScale ? scaleValue : 100}
                  onDimensionsDetected={handleDimensionsDetected}
                />

                {/* Color & Wireframe Controls */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <span className="max-w-[65%] truncate rounded-lg border border-[#27313C] bg-[#0E131A]/90 px-3 py-2 text-[11px] text-[#A5ADB8]">
                    Màu: {color}
                  </span>

                  <button
                    type="button"
                    onClick={() => setWireframe(!wireframe)}
                    className={`min-h-11 px-3 rounded-lg text-xs font-mono border backdrop-blur-md pointer-events-auto transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] ${
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

              <p className="text-xs leading-5 text-[#A5ADB8]">{showAll ? 'Mỗi file hiện một mẫu, đặt cạnh nhau để so sánh; chưa phải bản lắp ráp hay kế hoạch gom mẻ. Bấm mẫu hoặc tên file để chọn.' : 'Đang xem riêng linh kiện được chọn.'} Vân FDM là minh họa lớp 0,20 mm và sợi mặt trên, chưa phải đường đùn từ slicer. Phóng gần để thấy vân.</p>
              {detectedDims ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Đã đọc khung bao STL: {formatDimension(detectedDims.x)} × {formatDimension(detectedDims.y)} × {formatDimension(detectedDims.z)} mm · đơn vị giả định là mm
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-mono text-[#737D89] text-center">
                  {rawFile ? 'Đang phân tích cấu trúc 3D tệp...' : 'Bàn in đang chờ file .STL để hiển thị mô hình của bạn.'}
                </p>
              )}
              <PrintColorFields value={color} onChange={setColor} />
            </div>

            {/* Vùng kéo thả tệp */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="group"
              aria-label="Vùng chọn tệp STL để xem trước trên bàn in 3D"
              className={`order-1 relative rounded-2xl border-2 border-dashed transition-all lg:order-2 ${
                isDragOver
                  ? 'border-[#EB4037] bg-[#EB4037]/10'
                  : selectedFile
                  ? 'border-[#6F9576] bg-[#141A21]'
                  : 'border-[#27313C] bg-[#141A21]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".stl,model/stl,application/sla"
                multiple
                onChange={handleFileChange}
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
              />

              {!selectedFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-describedby="stl-upload-guidance"
                  className="group flex min-h-[150px] w-full flex-col items-center justify-center p-6 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A261]"
                >
                  <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#27313C] bg-[#0B0F14] text-[#EB4037] transition-transform group-hover:scale-105">
                    <UploadCloud className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="block text-sm font-semibold text-[#F4F1EA]">
                    <span className="sm:hidden">Chọn tệp STL từ thiết bị</span>
                    <span className="hidden sm:inline">Kéo thả file vào đây hoặc <span className="text-[#EB4037] underline underline-offset-2">chọn từ thiết bị</span></span>
                  </span>
                  <span id="stl-upload-guidance" className="mt-0.5 block text-xs font-mono text-[#737D89]">
                    STL · tối đa 10 file, tổng 100 MB xem trước · tải lên tối đa 50 MB/file
                  </span>
                </button>
              ) : (
                <div className="space-y-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#6F9576]/30 bg-[#6F9576]/15 text-[#6F9576] mx-auto">
                    <FileCheck className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <p className="mx-auto max-w-[280px] truncate text-sm font-semibold font-mono text-[#F4F1EA]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs font-mono text-[#6F9576]">
                      {selectedFile.size} · Chỉ có trên thiết bị này
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[#27313C] bg-[#0B0F14] px-3 text-xs font-mono text-[#F4F1EA] transition-colors hover:bg-[#1A222C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
                    >
                      <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Thêm linh kiện</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (rawFile) model.removePart(rawFile);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[#27313C] bg-[#0B0F14] px-3 text-xs font-mono text-[#A5ADB8] transition-colors hover:border-[#EB4037]/50 hover:text-[#EB4037] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Xóa tệp</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {errors.file && (
              <p className="text-xs text-[#EB4037] font-mono flex items-center gap-1.5" role="alert">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.file}</span>
              </p>
            )}
            </div>

            <PrintPartsList model={model} />
            {/* Checklist tự động mô phỏng quy chuẩn xưởng in */}
            <details className="p-4 rounded-xl bg-[#141A21] border border-[#27313C] space-y-3 text-left"><summary className="cursor-pointer text-sm text-[#A5ADB8]">Xưởng kiểm tra gì trước khi in?</summary>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#8492BD] uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-[#8492BD]" />
                  <span>Quy chuẩn soi file trước khi in</span>
                </span>
                <span className="text-[10px] font-mono text-[#A5ADB8]">FDM</span>
              </div>

              <div className="space-y-2 text-xs text-[#A5ADB8]">
                <div className="flex items-start gap-2.5">
                  <div className="p-0.5 rounded bg-[#0B0F14] text-[#6F9576] mt-0.5 shrink-0 border border-[#27313C]">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Xưởng kiểm tra độ dày thành và chi tiết nhỏ theo công nghệ đã chọn.</span>
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
                  <span>Xác nhận support, bề mặt và yêu cầu hoàn thiện trước khi in.</span>
                </div>
              </div>
            </details>

          </div>
  </>);
}
