-- Phase: Profile Settings
-- Enable pgcrypto for AES-256 column encryption and supabase_vault for key storage.
-- Creates a private helper to fetch the encryption key from vault without exposing it
-- to PostgREST or the client layer.

-- Enable pgcrypto (provides pgp_sym_encrypt / pgp_sym_decrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- supabase_vault is pre-installed on hosted Supabase (Postgres 15+).
-- This is a no-op if already present.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Generate and store a 256-bit encryption key for travel documents.
-- Uses vault.create_secret() (SECURITY DEFINER) instead of direct INSERT — required for hosted Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'travel_documents_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'travel_documents_encryption_key',
      'AES-256 key for encrypting travel document PII fields'
    );
  END IF;
END;
$$;

-- Private helper: fetches the decrypted key from vault.
-- SECURITY DEFINER + search_path = '' ensures:
--   1. The vault schema is not accessible via PostgREST (no RLS policy covers it).
--   2. The function runs as the owning role, which has SELECT on vault.decrypted_secrets.
--   3. search_path = '' prevents search-path injection attacks.
CREATE OR REPLACE FUNCTION private.get_travel_doc_encryption_key()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'travel_documents_encryption_key'
  LIMIT 1;
$$;
