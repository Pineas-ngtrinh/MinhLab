import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AdminProduct } from '../../../contracts/catalog-admin';
import type { CatalogDependencies, CatalogWriter } from '../catalog.ports';
import { createCatalogManagement } from '../catalog-management.service';

const product: AdminProduct = {
  id: 'product-id',
  code: 'ML-P-001',
  slug: 'fixture',
  categoryId: 'category-id',
  name: 'Sản phẩm thử',
  shortDescription: 'Mô tả ngắn',
  description: 'Mô tả',
  material: 'PLA',
  leadTime: '',
  layerHeight: '',
  source: 'ORIGINAL',
  productionMode: 'MADE_TO_ORDER',
  featured: false,
  badge: null,
  sortOrder: 0,
  images: [],
  variants: [{ id: 'variant-id', sku: 'ML-S-001', name: 'Mặc định', color: 'Đỏ', hex: '#EB4037', price: 1000, originalPrice: null, lengthMm: null, widthMm: null, heightMm: null, weightGrams: null, status: 'ACTIVE' }],
  revision: 1,
  publication: 'PUBLISHED',
  compliance: 'APPROVED',
  updatedAt: new Date(0).toISOString(),
};

test('staff cannot edit a published product and accidentally unpublish it', async () => {
  let writes = 0;
  const writer: CatalogWriter = {
    async get() { return product; },
    async categoryExists() { return true; },
    async nextCode() { return 'ML-P-002'; },
    async save() { writes += 1; return product.id; },
    async publish() {},
    async deleteProduct() { return []; },
    async audit() {},
  };
  const dependencies: CatalogDependencies = {
    async get() { return product; },
    async list() { return { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }; },
    async categories() { return []; },
    async transaction(operation) { return operation(writer); },
  };
  const catalog = createCatalogManagement(dependencies);

  await assert.rejects(
    catalog.save({
      categoryId: product.categoryId,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      material: product.material,
      leadTime: product.leadTime,
      layerHeight: product.layerHeight,
      source: product.source,
      productionMode: product.productionMode,
      featured: product.featured,
      badge: product.badge,
      sortOrder: product.sortOrder,
      images: product.images,
      variants: product.variants,
    }, 'staff-id', { id: product.id, revision: product.revision }, false),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 403,
  );
  assert.equal(writes, 0);
});
