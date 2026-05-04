// ─── 약 관련 타입 정의 ──────────────────────────────────────────────────────

/** 화면 뷰 타입 */
export type View = "today" | "add" | "stats";

/** 복용 시간대 카테고리 */
export type Category = "morning" | "lunch" | "evening";

/** 약의 형태 */
export type MedType = "tablet" | "syrup" | "powder" | "ointment" | "drops" | "inhaler";

/** 약 유형별 1회 용량 단위 */
export function getDoseUnit(type: MedType): string {
  const map: Record<MedType, string> = {
    tablet: "정",
    syrup: "ml",
    powder: "포",
    ointment: "회",
    drops: "방울",
    inhaler: "회",
  };
  return map[type];
}

/** 약 정보 인터페이스 */
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  /** 복용 방법 메모 — 사용자가 직접 작성 */
  memo: string;
  /** 복용 시간 배열 (HH:MM 형식, 최대 4개). 예: ["08:00","13:00"] */
  times: string[];
  completed: boolean;
  type: MedType;
  color: string;
  /** 복용 요일 배열. 예: ["mon","wed","fri"] */
  days: string[];
}

/** 시간대별 알림 활성화 상태 */
export type NotifCategories = {
  morning: boolean;
  lunch: boolean;
  evening: boolean;
};
