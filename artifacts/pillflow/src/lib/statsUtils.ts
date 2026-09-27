export type WeeklyDataPoint = { day: string; rate: number | null };

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD를 브라우저의 로컬 달력 기준 요일로 변환한다. */
export function dateToDayLabel(dateValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

/** null인 날은 평균에서 제외한다. */
export function averageRate(weeklyData: WeeklyDataPoint[]): number | null {
  const rates = weeklyData.map((entry) => entry.rate).filter((rate): rate is number => rate !== null);
  return rates.length > 0 ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null;
}
