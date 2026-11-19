import type { ProductionItem } from '../../contracts/production';

export function batchingDue(items: Pick<ProductionItem, 'orderId'|'placedAt'>[], now: number, minOrders: number, maxHours: number) {
    return items.length > 0 && (new Set(items.map(i => i.orderId)).size >= minOrders ||
        items.some(i => now - Date.parse(i.placedAt) >= maxHours * 3600000));
}
