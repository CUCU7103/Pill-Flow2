CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('age_over_14','sensitive_health','photo_analysis')),
  policy_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_user_consents UNIQUE (user_id, consent_type, policy_version)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
-- Supabase 기본 권한이 새 테이블에 anon·authenticated의 ALL을 부여하므로 회수한 뒤 필요한 권한만 다시 준다.
REVOKE ALL ON public.user_consents FROM anon, authenticated;
GRANT SELECT ON public.user_consents TO authenticated;
GRANT INSERT (user_id, consent_type, policy_version) ON public.user_consents TO authenticated;
GRANT DELETE ON public.user_consents TO authenticated;

CREATE POLICY user_consents_select ON public.user_consents FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY user_consents_insert ON public.user_consents FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND policy_version = '2026-09-27');
-- 정책 버전을 올릴 때는 새 마이그레이션에서 이 INSERT 정책의 버전도 함께 갱신한다.
CREATE POLICY user_consents_delete ON public.user_consents FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id AND consent_type IN ('sensitive_health','photo_analysis'));

-- 환경에 따라 API role이 없을 수 있으므로 존재할 때만 런타임 권한을 부여한다.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'pillflow_api') THEN
    GRANT SELECT, INSERT, DELETE ON public.user_consents TO pillflow_api;
  ELSE
    RAISE NOTICE 'pillflow_api role 없음: user_consents 권한 부여 생략';
  END IF;
END $$;
