export interface CatalogVariant {
  id: string;
  sku: string;
  name: string;
  color?: string;
  hex: string;
  price: number;
  originalPrice?: number;
  available: boolean;
  dimensions: string;
  weight: string;
}

export interface ProductItem {
  /** Stable public slug. The database UUID remains internal to the product aggregate. */
  id: string;
  code: string;
  title: string;
  category: string;
  categorySlug: string;
  description: string;
  longDescription?: string;
  price: number;
  originalPrice?: number;
  image: string;
  gallery?: string[];
  material: string;
  dimensions: string;
  weight: string;
  printTime?: string;
  layerHeight?: string;
  featured?: boolean;
  badge?: 'MỚI' | 'TIÊU BIỂU' | 'BÁN CHẠY' | 'ĐỘC BẢN';
  inStock: boolean;
  madeToOrder: boolean;
  colors: { name: string; hex: string }[];
  variants: CatalogVariant[];
}

export interface CatalogCategory {
  slug: string;
  name: string;
}

export interface CatalogData {
  products: ProductItem[];
  categories: CatalogCategory[];
}
