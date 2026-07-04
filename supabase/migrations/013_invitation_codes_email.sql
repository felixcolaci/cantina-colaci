-- Add email column to invitation_codes table
-- Two-statement approach: ADD with DEFAULT, then DROP DEFAULT
-- This allows existing rows to be populated while forcing new inserts to supply an email

ALTER TABLE invitation_codes ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE invitation_codes ALTER COLUMN email DROP DEFAULT;
