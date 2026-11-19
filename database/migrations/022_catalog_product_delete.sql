DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
    GRANT DELETE ON products,product_variants TO minhlab_app;
  END IF;
END $$;
