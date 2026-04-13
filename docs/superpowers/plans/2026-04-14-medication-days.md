# 복용 요일 기능 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 약마다 복용 요일을 지정하고, TodayView에서 오늘 해당하는 약만 표시하며, 자정 날짜 변경 시 자동 리셋되도록 한다.

**Architecture:** `medications` DB 테이블에 `days text[]` 컬럼을 추가하고, `Medication` 타입에 `days: string[]`을 추가한다. `AddView`의 기존 요일 선택 UI가 실제로 저장되도록 `save` 함수와 `addMed`를 수정한다. `App.tsx`에서 오늘 요일 필터링 + 자정 감지 훅을 적용한다.

**Tech Stack:** React, TypeScript, Supabase (PostgreSQL), Capacitor

---

## 파일 변경 맵

| 파일 | 변경 종류 | 내용 |
|------|----------|------|
| `artifacts/pillflow/src/types/index.ts` | 수정 | `Medication`에 `days: string[]` 추가 |
| `artifacts/pillflow/src/hooks/use-medications.ts` | 수정 | `toMedication`, `addMed`에 `days` 처리 추가 |
| `artifacts/pillflow/src/hooks/use-day-change.ts` | 신규 생성 | 자정 날짜 변경 감지 훅 |
| `artifacts/pillflow/src/components/views/AddView.tsx` | 수정 | `save`에서 `days` 전달 + 최소 1개 유효성 검사 |
| `artifacts/pillflow/src/App.tsx` | 수정 | 오늘 요일 필터링 + `useDayChange` 적용 |

> **Supabase 마이그레이션은 Task 1에서 먼저 실행한다. 이후 코드 변경은 순서대로 진행한다.**

---

## Task 1: Supabase DB 마이그레이션

**Files:**
- 없음 (Supabase 대시보드 SQL Editor에서 직접 실행)

- [ ] **Step 1: Supabase 대시보드 SQL Editor에서 아래 쿼리 실행**

```sql
ALTER TABLE medications
ADD COLUMN IF NOT EXISTS days text[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri,sat,sun}';
```

- [ ] **Step 2: 실행 결과 확인**

아래 쿼리로 컬럼이 추가됐는지 확인한다:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'medications' AND column_name = 'days';
```

예상 결과:
```
column_name | data_type | column_default
days        | ARRAY     | '{mon,tue,wed,thu,fri,sat,sun}'::text[]
```

- [ ] **Step 3: 기존 데이터 확인**

```sql
SELECT id, name, days FROM medications LIMIT 5;
```

기존 약들의 `days` 컬럼이 `{mon,tue,wed,thu,fri,sat,sun}` 으로 채워져 있어야 한다.

---

## Task 2: `Medication` 타입에 `days` 추가

**Files:**
- Modify: `artifacts/pillflow/src/types/index.ts`

- [ ] **Step 1: `Medication` 인터페이스에 `days` 필드 추가**

`artifacts/pillflow/src/types/index.ts`의 `Medication` 인터페이스를:

```ts
/** 약 정보 인터페이스 */
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosageAmount: number;
  remainingQuantity: number;
  time: string;
  category: Category;
  completed: boolean;
  type: MedType;
  color: string;
}
```

아래와 같이 변경한다:

```ts
/** 약 정보 인터페이스 */
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosageAmount: number;
  remainingQuantity: number;
  time: string;
  category: Category;
  completed: boolean;
  type: MedType;
  color: string;
  /** 복용 요일 배열. 예: ["mon","wed","fri"] */
  days: string[];
}
```

- [ ] **Step 2: 타입스크립트 컴파일 에러 확인**

```bash
cd artifacts/pillflow && npx tsc --noEmit 2>&1 | head -40
```

`days` 필드가 없다는 에러가 여러 개 나오는 것이 정상이다. 이후 태스크에서 순차적으로 해결한다.

- [ ] **Step 3: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2
git add artifacts/pillflow/src/types/index.ts
git commit -m "[Feat] Medication 타입에 days 필드 추가"
```

