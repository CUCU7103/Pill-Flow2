CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);

CREATE TYPE public.med_type AS ENUM ('tablet','syrup','powder','ointment','drops','inhaler');
CREATE TYPE public.category AS ENUM ('morning','afternoon','evening');

CREATE TABLE public.medications (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    dosage text NOT NULL,
    memo text NOT NULL DEFAULT '',
    type public.med_type NOT NULL DEFAULT 'tablet',
    category public.category,
    color text NOT NULL DEFAULT '#6C63FF',
    time text,
    times text[] DEFAULT ARRAY[]::text[],
    days text[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri,sat,sun}'::text[],
    created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.medication_logs (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    user_id uuid CONSTRAINT medication_logs_user_id_fkey REFERENCES auth.users(id),
    "date" text NOT NULL,
    taken_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
CREATE INDEX idx_medication_logs_date ON public.medication_logs("date");
CREATE INDEX idx_medication_logs_med_date ON public.medication_logs(medication_id, "date");

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY medications_select ON public.medications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY medications_insert ON public.medications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY medications_update ON public.medications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY medications_delete ON public.medications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY logs_select ON public.medication_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY logs_insert ON public.medication_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY logs_delete ON public.medication_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.medications(user_id, name, dosage, type, category, color, time, times, days)
VALUES ('00000000-0000-0000-0000-000000000001', '기존 약', '1정', 'tablet', 'morning', '#6C63FF', '08:00', '{}', '{mon}');
INSERT INTO public.medication_logs(medication_id, user_id, "date")
SELECT id, user_id, '2026-09-25' FROM public.medications WHERE name = '기존 약';
