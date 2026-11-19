-- Production plan alerts share the existing Telegram outbox and delivery worker.
ALTER TABLE telegram_outbox ALTER COLUMN order_number DROP NOT NULL;
ALTER TABLE telegram_outbox
  ADD COLUMN production_plan_id uuid REFERENCES production_plans(id) ON DELETE CASCADE;

ALTER TABLE telegram_outbox
  DROP CONSTRAINT IF EXISTS telegram_outbox_notification_type_check;
ALTER TABLE telegram_outbox
  ADD CONSTRAINT telegram_outbox_notification_type_check CHECK (notification_type IN (
    'STORE_ORDER_CREATED', 'STORE_PAYMENT_DECLARED', 'STORE_PAYMENT_VERIFIED', 'PRODUCTION_PLAN_DRAFTED'
  ));
ALTER TABLE telegram_outbox
  ADD CONSTRAINT telegram_outbox_subject_check CHECK (
    (notification_type = 'PRODUCTION_PLAN_DRAFTED' AND production_plan_id IS NOT NULL AND order_number IS NULL)
    OR
    (notification_type <> 'PRODUCTION_PLAN_DRAFTED' AND production_plan_id IS NULL AND order_number IS NOT NULL)
  );

CREATE INDEX idx_telegram_outbox_production_plan
  ON telegram_outbox(production_plan_id)
  WHERE production_plan_id IS NOT NULL;
