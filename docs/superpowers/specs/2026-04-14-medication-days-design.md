# 설계: 복용 요일 기능 추가

**날짜:** 2026-04-14  
**상태:** 승인됨

## 문제

1. 약 등록 시 복용 요일 설정 기능 없음
2. TodayView에서 오늘 요일에 해당하지 않는 약도 모두 표시됨
3. 앱이 자정을 넘겨 열린 채로 있으면 completed 상태가 리셋되지 않음

## 해결 방향

방식 A: `medications` 테이블에 `days` 배열 컬럼 추가

---

## 1. 데이터 모델

### Supabase 마이그레이션

```sql
ALTER TABLE medications
ADD COLUMN days text[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri,sat,sun}';
```

- 기존 약은 전체 요일(매일) 로 자동 설정됨 (하위호환)
- 값: `"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"`

### Medication 타입 변경

```ts
interface Medication {
  // 기존 필드 유지
  days: string[]; // 추가: 복용 요일 배열
}
```

---

## 2. AddView — 요일 선택 UI

- 약 등록 폼 하단에 요일 토글 버튼 추가
- 기본값: 전체 요일 선택 (매일)
- 최소 1개 이상 선택 필수 (유효성 검사)
- 요일 순서: 월 화 수 목 금 토 일

---

## 3. TodayView — 오늘 요일 필터링

- `App.tsx`에서 `meds`를 오늘 요일 기준으로 필터링 후 `TodayView`에 전달
- 필터 키: `["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()]`

---

## 4. 자정 날짜 변경 감지

- `useDayChange` 훅 추가: 자정이 지나면 `refetchMeds()` 호출
- `App.tsx`에서 `useMedications`의 `refetch`를 활용

---

## 5. 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `src/types/index.ts` | `Medication`에 `days` 필드 추가 |
| `src/hooks/use-medications.ts` | `toMedication`, `addMed`에 `days` 처리 추가 |
| `src/hooks/use-day-change.ts` | 신규: 자정 감지 훅 |
| `src/components/views/AddView.tsx` | 요일 선택 UI 추가 |
| `src/App.tsx` | 오늘 요일 필터링 + `useDayChange` 적용 |
| Supabase SQL | `days` 컬럼 마이그레이션 |
