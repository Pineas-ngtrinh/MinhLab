ALTER TABLE orders
  ADD COLUMN admin_archived_at timestamptz;

CREATE INDEX idx_orders_active_status_created
  ON orders (order_status, created_at DESC, id DESC)
  WHERE admin_archived_at IS NULL;

COMMENT ON COLUMN orders.admin_archived_at IS
  'When set, hides an unpaid order from admin order and payment lists while retaining its customer history and audit trail.';
