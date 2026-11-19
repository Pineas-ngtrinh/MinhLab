import type { ProductInput, ProductVariantInput } from '../../../contracts/catalog-admin';

export const INPUT =
  'min-h-11 w-full rounded-lg border border-[#27313C] bg-[#0B0F14] px-3 py-2 text-sm text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent disabled:opacity-40';
export const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#27313C] px-4 text-sm text-[#F4F1EA] transition-colors hover:border-admin-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent disabled:cursor-not-allowed disabled:opacity-40';
export const PUBLICATION_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang bán',
  HIDDEN: 'Đã ẩn',
  ARCHIVED: 'Ngừng kinh doanh',
};
// Retired SKUs remain in the database for old orders, outside the editable variant limit.
export function editableVariants(variants: ProductVariantInput[]): ProductVariantInput[] {
  return variants.filter((variant) => variant.status !== 'INACTIVE');
}
export function newVariant(): ProductVariantInput {
  return {
    name: 'Mặc định',
    color: 'Mặc định',
    hex: '#737D89',
    price: 0,
    originalPrice: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    weightGrams: null,
    status: 'ACTIVE',
  };
}
export function newProduct(categoryId: string): ProductInput {
  return {
    categoryId,
    name: '',
    shortDescription: '',
    description: '',
    material: '',
    leadTime: '',
    layerHeight: '',
    source: 'ORIGINAL',
    productionMode: 'MADE_TO_ORDER',
    featured: false,
    badge: null,
    sortOrder: 0,
    images: [],
    variants: [newVariant()],
  };
}
