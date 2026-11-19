'use client';

import { formatVND } from '../../lib/format';
import type { usePrintRequest } from './usePrintRequest';
import { PRINT_QUANTITY_MIN, PRINT_QUANTITY_MAX } from './print-request-quantity';
import { formatPrintDuration } from './print-request-settings';

interface PrintConfigurationPanelProps {
  model: ReturnType<typeof usePrintRequest>;
}

export function PrintConfigurationPanel({ model }: PrintConfigurationPanelProps) {
  const {
    rawFile,
    MATERIALS,
    material,
    setMaterial,
    color,
    setColor,
    isAnalyzingQuote,
    quoteAnalysisError,
    referenceQuote,
    hasValidScale,
    detectedDims,
    formatDimension,
    setScalePercent,
    setErrors,
    errors,
    purpose,
    setPurpose,
    setInfillPercent,
    DEFAULT_INFILL_BY_PURPOSE,
    PURPOSES,
    infillPercent,
    INFILL_OPTIONS,
    scalePercent,
    scaledDimensionsCm,
    exceedsBuildVolume,
    quantity,
    setQuantity,
    hasValidQuantity,
    quantityEstimate,
    fullName,
    setFullName,
    phone,
    setPhone,
    notes,
    setNotes,
    confirmedRights,
    setConfirmedRights,
  } = model;
  return (<>
<div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-6 text-left">

            <div className="space-y-2.5">
              <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">Lựa chọn vật liệu in</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MATERIALS.map(option => (
                  <button key={option.label} type="button" onClick={() => setMaterial(option.label)}
                    className={`p-3 rounded-lg border text-left transition-all min-h-[44px] ${material === option.label ? 'border-[#EB4037] bg-[#EB4037]/10 text-[#F4F1EA]' : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:border-[#8492BD]/40 hover:text-[#F4F1EA]'}`}>
                    <span className="font-semibold text-xs block text-[#F4F1EA] mb-0.5">{option.label}</span>
                    <span className="text-[11px] text-[#737D89] block leading-snug">{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs leading-5 text-[#A5ADB8]">FDM · lớp in 0,20 mm. Xưởng xác nhận thông số sau khi kiểm file.</p>

            {/* Mục đích & Kích thước */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="print-purpose" className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  Mục đích sử dụng
                </label>
                <select
                  id="print-purpose"
                  value={purpose}
                  onChange={(e) => {
                    const nextPurpose = e.target.value;
                    setPurpose(nextPurpose);
                    setInfillPercent(DEFAULT_INFILL_BY_PURPOSE[nextPurpose] || '15');
                  }}
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
                <label htmlFor="infill-density" className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  Mật độ infill FDM dự kiến
                </label>
                <select
                  id="infill-density"
                  value={infillPercent}
                  onChange={(e) => setInfillPercent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-mono text-[#F4F1EA] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                  aria-describedby="infill-guidance"
                >
                  {INFILL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#141A21] text-[#F4F1EA]">
                      {option.label}
                    </option>
                  ))}
                </select>
                <p id="infill-guidance" className="text-[10px] leading-relaxed text-[#737D89]">
                  {INFILL_OPTIONS.find((option) => option.value === infillPercent)?.desc} Infill cao không tự bảo đảm độ bền; xưởng còn kiểm tra số vách, vật liệu và hướng in.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  Kích thước đọc từ STL · X × Y × Z
                </label>
                {detectedDims ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#0F141A] border border-[#27313C]">
                    <div className="space-y-1">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-[#737D89]">Kích thước gốc · giả định mm</span>
                      <span className="block text-sm font-mono text-[#F4F1EA]">
                        {formatDimension(detectedDims.x)} × {formatDimension(detectedDims.y)} × {formatDimension(detectedDims.z)} mm
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="scale-percent" className="block text-[10px] font-mono uppercase tracking-wider text-[#737D89]">Tỷ lệ in so với file</label>
                      <div className="relative">
                        <input
                          id="scale-percent"
                          type="number"
                          min="1"
                          max="5000"
                          step="1"
                          value={scalePercent}
                          onChange={(e) => {
                            setScalePercent(e.target.value);
                            setErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.scalePercent;
                              return copy;
                            });
                          }}
                          className="w-full px-3.5 py-2 rounded-lg bg-[#08090C] border border-[#27313C] text-sm font-mono text-[#F4F1EA] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                          aria-invalid={!hasValidScale}
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#737D89] pointer-events-none">%</span>
                      </div>
                      {errors.scalePercent && <p className="text-[10px] text-[#EB4037]" role="alert">{errors.scalePercent}</p>}
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-white/[0.06]">
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-[#737D89]">Kích thước dự kiến sau scale</span>
                      <span className="block mt-1 text-base font-mono font-semibold text-[#C8A261]">
                        {scaledDimensionsCm
                          ? `${formatDimension(scaledDimensionsCm.x)} × ${formatDimension(scaledDimensionsCm.y)} × ${formatDimension(scaledDimensionsCm.z)} cm`
                          : 'Nhập tỷ lệ từ 1% đến 5000%'}
                      </span>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-[#737D89]">
                        STL không lưu đơn vị đo. Nếu kích thước gốc không đúng với ý định thiết kế, hãy chỉnh tỷ lệ hoặc xác nhận lại với xưởng.
                      </p>
                      {exceedsBuildVolume && (
                        <p className="mt-2 text-[11px] leading-relaxed text-[#C8A261]" role="status">
                          Kích thước vượt vùng in hữu dụng sau khi chừa brim. Xưởng cần kiểm tra cách bố trí hoặc chia mẫu trước khi báo giá.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[88px] flex items-center px-3.5 py-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs text-[#737D89]">
                    Chọn tệp STL để tự đọc kích thước. Hệ thống giữ nguyên tỷ lệ các trục khi phóng hoặc thu mô hình.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="space-y-1.5">
                <label htmlFor="requested-color" className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">Màu sắc mong muốn</label>
                <input id="requested-color" type="text" placeholder="Chọn bảng màu bên mô hình hoặc ghi màu riêng"
                  value={color} onChange={event => setColor(event.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-mono text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]" />
              </div>
            </div>

            {/* Thông tin liên hệ & nhận báo giá */}
            <div className="pt-4 border-t border-[#27313C] space-y-4">
              <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                Thông tin liên hệ & xác nhận thông số
              </label>
              <p className="-mt-2 text-xs leading-relaxed text-[#8492BD]">
                MinhLab kiểm tra file, công nghệ, màu và yêu cầu hoàn thiện trước khi xác nhận báo giá cuối.
              </p>

              <div className="rounded-lg border border-[#C8A261]/30 bg-[#C8A261]/[0.06] px-4 py-3 space-y-1.5" aria-live="polite" aria-busy={isAnalyzingQuote}>
                <span className="block text-[10px] font-mono uppercase tracking-widest text-[#C8A261]">Giá tham khảo FDM · 1 sản phẩm</span>
                {isAnalyzingQuote ? (
                  <p className="text-sm text-[#A5ADB8]">Đang phân tích STL để ước tính vật liệu và thời gian in…</p>
                ) : quoteAnalysisError ? (
                  <p className="text-sm text-[#A5ADB8]">{quoteAnalysisError}</p>
                ) : referenceQuote?.status === 'ready' ? (
                  <>
                    <p className="text-xl font-semibold text-[#F4F1EA]">{formatVND(referenceQuote.referencePriceVnd)}</p>
                    <p className="text-xs leading-relaxed text-[#A5ADB8]">
                      Nhựa {referenceQuote.massG.toFixed(2)} g: {formatVND(referenceQuote.materialVnd)}
                      {' · '}Thời gian in {formatPrintDuration(referenceQuote.modelTimeHours)}
                      {' · '}Điện: {formatVND(referenceQuote.electricityVnd)}
                    </p>
                    <p className="text-xs leading-relaxed text-[#A5ADB8]">
                      Khoảng tham khảo {formatVND(referenceQuote.lowPriceVnd)}–{formatVND(referenceQuote.highPriceVnd)}
                      {' '}({`−${referenceQuote.lowDeltaPercent}% / +${referenceQuote.highDeltaPercent}%`} so với mức giữa).
                    </p>
                    <p className="text-[11px] leading-relaxed text-[#737D89]">
                      Ước tính theo cấu hình FDM đã chọn, gồm nhựa support/brim và điện. Thời gian chưa gồm chuẩn bị máy, chờ lượt và hậu xử lý; giá chưa gồm giao hàng. Xưởng sẽ kiểm tra file và xác nhận báo giá cuối.
                    </p>
                  </>
                ) : referenceQuote?.status === 'review' ? (
                  <p className="text-sm leading-relaxed text-[#A5ADB8]">{referenceQuote.message}</p>
                ) : !hasValidScale ? (
                  <p className="text-sm text-[#A5ADB8]">Tỷ lệ in chưa hợp lệ nên chưa thể tính giá tham khảo.</p>
                ) : rawFile ? (
                  <p className="text-sm text-[#A5ADB8]">Đang chờ đọc xong kích thước và lưới STL…</p>
                ) : (
                  <p className="text-sm text-[#A5ADB8]">Chọn tệp STL để xem khoảng giá tham khảo.</p>
                )}
              </div>

              <div className="border-b border-[#27313C] pb-4 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="requested-quantity" className="block text-sm font-medium text-[#F4F1EA]">
                      Số lượng cần in
                    </label>
                    <p id="print-quantity-guidance" className="text-xs leading-relaxed text-[#A5ADB8]">
                      Xem giá một sản phẩm ở trên, rồi nhập số bản bạn muốn in.
                    </p>
                  </div>
                  <input
                    id="requested-quantity"
                    type="number"
                    inputMode="numeric"
                    required
                    min={PRINT_QUANTITY_MIN}
                    max={PRINT_QUANTITY_MAX}
                    step="1"
                    value={quantity}
                    onChange={(event) => {
                      setQuantity(event.target.value);
                      setErrors((previous) => {
                        const next = { ...previous };
                        delete next.quantity;
                        return next;
                      });
                    }}
                    aria-invalid={!hasValidQuantity}
                    aria-describedby={`print-quantity-guidance${!hasValidQuantity ? ' print-quantity-error' : ''}`}
                    className={`w-28 min-h-11 shrink-0 rounded-lg border bg-[#0F141A] px-3.5 py-2.5 text-base font-mono tabular-nums text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] ${hasValidQuantity ? 'border-[#35414E]' : 'border-[#EB4037]'}`}
                  />
                </div>
                {!hasValidQuantity && (
                  <p id="print-quantity-error" className="text-xs text-[#FF8179]" role="alert">
                    {errors.quantity || `Nhập số lượng nguyên từ ${PRINT_QUANTITY_MIN} đến ${PRINT_QUANTITY_MAX}.`}
                  </p>
                )}
                <div aria-live="polite" aria-atomic="true">
                  {quantityEstimate && referenceQuote?.status === 'ready' ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-sm text-[#A5ADB8]">Tổng giá tham khảo · {quantityEstimate.quantity} sản phẩm</span>
                        <output aria-label="Tổng giá tham khảo" className="text-xl font-semibold tabular-nums text-[#C8A261]">
                          {formatVND(quantityEstimate.referencePriceVnd)}
                        </output>
                      </div>
                      <p className="text-xs leading-relaxed text-[#A5ADB8]">
                        {formatVND(referenceQuote.referencePriceVnd)} × {quantityEstimate.quantity}
                        {' · '}Khoảng {formatVND(quantityEstimate.lowPriceVnd)}–{formatVND(quantityEstimate.highPriceVnd)}
                      </p>
                      <p className="text-xs leading-relaxed text-[#A5ADB8]">
                        Tạm tính theo giá một sản phẩm × số lượng, chưa gồm giao hàng và hậu xử lý. Xưởng xác nhận giá cuối sau khi kiểm tra yêu cầu.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-[#A5ADB8]">
                      {hasValidQuantity
                        ? 'Tổng giá sẽ hiện khi có kết quả ước tính cho tệp. Bạn vẫn có thể gửi số lượng để xưởng tư vấn.'
                        : 'Nhập số lượng hợp lệ để xem tổng giá tham khảo.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Họ tên của bạn"
                    aria-label="Họ tên của bạn"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs font-sans text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] min-h-[44px]"
                  />
                </div>

                <div className="space-y-1">
                  <input
                    type="tel"
                    placeholder="Số điện thoại / Zalo *"
                    aria-label="Số điện thoại hoặc Zalo, bắt buộc"
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? 'request-phone-error' : undefined}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-[#0F141A] border text-xs font-mono text-[#F4F1EA] placeholder-[#737D89] focus:outline-none min-h-[44px] ${
                      errors.phone ? 'border-[#EB4037]' : 'border-[#27313C] focus:border-[#EB4037]'
                    }`}
                  />
                  {errors.phone && (
                    <p id="request-phone-error" className="text-[11px] text-[#EB4037] font-mono" role="alert">{errors.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Ghi chú thêm (yêu cầu khớp lắp ráp, bề mặt hoàn thiện...)"
                  aria-label="Ghi chú thêm cho yêu cầu in"
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
                  aria-required="true"
                  aria-invalid={Boolean(errors.confirmedRights)}
                  aria-describedby={errors.confirmedRights ? 'rights-confirmation-error' : undefined}
                  onChange={(e) => setConfirmedRights(e.target.checked)}
                  className="mt-0.5 rounded border-[#27313C] text-[#EB4037] focus:ring-0 bg-[#0F141A]"
                />
                <span className="text-[11px] text-[#A5ADB8] leading-relaxed">
                  Tôi xác nhận rằng tôi có quyền hợp pháp đối với tệp thiết kế 3D này và chịu trách nhiệm về nội dung của tệp. <span className="text-[#C8A261]">Bắt buộc</span>
                </span>
              </label>
              {errors.confirmedRights && (
                <p id="rights-confirmation-error" className="text-[11px] text-[#EB4037] font-mono" role="alert">{errors.confirmedRights}</p>
              )}
            </div>

            <p className="text-sm leading-6 text-[#C8A261]">Gửi yêu cầu ngay bên dưới. Xưởng kiểm file trước khi xác nhận báo giá.</p>
            <button type="submit" className="min-h-11 text-sm text-[#A5ADB8] underline">Tùy chọn: xem tóm tắt để gửi qua Zalo / email</button>

          </div>
  </>);
}
