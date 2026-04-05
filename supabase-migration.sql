-- Supabase SQL Editor에서 실행해주세요
-- 약 테이블
CREATE TABLE IF NOT EXISTS medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  dosage_amount INTEGER NOT NULL DEFAULT 1,
  remaining_quantity INTEGER NOT NULL DEFAULT 30,
  time TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'morning' CHECK (category IN ('morning', 'lunch', 'evening')),
  type TEXT NOT NULL DEFAULT 'pill' CHECK (type IN ('pill', 'capsule', 'liquid')),
  color TEXT NOT NULL DEFAULT '#6C63FF',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 복용 기록 테이블
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스: 날짜별 복용 기록 조회 최적화
CREATE INDEX IF NOT EXISTS idx_medication_logs_date ON medication_logs(date);
CREATE INDEX IF NOT EXISTS idx_medication_logs_med_date ON medication_logs(medication_id, date);

-- RLS 비활성화 (인증 없이 사용, 추후 인증 추가 시 활성화)
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 접근 허용 정책 (추후 인증 추가 시 수정)
CREATE POLICY "Allow all access to medications" ON medications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to medication_logs" ON medication_logs FOR ALL USING (true) WITH CHECK (true);

-- 초기 데이터
INSERT INTO medications (name, dosage, dosage_amount, remaining_quantity, time, category, type, color) VALUES
  ('종합비타민', '1캡슐 · 식사 후', 1, 28, '08:00 AM', 'morning', 'capsule', '#6C63FF'),
  ('오메가-3', '2캡슐 · 고함량', 2, 60, '08:30 AM', 'morning', 'pill', '#FF6584'),
  ('비타민 D3', '1000 IU · 액상형', 1, 15, '01:00 PM', 'lunch', 'liquid', '#FFD166');
