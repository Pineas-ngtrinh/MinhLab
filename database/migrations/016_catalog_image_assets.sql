ALTER TABLE file_assets
  ADD COLUMN image_width integer CHECK (image_width IS NULL OR image_width > 0),
  ADD COLUMN image_height integer CHECK (image_height IS NULL OR image_height > 0);

ALTER TABLE product_images
  ADD COLUMN file_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_product_images_product_file_asset
  ON product_images(product_id, file_asset_id)
  WHERE file_asset_id IS NOT NULL;

CREATE INDEX idx_file_assets_cloudinary_secure_url
  ON file_assets(secure_url)
  WHERE storage_provider='CLOUDINARY';
