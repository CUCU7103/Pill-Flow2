import { Pill, Droplets, Package, Hand, Eye, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MedType } from "@/types";

/** 약 유형 → 아이콘 매핑 (새 타입 추가 시 이 맵에만 추가) */
const MED_ICON_MAP: Record<MedType, LucideIcon> = {
  tablet: Pill,
  syrup: Droplets,
  powder: Package,
  ointment: Hand,
  drops: Eye,
  inhaler: Wind,
};

/** 약 유형별 아이콘 컴포넌트 */
export function MedIcon({ type, color }: { type: MedType; color: string }) {
  const Icon = MED_ICON_MAP[type];
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color + "20" }}
    >
      <Icon size={22} style={{ color }} />
    </div>
  );
}
