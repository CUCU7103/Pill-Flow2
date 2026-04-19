# 알림 버튼 빠른 설정 패널 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인페이지(TodayView) Bell 버튼에 Radix Popover 패널을 붙여, 전체 알림 on/off와 시간대별(아침/점심/저녁) on/off를 즉시 제어할 수 있게 한다.

**Architecture:** `NotificationPopover` 컴포넌트가 Bell 버튼 트리거와 Popover 패널을 캡슐화하며, 상태는 `App.tsx`의 `usePersisted("pillflow_notif_categories")` 로 관리한다. 카테고리 상태 변경 시 `useNotifications` 훅이 즉시 재스케줄링하여 OS 알림에 실시간 반영한다.

**Tech Stack:** React, TypeScript, Radix UI Popover (`@radix-ui/react-popover` 이미 설치됨), Framer Motion, `@capacitor/local-notifications`, `localStorage` via `usePersisted`

---

## 파일 변경 맵

| 파일 | 작업 |
|------|------|
| `src/types/index.ts` | `NotifCategories` 타입 추가 |
| `src/hooks/use-notifications.ts` | `categories` 파라미터 추가, 카테고리 필터링 로직 |
| `src/components/NotificationPopover.tsx` | **신규** — Popover + Bell 버튼 + 토글 UI |
| `src/components/views/TodayView.tsx` | Bell 버튼 → `NotificationPopover` 교체, props 추가 |
| `src/App.tsx` | `notifCategories` 상태 추가, 훅 연결, TodayView props 전달 |

---

## Task 1: NotifCategories 타입 추가

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: `NotifCategories` 타입을 `src/types/index.ts` 끝에 추가**

```typescript
// src/types/index.ts 끝에 추가

/** 시간대별 알림 활성화 상태 */
export type NotifCategories = {
  morning: boolean;
  lunch: boolean;
  evening: boolean;
};
```

- [ ] **Step 2: 타입 검사 확인**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm tsc --noEmit 2>&1 | head -20
```
예상 출력: 오류 없음 (또는 기존 오류만 — 이 변경으로 새 오류가 생기면 안 됨)

- [ ] **Step 3: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
git add src/types/index.ts
git commit -m "[Feat] NotifCategories 타입 추가"
```

---

## Task 2: useNotifications 훅에 카테고리 필터링 추가

**Files:**
- Modify: `src/hooks/use-notifications.ts`

현재 `useNotifications(meds, notif)` 시그니처를 `useNotifications(meds, notif, categories)` 로 확장하고, `scheduleNotifications`에 카테고리 필터를 주입한다.

- [ ] **Step 1: `use-notifications.ts` import에 `NotifCategories` 추가**

파일 상단 import를 아래로 교체:

```typescript
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type ScheduleOptions } from "@capacitor/local-notifications";
import type { Medication, NotifCategories } from "@/types";
```

- [ ] **Step 2: `useNotifications` 시그니처 변경 및 categories 전달**

현재 코드 (L12-23):
```typescript
export function useNotifications(meds: Medication[], notif: boolean) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (notif) {
      scheduleNotifications(meds);
    } else {
      cancelAllNotifications();
    }
  }, [meds, notif]);
}
```

아래로 교체:
```typescript
export function useNotifications(
  meds: Medication[],
  notif: boolean,
  categories: NotifCategories
) {
  useEffect(() => {
    // 웹 환경에서는 Local Notifications API 사용 불가
    if (!Capacitor.isNativePlatform()) return;

    if (notif) {
      scheduleNotifications(meds, categories);
    } else {
      cancelAllNotifications();
    }
    // 객체 참조 대신 원시값으로 풀어서 불필요한 재실행 방지
  }, [meds, notif, categories.morning, categories.lunch, categories.evening]);
}
```

- [ ] **Step 3: `scheduleNotifications` 시그니처 변경 및 카테고리 필터 추가**

현재 코드 (L43):
```typescript
async function scheduleNotifications(meds: Medication[]) {
```

