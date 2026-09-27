CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('age_over_14','sensitive_health','photo_analysis')),
  policy_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_user_consents UNIQUE (user_id, consent_type, policy_version)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_consents FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;

CREATE POLICY user_consents_select ON public.user_consents FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY user_consents_insert ON public.user_consents FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'pillflow_api') THEN
    GRANT SELECT, INSERT ON public.user_consents TO pillflow_api;
  END IF;
END $$;
