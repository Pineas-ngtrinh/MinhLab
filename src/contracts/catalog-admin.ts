import type { ProductItem } from './catalog';
import type { PageOptions, PageResult } from './pagination';

export const PRODUCT_PUBLICATIONS = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'] as const;
export const PRODUCT_SOURCES = [
  'ORIGINAL',
  'LICENSED',
  'PUBLIC_DOMAIN',
  'FUNCTIONAL_REPLACEMENT',
] as const;
export const VARIANT_STATUSES = ['ACTIVE', 'OUT_OF_STOCK', 'INACTIVE'] as const;
export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOG_IMAGE_REQUEST_MAX_BYTES = CATALOG_IMAGE_MAX_BYTES + 64 * 1024;
export type CatalogImageFormat = 'jpg' | 'png' | 'webp';
export type CatalogImagePlacement = 'MAIN' | 'GALLERY';

export interface CatalogImageUploadResult {
  url: string;
  width: number;
  height: number;
  format: CatalogImageFormat;
  bytes: number;
}

export interface ProductVariantInput {
  id?: string;
  name: string;
  color: string;
  hex: string;
  price: number;
  originalPrice: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightGrams: number | null;
  status: (typeof VARIANT_STATUSES)[number];
}
export interface ProductInput {
  categoryId: string;
  name: string;
  shortDescription: string;
  description: string;
  material: string;
  leadTime: string;
  layerHeight: string;
  source: (typeof PRODUCT_SOURCES)[number];
  productionMode: 'IN_STOCK' | 'MADE_TO_ORDER';
  featured: boolean;
  badge: ProductItem['badge'] | null;
  sortOrder: number;
  images: string[];
  variants: ProductVariantInput[];
}
export interface AdminProduct extends ProductInput {
  id: string;
  code: string;
  slug: string;
  revision: number;
  publication: (typeof PRODUCT_PUBLICATIONS)[number];
  compliance: string;
  updatedAt: string;
  variants: (ProductVariantInput & { id: string; sku: string })[];
}
export interface CatalogCategoryOption {
  id: string;
  name: string;
  slug: string;
}
export interface CatalogCategoryInput {
  name: string;
  description?: string;
}
export interface CatalogListOptions extends PageOptions {
  search?: string;
}
export type AdminCatalogPage = PageResult<AdminProduct>;
export interface PublicationInput {
  revision: number;
  action: 'PUBLISH' | 'HIDE' | 'ARCHIVE';
  note: string;
  rightsConfirmed: boolean;
}
