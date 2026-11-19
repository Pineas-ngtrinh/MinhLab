-- Internal shop alerts are committed with order/payment changes and delivered after commit.
CREATE TABLE IF NOT EXISTS telegram_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedup_key varchar(255) NOT NULL UNIQUE,
  notification_type varchar(40) NOT NULL CHECK (notification_type IN (
    'STORE_ORDER_CREATED', 'STORE_PAYMENT_DECLARED', 'STORE_PAYMENT_VERIFIED'
  )),
  order_number varchar(40) NOT NULL REFERENCES orders(order_number) ON DELETE CASCADE,
  body_text varchar(4096) NOT NULL CHECK (length(body_text) BETWEEN 1 AND 4096),
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  retry_after timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error varchar(80),
  provider_message_id varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK (status = 'PROCESSING' OR lease_token IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_telegram_outbox_delivery
  ON telegram_outbox(status, retry_after, created_at)
  WHERE status IN ('PENDING', 'PROCESSING');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'minhlab_app') THEN
    GRANT SELECT, INSERT, UPDATE ON telegram_outbox TO minhlab_app;
  END IF;
END $$;
