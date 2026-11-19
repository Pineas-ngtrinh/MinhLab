import type { PoolClient } from 'pg';
import { getDbPool, query } from '../../lib/db';
import { pageInfo } from '../../lib/pagination';
import type {
  AdminProduct,
  CatalogCategoryOption,
  CatalogListOptions,
  ProductInput,
  PublicationInput,
} from '../../contracts/catalog-admin';
import type { CatalogWriter } from '../../services/catalog/catalog.ports';

interface ProductRow {
  id: string;
  product_code: string;
  slug: string;
  category_id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  material_description: string | null;
  lead_time_description: string | null;
  layer_height_description: string | null;
  product_source_type: AdminProduct['source'];
  production_mode: AdminProduct['productionMode'];
  is_featured: boolean;
  badge: AdminProduct['badge'];
  sort_order: number;
  revision: number;
  publication_status: AdminProduct['publication'];
  compliance_status: string;
  updated_at: Date;
  images: string[];
  variants: AdminProduct['variants'];
}
const COLUMNS = `p.id,p.product_code,p.slug,p.category_id,p.name,p.short_description,p.description,
  p.material_description,p.lead_time_description,p.layer_height_description,p.product_source_type,
  p.production_mode,p.is_featured,p.badge,p.sort_order,p.revision,p.publication_status,p.compliance_status,p.updated_at,
  COALESCE((SELECT jsonb_agg(i.url ORDER BY i.sort_order,i.id) FROM product_images i WHERE i.product_id=p.id),'[]') AS images,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'name',v.variant_name,
    'color',COALESCE(v.color_name,''),'hex',COALESCE(v.color_hex,'#737D89'),
    'price',v.sale_price,'originalPrice',v.compare_at_price,'lengthMm',v.length_mm,
    'widthMm',v.width_mm,'heightMm',v.height_mm,'weightGrams',v.weight_grams,'status',v.status)
    ORDER BY v.created_at,v.id) FROM product_variants v WHERE v.product_id=p.id),'[]') AS variants`;

function present(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    code: row.product_code,
    slug: row.slug,
    categoryId: row.category_id,
    name: row.name,
    shortDescription: row.short_description ?? '',
    description: row.description ?? '',
    material: row.material_description ?? '',
    leadTime: row.lead_time_description ?? '',
    layerHeight: row.layer_height_description ?? '',
    source: row.product_source_type,
    productionMode: row.production_mode,
    featured: row.is_featured,
    badge: row.badge,
    sortOrder: row.sort_order,
    revision: row.revision,
    publication: row.publication_status,
    compliance: row.compliance_status,
    updatedAt: row.updated_at.toISOString(),
    images: row.images,
    variants: row.variants,
  };
}
async function get(id: string, client?: PoolClient) {
  const result = await (client ?? getDbPool()).query<ProductRow>(
    `SELECT ${COLUMNS} FROM products p WHERE p.id=$1::uuid${client ? ' FOR UPDATE OF p' : ''}`,
    [id],
  );
  return result.rows[0] ? present(result.rows[0]) : null;
}
export const catalogAdminRepository = {
  get,
  async list(options: CatalogListOptions) {
    const values = [options.status ?? null, options.search ?? ''];
    const where = `WHERE ($1::varchar IS NULL OR p.publication_status=$1)
      AND ($2::text='' OR p.name ILIKE '%'||$2||'%' OR p.product_code ILIKE '%'||$2||'%')`;
    const [count, result] = await Promise.all([
      query<{ total: string }>(`SELECT count(*) AS total FROM products p ${where}`, values),
      query<ProductRow>(
        `SELECT ${COLUMNS} FROM products p ${where} ORDER BY p.created_at DESC,p.id DESC LIMIT $3 OFFSET $4`,
        [...values, options.pageSize, (options.page - 1) * options.pageSize],
      ),
    ]);
    return {
      data: result.rows.map(present),
      pagination: pageInfo(options, Number(count.rows[0].total)),
    };
  },
  async categories(): Promise<CatalogCategoryOption[]> {
    return (
      await query<CatalogCategoryOption>(
        'SELECT id,name,slug FROM categories ORDER BY sort_order,name,id',
      )
    ).rows;
  },
};

