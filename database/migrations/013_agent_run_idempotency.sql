ALTER TABLE production_agent_runs ADD COLUMN request_key varchar(120) UNIQUE;
ALTER TABLE production_agent_runs ADD COLUMN request_hash char(64);
ALTER TABLE production_agent_runs ADD COLUMN scope_ids jsonb;
ALTER TABLE production_agent_runs ADD COLUMN requested_by uuid REFERENCES users(id);
ALTER TABLE production_agent_runs ADD COLUMN lease_until timestamptz;
ALTER TABLE production_agent_runs ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5);
