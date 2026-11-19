-- Reuse existing request/file/specification/quote/approval aggregates.
ALTER TABLE file_assets ALTER COLUMN secure_url DROP NOT NULL;
ALTER TABLE file_assets ADD COLUMN analysis_status text NOT NULL DEFAULT 'PENDING' CHECK(analysis_status IN ('PENDING','COMPLETE','FAILED','MANUAL_REVIEW'));
ALTER TABLE file_assets ADD COLUMN analysis_metadata jsonb;
ALTER TABLE file_assets ADD COLUMN processing_attempts integer NOT NULL DEFAULT 0 CHECK(processing_attempts BETWEEN 0 AND 5);
ALTER TABLE file_assets ADD COLUMN processing_lease_until timestamptz;
ALTER TABLE file_assets ADD COLUMN processing_lease_token uuid;
ALTER TABLE print_requests ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
ALTER TABLE print_requests ADD COLUMN assigned_reviewer_id uuid REFERENCES users(id);
ALTER TABLE print_requests ADD COLUMN current_item_id uuid;
ALTER TABLE print_requests ADD COLUMN contact_snapshot jsonb;
ALTER TABLE print_requests ADD COLUMN submission_key char(64) UNIQUE;
ALTER TABLE print_requests ADD COLUMN submission_hash char(64);
ALTER TABLE print_request_items ADD COLUMN requested_spec jsonb;
ALTER TABLE print_request_items ADD CONSTRAINT request_item_revision UNIQUE(print_request_id,item_number);
ALTER TABLE print_requests ADD FOREIGN KEY(current_item_id) REFERENCES print_request_items(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE quotes ADD COLUMN request_revision integer;
ALTER TABLE quotes ADD COLUMN promised_finish_at timestamptz;
ALTER TABLE quotes ADD COLUMN terms_text text;
ALTER TABLE quotes ADD COLUMN terms_hash char(64);
ALTER TABLE quotes ADD COLUMN converted_order_id uuid UNIQUE REFERENCES orders(id);
CREATE UNIQUE INDEX quote_single_acceptance ON customer_approvals(quote_id) WHERE approval_status='ACCEPTED';
ALTER TABLE orders ADD COLUMN accepted_quote_id uuid UNIQUE REFERENCES quotes(id);
ALTER TABLE orders ADD COLUMN customer_approval_id uuid UNIQUE REFERENCES customer_approvals(id);
CREATE INDEX print_requests_owner_queue ON print_requests(customer_id,created_at DESC,id);
CREATE INDEX print_requests_review_queue ON print_requests(status,created_at,id);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
 GRANT SELECT,INSERT,UPDATE ON print_requests,print_request_items,file_inspections,print_specifications,quotes,quote_items,customer_approvals TO minhlab_app;
END IF; END $$;
CREATE TABLE print_request_operations (
 operation_key char(64) PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), request_hash char(64) NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='minhlab_app') THEN
 GRANT SELECT,INSERT ON print_request_operations TO minhlab_app;
END IF; END $$;
ALTER TABLE file_assets ADD COLUMN retain_until timestamptz;
ALTER TABLE print_requests ADD COLUMN review_issue text;
