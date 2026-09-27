-- SEC-04: 약 정보 입력 크기 제한.
-- 백엔드 MedicationService와 프론트 constants.ts(MED_INPUT_LIMITS)의 상한과 같은 값을 유지한다.
-- 운영 DB에 기존 행이 있으므로 모든 제약을 NOT VALID로 추가해 배포 시 기존 행 검사로 실패하지 않게 하고,
-- 새로 추가·수정되는 행에만 강제한다. 기존 행을 정리한 뒤 VALIDATE CONSTRAINT는 별도 마이그레이션으로 한다.
-- Supabase 직접 경로(롤백 경로)는 API 검증을 거치지 않으므로 이 제약이 유일한 서버 측 방어선이다.

-- CHECK 제약에는 서브쿼리를 쓸 수 없어 요일 중복 검사를 IMMUTABLE 함수로 분리한다.
-- CHECK 평가 시 삽입하는 역할에 EXECUTE 권한이 필요하므로 기본 PUBLIC 실행 권한은 유지한다(순수 함수라 노출 위험 없음).
CREATE FUNCTION public.medication_days_are_distinct(days text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog
AS $$ SELECT pg_catalog.count(*) = pg_catalog.count(DISTINCT d) FROM pg_catalog.unnest(days) AS d $$;
-- 운영 프로젝트에서 PUBLIC 기본 권한이 회수돼 있어도 약 추가가 42501로 실패하지 않도록 삽입 주체에 명시적으로 부여한다.
GRANT EXECUTE ON FUNCTION public.medication_days_are_distinct(text[]) TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'pillflow_api') THEN
    GRANT EXECUTE ON FUNCTION public.medication_days_are_distinct(text[]) TO pillflow_api;
  ELSE
    RAISE NOTICE 'pillflow_api role 없음: medication_days_are_distinct 권한 부여 생략';
  END IF;
END $$;

ALTER TABLE public.medications
 ADD CONSTRAINT medications_name_length_check CHECK (pg_catalog.char_length(name) BETWEEN 1 AND 100) NOT VALID,
 ADD CONSTRAINT medications_dosage_length_check CHECK (pg_catalog.char_length(dosage) BETWEEN 1 AND 50) NOT VALID,
 ADD CONSTRAINT medications_memo_length_check CHECK (pg_catalog.char_length(memo) <= 1000) NOT VALID,
 ADD CONSTRAINT medications_color_format_check CHECK (color OPERATOR(pg_catalog.~) '^#[0-9A-Fa-f]{6}$') NOT VALID,
 -- V1의 medications_days_check(유효 요일 부분집합)와 합쳐 최대 7개가 보장된다.
 ADD CONSTRAINT medications_days_distinct_check CHECK (public.medication_days_are_distinct(days)) NOT VALID;
