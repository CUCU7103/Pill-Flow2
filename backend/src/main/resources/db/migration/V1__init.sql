CREATE TYPE public.med_type AS ENUM ('tablet','syrup','powder','ointment','drops','inhaler');
CREATE TABLE public.medications (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL, dosage text NOT NULL, memo text NOT NULL DEFAULT '', type public.med_type NOT NULL DEFAULT 'tablet',
 color text NOT NULL DEFAULT '#6C63FF', times text[] NOT NULL, days text[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri,sat,sun}'::text[],
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(), updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 CONSTRAINT medications_times_check CHECK (
  pg_catalog.cardinality(times) BETWEEN 1 AND 4
  AND times::pg_catalog.text OPERATOR(pg_catalog.~) '^[{]([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*[}]$'
 ),
 CONSTRAINT medications_days_check CHECK (
  pg_catalog.cardinality(days) >= 1
  AND days OPERATOR(pg_catalog.<@) ARRAY['mon','tue','wed','thu','fri','sat','sun']::pg_catalog.text[]
 )
);
CREATE FUNCTION public.set_medication_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
 NEW.updated_at := pg_catalog.clock_timestamp();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_medication_updated_at() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER medications_set_updated_at
 BEFORE UPDATE ON public.medications
 FOR EACH ROW EXECUTE FUNCTION public.set_medication_updated_at();
CREATE INDEX medications_user_id_idx ON public.medications(user_id);
CREATE TABLE public.medication_logs (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, taken_on date NOT NULL, taken_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 CONSTRAINT uq_medication_logs_medication_date UNIQUE (medication_id,taken_on)
);
CREATE INDEX medication_logs_user_date_idx ON public.medication_logs(user_id,taken_on);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY; ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY medications_select ON public.medications FOR SELECT TO authenticated
 USING ((select auth.uid()) = user_id);
CREATE POLICY medications_insert ON public.medications FOR INSERT TO authenticated
 WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY medications_update ON public.medications FOR UPDATE TO authenticated
 USING ((select auth.uid()) = user_id)
 WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY medications_delete ON public.medications FOR DELETE TO authenticated
 USING ((select auth.uid()) = user_id);
CREATE POLICY logs_select ON public.medication_logs FOR SELECT TO authenticated
 USING ((select auth.uid()) = user_id);
CREATE POLICY logs_insert ON public.medication_logs FOR INSERT TO authenticated
 WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
   SELECT 1
   FROM public.medications m
   WHERE m.id = medication_id AND m.user_id = (select auth.uid())
  )
 );
CREATE POLICY logs_delete ON public.medication_logs FOR DELETE TO authenticated
 USING ((select auth.uid()) = user_id);
REVOKE ALL ON public.medications, public.medication_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications, public.medication_logs TO authenticated;
