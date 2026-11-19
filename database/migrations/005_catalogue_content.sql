-- Storefront content belongs to the catalogue, independently of private file uploads.
ALTER TABLE products
  ADD COLUMN material_description varchar(160),
  ADD COLUMN lead_time_description varchar(160),
  ADD COLUMN layer_height_description varchar(160),
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN badge varchar(20) CHECK (badge IN ('MỚI','TIÊU BIỂU','BÁN CHẠY','ĐỘC BẢN')),
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE product_variants
  ADD COLUMN color_hex char(7) CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN compare_at_price numeric(12,2) CHECK (compare_at_price >= sale_price);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (url ~ '^https://' OR (url LIKE '/images/%' AND url NOT LIKE '%..%')),
  alt_text varchar(255) NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (product_id, sort_order)
);

CREATE INDEX idx_catalogue_published ON products(sort_order, created_at, id)
  WHERE publication_status = 'PUBLISHED' AND compliance_status = 'APPROVED';

-- Existing runtime roles receive read access only; catalogue editing is a separate use case.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'minhlab_app') THEN
    GRANT SELECT ON product_images TO minhlab_app;
  END IF;
END $$;
