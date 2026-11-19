import { cloudinaryImages } from '../integrations/media/cloudinary-images';
import { PostgresCatalogImageRepository } from '../repositories/catalog/catalog-image.repository';
import { createCatalogImageService } from '../services/catalog/catalog-image.service';
import { query, withTransaction } from '../lib/db';
import { cloudinaryImageConfig } from './cloudinary-config';

const service = createCatalogImageService({
  storage: {
    upload: (input) => cloudinaryImages.upload(cloudinaryImageConfig(), input),
    delete: (publicId) => cloudinaryImages.delete(cloudinaryImageConfig(), publicId),
  },
  repository: {
    resolveProductFolder: (input) => withTransaction((client) =>
      new PostgresCatalogImageRepository(client).resolveProductFolder(input),
    ),
    saveProductImage: (input) => withTransaction((client) =>
      new PostgresCatalogImageRepository(client).saveProductImage({
        ...input,
        cloudName: cloudinaryImageConfig().cloudName,
      }),
    ),
    async hasPersistedProductImage(input) {
      const result = await query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM product_images i
           JOIN file_assets f ON f.id=i.file_asset_id
           WHERE i.product_id=$1 AND f.storage_provider='CLOUDINARY' AND f.object_key=$2
         ) AS exists`,
        [input.productId, input.publicId],
      );
      return result.rows[0]?.exists === true;
    },
  },
});

export const CatalogImages = { uploadProductImage: service.uploadProductImage };
