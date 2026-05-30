import type { Medication, MedType } from "@/types";

/**
 * 로컬 시간 기준 날짜 문자열 (YYYY-MM-DD).
 * toISOString()은 UTC 기준이므로 KST(UTC+9) 자정 전후 시간대에
 * 날짜가 어긋나는 문제를 방지하기 위해 로컬 날짜를 직접 계산한다.
 */
export function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 오늘 날짜 문자열 (로컬 시간 기준, YYYY-MM-DD) */
export function getToday(): string {
  return toLocalDateStr(new Date());
}

/** DB 행을 프론트엔드 Medication 타입으로 변환 */
export function toMedication(row: Record<string, unknown>, completedIds: Set<string>): Medication {
  // times 컬럼 우선, 구버전 time 컬럼 fallback
  const rawTimes = row.times as string[] | null;
  const legacyTime = row.time as string | null;
  const times =
    rawTimes && rawTimes.length > 0
      ? rawTimes
      : legacyTime
      ? [legacyTime]
      : ["08:00"];

  return {
    id: row.id as string,
    name: row.name as string,
    dosage: row.dosage as string,
    memo: (row.memo as string | null) ?? "",
    times,
    type: row.type as MedType,
    color: row.color as string,
    // DB 컬럼이 없는 구버전 데이터 대비 — 없으면 전체 요일로 fallback
    days: (row.days as string[] | null) ?? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    completed: completedIds.has(row.id as string),
  };
}
