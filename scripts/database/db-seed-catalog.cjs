const { createPool } = require('../lib/database.cjs');
const catalog = require('../../database/seeds/catalog.json');

function measurement(value) {
  if (!value) return null;
  const number = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

async function main() {
  const backfillDisplay = process.argv.includes('--backfill-display');
  const pool = createPool(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const categoryIds = new Map();
    for (const category of catalog.categories) {
      await client.query('INSERT INTO categories(name,slug,sort_order) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING',
        [category.name, category.slug, categoryIds.size + 1]);
      const result = await client.query('SELECT id FROM categories WHERE slug=$1', [category.slug]);
      categoryIds.set(category.slug, result.rows[0].id);
    }
    let created = 0;
    let backfilled = 0;
    for (const [position, product] of catalog.products.entries()) {
      const result = await client.query(`INSERT INTO products (
        category_id,product_code,name,slug,short_description,description,compatibility_note,
        product_source_type,production_mode,publication_status,compliance_status,
        material_description,lead_time_description,layer_height_description,is_featured,badge,sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'FUNCTIONAL_REPLACEMENT','MADE_TO_ORDER','DRAFT','NEEDS_REVIEW',
        $8,$9,$10,$11,$12,$13) ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [categoryIds.get(product.categorySlug), product.code.trim(), product.title, product.id,
        product.description.slice(0,300), product.longDescription || product.description,
        'Mẫu remake do MinhLab chế tác; cần nhân sự rà soát nguồn gốc và khả năng tương thích trước khi xuất bản.',
        product.material, product.printTime ?? null, product.layerHeight ?? null,
        product.featured ?? false, product.badge ?? null, position + 1]);
      const isNew = result.rowCount > 0;
      if (!isNew && !backfillDisplay) continue;
      const productId = result.rows[0]?.id ?? (await client.query('SELECT id FROM products WHERE slug=$1',[product.id])).rows[0].id;
      if (isNew) created += 1;
      const hasImages = (await client.query('SELECT 1 FROM product_images WHERE product_id=$1 LIMIT 1',[productId])).rowCount > 0;
      if (!isNew && !hasImages) {
        // Explicit one-time upgrade: preserve existing names, descriptions, prices, IDs and approval states.
        await client.query(`UPDATE products SET material_description=COALESCE(material_description,$2),
          lead_time_description=COALESCE(lead_time_description,$3), layer_height_description=COALESCE(layer_height_description,$4),
          is_featured=$5, badge=COALESCE(badge,$6), sort_order=$7 WHERE id=$1`,
        [productId,product.material,product.printTime ?? null,product.layerHeight ?? null,
          product.featured ?? false,product.badge ?? null,position + 1]);
        backfilled += 1;
      }
      if (!hasImages) {
        for (const [index,url] of [...new Set([product.image,...(product.gallery ?? [])])].entries()) {
          await client.query('INSERT INTO product_images(product_id,url,alt_text,sort_order) VALUES ($1,$2,$3,$4)',
            [productId,url,product.title,index]);
        }
      }
      const dimensions = product.dimensions.split(/[×x]/).map(part => measurement(part.trim()));
      const colors = product.colors?.length ? product.colors : [{name:'Mặc định',hex:'#737D89'}];
      for (const [index,color] of colors.entries()) {
        const sku = `${product.id}-${String(index+1).padStart(3,'0')}`;
        if (isNew) {
          await client.query(`INSERT INTO product_variants(product_id,sku,variant_name,color_name,color_hex,
            length_mm,width_mm,height_mm,weight_grams,sale_price,compare_at_price,status)
            VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [productId,sku,color.name,color.hex,...[0,1,2].map(i=>dimensions[i] == null ? null : dimensions[i]*10),
            measurement(product.weight),product.price,product.originalPrice ?? null,product.inStock?'ACTIVE':'OUT_OF_STOCK']);
        } else if (!hasImages) {
          await client.query(`UPDATE product_variants SET color_hex=COALESCE(color_hex,$2),
            compare_at_price=COALESCE(compare_at_price,CASE WHEN $3::numeric>=sale_price THEN $3::numeric ELSE NULL END)
            WHERE sku=$1 AND product_id=$4`,[sku,color.hex,product.originalPrice ?? null,productId]);
        }
      }
    }
    await client.query('COMMIT');
    process.stdout.write(`Catalogue: ${created} sản phẩm mới, ${backfilled} sản phẩm bổ sung nội dung hiển thị; giữ nguyên trạng thái duyệt.\n`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error=>{process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);process.exitCode=1;});
