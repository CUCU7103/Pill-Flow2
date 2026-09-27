-- SEC-03: 사진 분석(외부 AI 호출) 사용자별 호출 한도.
-- Edge Function analyze-medication-photo가 사용자 JWT로 public.consume_photo_analysis_quota()를 Groq 호출 전에 부른다.
-- 배포 순서: 이 마이그레이션이 먼저 적용된 뒤 Edge Function을 배포한다. 함수가 없으면 Edge Function이 503으로 거부(fail-closed)한다.
-- 한도를 바꿀 때는 새 마이그레이션에서 CREATE OR REPLACE FUNCTION으로 아래 상수를 수정한다.

CREATE TABLE public.photo_analysis_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_window_start timestamptz NOT NULL,
  minute_count integer NOT NULL DEFAULT 0,
  day_window date NOT NULL,
  day_count integer NOT NULL DEFAULT 0
);

-- 사용량 행은 아래 SECURITY DEFINER 함수로만 바꾼다. 직접 접근 정책은 두지 않는다.
ALTER TABLE public.photo_analysis_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_analysis_usage FROM PUBLIC, anon, authenticated;

-- 호출 1회를 원자적으로 차감한다. 반환값 0은 허용, 양수는 다시 시도할 수 있을 때까지 남은 초(Retry-After).
-- 단기 한도: 1분 5회, 일일 한도: 한국 시간 기준 하루 30회. 거부된 요청은 차감하지 않는다.
CREATE FUNCTION public.consume_photo_analysis_quota() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  minute_limit CONSTANT integer := 5;
  daily_limit CONSTANT integer := 30;
  caller uuid := auth.uid();
  now_ts timestamptz := pg_catalog.clock_timestamp();
  today date := (now_ts AT TIME ZONE 'Asia/Seoul')::date;
  usage public.photo_analysis_usage%ROWTYPE;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  -- 첫 호출이면 행을 만들고, 이후 FOR UPDATE로 같은 사용자의 동시 요청을 직렬화한다.
  INSERT INTO public.photo_analysis_usage(user_id, minute_window_start, minute_count, day_window, day_count)
  VALUES (caller, now_ts, 0, today, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO usage FROM public.photo_analysis_usage WHERE user_id = caller FOR UPDATE;

  IF usage.day_window OPERATOR(pg_catalog.<>) today THEN
    usage.day_window := today;
    usage.day_count := 0;
  END IF;
  IF now_ts OPERATOR(pg_catalog.-) usage.minute_window_start OPERATOR(pg_catalog.>=) interval '1 minute' THEN
    usage.minute_window_start := now_ts;
    usage.minute_count := 0;
  END IF;

  IF usage.day_count OPERATOR(pg_catalog.>=) daily_limit THEN
    -- 다음 한국 시간 자정까지 남은 초
    RETURN GREATEST(1, pg_catalog.ceil(pg_catalog.date_part('epoch',
      ((today OPERATOR(pg_catalog.+) 1)::timestamp AT TIME ZONE 'Asia/Seoul') OPERATOR(pg_catalog.-) now_ts))::integer);
  END IF;
  IF usage.minute_count OPERATOR(pg_catalog.>=) minute_limit THEN
    RETURN GREATEST(1, pg_catalog.ceil(pg_catalog.date_part('epoch',
      (usage.minute_window_start OPERATOR(pg_catalog.+) interval '1 minute') OPERATOR(pg_catalog.-) now_ts))::integer);
  END IF;

  UPDATE public.photo_analysis_usage
  SET minute_window_start = usage.minute_window_start,
      minute_count = usage.minute_count OPERATOR(pg_catalog.+) 1,
      day_window = usage.day_window,
      day_count = usage.day_count OPERATOR(pg_catalog.+) 1
  WHERE user_id = caller;
  RETURN 0;
END;
$$;

-- Supabase는 새 함수에 PUBLIC·anon 실행 권한을 기본 부여하므로 회수하고 로그인 사용자에게만 허용한다.
REVOKE ALL ON FUNCTION public.consume_photo_analysis_quota() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_photo_analysis_quota() TO authenticated;
