import type { ProductionProgressData } from '../../contracts/orders';
const LABELS: Record<ProductionProgressData['status'], string> = { WAITING_DATA: 'Xưởng đang bổ sung dữ liệu chế tạo', WAITING_PLAN: 'Chờ xưởng duyệt phương án chế tác', SCHEDULED: 'Đã xếp lịch chế tác', IN_PROGRESS: 'Đang chế tác', POST_PROCESSING: 'Đang hậu xử lý', WAITING_QC: 'Chờ kiểm tra chất lượng', FINISHING_REVIEW: 'Xưởng đang kiểm tra và hoàn thiện', PACKING: 'Đang đóng gói', READY_FOR_DISPATCH: 'Đã đóng gói, sẵn sàng giao' };
export function OrderProductionProgress({ items }: {
    items?: ProductionProgressData[];
}) {
    if (!items?.length)
        return null;
    return <section aria-label="Tiến độ chế tác" className="space-y-2 border-t border-[#27313C] pt-4"><h3 className="text-sm font-semibold text-[#F4F1EA]">Tiến độ chế tác</h3><ul className="space-y-2 text-sm leading-6 text-[#A5ADB8]">{items.map((item, i) => <li key={i} className="break-words">{item.itemName} × {item.quantity} · <span className="text-[#C8A261]">{LABELS[item.status]}</span></li>)}</ul></section>;
}
