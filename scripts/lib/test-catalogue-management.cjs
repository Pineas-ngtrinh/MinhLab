const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

module.exports = async function testCatalogue({
  check,
  call,
  pool,
  admin,
  owner,
  operator,
  workshop,
  reviewer,
}) {
  const category = (await pool.query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
  const input = {
    categoryId: category,
    name: 'Catalogue integration fixture',
    shortDescription: 'Fixture description',
    description: 'Isolated database test only',
    material: 'PETG',
    leadTime: 'Theo lịch xưởng',
    layerHeight: '0.2 mm',
    source: 'ORIGINAL',
    productionMode: 'MADE_TO_ORDER',
    featured: false,
    badge: null,
    sortOrder: 1,
    images: ['/images/product-placeholder.svg'],
    variants: [
      {
        name: 'Đỏ',
        color: 'Đỏ',
        hex: '#EB4037',
        price: 120000,
        originalPrice: 150000,
        lengthMm: 50,
        widthMm: 40,
        heightMm: 60,
        weightGrams: 20,
        status: 'ACTIVE',
      },
    ],
  };
  const detail = (id, method = 'GET', body, cookie = admin.cookie) =>
    call('product', method, body, cookie, `http://localhost:3100/api/admin/products/${id}`, { id });
  let product, second;
  await check('category creation is ADMIN-only, persistent and rejects duplicate paths',async()=>{
    const input={name:'Đồ trang trí kiểm thử',description:'Isolated category fixture'};
    for(const cookie of ['',owner.cookie,workshop.cookie,operator.cookie,reviewer.cookie]) {
      assert.equal((await call('catalogCategories','POST',input,cookie)).status,cookie?403:401);
    }
    const created=await call('catalogCategories','POST',input,admin.cookie);
    assert.equal(created.status,201,JSON.stringify(created.body));
    assert.equal(created.body.data.slug,'do-trang-tri-kiem-thu');
    assert((await call('catalogCategories','GET',undefined,workshop.cookie)).body.data.some(c=>c.id===created.body.data.id));
    assert.equal((await call('catalogCategories','POST',input,admin.cookie)).status,409);
    assert.equal(Number((await pool.query("SELECT count(*) FROM audit_logs WHERE entity_id=$1 AND action='CATEGORY_CREATED'",[created.body.data.id])).rows[0].count),1);
  });
  await check(
    'catalogue management allows workshop to draft products while keeping publication admin-only',
    async () => {
      for (const cookie of ['', owner.cookie, operator.cookie, reviewer.cookie]) {
        const expected = cookie ? 403 : 401;
        for (const method of ['GET', 'POST'])
          assert.equal(
            (await call('products', method, method === 'POST' ? input : undefined, cookie)).status,
            expected,
          );
        for (const method of ['GET', 'PUT', 'PATCH'])
          assert.equal(
            (await detail(randomUUID(), method, method === 'GET' ? undefined : input, cookie))
              .status,
            expected,
          );
        assert.equal((await call('catalogCategories', 'GET', undefined, cookie)).status, expected);
      }
      assert.equal((await call('products', 'GET', undefined, workshop.cookie)).status, 200);
      assert.equal((await call('catalogCategories', 'GET', undefined, workshop.cookie)).status, 200);
      const drafted = await call('products', 'POST', { ...input, name: 'WORKSHOP product fixture' }, workshop.cookie);
      assert.equal(drafted.status, 201, JSON.stringify(drafted.body));
      assert.equal(drafted.body.data.publication, 'DRAFT');
      assert.equal((await detail(drafted.body.data.id, 'GET', undefined, workshop.cookie)).status, 200);
      const edited = await detail(drafted.body.data.id, 'PUT', { ...drafted.body.data, revision: drafted.body.data.revision, name: 'WORKSHOP product fixture updated' }, workshop.cookie);
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(edited.body.data.publication, 'DRAFT');
      assert.equal((await detail(drafted.body.data.id, 'PATCH', { action: 'PUBLISH', revision: edited.body.data.revision, note: 'Workshop cannot publish', rightsConfirmed: true }, workshop.cookie)).status, 403);
    },
  );
  await check(
    'creating products assigns persistent codes and SKUs and ignores forged approval fields',
    async () => {
      const result = await call(
        'products',
        'POST',
        { ...input, code: 'FORGED', publication: 'PUBLISHED', compliance: 'APPROVED' },
        admin.cookie,
      );
      assert.equal(result.status, 201, JSON.stringify(result.body));
      product = result.body.data;
      assert.match(product.code, /^ML-P-\d+$/);
      assert.match(product.variants[0].sku, /^ML-S-\d+$/);
      assert.equal(product.publication, 'DRAFT');
      assert.equal(product.compliance, 'NEEDS_REVIEW');
      assert.equal((await detail(product.id)).body.data.id, product.id);
      assert.equal(
        (await call('catalog')).body.data.products.some((value) => value.id === product.slug),
        false,
      );
    },
  );
  await check('concurrent catalogue inserts get different codes and SKUs', async () => {
    const results = await Promise.all([
      call('products', 'POST', { ...input, name: 'Concurrent A' }, admin.cookie),
      call('products', 'POST', { ...input, name: 'Concurrent B' }, admin.cookie),
    ]);
    assert(results.every((result) => result.status === 201));
    assert.notEqual(results[0].body.data.code, results[1].body.data.code);
    assert.notEqual(results[0].body.data.variants[0].sku, results[1].body.data.variants[0].sku);
    second = results[0].body.data;
  });
  await check(
    'catalogue input rejects forged IDs, prices, duplicate choices and unsafe images',
    async () => {
      for (const body of [
        { ...input, categoryId: 'invalid' },
        { ...input, categoryId: randomUUID() },
        { ...input, variants: [{ ...input.variants[0], price: -1 }] },
        { ...input, variants: [{ ...input.variants[0], price: 1.2 }] },
        { ...input, variants: [{ ...input.variants[0], originalPrice: 1 }] },
        { ...input, variants: [input.variants[0], { ...input.variants[0], name: 'đỏ' }] },
        { ...input, variants: [{ ...input.variants[0], id: product.variants[0].id }] },
        { ...input, images: ['http://127.0.0.1/private'] },
        { ...input, images: ['file:///etc/passwd'] },
        { ...input, images: ['/images/../private'] },
        { ...input, images: ['https://res.cloudinary.com:444/private'] },
      ])
        assert.equal((await call('products', 'POST', body, admin.cookie)).status, 400);
      assert.equal((await detail('invalid')).status, 400);
    },
  );
  await check(
    'catalogue editing rejects foreign variants and leaves the product intact',
    async () => {
      const result = await detail(product.id, 'PUT', {
        ...product,
        variants: [second.variants[0]],
      });
      assert.equal(result.status, 400);
      assert.equal((await detail(product.id)).body.data.revision, product.revision);
    },
  );
  await check(
    'concurrent edits reject the stale revision and preserve product code, slug and SKU',
    async () => {
      const results = await Promise.all([
        detail(product.id, 'PUT', { ...product, name: 'Edited A' }),
        detail(product.id, 'PUT', { ...product, name: 'Edited B' }),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
      const updated = (await detail(product.id)).body.data;
      assert.equal(updated.revision, product.revision + 1);
      assert.equal(updated.code, product.code);
      assert.equal(updated.slug, product.slug);
      assert.equal(updated.variants[0].sku, product.variants[0].sku);
      product = updated;
    },
  );
  await check(
    'publishing requires explicit rights confirmation, review notes and complete sellable content',
    async () => {
      assert.equal(
        (
          await detail(product.id, 'PATCH', {
            action: 'PUBLISH',
            revision: product.revision,
            note: 'Reviewed fixture',
            rightsConfirmed: false,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await detail(product.id, 'PATCH', {
            action: 'PUBLISH',
            revision: product.revision,
            note: '',
            rightsConfirmed: true,
          })
        ).status,
        400,
      );
      const incomplete = await detail(second.id, 'PUT', { ...second, images: [] });
      assert.equal(incomplete.status, 200);
      second = incomplete.body.data;
      assert.equal(
        (
          await detail(second.id, 'PATCH', {
            action: 'PUBLISH',
            revision: second.revision,
            note: 'Test only',
            rightsConfirmed: true,
          })
        ).status,
        400,
      );
      const result = await detail(product.id, 'PATCH', {
        action: 'PUBLISH',
        revision: product.revision,
        note: 'Isolated fixture rights confirmation',
        rightsConfirmed: true,
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      product = result.body.data;
      const publicProduct = (await call('catalog')).body.data.products.find(
        (value) => value.id === product.slug,
      );
      assert.equal(publicProduct.title, product.name);
      assert.equal(publicProduct.price, 120000);
      const review = (
        await pool.query(
          'SELECT compliance_reviewed_by,compliance_reviewed_at FROM products WHERE id=$1',
          [product.id],
        )
      ).rows[0];
      assert.equal(review.compliance_reviewed_by, admin.body.data.id);
      assert(review.compliance_reviewed_at);
    },
  );
  let orderNumber;
  await check(
    'published managed products can be ordered with authoritative price and immutable snapshots',
    async () => {
      const result = await call('orders', 'POST', {
        customerName: 'Isolated test',
        customerEmail: 'fixture@example.test',
        customerPhone: '0901234567',
        shippingAddress: 'Fixture only',
        paymentMethod: 'VIETQR',
        items: [
          {
            productId: product.slug,
            productVariantId: product.variants[0].id,
            itemType: 'READY_PRODUCT',
            itemName: 'Forged',
            unitPrice: 1,
            quantity: 1,
          },
        ],
      });
      assert.equal(result.status, 201);
      assert.equal(result.body.data.grandTotal, 150000);
      orderNumber = result.body.data.orderNumber;
    },
  );
  await check(
    'editing a published product withdraws approval and preserves the old order snapshot',
    async () => {
      const result = await detail(product.id, 'PUT', {
        ...product,
        description: 'Updated database description',
        variants: [{ ...product.variants[0], price: 130000 }],
      });
      assert.equal(result.status, 200);
      product = result.body.data;
      assert.equal(product.publication, 'DRAFT');
      assert.equal(product.compliance, 'NEEDS_REVIEW');
      assert.equal(
        (await call('catalog')).body.data.products.some((value) => value.id === product.slug),
        false,
      );
      const snapshot = (
        await pool.query(
          'SELECT unit_price FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.order_number=$1',
          [orderNumber],
        )
      ).rows[0];
      assert.equal(Number(snapshot.unit_price), 120000);
    },
  );
  await check(
    'removed variants become inactive rather than deleting referenced identities',
    async () => {
      let result = await detail(product.id, 'PUT', {
        ...product,
        variants: [...product.variants, { ...input.variants[0], name: 'Xanh', color: 'Xanh' }],
      });
      assert.equal(result.status, 200);
      product = result.body.data;
      const old = product.variants[0];
      result = await detail(product.id, 'PUT', {
        ...product,
        variants: product.variants.filter((value) => value.id !== old.id),
      });
      assert.equal(result.status, 200);
      product = result.body.data;
      assert.equal(product.variants.find((value) => value.id === old.id).status, 'INACTIVE');
      assert(
        (await pool.query('SELECT 1 FROM order_items WHERE product_variant_id=$1', [old.id]))
          .rowCount > 0,
      );
    },
  );
  await check('catalogue listing supports bounded pages, search and status filters', async () => {
    const list = await call(
      'products',
      'GET',
      undefined,
      admin.cookie,
      'http://localhost:3100/api/admin/products?pageSize=1',
    );
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert(list.body.pagination.total > 1);
    const filtered = await call(
      'products',
      'GET',
      undefined,
      admin.cookie,
      `http://localhost:3100/api/admin/products?q=${encodeURIComponent(product.code)}&status=DRAFT`,
    );
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].id, product.id);
    assert.equal(
      (
        await call(
          'products',
          'GET',
          undefined,
          admin.cookie,
          'http://localhost:3100/api/admin/products?pageSize=101',
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          'products',
          'GET',
          undefined,
          admin.cookie,
          'http://localhost:3100/api/admin/products?status=INVALID',
        )
      ).status,
      400,
    );
  });
  await check(
    'hiding and archiving records reversible state changes with actor and review note',
    async () => {
      let result = await detail(product.id, 'PATCH', {
        action: 'HIDE',
        revision: product.revision,
        note: 'Fixture hide',
      });
      assert.equal(result.status, 200);
      product = result.body.data;
      result = await detail(product.id, 'PATCH', {
        action: 'ARCHIVE',
        revision: product.revision,
        note: 'Fixture archive',
      });
      assert.equal(result.status, 200);
      product = result.body.data;
      assert.equal(product.publication, 'ARCHIVED');
      const audit = (
        await pool.query(
          "SELECT actor_user_id FROM audit_logs WHERE entity_id=$1 AND action='PRODUCT_ARCHIVE'",
          [product.id],
        )
      ).rows;
      assert.equal(audit.length, 1);
      assert.equal(audit[0].actor_user_id, admin.body.data.id);
      assert(
        (
          await pool.query(
            "SELECT 1 FROM status_history WHERE entity_id=$1 AND to_status='ARCHIVED' AND reason='Fixture archive'",
            [product.id],
          )
        ).rowCount > 0,
      );
    },
  );
  await check('catalogue writes and images roll back if audit persistence fails', async () => {
    await pool.query(`CREATE FUNCTION test_catalogue_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='PRODUCT_CREATED' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_catalogue_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_catalogue_audit_failure()`);
    try {
      const name = `Rollback-${randomUUID()}`;
      assert.equal((await call('products', 'POST', { ...input, name }, admin.cookie)).status, 500);
      assert.equal((await pool.query('SELECT 1 FROM products WHERE name=$1', [name])).rowCount, 0);
    } finally {
      await pool.query(
        'DROP TRIGGER test_catalogue_audit_failure ON audit_logs; DROP FUNCTION test_catalogue_audit_failure()',
      );
    }
  });
};
