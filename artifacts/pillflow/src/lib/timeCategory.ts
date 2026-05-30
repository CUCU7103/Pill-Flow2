/** 복용 시간대 카테고리 */
export type TimeCategory = "morning" | "lunch" | "evening";

/**
 * 시간(0-23)을 복용 시간대 카테고리로 변환한다.
 * - 16시 이상 → 저녁 (evening)
 * - 11시 이상 → 점심 (lunch)
 * - 나머지 → 아침 (morning)
 */
export function getTimeCategory(hour: number): TimeCategory {
  if (hour >= 16) return "evening";
  if (hour >= 11) return "lunch";
  return "morning";
}

/** 시간대 카테고리의 한국어 레이블 */
export const TIME_CATEGORY_LABEL: Record<TimeCategory, string> = {
  morning: "아침",
  lunch: "점심",
  evening: "저녁",
};
