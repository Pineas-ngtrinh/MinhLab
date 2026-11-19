import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCatalogCategoryInput } from '../../../lib/catalog-validation';
import { createCatalogCategoryService } from '../catalog-category.service';

test('category creation normalizes Vietnamese names and audits the saved category', async () => {
  const calls: unknown[] = [];
  const create = createCatalogCategoryService({
    transaction: async (run) => run({
      async createCategory(input) {
        calls.push(input);
        return { id: 'category-id', name: input.name, slug: input.slug };
      },
      async auditCategory(category, actorId, description) { calls.push({ category, actorId, description }); },
    }),
  });
  const category = await create(parseCatalogCategoryInput({ name: '  Đồ trang trí  ', description: '  Mô hình 3D  ' }), 'admin-id');
  assert.deepEqual(category, { id: 'category-id', name: 'Đồ trang trí', slug: 'do-trang-tri' });
  assert.deepEqual(calls, [
    { name: 'Đồ trang trí', slug: 'do-trang-tri', description: 'Mô hình 3D' },
    { category, actorId: 'admin-id', description: 'Mô hình 3D' },
  ]);
});

test('duplicate category paths return a conflict without a success audit', async () => {
  let audited = false;
  const create = createCatalogCategoryService({
    transaction: async (run) => run({
      async createCategory() { return null; },
      async auditCategory() { audited = true; },
    }),
  });
  await assert.rejects(create({ name: 'Art Toy' }, 'admin-id'), { status: 409 });
  assert.equal(audited, false);
});

test('category input rejects missing names and oversized fields before writes', () => {
  for (const input of [null, {}, { name: ' ' }, { name: 'x'.repeat(121) }, { name: 'Art Toy', description: 'x'.repeat(2001) }]) {
    assert.throws(() => parseCatalogCategoryInput(input));
  }
});
