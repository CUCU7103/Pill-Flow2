-- ============================================================
-- PillFlow v2 마이그레이션: 사용자별 데이터 격리 (RLS 강화)
-- Supabase SQL Editor에서 실행해주세요
-- ============================================================

-- ① medications 테이블에 user_id 컬럼 추가
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ② medication_logs 테이블에 user_id 컬럼 추가 (조인 없이 RLS 적용 가능하도록)
ALTER TABLE medication_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ③ 기존 데이터가 있다면 현재 로그인 사용자의 ID로 일괄 업데이트
-- (초기 테스트 데이터 정리 목적 - 필요 시 삭제)
-- UPDATE medications SET user_id = auth.uid() WHERE user_id IS NULL;
-- UPDATE medication_logs SET user_id = auth.uid() WHERE user_id IS NULL;

-- ④ 기존 모든-접근-허용 정책 제거
DROP POLICY IF EXISTS "Allow all access to medications" ON medications;
DROP POLICY IF EXISTS "Allow all access to medication_logs" ON medication_logs;

-- ⑤ medications: 본인 데이터만 조회/추가/수정/삭제 가능
CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  USING (auth.uid() = user_id);

-- ⑥ medication_logs: 본인 데이터만 조회/추가/삭제 가능
CREATE POLICY "Users can view own medication_logs"
  ON medication_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medication_logs"
  ON medication_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own medication_logs"
  ON medication_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ⑦ 인덱스: user_id 기반 쿼리 성능 향상
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON medication_logs(user_id);