---

## Task 3: `use-medications.ts` — `days` 읽기/쓰기 추가

**Files:**
- Modify: `artifacts/pillflow/src/hooks/use-medications.ts`

현재 `toMedication` 함수는 DB 행에서 `days`를 읽지 않고, `addMed`는 `days`를 insert하지 않는다.

- [ ] **Step 1: `toMedication` 함수에 `days` 매핑 추가**

`toMedication` 함수를:

```ts
function toMedication(row: Record<string, unknown>, completedIds: Set<string>): Medication {
  return {
    id: row.id as string,
    name: row.name as string,
    dosage: row.dosage as string,
    dosageAmount: row.dosage_amount as number,
    remainingQuantity: row.remaining_quantity as number,
    time: row.time as string,
    category: row.category as Category,
    type: row.type as MedType,
    color: row.color as string,
    completed: completedIds.has(row.id as string),
  };
}
```

아래와 같이 변경한다:

```ts
function toMedication(row: Record<string, unknown>, completedIds: Set<string>): Medication {
  return {
    id: row.id as string,
    name: row.name as string,
    dosage: row.dosage as string,
    dosageAmount: row.dosage_amount as number,
    remainingQuantity: row.remaining_quantity as number,
    time: row.time as string,
    category: row.category as Category,
    type: row.type as MedType,
    color: row.color as string,
    // DB 컬럼이 없는 구버전 데이터 대비 — 없으면 전체 요일로 fallback
    days: (row.days as string[] | null) ?? ["mon","tue","wed","thu","fri","sat","sun"],
    completed: completedIds.has(row.id as string),
  };
}
```

- [ ] **Step 2: `addMed` 파라미터에 `days` 추가**

`addMed`의 파라미터 타입을:

```ts
const addMed = useCallback(
  async (data: {
    name: string;
    dosage: string;
    dosageAmount: number;
    remainingQuantity: number;
    time: string;
    category: Category;
    type: MedType;
    color: string;
  }) => {
```

아래와 같이 변경한다:

```ts
const addMed = useCallback(
  async (data: {
    name: string;
    dosage: string;
    dosageAmount: number;
    remainingQuantity: number;
    time: string;
    category: Category;
    type: MedType;
    color: string;
    days: string[];
  }) => {
```

- [ ] **Step 3: `addMed`의 supabase insert에 `days` 추가**

insert 객체를:

```ts
const { data: row, error: err } = await supabase
  .from("medications")
  .insert({
    user_id: userId,
    name: data.name,
    dosage: data.dosage,
    dosage_amount: data.dosageAmount,
    remaining_quantity: data.remainingQuantity,
    time: data.time,
    category: data.category,
    type: data.type,
    color: data.color,
  })
  .select()
  .single();
```

아래와 같이 변경한다:

```ts
const { data: row, error: err } = await supabase
  .from("medications")
  .insert({
    user_id: userId,
    name: data.name,
    dosage: data.dosage,
    dosage_amount: data.dosageAmount,
    remaining_quantity: data.remainingQuantity,
    time: data.time,
    category: data.category,
    type: data.type,
    color: data.color,
    days: data.days,
  })
  .select()
  .single();
```

- [ ] **Step 4: 타입 에러 확인**

```bash
cd artifacts/pillflow && npx tsc --noEmit 2>&1 | head -40
```

`use-medications.ts` 관련 에러는 사라져야 한다. `AddView`, `App.tsx` 관련 에러는 남아있는 것이 정상이다.

