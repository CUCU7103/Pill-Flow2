import { CalendarDays, Plus, ChartNoAxesColumn } from "lucide-react";
import type { View } from "@/types";

/** 세 가지 핵심 작업을 유지하는 모바일 하단 탐색. */
export function BottomNav({
  view,
  setView,
  dark: _dark,
}: {
  view: View;
  setView: (v: View) => void;
  dark: boolean;
}) {
  const items = [
    { id: "today" as const, icon: CalendarDays, label: "오늘" },
    { id: "add" as const, icon: Plus, label: "추가" },
    { id: "stats" as const, icon: ChartNoAxesColumn, label: "통계" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-pf-divider bg-pf-nav px-5 pt-2 backdrop-blur-xl"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      aria-label="메인 메뉴"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map(({ id, icon: Icon, label }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={active ? "page" : undefined}
              className="flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pf-accent)]"
              style={{ color: active ? "var(--pf-accent)" : "var(--pf-subtext)" }}
            >
              <Icon size={22} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
