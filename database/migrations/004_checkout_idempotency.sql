-- A request key is a bearer secret for guest checkout: persist only its hash.
ALTER TABLE orders ADD COLUMN checkout_key_hash char(64);
ALTER TABLE orders ADD COLUMN checkout_request_hash char(64);
ALTER TABLE orders ADD CONSTRAINT ck_orders_checkout_hashes CHECK (
  (checkout_key_hash IS NULL AND checkout_request_hash IS NULL)
  OR (checkout_key_hash IS NOT NULL AND checkout_request_hash IS NOT NULL
      AND checkout_key_hash ~ '^[0-9a-f]{64}$'
      AND checkout_request_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX idx_orders_checkout_key ON orders(checkout_key_hash)
  WHERE checkout_key_hash IS NOT NULL;

-- Stable ordering and bounded admin list reads.
CREATE INDEX idx_orders_created_id ON orders(created_at DESC, id DESC);
CREATE INDEX idx_payments_created_id ON payments(created_at DESC, id DESC);
