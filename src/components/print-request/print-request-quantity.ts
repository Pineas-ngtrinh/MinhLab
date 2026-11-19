import type { ReferenceQuoteView } from '../../lib/quote';

export const PRINT_QUANTITY_MIN = 1;
export const PRINT_QUANTITY_MAX = 100;

export function parsePrintQuantity(value: string): number | null {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= PRINT_QUANTITY_MIN && quantity <= PRINT_QUANTITY_MAX
    ? quantity
    : null;
}

/** Multiply the displayed unit estimate; this does not estimate a shared print batch or apply discounts. */
export function estimatePrintQuantity(quote: ReferenceQuoteView | null, value: string) {
  const quantity = parsePrintQuantity(value);
  if (quote?.status !== 'ready' || quantity === null) return null;
  return {
    quantity,
    referencePriceVnd: quote.referencePriceVnd * quantity,
    lowPriceVnd: quote.lowPriceVnd * quantity,
    highPriceVnd: quote.highPriceVnd * quantity,
  };
}
