ALTER TABLE production_plans ADD COLUMN deleted_at timestamptz;
ALTER TABLE production_plans ADD COLUMN deleted_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE production_plans ADD CONSTRAINT production_plan_deletion_check CHECK (
  (deleted_at IS NULL AND deleted_by IS NULL)
  OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL
    AND status IN ('WAITING_DATA','PENDING_APPROVAL','REJECTED','STALE','SUPERSEDED'))
);
CREATE INDEX production_plans_visible ON production_plans(created_at DESC,id DESC) WHERE deleted_at IS NULL;
