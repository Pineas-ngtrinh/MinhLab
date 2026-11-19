import { AppError } from '../../lib/errors';
import type { CatalogImagePlacement } from '../../contracts/catalog-admin';
import { validateCatalogImage } from './catalog-image-validation';

export interface CatalogImageAsset {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: 'jpg' | 'png' | 'webp';
  bytes: number;
  sha256: string;
}

export interface CatalogImageStorage {
  upload(input: {
    productName: string;
    productCode: string;
    bytes: Uint8Array;
    filename: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    format: 'jpg' | 'png' | 'webp';
  }): Promise<CatalogImageAsset>;
  delete(publicId: string): Promise<void>;
}

export interface CatalogImageRepository {
  resolveProductFolder(input: {
    productId: string;
    actorRole: 'ADMIN' | 'WORKSHOP_OPERATOR';
  }): Promise<{ name: string; code: string }>;
  saveProductImage(input: {
    productId: string;
    actorId: string;
    actorRole: 'ADMIN' | 'WORKSHOP_OPERATOR';
    filename: string;
    mimeType: string;
    asset: CatalogImageAsset;
    placement: CatalogImagePlacement;
  }): Promise<void>;
  hasPersistedProductImage(input: { productId: string; publicId: string }): Promise<boolean>;
}

export function createCatalogImageService(dependencies: {
  storage: CatalogImageStorage;
  repository: CatalogImageRepository;
}) {
  return {
    async uploadProductImage(input: {
      productId: string;
      actorId: string;
      actorRole: 'ADMIN' | 'WORKSHOP_OPERATOR';
      bytes: Uint8Array;
      declaredMimeType: string;
      filename: string;
      placement?: CatalogImagePlacement;
    }) {
      const placement = input.placement ?? 'GALLERY';
      const validated = validateCatalogImage(input.bytes, input.declaredMimeType, input.filename);
      const product = await dependencies.repository.resolveProductFolder({
        productId: input.productId,
        actorRole: input.actorRole,
      });
      const asset = await dependencies.storage.upload({
        productName: product.name,
        productCode: product.code,
        bytes: input.bytes,
        filename: validated.originalFilename,
        mimeType: validated.mimeType,
        format: validated.format,
      });

      const result = {
        url: asset.secureUrl,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        bytes: asset.bytes,
      };

      try {
        await dependencies.repository.saveProductImage({
          productId: input.productId,
          actorId: input.actorId,
          actorRole: input.actorRole,
          filename: validated.originalFilename,
          mimeType: validated.mimeType,
          asset,
          placement,
        });
        return result;
      } catch (error) {
        let persisted: boolean;
        try {
          persisted = await dependencies.repository.hasPersistedProductImage({
            productId: input.productId,
            publicId: asset.publicId,
          });
        } catch {
          throw new AppError(
            'Chưa xác định được ảnh đã gắn vào sản phẩm hay chưa; hãy tải lại sản phẩm trước khi thử lại.',
            503,
          );
        }
        if (persisted) return result;
        try {
          await dependencies.storage.delete(asset.publicId);
        } catch {
          throw new AppError(
            'Ảnh đã tải lên kho nhưng chưa gắn được vào sản phẩm; cần kiểm tra kho ảnh.',
            502,
          );
        }
        throw error;
      }
    },
  };
}
