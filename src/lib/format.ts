const vnd = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatVND(amount: number): string {
  return `${vnd.format(amount)} ₫`;
}

/** Compact visual reference; API operations still use the full unique order number. */
export function shortOrderNumber(orderNumber: string): string {
  const parts = orderNumber.split('-');
  if (parts.length === 4 && parts[1].length === 4 && parts[2].length === 4 && parts[3].length === 5)
    return `#${parts[2]}-${parts[3]}`;
  return `#${(parts.at(-1) ?? orderNumber).slice(-8)}`;
}
