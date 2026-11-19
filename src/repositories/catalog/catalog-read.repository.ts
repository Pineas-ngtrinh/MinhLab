import { isCatalogImage } from '../../domain/catalog/catalog-policy';
import { query } from "../../lib/db";
import type {
  CatalogData,
  CatalogVariant,
  ProductItem,
} from "../../contracts/catalog";

interface VariantRow {
  id: string;
  sku: string;
  variant_name: string;
  color_name: string | null;
  color_hex: string | null;
  sale_price: string;
  compare_at_price: string | null;
  status: string;
  length_mm: string | null;
  width_mm: string | null;
  height_mm: string | null;
  weight_grams: string | null;
}
interface CatalogRow {
  slug: string;
  product_code: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category_name: string;
  category_slug: string;
  material_description: string | null;
  lead_time_description: string | null;
  layer_height_description: string | null;
  production_mode: string;
  is_featured: boolean;
  badge: ProductItem["badge"] | null;
  images: { url: string }[];
  variants: VariantRow[];
}

/** Explicit public projection. No compliance notes, provider keys or private file URLs. */
export function presentCatalogProduct(row: CatalogRow): ProductItem {
  const variants: CatalogVariant[] = row.variants.map((value) => ({
    id: value.id,
    sku: value.sku,
    name: value.variant_name,
    color: value.color_name ?? undefined,
    hex: value.color_hex ?? "#737D89",
    price: Number(value.sale_price),
    originalPrice:
      value.compare_at_price === null
        ? undefined
        : Number(value.compare_at_price),
    available: value.status === "ACTIVE",
    dimensions: [value.length_mm, value.width_mm, value.height_mm].every(
      (size) => size !== null,
    )
      ? `${[value.length_mm, value.width_mm, value.height_mm].map((size) => Number(size) / 10).join(" × ")} cm`
      : "",
    weight:
      value.weight_grams === null ? "" : `${Number(value.weight_grams)} gram`,
  }));
  const baseIndex = Math.max(
    0,
    variants.findIndex((value) => value.available),
  );
  const base = variants[baseIndex];
  const images = row.images.map((value) => value.url).filter(isCatalogImage);
  return {
    id: row.slug,
    code: row.product_code,
    title: row.name,
    category: row.category_name,
    categorySlug: row.category_slug,
    description: row.short_description ?? "",
    longDescription: row.description ?? undefined,
    price: base?.price ?? 0,
    originalPrice: base?.originalPrice,
    image: images[0] ?? "/images/product-placeholder.svg",
    gallery: images,
    material: row.material_description ?? "",
    dimensions: base?.dimensions ?? "",
    weight: base?.weight ?? "",
    printTime: row.lead_time_description ?? undefined,
    layerHeight: row.layer_height_description ?? undefined,
    featured: row.is_featured,
    badge: row.badge ?? undefined,
    madeToOrder: row.production_mode === "MADE_TO_ORDER",
    inStock: variants.some((value) => value.available),
    colors: variants
      .filter((value) => value.available)
      .map((value) => ({ name: value.name, hex: value.hex })),
    variants,
  };
}

export const catalogRepository = {
  async read(requirePublished: boolean): Promise<CatalogData> {
    const result = await query<CatalogRow>(
      `SELECT
      p.slug, p.product_code, p.name, p.short_description, p.description,
      c.name AS category_name, c.slug AS category_slug,
      p.material_description, p.lead_time_description, p.layer_height_description,
      p.production_mode, p.is_featured, p.badge,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('url', i.url) ORDER BY i.sort_order, i.id)
        FROM product_images i WHERE i.product_id = p.id), '[]'::jsonb) AS images,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'sku', v.sku, 'variant_name', v.variant_name,
        'color_name', v.color_name, 'color_hex', v.color_hex,
        'sale_price', v.sale_price::text, 'compare_at_price', v.compare_at_price::text,
        'status', v.status, 'length_mm', v.length_mm::text, 'width_mm', v.width_mm::text,
        'height_mm', v.height_mm::text, 'weight_grams', v.weight_grams::text
      ) ORDER BY v.created_at, v.id) FROM product_variants v
        WHERE v.product_id = p.id AND v.status IN ('ACTIVE','OUT_OF_STOCK')) AS variants
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.publication_status IN ('DRAFT','PUBLISHED') AND p.compliance_status <> 'REJECTED'
        AND (NOT $1::boolean OR (p.publication_status = 'PUBLISHED' AND p.compliance_status = 'APPROVED'))
        AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.status IN ('ACTIVE','OUT_OF_STOCK'))
      ORDER BY p.sort_order, p.created_at, p.id`,
      [requirePublished],
    );
    const products = result.rows.map(presentCatalogProduct);
    const categories = [
      ...new Map(
        products.map((product) => [
          product.categorySlug,
          { slug: product.categorySlug, name: product.category },
        ]),
      ).values(),
    ];
    return { products, categories };
  },
};
