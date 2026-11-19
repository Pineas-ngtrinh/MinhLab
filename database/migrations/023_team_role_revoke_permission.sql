-- The ADMIN-only team use case removes a WORKSHOP_OPERATOR role assignment.
-- Keep account records, orders and audit history outside this DELETE grant.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
    GRANT DELETE ON user_roles TO minhlab_app;
  END IF;
END $$;
