-- Legacy assets remain protected until classified explicitly; never infer disposability by extension.
ALTER TABLE file_assets ADD COLUMN asset_kind text NOT NULL DEFAULT 'LEGACY'
  CHECK (asset_kind IN ('LEGACY','PRINT_SOURCE','PRINT_APPROVED','SLICER_ARTIFACT','PAYMENT_PROOF','QC_EVIDENCE'));
ALTER TABLE file_assets ADD COLUMN purge_token uuid;
ALTER TABLE file_assets ADD COLUMN purge_lease_until timestamptz;
ALTER TABLE file_assets ADD COLUMN purge_attempts integer NOT NULL DEFAULT 0 CHECK (purge_attempts BETWEEN 0 AND 5);
ALTER TABLE file_assets ADD COLUMN purge_retry_at timestamptz;
ALTER TABLE file_assets ADD COLUMN retention_checked_at timestamptz;
CREATE INDEX private_model_cleanup ON file_assets(created_at,id)
  WHERE storage_provider='LOCAL_PRIVATE' AND purged_at IS NULL AND asset_kind IN ('PRINT_SOURCE','PRINT_APPROVED','SLICER_ARTIFACT');

ALTER TABLE print_requests ADD COLUMN closed_reason text
  CHECK (closed_reason IN ('CUSTOMER_CLOSED','STAFF_CLOSED','REJECTED','QUOTE_EXPIRED','CONVERTED'));
CREATE TABLE print_file_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES print_requests(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  review_at timestamptz NOT NULL,
  released_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  released_at timestamptz,
  resolution text,
  CHECK ((released_at IS NULL AND released_by IS NULL AND resolution IS NULL)
    OR (released_at IS NOT NULL AND released_by IS NOT NULL AND length(trim(resolution)) BETWEEN 1 AND 2000))
);
CREATE INDEX active_print_file_holds ON print_file_holds(request_id) WHERE released_at IS NULL;
CREATE INDEX attachment_file_references ON attachments(file_asset_id,entity_type,entity_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
    GRANT SELECT,INSERT,UPDATE ON print_file_holds TO minhlab_app;
  END IF;
END $$;