- [ ] **Step 5: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2
git add artifacts/pillflow/src/hooks/use-medications.ts
git commit -m "[Feat] use-medications: days 필드 읽기/쓰기 추가"
```

---

## Task 4: `AddView` — `days`를 `onSave`에 전달 + 유효성 검사

**Files:**
- Modify: `artifacts/pillflow/src/components/views/AddView.tsx`

현재 `AddView`에는 요일 선택 UI(`days` 상태)가 이미 존재한다. 하지만 `save` 함수가 `onSave`를 호출할 때 `days`를 전달하지 않고, 최소 1개 선택 유효성 검사도 없다.

`AddView`의 `days` 상태는 숫자 인덱스 배열(`[0,1,2,3,4,5,6]`)이다. 이를 DB 문자열 키로 변환해야 한다:
- 0 → "mon", 1 → "tue", 2 → "wed", 3 → "thu", 4 → "fri", 5 → "sat", 6 → "sun"

- [ ] **Step 1: `save` 함수에 `days` 변환 및 전달 추가**

`save` 함수 내부 `onSave(...)` 호출 부분을:

```ts
await onSave({
  name: name.trim(),
  dosage: `${dosage}${doseUnit}`,
  dosageAmount: parseInt(dosage) || 1,
  remainingQuantity: parseInt(remaining) || 0,
  time: formatDisplay(time),
  category: cat,
  type,
  color,
});
```

아래와 같이 변경한다:

```ts
// 숫자 인덱스(월=0 기준)를 DB 문자열 키로 변환
const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"] as const;
const selectedDays = DAY_KEYS.filter((_, i) => days.includes(i));

await onSave({
  name: name.trim(),
  dosage: `${dosage}${doseUnit}`,
  dosageAmount: parseInt(dosage) || 1,
  remainingQuantity: parseInt(remaining) || 0,
  time: formatDisplay(time),
  category: cat,
  type,
  color,
  days: selectedDays,
});
```

- [ ] **Step 2: `save` 함수에 최소 1개 요일 선택 유효성 검사 추가**

`save` 함수의 early return 조건을:

```ts
if (!name.trim() || saving) return;
```

아래와 같이 변경한다:

```ts
if (!name.trim() || saving) return;
if (days.length === 0) {
  toast.error("복용 요일을 최소 1개 선택해주세요.");
  return;
}
```

- [ ] **Step 3: 저장 버튼 비활성화 조건에 `days` 추가**

저장 버튼의 `disabled` 속성을:

```tsx
disabled={!name.trim() || saving}
```

아래와 같이 변경한다:

```tsx
disabled={!name.trim() || saving || days.length === 0}
```

저장 버튼의 `style` 내 조건도 동일하게 수정한다:

```tsx
style={{
  background: name.trim() && !saving && days.length > 0
    ? "linear-gradient(135deg,#6C63FF,#4FACFE)"
    : t.divider,
}}
```

- [ ] **Step 4: 타입 에러 확인**

```bash
cd artifacts/pillflow && npx tsc --noEmit 2>&1 | head -40
```

`AddView` 관련 에러가 사라져야 한다.

- [ ] **Step 5: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2
git add artifacts/pillflow/src/components/views/AddView.tsx
git commit -m "[Feat] AddView: days를 onSave에 전달 및 유효성 검사 추가"
```

---

## Task 5: `use-day-change.ts` — 자정 날짜 변경 감지 훅 생성

**Files:**
- Create: `artifacts/pillflow/src/hooks/use-day-change.ts`

앱이 자정을 넘겨 열린 채로 있으면 `completed` 상태가 리셋되지 않는다. 자정까지 남은 밀리초를 계산해 `setTimeout`으로 콜백을 호출한다.

- [ ] **Step 1: `use-day-change.ts` 파일 생성**

`artifacts/pillflow/src/hooks/use-day-change.ts` 파일을 아래 내용으로 생성한다:

