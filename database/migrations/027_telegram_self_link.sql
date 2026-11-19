-- One bounded, expiring challenge per website account; raw tokens are never stored.
CREATE TABLE telegram_link_requests (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  request_id uuid NOT NULL UNIQUE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  previous_telegram_user_id varchar(20),
  candidate_id varchar(20),
  candidate_name varchar(160),
  CHECK (candidate_id IS NULL OR candidate_id ~ '^[1-9][0-9]{0,19}$')
);
