// ─── 약 관련 타입 정의 ──────────────────────────────────────────────────────

/** 화면 뷰 타입 */
export type View = "today" | "add" | "stats";

/** 복용 시간대 카테고리 */
export type Category = "morning" | "lunch" | "evening";

/** 약의 형태 */
export type MedType = "pill" | "capsule" | "liquid" | "packet";

/** 약 정보 인터페이스 */
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  /** 복용 방법 메모 — 사용자가 직접 작성 */
  memo: string;
  time: string;
  category: Category;
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
