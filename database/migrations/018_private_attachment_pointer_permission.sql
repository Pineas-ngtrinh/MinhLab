DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
    GRANT UPDATE (is_current) ON attachments TO minhlab_app;
  END IF;
END $$;
