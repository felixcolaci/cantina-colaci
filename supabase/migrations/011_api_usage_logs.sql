-- supabase/migrations/011_api_usage_logs.sql
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  feature       text        NOT NULL,
  model         text        NOT NULL,
  input_tokens  integer     NOT NULL,
  output_tokens integer     NOT NULL,
  cost_usd      numeric(10,6) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON api_usage_logs (family_id, created_at DESC);

ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