```ts
import { useEffect } from "react";

/**
 * 자정(00:00)이 지나면 callback을 호출하는 훅.
 * 앱이 자정을 넘겨 열린 채로 있을 때 복약 데이터를 자동 리셋하기 위해 사용한다.
 */
export function useDayChange(callback: () => void) {
  useEffect(() => {
    function scheduleMidnight() {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 100, // 자정 + 100ms 여유
      );
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      const timer = setTimeout(() => {
        callback();
        // 자정 이후 다음 자정도 감지하기 위해 재귀 스케줄링
        scheduleMidnight();
      }, msUntilMidnight);

      return timer;
    }

    const timer = scheduleMidnight();
    return () => clearTimeout(timer);
  // callback이 바뀌어도 타이머를 재설정하지 않도록 의존성 배열 비움
  // (App.tsx에서 useCallback으로 감싼 refetch를 전달하므로 안전)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2
git add artifacts/pillflow/src/hooks/use-day-change.ts
git commit -m "[Feat] useDayChange 훅 추가 - 자정 날짜 변경 감지"
```

---

## Task 6: `App.tsx` — 오늘 요일 필터링 + `useDayChange` 적용

**Files:**
- Modify: `artifacts/pillflow/src/App.tsx`

- [ ] **Step 1: `useDayChange` import 추가**

`App.tsx` 상단 import에 추가한다:

```ts
import { useDayChange } from "@/hooks/use-day-change";
```

- [ ] **Step 2: 오늘 요일 키 계산 + `meds` 필터링 추가**

`App.tsx`의 `useMedications` 아래에 추가한다:

```ts
// 오늘 요일 키 계산 (일=0, 월=1 ... 토=6 → DB 키로 변환)
const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const todayKey = DAY_KEYS[new Date().getDay()];

// 오늘 복용해야 할 약만 필터링
const todayMeds = meds.filter((m) => m.days.includes(todayKey));
```

- [ ] **Step 3: `useDayChange`로 자정 리셋 적용**

`useNotifications` 아래에 추가한다:

```ts
// 자정이 지나면 복약 데이터 재조회 (completed 상태 리셋)
useDayChange(refetchMeds);
```

- [ ] **Step 4: `TodayView`에 `todayMeds` 전달**

`TodayView`의 `meds` prop을 `todayMeds`로 교체한다:

```tsx
<TodayView
  meds={todayMeds}   // meds → todayMeds
  onToggle={handleToggle}
  onDelete={handleDelete}
  onAddClick={() => setView("add")}
  dark={dark}
  onOpenSettings={() => setSettingsOpen(true)}
/>
```

- [ ] **Step 5: `useMedications`에서 `refetch` 구조분해 확인**

`useMedications` 호출부를 확인해 `refetchMeds`가 구조분해되어 있는지 확인한다. 현재:

```ts
const { meds, loading: medsLoading, addMed, deleteMed, toggleMed, resetAll } = useMedications(user?.id);
```

`refetch`를 추가로 구조분해한다:

```ts
const { meds, loading: medsLoading, addMed, deleteMed, toggleMed, resetAll, refetch: refetchMeds } = useMedications(user?.id);
```

- [ ] **Step 6: 타입 에러 없음 확인**

```bash
cd artifacts/pillflow && npx tsc --noEmit 2>&1 | head -40
```

에러가 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2
git add artifacts/pillflow/src/App.tsx
git commit -m "[Feat] App: 오늘 요일 필터링 및 자정 리셋 적용"
```

---

## Task 7: 빌드 검증

- [ ] **Step 1: 빌드 실행**

```bash
cd artifacts/pillflow && pnpm build 2>&1 | tail -20
```

빌드 에러가 없어야 한다.

- [ ] **Step 2: (선택) Android 동기화**

Android 앱으로 테스트할 경우:

```bash
cd artifacts/pillflow && pnpm build && npx cap sync android
```

- [ ] **Step 3: 동작 확인 체크리스트**

1. 약 추가 화면에서 요일 선택 후 저장 → Supabase `medications` 테이블의 `days` 컬럼에 선택한 요일만 저장되는지 확인
2. TodayView에서 오늘 요일에 해당하는 약만 표시되는지 확인
3. 오늘 요일에 해당하지 않는 약은 표시되지 않는지 확인
4. 약 복용 체크 → 다음날(날짜 변경)에는 completed가 초기화되는지 확인
5. 요일 미선택 상태에서 저장 버튼이 비활성화되는지 확인
