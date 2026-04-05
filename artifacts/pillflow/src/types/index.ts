// ─── 약 관련 타입 정의 ──────────────────────────────────────────────────────

/** 화면 뷰 타입 */
export type View = "today" | "add" | "stats";

/** 복용 시간대 카테고리 */
export type Category = "morning" | "lunch" | "evening";

/** 약의 형태 */
export type MedType = "pill" | "capsule" | "liquid";

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
