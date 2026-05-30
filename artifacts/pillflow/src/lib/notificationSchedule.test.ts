import assert from "node:assert/strict";
import {
  buildMedicationNotifications,
  formatMedicationTime,
  parseMedicationTime,
  toCapacitorWeekday,
} from "./notificationSchedule";
import { getTimeCategory } from "./timeCategory";
import type { Medication, NotifCategories } from "../types";

// ─── 픽스처 ────────────────────────────────────────────────────────────────────

const ALL_ON: NotifCategories = { morning: true, lunch: true, evening: true };

/** 현재 Medication 타입 기준 픽스처 (times 배열, days 배열) */
const baseMedication: Medication = {
  id: "med-123",
  name: "테스트약",
  dosage: "1정",
  memo: "",
  times: ["19:00"],
  completed: false,
  type: "tablet",
  color: "#6C63FF",
  days: ["mon", "wed", "fri"],
};

// ─── parseMedicationTime ────────────────────────────────────────────────────────

assert.deepEqual(parseMedicationTime("19:00"), { hour: 19, minute: 0 });
assert.deepEqual(parseMedicationTime("07:00 PM"), { hour: 19, minute: 0 });
assert.deepEqual(parseMedicationTime("12:00 AM"), { hour: 0, minute: 0 });
assert.deepEqual(parseMedicationTime("12:00 PM"), { hour: 12, minute: 0 });
assert.deepEqual(parseMedicationTime("bad-value"), { hour: 8, minute: 0 });

// ─── formatMedicationTime ───────────────────────────────────────────────────────

assert.equal(formatMedicationTime("19:05"), "07:05 PM");
assert.equal(formatMedicationTime("07:05 PM"), "07:05 PM");

// ─── toCapacitorWeekday ─────────────────────────────────────────────────────────

assert.equal(toCapacitorWeekday("sun"), 1);
assert.equal(toCapacitorWeekday("mon"), 2);
assert.equal(toCapacitorWeekday("sat"), 7);

// ─── buildMedicationNotifications: 기본 동작 ────────────────────────────────────

{
  // 월/수/금 3개 알림이 생성되어야 함
  const notifications = buildMedicationNotifications([baseMedication], ALL_ON, "channel");
  assert.equal(notifications.length, 3, "월/수/금 3개 알림 생성");
  assert.deepEqual(
    notifications.map((n) => n.schedule),
    [
      { on: { weekday: 2, hour: 19, minute: 0 }, repeats: true, allowWhileIdle: true },
      { on: { weekday: 4, hour: 19, minute: 0 }, repeats: true, allowWhileIdle: true },
      { on: { weekday: 6, hour: 19, minute: 0 }, repeats: true, allowWhileIdle: true },
    ],
  );
  // ID가 중복되지 않아야 함
  assert.equal(new Set(notifications.map((n) => n.id)).size, 3, "알림 ID 중복 없음");
  assert.equal(notifications[0]?.extra.medicationId, "med-123");
}

// ─── [Bug 1] getTimeCategory 경계값: UI(16:59=점심) vs 코드(16:00=저녁) 불일치 ────
//
// NotificationPopover.tsx 18행: 점심 "11:00 ~ 16:59", 저녁 "17:00 ~ 23:59"
// timeCategory.ts 11행:       hour >= 16 → evening  ← 버그: 17이어야 UI와 일치
//
// 아래 테스트는 버그가 수정된 후 통과해야 한다.
// 현재는 getTimeCategory(16) === "evening" 이므로 실패한다.

{
  // UI 명세: 16시는 점심 범위(11:00~16:59)에 속해야 한다
  assert.equal(
    getTimeCategory(16),
    "lunch",
    "[Bug 1] getTimeCategory(16)은 'lunch'여야 한다 (UI: 점심=11:00~16:59)",
  );

  // UI 명세: 17시가 저녁의 시작이어야 한다
  assert.equal(
    getTimeCategory(17),
    "evening",
    "[Bug 1] getTimeCategory(17)은 'evening'이어야 한다 (UI: 저녁=17:00~23:59)",
  );

  // 점심 ON / 저녁 OFF 상태에서 16:30 약은 알림이 생성되어야 한다
  // (현재는 저녁으로 분류되어 드롭됨 → 알림 0개 반환되는 버그)
  const med1630: Medication = { ...baseMedication, times: ["16:30"] };
  const result = buildMedicationNotifications(
    [med1630],
    { morning: false, lunch: true, evening: false },
    "channel",
  );
  assert.equal(
    result.length,
    3, // 월/수/금 3개 — 점심 필터를 통과해야 함
    "[Bug 1] 16:30 약은 점심 필터에서 3개 알림이 생성되어야 한다",
  );
}

// ─── [Bug 2] times 배열 비어 있으면 알림 0개 ───────────────────────────────────
//
// 구 타입(time: string, category: string)으로 생성된 데이터가 마이그레이션 없이
// 사용될 경우 times가 undefined/[]가 되어 알림이 하나도 생성되지 않는다.

{
  const noTimes: Medication = { ...baseMedication, times: [] };
  const result = buildMedicationNotifications([noTimes], ALL_ON, "channel");
  assert.equal(result.length, 0, "[Bug 2] times 배열이 비어 있으면 알림 0개 생성");
}

// ─── 알림 ID가 Java int 범위(≤ 2_147_483_647)를 초과하지 않아야 한다 ────────────
//
// getNotificationId: (hash % 50_000_000) * 100 + weekday*10 + timeIndex
// 최댓값: (50_000_000 - 1) * 100 + 7*10 + 3 = 4_999_999_973 → Java int 초과 가능
// 실제 분포는 hash의 값에 따라 다르므로 여러 ID를 생성해 확인한다.

{
  const JAVA_INT_MAX = 2_147_483_647;
  // UUID와 짧은 ID를 섞어 다양한 hash 값 커버
  const testIds = [
    "med-abc",
    "med-123",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "short",
    "x".repeat(50),
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ];

  for (const medId of testIds) {
    const med: Medication = {
      ...baseMedication,
      id: medId,
      days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      times: ["08:00", "13:00", "18:00", "22:00"],
    };
    const results = buildMedicationNotifications([med], ALL_ON, "channel");
    for (const n of results) {
      assert.ok(
        n.id <= JAVA_INT_MAX,
        `[ID 범위] id=${n.id} 가 Java int 최댓값(${JAVA_INT_MAX})을 초과함 (medicationId="${medId}")`,
      );
    }
  }
}

// ─── 다중 times 지원: 2개 시간 × 3개 요일 = 6개 알림 ──────────────────────────

{
  const multiTime: Medication = {
    ...baseMedication,
    times: ["08:00", "13:00"], // 아침 + 점심
  };
  const result = buildMedicationNotifications([multiTime], ALL_ON, "channel");
  assert.equal(result.length, 6, "times 2개 × 요일 3개 = 6개 알림");

  // 두 시간대의 ID가 서로 겹치지 않아야 함
  assert.equal(new Set(result.map((n) => n.id)).size, 6, "다중 times의 알림 ID 중복 없음");
}

// ─── 카테고리 필터: 저녁 OFF 시 19:00 알림 미생성 ────────────────────────────────

{
  const eveningOff = buildMedicationNotifications(
    [baseMedication], // times: ["19:00"]
    { morning: true, lunch: true, evening: false },
    "channel",
  );
  assert.equal(eveningOff.length, 0, "저녁 OFF 시 19:00 알림 미생성");
}

console.log("모든 테스트 실행 완료");
