CREATE FUNCTION protect_approved_job_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (OLD.plan_id IS NOT NULL OR OLD.metadata_snapshot->>'kind'='CUSTOM') AND
 (NEW.metadata_snapshot IS DISTINCT FROM OLD.metadata_snapshot OR NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.check_id IS DISTINCT FROM OLD.check_id
 OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id OR NEW.hold_id IS DISTINCT FROM OLD.hold_id
 OR NEW.assigned_printer_id IS DISTINCT FROM OLD.assigned_printer_id OR NEW.assigned_material_id IS DISTINCT FROM OLD.assigned_material_id
 OR NEW.planned_start_at IS DISTINCT FROM OLD.planned_start_at OR NEW.planned_finish_at IS DISTINCT FROM OLD.planned_finish_at) THEN
  RAISE EXCEPTION 'Approved job snapshot is immutable';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER approved_job_immutable BEFORE UPDATE ON production_jobs FOR EACH ROW EXECUTE FUNCTION protect_approved_job_snapshot();
CREATE FUNCTION protect_production_supply_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-ARRAY['good','failed','inspected_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['good','failed','inspected_at']) THEN
  RAISE EXCEPTION 'Production allocation snapshot is immutable';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_supply_immutable BEFORE UPDATE ON production_supplies FOR EACH ROW EXECUTE FUNCTION protect_production_supply_snapshot();
CREATE FUNCTION protect_requirement_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.bom_revision_id IS DISTINCT FROM OLD.bom_revision_id OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id THEN
  RAISE EXCEPTION 'Pinned manufacturing revision is immutable';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_requirement_immutable BEFORE UPDATE ON production_requirements FOR EACH ROW EXECUTE FUNCTION protect_requirement_revision();
CREATE FUNCTION protect_batch_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') THEN RAISE EXCEPTION 'Batch confirmation is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER production_check_immutable BEFORE UPDATE ON production_checks FOR EACH ROW EXECUTE FUNCTION protect_batch_check();
CREATE FUNCTION protect_production_plan_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.body IS DISTINCT FROM OLD.body OR NEW.revision<>OLD.revision OR NEW.snapshot_hash<>OLD.snapshot_hash OR NEW.proposed_by<>OLD.proposed_by THEN
  RAISE EXCEPTION 'Production plan snapshot is immutable; submit a new revision';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER production_plan_immutable BEFORE UPDATE ON production_plans FOR EACH ROW EXECUTE FUNCTION protect_production_plan_snapshot();
CREATE INDEX production_jobs_item_status ON production_jobs(order_item_id,status);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
 REVOKE UPDATE ON production_operations,print_request_operations FROM minhlab_app;
END IF; END $$;
