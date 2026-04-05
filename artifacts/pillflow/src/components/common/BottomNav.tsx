import { Calendar, Plus, TrendingUp } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { View } from "@/types";

/** 하단 네비게이션 바 */
export function BottomNav({
  view,
  setView,
  dark,
}: {
  view: View;
  setView: (v: View) => void;
  dark: boolean;
}) {
  const t = useTheme(dark);
  const items = [
    { id: "today" as const, icon: Calendar, label: "오늘" },
    { id: "add" as const, icon: Plus, label: "추가" },
    { id: "stats" as const, icon: TrendingUp, label: "통계" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl px-6 py-3 pb-6"
      style={{ backgroundColor: t.navBg, borderColor: t.divider }}
      aria-label="메인 네비게이션"
    >
      <div className="max-w-md mx-auto flex justify-around">
        {items.map(({ id, icon: Icon, label }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all min-w-[48px] min-h-[48px]"
              style={{ backgroundColor: active ? "#6C63FF18" : "transparent" }}
            >
              <Icon
                size={22}
                style={{ color: active ? "#6C63FF" : t.subtext }}
                fill={active ? "#6C63FF" : "none"}
              />
              <span
                className="text-[11px] font-bold"
                style={{ color: active ? "#6C63FF" : t.subtext }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
