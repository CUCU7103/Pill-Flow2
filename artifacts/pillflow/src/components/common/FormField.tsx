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
    <div className="rounded-2xl border border-pf-divider p-5" style={{ backgroundColor: cardBg }}>
      <p
        className="text-sm font-bold mb-4"
        style={{ color: accentColor }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
