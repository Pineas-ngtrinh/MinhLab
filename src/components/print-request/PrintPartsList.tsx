'use client';

import type { usePrintRequest } from './usePrintRequest';
import { formatPrintDuration } from './print-request-settings';
import { formatVND } from '../../lib/format';

export function PrintPartsList({ model }: { model: ReturnType<typeof usePrintRequest> }) {
  const parts = model.partEstimates;
  if (!parts?.length) return null;
  const ready = parts.filter(part => part.quote?.status === 'ready' && part.estimate);
  const totals = ready.reduce((sum, part) => {
    if (part.quote?.status !== 'ready' || !part.estimate) return sum;
    return { mass: sum.mass + part.quote.massG * part.estimate.quantity, hours: sum.hours + part.quote.modelTimeHours * part.estimate.quantity, price: sum.price + part.estimate.referencePriceVnd, low: sum.low + part.estimate.lowPriceVnd, high: sum.high + part.estimate.highPriceVnd };
  }, { mass: 0, hours: 0, price: 0, low: 0, high: 0 });
  return <section className="space-y-3 rounded-xl border border-[#27313C] p-4" aria-label="Danh sách linh kiện và dự đoán">
    <h2 className="font-semibold">Linh kiện · {parts.length}/10</h2>
    <p className="text-xs leading-5 text-[#A5ADB8]">Chọn nhiều STL cùng lúc. Vật liệu, tỷ lệ và mật độ ruột áp dụng cho cả danh sách; số bản chỉnh riêng từng linh kiện. Chọn tên để xem mô hình.</p>
    <ul className="divide-y divide-[#27313C]">
      {parts.map(part => <li key={`${part.file.name}-${part.file.size}-${part.file.lastModified}`} className="space-y-2 py-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={model.rawFile === part.file} onClick={() => model.selectPart(part.file)} className={`min-h-11 min-w-0 flex-1 break-words text-left text-sm ${model.rawFile === part.file ? 'font-semibold text-[#C8A261]' : 'text-[#F4F1EA]'} focus-visible:ring-2 focus-visible:ring-[#C8A261]`}>{part.file.name}</button>
          <input type="number" aria-label={`Số bản ${part.file.name}`} min={1} max={100} step={1} value={part.quantity} onChange={event => model.setPartQuantity(part.file, event.target.value)} className="min-h-11 w-16 rounded border border-[#27313C] bg-[#0B0F14] px-2 text-base" />
          <button type="button" aria-label={`Gỡ ${part.file.name}`} onClick={() => model.removePart(part.file)} className="min-h-11 px-2 text-sm text-[#A5ADB8] focus-visible:ring-2 focus-visible:ring-[#C8A261]">Gỡ</button>
        </div>
        <p className="text-xs leading-5 text-[#A5ADB8]" role="status">{part.analyzing ? 'Đang chờ / phân tích STL…' : part.quote?.status === 'ready' && part.estimate ? `${(part.quote.massG * part.estimate.quantity).toFixed(2)} g · ${formatPrintDuration(part.quote.modelTimeHours * part.estimate.quantity)} · ${formatVND(part.estimate.referencePriceVnd)}` : part.error || 'Chưa có ước tính hợp lệ; cần xưởng kiểm tra file và số lượng.'}</p>
      </li>)}
    </ul>
    {ready.length > 0 && <p className="border-t border-[#27313C] pt-3 text-sm leading-6 text-[#C8A261]">{ready.length === parts.length ? 'Tổng tham khảo' : `Tạm tính ${ready.length}/${parts.length} linh kiện`}: {totals.mass.toFixed(2)} g · {formatPrintDuration(totals.hours)} · {formatVND(totals.price)} (khoảng {formatVND(totals.low)}–{formatVND(totals.high)})</p>}
    <p className="text-xs leading-5 text-[#A5ADB8]">Tổng cộng các lượt in riêng, chưa tối ưu gom mẻ, chưa gồm hậu xử lý và giao hàng. Gửi yêu cầu cho linh kiện đang chọn ở bên dưới; các file còn lại vẫn được giữ trong tab này.</p>
  </section>;
}
