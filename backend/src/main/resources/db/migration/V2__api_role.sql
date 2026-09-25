DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='pillflow_api') THEN CREATE ROLE pillflow_api LOGIN BYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public TO pillflow_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications, public.medication_logs TO pillflow_api;
