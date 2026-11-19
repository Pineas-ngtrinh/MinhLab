import { AppError } from './errors';
import { isRecord, textField } from './request-validation';
import { isCatalogImage } from '../domain/catalog/catalog-policy';
import {
  PRODUCT_SOURCES,
  VARIANT_STATUSES,
  type ProductInput,
  type ProductVariantInput,
  type PublicationInput,
  type CatalogCategoryInput,
} from '../contracts/catalog-admin';

export function parseCatalogCategoryInput(value: unknown): CatalogCategoryInput {
  if (!isRecord(value)) throw new AppError('Thông tin danh mục không hợp lệ.');
  return {
    name: textField(value.name, 'Tên danh mục', 120),
    description: textField(value.description, 'Mô tả danh mục', 2000, false),
  };
}

export function uuidField(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new AppError('Mã dữ liệu không hợp lệ.');
  }
  return value;
}
export function revisionField(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2147483646
  ) {
    throw new AppError('Phiên bản dữ liệu không hợp lệ.');
  }
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new AppError(`${label} không hợp lệ.`);
  return value as T;
}
function numeric(value: unknown, maximum: number, nullable = true, integer = false): number | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new AppError('Giá hoặc thông số sản phẩm không hợp lệ.');
  return value;
}
function parseVariant(value: unknown): ProductVariantInput {
  if (!isRecord(value)) throw new AppError('Biến thể sản phẩm không hợp lệ.');
  const price = numeric(value.price, 9999999999, false, true)!;
  const originalPrice = numeric(value.originalPrice, 9999999999, true, true);
  if (originalPrice !== null && originalPrice < price)
    throw new AppError('Giá niêm yết phải từ giá bán trở lên.');
  const hex = textField(value.hex, 'Mã màu', 7);
  if (!/^#[a-f0-9]{6}$/i.test(hex)) throw new AppError('Mã màu cần có dạng #RRGGBB.');
  return {
    id: value.id === undefined ? undefined : uuidField(value.id),
    name: textField(value.name, 'Tên biến thể', 160),
    color: textField(value.color, 'Tên màu', 60, false),
    hex,
    price,
    originalPrice,
    lengthMm: numeric(value.lengthMm, 99999999.99),
    widthMm: numeric(value.widthMm, 99999999.99),
    heightMm: numeric(value.heightMm, 99999999.99),
    weightGrams: numeric(value.weightGrams, 99999999.99),
    status: choice(value.status, VARIANT_STATUSES, 'Tình trạng biến thể'),
  };
}
export function parseProductInput(value: unknown): ProductInput {
  if (!isRecord(value)) throw new AppError('Thông tin sản phẩm không hợp lệ.');
  if (!Array.isArray(value.variants) || value.variants.length < 1 || value.variants.length > 30)
    throw new AppError('Sản phẩm cần từ 1 đến 30 biến thể.');
  const variants = value.variants.map(parseVariant);
  const names = variants.map((item) => item.name.toLocaleLowerCase('vi-VN'));
  const ids = variants.flatMap((item) => (item.id ? [item.id] : []));
  if (new Set(names).size !== names.length || new Set(ids).size !== ids.length)
    throw new AppError('Tên hoặc mã biến thể bị trùng.');
  if (
    !Array.isArray(value.images) ||
    value.images.length > 20 ||
    value.images.some((url) => typeof url !== 'string' || url.length > 2000 || !isCatalogImage(url))
  ) {
    throw new AppError('Ảnh cần là URL Cloudinary HTTPS hoặc đường dẫn /images/, tối đa 20 ảnh.');
  }
  if (typeof value.featured !== 'boolean')
    throw new AppError('Thông tin sản phẩm nổi bật không hợp lệ.');
  const sortOrder = numeric(value.sortOrder, 2147483647, false, true)!;
  return {
    categoryId: uuidField(value.categoryId),
    name: textField(value.name, 'Tên sản phẩm', 200),
    shortDescription: textField(value.shortDescription, 'Mô tả ngắn', 300, false),
    description: textField(value.description, 'Mô tả chi tiết', 12000, false),
    material: textField(value.material, 'Vật liệu', 160, false),
    leadTime: textField(value.leadTime, 'Thời gian hoàn thiện', 160, false),
    layerHeight: textField(value.layerHeight, 'Độ phân giải', 160, false),
    source: choice(value.source, PRODUCT_SOURCES, 'Nguồn sản phẩm'),
    productionMode: choice(value.productionMode, ['IN_STOCK', 'MADE_TO_ORDER'], 'Cách sản xuất'),
    featured: value.featured,
    badge:
      value.badge == null
        ? null
        : choice(value.badge, ['MỚI', 'TIÊU BIỂU', 'BÁN CHẠY', 'ĐỘC BẢN'] as const, 'Nhãn'),
    sortOrder,
    images: [...new Set(value.images as string[])],
    variants,
  };
}
export function parsePublicationInput(value: unknown): PublicationInput {
  if (!isRecord(value)) throw new AppError('Yêu cầu xuất bản không hợp lệ.');
  const action = choice(value.action, ['PUBLISH', 'HIDE', 'ARCHIVE'], 'Thao tác');
  return {
    action,
    revision: revisionField(value.revision),
    note: textField(value.note, 'Lý do/ghi chú duyệt', 2000),
    rightsConfirmed: value.rightsConfirmed === true,
  };
}
