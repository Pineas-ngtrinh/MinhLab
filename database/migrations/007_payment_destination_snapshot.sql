-- Existing payments deliberately stay NULL: do not backfill an unconfirmed receiving account.
ALTER TABLE payments ADD COLUMN receiving_account jsonb
  CHECK (receiving_account IS NULL OR jsonb_typeof(receiving_account)='object');
