CREATE FUNCTION protect_issued_custom_quote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status<>'DRAFT' AND (to_jsonb(NEW)-ARRAY['status','converted_order_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','converted_order_id']) THEN
  RAISE EXCEPTION 'Issued quote snapshot is immutable; issue a new revision';
 END IF;
 IF OLD.converted_order_id IS NOT NULL AND (NEW.converted_order_id IS DISTINCT FROM OLD.converted_order_id OR NEW.status<>'CONVERTED') THEN
  RAISE EXCEPTION 'Converted quote cannot be reassigned';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custom_quote_immutable BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION protect_issued_custom_quote();
CREATE FUNCTION protect_approved_custom_spec() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status='APPROVED' AND (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
  RAISE EXCEPTION 'Approved specification snapshot is immutable';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER custom_spec_immutable BEFORE UPDATE ON print_specifications FOR EACH ROW EXECUTE FUNCTION protect_approved_custom_spec();
CREATE FUNCTION protect_custom_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Customer acceptance is immutable';
END $$;
CREATE TRIGGER custom_acceptance_immutable BEFORE UPDATE OR DELETE ON customer_approvals FOR EACH ROW WHEN(OLD.approval_status='ACCEPTED') EXECUTE FUNCTION protect_custom_acceptance();