아래로 교체 (L43-57 전체):
```typescript
async function scheduleNotifications(meds: Medication[], categories: NotifCategories) {
  try {
    // 알림 권한 요청 (Android 13+ / iOS는 반드시 필요)
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== "granted") return;

    // Android 채널 생성 (소리/진동 포함)
    await ensureNotificationChannel();

    // 기존 알림을 모두 취소하고 새로 스케줄링 (중복 방지)
    await cancelAllNotifications();

    // 완료되지 않은 약 중 활성화된 카테고리에 해당하는 것만 스케줄링
    const pendingMeds = meds.filter(
      (m) => !m.completed && categories[m.category] === true
    );
    if (pendingMeds.length === 0) return;
```

(이후 `pendingMeds.map(...)` 부분은 변경 없음)

- [ ] **Step 4: 타입 검사 확인**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm tsc --noEmit 2>&1 | head -20
```
예상 출력: `App.tsx`에서 `useNotifications` 호출부 인자 부족 오류 발생 — 정상 (Task 5에서 수정)

- [ ] **Step 5: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
git add src/hooks/use-notifications.ts
git commit -m "[Feat] useNotifications에 카테고리별 알림 필터링 추가"
```

---

## Task 3: NotificationPopover 컴포넌트 신규 생성

**Files:**
- Create: `src/components/NotificationPopover.tsx`

Radix Popover를 사용해 Bell 버튼 트리거와 알림 설정 패널을 하나의 컴포넌트로 캡슐화한다. 기존 `Toggle` 컴포넌트(`src/components/common/Toggle.tsx`)를 재사용한다.

- [ ] **Step 1: `src/components/NotificationPopover.tsx` 생성**

```typescript
import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { Toggle } from "@/components/common/Toggle";
import { useTheme } from "@/hooks/use-theme";
import type { NotifCategories } from "@/types";

type Props = {
  dark: boolean;
  notifEnabled: boolean;
  onToggleNotif: () => void;
  categories: NotifCategories;
  onToggleCategory: (key: keyof NotifCategories) => void;
};

/** 시간대별 카테고리 표시 정보 */
const CATEGORY_LABELS: { key: keyof NotifCategories; label: string; time: string }[] = [
  { key: "morning", label: "아침", time: "06:00 ~ 10:59" },
  { key: "lunch",   label: "점심", time: "11:00 ~ 16:59" },
  { key: "evening", label: "저녁", time: "17:00 ~ 23:59" },
];

/** Bell 버튼 + 알림 설정 Popover 패널 */
export function NotificationPopover({
  dark,
  notifEnabled,
  onToggleNotif,
  categories,
  onToggleCategory,
}: Props) {
  const t = useTheme(dark);

  return (
    <Popover.Root>
      {/* Bell 버튼 — Popover 트리거 */}
      <Popover.Trigger asChild>
        <button
          aria-label="알림 설정"
          className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
          style={{ backgroundColor: t.card }}
        >
          <Bell size={17} style={{ color: "#6C63FF" }} />
        </button>
      </Popover.Trigger>

      {/* 패널 — 버튼 아래에 위치 */}
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl shadow-xl p-4"
          style={{ backgroundColor: t.card }}
        >
          {/* 헤더 */}
          <p
            className="text-xs font-black uppercase tracking-widest mb-3"
            style={{ color: t.subtext }}
          >
            알림
          </p>

          {/* 전체 알림 토글 */}
          <div
            className="flex items-center justify-between py-2 mb-2 border-b"
            style={{ borderColor: t.divider }}
          >
            <span className="text-sm font-bold" style={{ color: t.text }}>
              전체 알림
            </span>
            <Toggle on={notifEnabled} onToggle={onToggleNotif} />
          </div>

          {/* 시간대별 토글 */}
          <div className="flex flex-col gap-2 mt-2">
            {CATEGORY_LABELS.map(({ key, label, time }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: notifEnabled ? t.text : t.subtext }}
                  >
                    {label}
                  </p>
                  <p className="text-[10px]" style={{ color: t.subtext }}>
                    {time}
                  </p>
                </div>
                {/* 전체 알림 OFF이면 카테고리 토글 비활성화 */}
                <div style={{ opacity: notifEnabled ? 1 : 0.4, pointerEvents: notifEnabled ? "auto" : "none" }}>
                  <Toggle
                    on={categories[key]}
                    onToggle={() => onToggleCategory(key)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Radix Popover 화살표 */}
          <Popover.Arrow style={{ fill: t.card }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

- [ ] **Step 2: 타입 검사**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm tsc --noEmit 2>&1 | head -30
```
예상: `NotificationPopover.tsx` 자체 오류 없음. `App.tsx` 관련 기존 오류만 남아있을 수 있음.

