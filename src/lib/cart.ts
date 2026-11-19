import type { ProductItem } from '../contracts/catalog';
import { selectProductVariant } from './catalog';
import type { CartItem } from '../context/CartContext';

// Persisted browser data is untrusted and may contain removed products/prices.
export function restoreCart(value: unknown, products: ProductItem[]): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (!item.product || typeof item.product !== 'object') return [];
    const product = products.find(p => p.id === (item.product as Record<string, unknown>).id);
    if (!product || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) return [];
    const selectedColor = typeof item.selectedColor === 'string' ? item.selectedColor : product.colors[0]?.name;
    const variantId = typeof item.variantId === 'string' ? item.variantId : undefined;
    const selected = selectProductVariant(product, selectedColor, variantId);
    if (!selected) return [];
    const variant = selected.variants.find(value=>variantId ? value.id===variantId : value.name===selectedColor);
    if (!variant) return [];
    return [{ product: selected, quantity: Math.min(item.quantity, 100), selectedColor:variant.name, variantId:variant.id }];
  });
}

export function mergeCartItems(stored: CartItem[], added: CartItem[]): CartItem[] {
  const result = new Map<string, CartItem>();
  for (const item of [...stored, ...added]) {
    const key = JSON.stringify([item.product.id,item.variantId ?? item.selectedColor]);
    const existing = result.get(key);
    result.set(key, {...item,quantity:Math.min(100,item.quantity+(existing?.quantity ?? 0))});
  }
  return [...result.values()];
}

export function cartReferences(items: CartItem[]) {
  return items.map(item => ({product:{id:item.product.id},quantity:item.quantity,selectedColor:item.selectedColor,variantId:item.variantId}));
}

export function matchesCartItem(item: CartItem, productId: string, color?: string): boolean {
  return item.product.id === productId && (color === undefined || item.variantId === color || item.selectedColor === color);
}
