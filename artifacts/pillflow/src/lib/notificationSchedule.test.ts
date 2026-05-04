import assert from "node:assert/strict";
import {
  buildMedicationNotifications,
  formatMedicationTime,
  parseMedicationTime,
  toCapacitorWeekday,
} from "./notificationSchedule";
import type { Medication, NotifCategories } from "../types";

const categories: NotifCategories = {
  morning: true,
  lunch: true,
  evening: true,
};

const baseMedication: Medication = {
  id: "med-123",
  name: "테스트약",
  dosage: "1정",
  memo: "",
  time: "07:00 PM",
  category: "evening",
  completed: false,
  type: "tablet",
  color: "#6C63FF",
  days: ["mon", "wed", "fri"],
};

assert.deepEqual(parseMedicationTime("19:00"), { hour: 19, minute: 0 });
assert.deepEqual(parseMedicationTime("07:00 PM"), { hour: 19, minute: 0 });
assert.deepEqual(parseMedicationTime("12:00 AM"), { hour: 0, minute: 0 });
assert.deepEqual(parseMedicationTime("12:00 PM"), { hour: 12, minute: 0 });
assert.deepEqual(parseMedicationTime("bad-value"), { hour: 8, minute: 0 });

assert.equal(formatMedicationTime("19:05"), "07:05 PM");
assert.equal(formatMedicationTime("07:05 PM"), "07:05 PM");

assert.equal(toCapacitorWeekday("sun"), 1);
assert.equal(toCapacitorWeekday("mon"), 2);
assert.equal(toCapacitorWeekday("sat"), 7);

const notifications = buildMedicationNotifications([baseMedication], categories, "channel");
assert.equal(notifications.length, 3);
assert.deepEqual(
  notifications.map((notification) => notification.schedule),
  [
    { on: { weekday: 2, hour: 19, minute: 0 }, repeats: true, allowWhileIdle: true },
    { on: { weekday: 4, hour: 19, minute: 0 }, repeats: true, allowWhileIdle: true },
    { on: { weekday: 6, hour: 19, minute: 0 }, repeats: true, allowWhileIdle: true },
  ],
);
assert.equal(new Set(notifications.map((notification) => notification.id)).size, 3);
assert.equal(notifications[0]?.extra.medicationId, "med-123");

const disabled = buildMedicationNotifications(
  [{ ...baseMedication, category: "morning" }],
  { ...categories, morning: false },
  "channel",
);
assert.equal(disabled.length, 0);
