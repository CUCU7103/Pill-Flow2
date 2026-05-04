import type { LocalNotificationSchema, Weekday } from "@capacitor/local-notifications";
import type { Medication, NotifCategories } from "@/types";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

const DEFAULT_TIME = { hour: 8, minute: 0 };

const WEEKDAY_BY_DAY: Record<DayKey, Weekday> = {
  sun: 1 as Weekday,
  mon: 2 as Weekday,
  tue: 3 as Weekday,
  wed: 4 as Weekday,
  thu: 5 as Weekday,
  fri: 6 as Weekday,
  sat: 7 as Weekday,
};

export function parseMedicationTime(time: string): { hour: number; minute: number } {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return DEFAULT_TIME;

  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isInteger(rawHour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return DEFAULT_TIME;
  }

  if (meridiem) {
    if (rawHour < 1 || rawHour > 12) return DEFAULT_TIME;
    if (meridiem === "AM") {
      return { hour: rawHour === 12 ? 0 : rawHour, minute };
    }
    return { hour: rawHour === 12 ? 12 : rawHour + 12, minute };
  }

  if (rawHour < 0 || rawHour > 23) return DEFAULT_TIME;
  return { hour: rawHour, minute };
}

export function formatMedicationTime(time: string): string {
  const { hour, minute } = parseMedicationTime(time);
  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")} ${meridiem}`;
}

export function toCapacitorWeekday(day: string): Weekday | null {
  return isDayKey(day) ? WEEKDAY_BY_DAY[day] : null;
}

export function buildMedicationNotifications(
  meds: Medication[],
  categories: NotifCategories,
  channelId: string,
): LocalNotificationSchema[] {
  return meds.flatMap((med) => {
    if (med.days.length === 0) return [];

    // times 배열의 각 시간마다 요일별 알림 생성
    return med.times.flatMap((timeStr, timeIndex) => {
      // 시간대 카테고리 판별 — 알림 토글 필터에 사용
      const { hour } = parseMedicationTime(timeStr);
      const cat: keyof NotifCategories =
        hour >= 16 ? "evening" : hour >= 11 ? "lunch" : "morning";
      if (categories[cat] !== true) return [];

      const { hour: h, minute } = parseMedicationTime(timeStr);

      return med.days.flatMap((day) => {
        const weekday = toCapacitorWeekday(day);
        if (weekday === null) return [];

        return [
          {
            // timeIndex를 ID에 반영해 같은 약의 다른 시간대 알림이 충돌하지 않도록 함
            id: getNotificationId(med.id, weekday, timeIndex),
            title: "💊 복약 시간",
            body: `${med.name} ${med.dosage} 복용할 시간입니다`,
            schedule: {
              on: { weekday, hour: h, minute },
              repeats: true,
              allowWhileIdle: true,
            },
            channelId,
            actionTypeId: "",
            extra: { medicationId: med.id, day, time: timeStr },
          },
        ];
      });
    });
  });
}

function isDayKey(day: string): day is DayKey {
  return (
    day === "sun" ||
    day === "mon" ||
    day === "tue" ||
    day === "wed" ||
    day === "thu" ||
    day === "fri" ||
    day === "sat"
  );
}

function getNotificationId(medicationId: string, weekday: Weekday, timeIndex: number = 0): number {
  let hash = 0;
  for (let i = 0; i < medicationId.length; i += 1) {
    hash = (hash * 31 + medicationId.charCodeAt(i)) >>> 0;
  }
  // timeIndex(0~3)를 100 단위로 분리해 같은 약의 다른 시간대가 겹치지 않도록 함
  return ((hash % 50_000_000) * 100 + Number(weekday) * 10 + timeIndex) || Number(weekday) * 10 + timeIndex;
}
