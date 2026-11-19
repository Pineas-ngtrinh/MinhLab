import type { ProductItem } from '../contracts/catalog';

/** Resolve price and availability from the selected SKU, never from localStorage. */
export function selectProductVariant(product: ProductItem, name?: string, variantId?: string): ProductItem | null {
  const variant = variantId ? product.variants.find(value=>value.id===variantId && value.available)
    : name ? product.variants.find(value => value.name === name && value.available)
    : product.variants.find(value => value.available);
  return variant ? {...product, price: variant.price, originalPrice: variant.originalPrice,
    dimensions: variant.dimensions, weight: variant.weight} : null;
}

export function productAvailability(product: ProductItem): string {
  if (!product.inStock) return 'Tạm hết hàng';
  return product.madeToOrder ? 'Nhận đặt trước' : 'Có sẵn tại xưởng';
}

export function productBadge(product: ProductItem): string {
  if (!product.inStock) return 'Tạm hết hàng';
  return product.madeToOrder ? 'Đặt trước' : 'Có sẵn';
}
