import type { ReactNode } from "react";

/** 폼 필드 래퍼 컴포넌트 (AddView에서 사용) */
export function FormField({
  label,
  children,
  cardBg,
  accentColor,
}: {
  label: string;
  children: ReactNode;
  cardBg: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: cardBg }}>
      <p
        className="text-[10px] font-black uppercase tracking-widest mb-4"
        style={{ color: accentColor }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
