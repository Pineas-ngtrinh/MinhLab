CREATE TABLE order_return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  status varchar(24) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','RETURN_RECEIVED','REFUNDED')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  received_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  received_at timestamptz,
  refunded_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  refunded_at timestamptz,
  CONSTRAINT ck_order_return_request_timestamps CHECK (
    (status='REQUESTED' AND received_at IS NULL AND refunded_at IS NULL)
    OR (status='RETURN_RECEIVED' AND received_by_user_id IS NOT NULL AND received_at IS NOT NULL AND refunded_at IS NULL)
    OR (status='REFUNDED' AND received_by_user_id IS NOT NULL AND received_at IS NOT NULL
      AND refunded_by_user_id IS NOT NULL AND refunded_at IS NOT NULL)
  )
);

CREATE INDEX idx_order_return_requests_status_created
  ON order_return_requests(status, requested_at DESC);

ALTER TABLE refunds
  ADD COLUMN return_request_id uuid REFERENCES order_return_requests(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_refunds_return_request
  ON refunds(return_request_id) WHERE return_request_id IS NOT NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS ck_payments_verification;
ALTER TABLE payments ADD CONSTRAINT ck_payments_verification
  CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED','REFUNDED'));

COMMENT ON COLUMN payments.verification_status IS 'PENDING, VERIFIED, REJECTED, REFUNDED';
COMMENT ON COLUMN status_history.entity_type IS 'ORDER, SHIPMENT, PRINT_REQUEST, QUOTE, PRINT_SPECIFICATION, ORDER_RETURN';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
    GRANT SELECT,INSERT,UPDATE ON order_return_requests TO minhlab_app;
    GRANT INSERT ON refunds TO minhlab_app;
  END IF;
END $$;
