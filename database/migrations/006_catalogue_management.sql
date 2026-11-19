-- Stable business codes are allocated by PostgreSQL, including concurrent inserts.
CREATE SEQUENCE product_code_seq;
CREATE SEQUENCE variant_sku_seq;
SELECT setval('product_code_seq', COALESCE(max(substring(product_code from 6)::bigint),0)+1, false)
  FROM products WHERE product_code ~ '^ML-P-[0-9]{1,12}$';
SELECT setval('variant_sku_seq', COALESCE(max(substring(sku from 6)::bigint),0)+1, false)
  FROM product_variants WHERE sku ~ '^ML-S-[0-9]{1,12}$';
ALTER TABLE products ALTER COLUMN product_code SET DEFAULT ('ML-P-' || nextval('product_code_seq')::text);
ALTER TABLE product_variants ALTER COLUMN sku SET DEFAULT ('ML-S-' || nextval('variant_sku_seq')::text);
ALTER TABLE products ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
CREATE INDEX idx_orders_customer_page ON orders(customer_id,created_at DESC,id DESC);
CREATE INDEX idx_products_admin_page ON products(created_at DESC,id DESC);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'minhlab_app') THEN
    GRANT INSERT, UPDATE ON categories,products,product_variants,product_images TO minhlab_app;
    GRANT DELETE ON product_images TO minhlab_app;
    GRANT USAGE ON SEQUENCE product_code_seq,variant_sku_seq TO minhlab_app;
  END IF;
END $$;