- [ ] **Step 3: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
git add src/components/NotificationPopover.tsx
git commit -m "[Feat] NotificationPopover 컴포넌트 생성"
```

---

## Task 4: TodayView에 NotificationPopover 연결

**Files:**
- Modify: `src/components/views/TodayView.tsx`

기존 Bell 버튼(L80-86)을 `NotificationPopover`로 교체하고, props 인터페이스를 확장한다.

- [ ] **Step 1: import 추가**

`TodayView.tsx` 상단 import 블록에 추가:

```typescript
import { NotificationPopover } from "@/components/NotificationPopover";
import type { NotifCategories } from "@/types";
```

- [ ] **Step 2: Props 인터페이스에 알림 관련 필드 추가**

현재 props 인터페이스 (L20-27):
```typescript
{
  meds: Medication[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  dark: boolean;
  onOpenSettings: () => void;
}
```

아래로 교체:
```typescript
{
  meds: Medication[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  dark: boolean;
  onOpenSettings: () => void;
  notifEnabled: boolean;
  onToggleNotif: () => void;
  categories: NotifCategories;
  onToggleCategory: (key: keyof NotifCategories) => void;
}
```

- [ ] **Step 3: 함수 매개변수 구조분해에 새 props 추가**

현재 (L13-27):
```typescript
export function TodayView({
  meds,
  onToggle,
  onDelete,
  onAddClick,
  dark,
  onOpenSettings,
}: { ... })
```

아래로 교체:
```typescript
export function TodayView({
  meds,
  onToggle,
  onDelete,
  onAddClick,
  dark,
  onOpenSettings,
  notifEnabled,
  onToggleNotif,
  categories,
  onToggleCategory,
}: { ... })
```

- [ ] **Step 4: Bell 버튼(L80-86)을 NotificationPopover로 교체**

현재 코드 (L80-86):
```tsx
<button
  aria-label="알림"
  className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
  style={{ backgroundColor: t.card }}
>
  <Bell size={17} style={{ color: "#6C63FF" }} />
</button>
```

아래로 교체:
```tsx
<NotificationPopover
  dark={dark}
  notifEnabled={notifEnabled}
  onToggleNotif={onToggleNotif}
  categories={categories}
  onToggleCategory={onToggleCategory}
/>
```

- [ ] **Step 5: 더 이상 사용되지 않는 `Bell` import 제거**

`TodayView.tsx` L3-5의 lucide-react import에서 `Bell` 제거:

```typescript
import {
  Settings, Plus, Sparkles, CheckCircle2, Trash2, Flame,
} from "lucide-react";
```

- [ ] **Step 6: 타입 검사**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm tsc --noEmit 2>&1 | head -20
```
예상: `App.tsx`에서 `TodayView`에 새 props가 전달되지 않아 오류 — 정상 (Task 5에서 수정)

- [ ] **Step 7: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
git add src/components/views/TodayView.tsx
git commit -m "[Feat] TodayView Bell 버튼을 NotificationPopover로 교체"
```

---

## Task 5: App.tsx에 상태 추가 및 모든 연결 완성

**Files:**
- Modify: `src/App.tsx`

`notifCategories` 상태를 추가하고, `useNotifications`와 `TodayView`에 연결한다.

- [ ] **Step 1: `NotifCategories` 타입 import 추가**

`App.tsx` L19의 import 라인:
```typescript
import type { View, Medication } from "@/types";
```
아래로 교체:
```typescript
import type { View, Medication, NotifCategories } from "@/types";
```

- [ ] **Step 2: `notifCategories` 상태 추가**

`App.tsx` L36-38 (기존 상태들 바로 아래):
```typescript
const [dark, setDark] = usePersisted<boolean>("pillflow_dark", false);
const [notif, setNotif] = usePersisted<boolean>("pillflow_notif", true);
const [alarm, setAlarm] = usePersisted<string>("pillflow_alarm", "08:00");
```

`notif` 다음 줄에 추가:
```typescript
const [dark, setDark] = usePersisted<boolean>("pillflow_dark", false);
const [notif, setNotif] = usePersisted<boolean>("pillflow_notif", true);
const [notifCategories, setNotifCategories] = usePersisted<NotifCategories>(
  "pillflow_notif_categories",
  { morning: true, lunch: true, evening: true }
);
const [alarm, setAlarm] = usePersisted<string>("pillflow_alarm", "08:00");
```

- [ ] **Step 3: `useNotifications` 호출에 `notifCategories` 전달**

현재 L51:
```typescript
useNotifications(meds, notif);
```

아래로 교체:
```typescript
useNotifications(meds, notif, notifCategories);
```

- [ ] **Step 4: `onToggleCategory` 핸들러 추가**

`handleSignOut` 위에 추가:
```typescript
const handleToggleCategory = useCallback((key: keyof NotifCategories) => {
  setNotifCategories((prev) => ({ ...prev, [key]: !prev[key] }));
}, []);
```

- [ ] **Step 5: `TodayView`에 새 props 전달**

현재 `<TodayView ...>` (L166-174):
```tsx
<TodayView
  meds={todayMeds}
  onToggle={handleToggle}
  onDelete={handleDelete}
  onAddClick={() => setView("add")}
  dark={dark}
  onOpenSettings={() => setSettingsOpen(true)}
/>
```

아래로 교체:
```tsx
<TodayView
  meds={todayMeds}
  onToggle={handleToggle}
  onDelete={handleDelete}
  onAddClick={() => setView("add")}
  dark={dark}
  onOpenSettings={() => setSettingsOpen(true)}
  notifEnabled={notif}
  onToggleNotif={() => setNotif(!notif)}
  categories={notifCategories}
  onToggleCategory={handleToggleCategory}
/>
```

- [ ] **Step 6: 타입 검사 — 모든 오류 해결 확인**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm tsc --noEmit 2>&1
```
예상 출력: 오류 없음

- [ ] **Step 7: 커밋**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
git add src/App.tsx
git commit -m "[Feat] App에 notifCategories 상태 추가 및 알림 팝오버 연결"
```

---

## Task 6: 로컬 웹 검증

- [ ] **Step 1: 개발 서버 실행**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm dev
```

- [ ] **Step 2: 브라우저에서 메인페이지 확인**

`http://localhost:5173` 접속 후:
1. 헤더의 Bell 버튼 클릭 → 우측 정렬 Popover 패널 열림 확인
2. "전체 알림" 토글 OFF → 아침/점심/저녁 토글이 반투명(opacity 0.4)하게 비활성화되는지 확인
3. 전체 ON 상태에서 "점심" 토글 OFF → 즉시 상태 변경 확인
4. 패널 바깥 클릭 → 자동으로 닫히는지 확인
5. 페이지 새로고침 → 이전 토글 상태가 유지되는지 확인

- [ ] **Step 3: localStorage 저장 확인**

DevTools → Application → Local Storage → 아래 키 확인:
- `pillflow_notif` — `true` 또는 `false`
- `pillflow_notif_categories` — `{"morning":true,"lunch":false,"evening":true}` 형태

- [ ] **Step 4: SettingsModal 회귀 체크**

설정(톱니바퀴) 버튼 클릭 → SettingsModal의 "복용 알림" 토글이 Popover의 전체 알림 토글과 동기화되는지 확인 (같은 `notif` 상태 공유)

---

## Task 7: (선택) Android 빌드 검증

Android 실기기가 있을 때만 수행. 로컬 웹 검증이 완료된 이후 진행.

- [ ] **Step 1: Android 빌드**

```bash
cd /Users/joongyu/Pill-Flow2/artifacts/pillflow
pnpm build && npx cap sync android
```

- [ ] **Step 2: Android Studio에서 실기기 빌드 후 확인**
  - 알림 권한 허용
  - 약 3개를 아침/점심/저녁 카테고리에 각각 등록
  - Popover에서 "점심" 카테고리 OFF
  - Chrome DevTools 원격 디버깅(`chrome://inspect`) → Console에서 확인:
    ```js
    // 예약된 알림 목록 확인 (점심 약이 없어야 함)
    Capacitor.Plugins.LocalNotifications.getPending().then(console.log)
    ```
  - "점심" 다시 ON → 점심 약 재등록 확인
  - 전체 알림 OFF → 모든 예약 취소 확인
