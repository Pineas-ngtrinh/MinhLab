-- Custom prints reuse the existing physical jobs and machine-hold aggregate.
ALTER TABLE production_holds ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE production_holds ADD COLUMN custom_order_item_id uuid REFERENCES order_items(id);
ALTER TABLE production_holds ADD CONSTRAINT production_hold_subject CHECK(num_nonnulls(plan_id,custom_order_item_id)=1);
ALTER TABLE order_items ADD COLUMN custom_packed_at timestamptz;
ALTER TABLE order_items ADD COLUMN custom_dispatch_ready_at timestamptz;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
 GRANT UPDATE(custom_packed_at,custom_dispatch_ready_at) ON order_items TO minhlab_app;
END IF; END $$;
