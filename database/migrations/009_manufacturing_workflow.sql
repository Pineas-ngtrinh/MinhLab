-- Metadata only: private manufacturing files never enter this subsystem.
CREATE TABLE manufacturing_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('COMPONENT','BOM','PROFILE')),
 code varchar(60) NOT NULL, revision integer NOT NULL CHECK(revision>0),
 variant_id uuid REFERENCES product_variants(id), printer_id uuid REFERENCES printers(id),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object'),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','REVOKED')),
 created_by uuid NOT NULL REFERENCES users(id), verified_by uuid REFERENCES users(id), verified_at timestamptz,
 published_by uuid REFERENCES users(id), published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,code,revision), CHECK((kind='BOM')=(variant_id IS NOT NULL)), CHECK((kind='PROFILE')=(printer_id IS NOT NULL)),
 CHECK(status<>'PUBLISHED' OR (verified_by IS NOT NULL AND published_by IS NOT NULL))
);
CREATE INDEX manufacturing_current_bom ON manufacturing_revisions(variant_id,revision DESC) WHERE kind='BOM' AND status='PUBLISHED';
ALTER TABLE order_items ADD COLUMN manufacturing_revision_id uuid REFERENCES manufacturing_revisions(id);
-- Legacy items are resolved explicitly when requirements are first prepared, never backfilled speculatively.
CREATE TABLE production_requirements (
 order_item_id uuid PRIMARY KEY REFERENCES order_items(id), bom_revision_id uuid NOT NULL REFERENCES manufacturing_revisions(id),
 group_id uuid, packed_at timestamptz, dispatch_ready_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE production_inventory (
 stock_key varchar(160) PRIMARY KEY, available numeric(14,3) NOT NULL CHECK(available>=0),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), confirmed_by uuid NOT NULL REFERENCES users(id),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE production_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(60) NOT NULL,
 profile_revision_id uuid NOT NULL REFERENCES manufacturing_revisions(id),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object'), verified_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE TABLE production_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 status text NOT NULL CHECK(status IN ('WAITING_DATA','PENDING_APPROVAL','APPROVED','REJECTED','STALE','SUPERSEDED')),
 snapshot_hash char(64) NOT NULL, body jsonb NOT NULL, proposed_by varchar(120) NOT NULL,
 decided_by uuid REFERENCES users(id), decision_note text, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE production_holds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), printer_id uuid NOT NULL REFERENCES printers(id), group_id uuid NOT NULL,
 plan_id uuid NOT NULL REFERENCES production_plans(id), released_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_machine_hold ON production_holds(printer_id) WHERE released_at IS NULL;
CREATE TABLE production_hold_items (
 hold_id uuid NOT NULL REFERENCES production_holds(id), order_item_id uuid NOT NULL REFERENCES order_items(id),
 PRIMARY KEY(hold_id,order_item_id)
);
ALTER TABLE production_jobs ALTER COLUMN order_item_id DROP NOT NULL;
ALTER TABLE production_jobs ADD COLUMN plan_id uuid REFERENCES production_plans(id);
ALTER TABLE production_jobs ADD COLUMN hold_id uuid REFERENCES production_holds(id);
ALTER TABLE production_jobs ADD COLUMN check_id uuid REFERENCES production_checks(id);
ALTER TABLE production_jobs ADD COLUMN metadata_snapshot jsonb;
ALTER TABLE production_jobs ADD CONSTRAINT production_job_scope CHECK(order_item_id IS NOT NULL OR (plan_id IS NOT NULL AND hold_id IS NOT NULL AND check_id IS NOT NULL));
CREATE UNIQUE INDEX one_running_job_per_printer ON production_jobs(assigned_printer_id) WHERE status='PRINTING';
CREATE TABLE production_supplies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_item_id uuid NOT NULL REFERENCES order_items(id),
 component_revision_id uuid REFERENCES manufacturing_revisions(id), job_id uuid REFERENCES production_jobs(id),
 plan_id uuid NOT NULL REFERENCES production_plans(id), stock_key varchar(160) REFERENCES production_inventory(stock_key),
 quantity integer NOT NULL CHECK(quantity>0), good integer NOT NULL DEFAULT 0 CHECK(good>=0),
 failed integer NOT NULL DEFAULT 0 CHECK(failed>=0), inspected_at timestamptz,
 CHECK(good+failed<=quantity), CHECK((job_id IS NULL)<>(stock_key IS NULL)),
 CHECK(component_revision_id IS NOT NULL OR job_id IS NULL)
);
CREATE INDEX production_supplies_item ON production_supplies(order_item_id);
CREATE TABLE production_operations (
 operation_key varchar(120) PRIMARY KEY, actor_id varchar(120) NOT NULL, request_hash char(64) NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE production_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type varchar(80) NOT NULL,
 entity_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED')),
 lease_until timestamptz, lease_token uuid, retry_after timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE production_agent_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid REFERENCES production_events(id),
 status text NOT NULL CHECK(status IN ('WAITING_CONFIGURATION','SUCCEEDED','FAILED')),
 model varchar(120), snapshot_hash char(64), plan_id uuid REFERENCES production_plans(id), created_at timestamptz NOT NULL DEFAULT now()
);
-- Serialize core mutations; order locks still protect commerce transitions.
-- Published bodies are immutable; revocation is explicit and never alters historical data.
CREATE FUNCTION protect_manufacturing_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.kind<>OLD.kind OR NEW.code<>OLD.code OR NEW.revision<>OLD.revision OR NEW.body<>OLD.body
 OR NEW.variant_id IS DISTINCT FROM OLD.variant_id OR NEW.printer_id IS DISTINCT FROM OLD.printer_id THEN
  RAISE EXCEPTION 'Create a new manufacturing revision';
 END IF;
 IF OLD.status='REVOKED' AND NEW.status<>'REVOKED' THEN RAISE EXCEPTION 'Revoked revisions cannot be republished'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER manufacturing_revision_immutable BEFORE UPDATE ON manufacturing_revisions FOR EACH ROW EXECUTE FUNCTION protect_manufacturing_revision();
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
 GRANT SELECT,INSERT,UPDATE ON manufacturing_revisions,production_requirements,production_inventory,production_checks,
 production_plans,production_holds,production_hold_items,production_jobs,production_supplies,production_operations,
 production_events,production_agent_runs,printers TO minhlab_app;
 GRANT INSERT ON quality_inspections TO minhlab_app;
 -- Checkout inserts a pinned revision; legacy resolution lives in production_requirements.
END IF; END $$;
