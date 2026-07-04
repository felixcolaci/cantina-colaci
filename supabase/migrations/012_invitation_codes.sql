-- supabase/migrations/012_invitation_codes.sql
CREATE TABLE invitation_codes (
  code       text        PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  used_by    uuid        REFERENCES auth.users(id)
);

ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated — all access is via service_role
GRANT SELECT, INSERT, UPDATE ON public.invitation_codes TO service_role;
