-- Shut the back door into the database.
--
-- Supabase exposes every table in the public schema through its own REST API
-- to the "anon" and "authenticated" roles, using a key that is meant to be
-- public. This system never uses that API: the backend connects as the owner
-- with the password in DATABASE_URL. Until now those roles held full rights on
-- every table, so anyone holding that public key could have read password
-- hashes and live sign-ins, or deleted records, without going near our API.
--
-- Two locks, so one slip doesn't open it: take the rights away, and switch on
-- row level security with no policies (which denies everything). The table
-- owner is not subject to row level security, so the backend is unaffected.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- Tables made later start locked too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