export class PostgresCatalogWriter implements CatalogWriter {
  constructor(private readonly client: PoolClient) {}
  get(id: string) {
    return get(id, this.client);
  }
  async categoryExists(id: string) {
    return (await this.client.query('SELECT 1 FROM categories WHERE id=$1', [id])).rowCount === 1;
  }
  async createCategory(input: { name: string; slug: string; description: string | null }) {
    const result = await this.client.query<CatalogCategoryOption>(
      `INSERT INTO categories(name,slug,description,sort_order)
       VALUES($1,$2,$3,(SELECT COALESCE(MAX(sort_order)+1,0) FROM categories))
       ON CONFLICT (slug) DO NOTHING
       RETURNING id,name,slug`,
      [input.name, input.slug, input.description],
    );
    return result.rows[0] ?? null;
  }
  async auditCategory(category: CatalogCategoryOption, actorId: string, description: string | null) {
    await this.client.query(
      `INSERT INTO audit_logs(entity_type,entity_id,actor_user_id,action,new_values)
       VALUES('CATEGORY',$1,$2,'CATEGORY_CREATED',$3::jsonb)`,
      [category.id, actorId, JSON.stringify({ ...category, description })],
    );
  }
  async nextCode() {
    return (
      await this.client.query<{ code: string }>(
        "SELECT 'ML-P-'||nextval('product_code_seq')::text AS code",
      )
    ).rows[0].code;
  }
  async save(
    input: ProductInput,
    actorId: string,
    current: AdminProduct | null,
    code: string,
    slug: string,
  ) {
    const values = [
      input.categoryId,
      input.name,
      input.shortDescription,
      input.description,
      input.material,
      input.leadTime,
      input.layerHeight,
      input.source,
      input.productionMode,
      input.featured,
      input.badge,
      input.sortOrder,
    ];
    let id: string;
    if (current) {
      id = current.id;
      await this.client.query(
        `UPDATE products SET category_id=$1,name=$2,short_description=$3,description=$4,
        material_description=$5,lead_time_description=$6,layer_height_description=$7,product_source_type=$8,
        production_mode=$9,is_featured=$10,badge=$11,sort_order=$12,
        publication_status='DRAFT',compliance_status='NEEDS_REVIEW',compliance_reviewed_by=NULL,
        compliance_reviewed_at=NULL,published_at=NULL,revision=revision+1,updated_at=now() WHERE id=$13`,
        [...values, id],
      );
      // Keep referenced variants and their identities; removed choices become unavailable.
      await this.client.query("UPDATE product_variants SET status='INACTIVE' WHERE product_id=$1", [
        id,
      ]);
    } else {
      id = (
        await this.client.query<{ id: string }>(
          `INSERT INTO products(category_id,name,short_description,description,
        material_description,lead_time_description,layer_height_description,product_source_type,production_mode,
        is_featured,badge,sort_order,created_by,product_code,slug,compliance_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'NEEDS_REVIEW') RETURNING id`,
          [...values, actorId, code, slug],
        )
      ).rows[0].id;
    }
    for (const variant of input.variants) {
      const values = [
        id,
        variant.name,
        variant.color,
        variant.hex,
        variant.price,
        variant.originalPrice,
        variant.lengthMm,
        variant.widthMm,
        variant.heightMm,
        variant.weightGrams,
        variant.status,
      ];
      if (variant.id) {
        await this.client.query(
          `UPDATE product_variants SET variant_name=$2,color_name=$3,color_hex=$4,
          sale_price=$5,compare_at_price=$6,length_mm=$7,width_mm=$8,height_mm=$9,weight_grams=$10,status=$11
          WHERE product_id=$1 AND id=$12`,
          [...values, variant.id],
        );
      } else {
        await this.client.query(
          `INSERT INTO product_variants(product_id,variant_name,color_name,color_hex,sale_price,
          compare_at_price,length_mm,width_mm,height_mm,weight_grams,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          values,
        );
      }
    }
    await this.client.query('DELETE FROM product_images WHERE product_id=$1', [id]);
    for (const [position, url] of input.images.entries()) {
      await this.client.query(
        `INSERT INTO product_images(product_id,file_asset_id,url,alt_text,sort_order)
         VALUES (
           $1,
           (SELECT id FROM file_assets WHERE storage_provider='CLOUDINARY'
             AND secure_url=$2 AND upload_status='AVAILABLE' ORDER BY created_at DESC,id DESC LIMIT 1),
           $2,$3,$4
         )`,
        [id, url, input.name, position],
      );
    }
    return id;
  }
  async publish(current: AdminProduct, input: PublicationInput, actorId: string) {
    const publication = { PUBLISH: 'PUBLISHED', HIDE: 'HIDDEN', ARCHIVE: 'ARCHIVED' }[input.action];
    await this.client.query(
      `UPDATE products SET publication_status=$2::varchar,
      compliance_status=CASE WHEN $2::varchar='PUBLISHED' THEN 'APPROVED' ELSE compliance_status END,
      compliance_reviewed_by=CASE WHEN $2::varchar='PUBLISHED' THEN $3::uuid ELSE compliance_reviewed_by END,
      compliance_reviewed_at=CASE WHEN $2::varchar='PUBLISHED' THEN now() ELSE compliance_reviewed_at END,
      compliance_notes=CASE WHEN $2::varchar='PUBLISHED' THEN $4 ELSE compliance_notes END,
      published_at=CASE WHEN $2::varchar='PUBLISHED' THEN now() ELSE published_at END,
      revision=revision+1,updated_at=now() WHERE id=$1`,
      [current.id, publication, actorId, input.note],
    );
    await this.client.query(
      `INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason)
      VALUES ('PRODUCT',$1,$2,$3,$4,$5)`,
      [current.id, current.publication, publication, actorId, input.note],
    );
  }
  async deleteProduct(id: string) {
    // Lock variants before checking references so concurrent order/cart/BOM writes
    // either become visible to this check or fail their foreign key after deletion.
    const variants = await this.client.query<{ id: string }>(
      'SELECT id FROM product_variants WHERE product_id=$1::uuid FOR UPDATE',
      [id],
    );
    const variantIds = variants.rows.map((variant) => variant.id);
    if (variantIds.length) {
      const references = await this.client.query<{
        in_cart: boolean;
        in_order: boolean;
        in_bom: boolean;
        in_stock_history: boolean;
      }>(
        `SELECT
          EXISTS(SELECT 1 FROM cart_items WHERE product_variant_id=ANY($1::uuid[])) AS in_cart,
          EXISTS(SELECT 1 FROM order_items WHERE product_variant_id=ANY($1::uuid[])) AS in_order,
          EXISTS(SELECT 1 FROM manufacturing_revisions WHERE variant_id=ANY($1::uuid[])) AS in_bom,
          EXISTS(SELECT 1 FROM stock_movements WHERE stock_type='PRODUCT_VARIANT' AND item_id=ANY($1::uuid[])) AS in_stock_history`,
        [variantIds],
      );
      const row = references.rows[0];
      const blockers: Array<'CART' | 'ORDER' | 'BOM' | 'STOCK'> = [];
      if (row.in_cart) blockers.push('CART');
      if (row.in_order) blockers.push('ORDER');
      if (row.in_bom) blockers.push('BOM');
      if (row.in_stock_history) blockers.push('STOCK');
      if (blockers.length) return blockers;
    }

    await this.client.query('DELETE FROM product_variants WHERE product_id=$1::uuid', [id]);
    await this.client.query('DELETE FROM products WHERE id=$1::uuid', [id]);
    return [];
  }
  async audit(action: string, id: string, actorId: string, before: unknown, after: unknown) {
    await this.client.query(
      `INSERT INTO audit_logs(entity_type,entity_id,actor_user_id,action,old_values,new_values)
      VALUES ('PRODUCT',$1,$2,$3,$4::jsonb,$5::jsonb)`,
      [id, actorId, action, JSON.stringify(before), JSON.stringify(after)],
    );
  }
}
