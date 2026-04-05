import { Pill, Activity, Droplets } from "lucide-react";
import type { MedType } from "@/types";

/** 약 유형별 아이콘 컴포넌트 */
export function MedIcon({ type, color }: { type: MedType; color: string }) {
  const Icon = type === "capsule" ? Pill : type === "pill" ? Activity : Droplets;
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color + "20" }}
    >
      <Icon size={22} style={{ color }} />
    </div>
  );
}
