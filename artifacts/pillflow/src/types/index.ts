// ─── 약 관련 타입 정의 ──────────────────────────────────────────────────────

/** 화면 뷰 타입 */
export type View = "today" | "add" | "stats";

/** 복용 시간대 카테고리 */
export type Category = "morning" | "lunch" | "evening";

/** 약의 형태 */
export type MedType = "pill" | "capsule" | "liquid" | "packet";

/** 약 타입별 잔여량 단위를 반환 */
export function getQuantityUnit(type: MedType): string {
  return type === "packet" ? "포" : "개";
}

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
