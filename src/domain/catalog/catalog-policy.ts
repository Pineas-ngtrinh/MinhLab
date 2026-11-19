import type { ProductInput } from '../../contracts/catalog-admin';

export function isCatalogImage(value: string): boolean {
  if (/^\/images\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes('..')) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'res.cloudinary.com' &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

export function catalogSlug(name: string, code: string): string {
  const prefix = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 150)
    .replace(/-$/, '');
  return `${prefix || 'san-pham'}-${code.toLowerCase()}`;
}

export function catalogCategorySlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140)
    .replace(/-$/g, '');
  return slug || 'danh-muc';
}

export function publicationProblems(product: ProductInput): string[] {
  const errors: string[] = [];
  if (!product.shortDescription || !product.description)
    errors.push('Cần mô tả ngắn và mô tả chi tiết.');
  if (!product.material) errors.push('Cần ghi rõ vật liệu.');
  if (!product.images.length) errors.push('Cần ít nhất một ảnh sản phẩm.');
  if (!product.variants.some((variant) => variant.status === 'ACTIVE'))
    errors.push('Cần ít nhất một biến thể đang bán.');
  return errors;
}
