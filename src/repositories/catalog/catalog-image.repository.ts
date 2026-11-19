import type { PoolClient } from 'pg';
import type { CatalogImagePlacement } from '../../contracts/catalog-admin';
import { AppError } from '../../lib/errors';
import type { CatalogImageAsset } from '../../services/catalog/catalog-image.service';

export class PostgresCatalogImageRepository {
  constructor(private readonly client: PoolClient) {}

  async resolveProductFolder(input: {
    productId: string;
    actorRole: 'ADMIN' | 'WORKSHOP_OPERATOR';
  }): Promise<{ name: string; code: string }> {
    const result = await this.client.query<{
      name: string;
      product_code: string;
      publication_status: string;
    }>(
      'SELECT name,product_code,publication_status FROM products WHERE id=$1',
      [input.productId],
    );
    const product = result.rows[0];
    if (!product) throw new AppError('Không tìm thấy sản phẩm.', 404);
    if (input.actorRole !== 'ADMIN' && product.publication_status !== 'DRAFT')
      throw new AppError('Nhân viên chỉ được thêm ảnh cho sản phẩm bản nháp.', 403);
    return { name: product.name, code: product.product_code };
  }

  async saveProductImage(input: {
    productId: string;
    actorId: string;
    actorRole: 'ADMIN' | 'WORKSHOP_OPERATOR';
    filename: string;
    mimeType: string;
    cloudName: string;
    asset: CatalogImageAsset;
    placement?: CatalogImagePlacement;
  }): Promise<void> {
    const product = await this.client.query<{ name: string; publication_status: string }>(
      'SELECT name,publication_status FROM products WHERE id=$1 FOR UPDATE',
      [input.productId],
    );
    if (!product.rows[0]) throw new AppError('Không tìm thấy sản phẩm.', 404);
    if (input.actorRole !== 'ADMIN' && product.rows[0].publication_status !== 'DRAFT')
      throw new AppError('Nhân viên chỉ được thêm ảnh cho sản phẩm bản nháp.', 403);

    const count = await this.client.query<{ total: number }>(
      'SELECT count(*)::integer AS total FROM product_images WHERE product_id=$1',
      [input.productId],
    );
    if (count.rows[0].total >= 20) throw new AppError('Mỗi sản phẩm tối đa 20 ảnh.');
    const placement = input.placement ?? 'GALLERY';
    const sortOrder = placement === 'MAIN' ? 0 : count.rows[0].total;
    if (placement === 'MAIN') {
      // Move existing rows out of the unique sort_order range, then back one slot later.
      await this.client.query(
        'UPDATE product_images SET sort_order=-sort_order-1 WHERE product_id=$1',
        [input.productId],
      );
      await this.client.query(
        'UPDATE product_images SET sort_order=-sort_order WHERE product_id=$1',
        [input.productId],
      );
    }

    const file = await this.client.query<{ id: string }>(
      `INSERT INTO file_assets(
        uploaded_by,storage_provider,bucket_name,object_key,secure_url,original_filename,
        file_extension,mime_type,byte_size,sha256,image_width,image_height,
        access_level,upload_status,malware_scan_status
      ) VALUES($1,'CLOUDINARY',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PUBLIC','AVAILABLE','PENDING')
      RETURNING id`,
      [
        input.actorId,
        input.cloudName,
        input.asset.publicId,
        input.asset.secureUrl,
        input.filename,
        input.asset.format,
        input.mimeType,
        input.asset.bytes,
        input.asset.sha256,
        input.asset.width,
        input.asset.height,
      ],
    );

    await this.client.query(
      `INSERT INTO product_images(product_id,file_asset_id,url,alt_text,sort_order)
       VALUES($1,$2,$3,$4,$5)`,
      [input.productId, file.rows[0].id, input.asset.secureUrl, product.rows[0].name, sortOrder],
    );

    await this.client.query(
      `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,new_values)
       VALUES($1,'PRODUCT_IMAGE_UPLOADED','PRODUCT',$2,$3::jsonb)`,
      [input.actorId, input.productId, JSON.stringify({
        fileAssetId: file.rows[0].id,
        storageProvider: 'CLOUDINARY',
        format: input.asset.format,
        bytes: input.asset.bytes,
        width: input.asset.width,
        height: input.asset.height,
        placement,
      })],
    );
  }
}
