-- Enforced invariants for the implemented website use cases. No data is deleted.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_status' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT ck_users_status CHECK (status IN ('PENDING','ACTIVE','LOCKED','DISABLED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_email_normalized' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT ck_users_email_normalized CHECK (email_normalized = lower(trim(email)) AND length(trim(full_name)) > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_products_publication' AND conrelid = 'products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT ck_products_publication CHECK (publication_status IN ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_products_compliance' AND conrelid = 'products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT ck_products_compliance CHECK (compliance_status IN ('PENDING','APPROVED','REJECTED','NEEDS_REVIEW'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_products_publish_approved' AND conrelid = 'products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT ck_products_publish_approved CHECK (publication_status <> 'PUBLISHED' OR compliance_status = 'APPROVED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_variants_price' AND conrelid = 'product_variants'::regclass) THEN
    ALTER TABLE product_variants ADD CONSTRAINT ck_variants_price CHECK (sale_price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_totals' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_totals CHECK (subtotal >= 0 AND shipping_fee >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND grand_total = subtotal + shipping_fee + tax_amount - discount_amount AND grand_total >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_status' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_status CHECK (order_status IN ('PENDING_PAYMENT','DEPOSIT_PAID','CONFIRMED','IN_PRODUCTION','READY_TO_SHIP','SHIPPED','COMPLETED','CANCELLED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_payment_status' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_payment_status CHECK (payment_status IN ('UNPAID','PARTIALLY_PAID','PAID','PARTIALLY_REFUNDED','REFUNDED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_timing' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_timing CHECK (payment_timing IN ('PREPAID','COD'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_order_items_values' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items ADD CONSTRAINT ck_order_items_values CHECK (quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND line_total = quantity * unit_price - discount_amount AND line_total >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_order_items_kind' AND conrelid = 'order_items'::regclass) THEN
    ALTER TABLE order_items ADD CONSTRAINT ck_order_items_kind CHECK ((item_type = 'READY_PRODUCT' AND product_variant_id IS NOT NULL AND print_specification_id IS NULL) OR (item_type = 'CUSTOM_PRINT' AND print_specification_id IS NOT NULL AND product_variant_id IS NULL));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payments_amount' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments ADD CONSTRAINT ck_payments_amount CHECK (amount > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_payments_verification' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments ADD CONSTRAINT ck_payments_verification CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_cart_items_quantity' AND conrelid = 'cart_items'::regclass) THEN
    ALTER TABLE cart_items ADD CONSTRAINT ck_cart_items_quantity CHECK (quantity > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_session_expiry' AND conrelid = 'auth_sessions'::regclass) THEN
    ALTER TABLE auth_sessions ADD CONSTRAINT ck_session_expiry CHECK (expires_at > created_at);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_account_token_expiry' AND conrelid = 'account_tokens'::regclass) THEN
    ALTER TABLE account_tokens ADD CONSTRAINT ck_account_token_expiry CHECK (expires_at > created_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON auth_sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_tokens_user_purpose ON account_tokens(user_id, purpose, expires_at);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  key_hash char(64) PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedup_key varchar(255) NOT NULL UNIQUE,
  recipient varchar(255) NOT NULL,
  subject varchar(255) NOT NULL,
  body_text text NOT NULL,
  notification_type varchar(40) NOT NULL,
  order_number varchar(40) REFERENCES orders(order_number) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  retry_after timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_message_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_outbox_delivery ON email_outbox(status, retry_after) WHERE status <> 'SENT';
