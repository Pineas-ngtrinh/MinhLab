/** Catalogue checkout policy. Custom-print estimates keep their separately approved rate card. */
export const CATALOG_FREE_SHIPPING_FROM = 500000;
export const CATALOG_SHIPPING_FEE = 30000;
export const MAX_ORDER_TOTAL = 999999999999; // orders/line_total numeric(14,2), whole VND.
export const MAX_UNIT_PRICE = 9999999999; // order_items.unit_price numeric(12,2), whole VND.

export function validUnitPrice(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_UNIT_PRICE;
}

export function catalogShippingFee(subtotal: number): number {
  return subtotal >= CATALOG_FREE_SHIPPING_FROM ? 0 : CATALOG_SHIPPING_FEE;
}
export function validOrderAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_ORDER_TOTAL;
}
