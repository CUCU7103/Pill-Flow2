import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { Toggle } from "@/components/common/Toggle";
import { useTheme } from "@/hooks/use-theme";
import type { NotifCategories } from "@/types";

type Props = {
  dark: boolean;
  notifEnabled: boolean;
  onToggleNotif: () => void;
  categories: NotifCategories;
  onToggleCategory: (key: keyof NotifCategories) => void;
};

/** 시간대별 카테고리 표시 정보 */
const CATEGORY_LABELS: { key: keyof NotifCategories; label: string; time: string }[] = [
  { key: "morning", label: "아침", time: "06:00 ~ 10:59" },
  { key: "lunch",   label: "점심", time: "11:00 ~ 16:59" },
  { key: "evening", label: "저녁", time: "17:00 ~ 23:59" },
];

/** Bell 버튼 + 알림 설정 Popover 패널 */
export function NotificationPopover({
  dark,
  notifEnabled,
  onToggleNotif,
  categories,
  onToggleCategory,
}: Props) {
  const t = useTheme(dark);

  return (
    <Popover.Root>
      {/* Bell 버튼 — Popover 트리거 */}
      <Popover.Trigger asChild>
        <button
          aria-label="알림 설정"
          className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
          style={{ backgroundColor: t.card }}
        >
          <Bell size={17} style={{ color: "#6C63FF" }} />
        </button>
      </Popover.Trigger>

      {/* 패널 — 버튼 아래에 위치 */}
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl shadow-xl p-4"
          style={{ backgroundColor: t.card }}
        >
          {/* 헤더 */}
          <p
            className="text-xs font-black uppercase tracking-widest mb-3"
            style={{ color: t.subtext }}
          >
            알림
          </p>

          {/* 전체 알림 토글 */}
          <div
            className="flex items-center justify-between py-2 mb-2 border-b"
            style={{ borderColor: t.divider }}
          >
            <span className="text-sm font-bold" style={{ color: t.text }}>
              전체 알림
            </span>
            <Toggle on={notifEnabled} onToggle={onToggleNotif} />
          </div>

          {/* 시간대별 토글 */}
          <div className="flex flex-col gap-2 mt-2">
            {CATEGORY_LABELS.map(({ key, label, time }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: notifEnabled ? t.text : t.subtext }}
                  >
                    {label}
                  </p>
                  <p className="text-[10px]" style={{ color: t.subtext }}>
                    {time}
                  </p>
                </div>
                {/* 전체 알림 OFF이면 카테고리 토글 비활성화 */}
                <Toggle
                  on={categories[key]}
                  onToggle={() => onToggleCategory(key)}
                  disabled={!notifEnabled}
                />
              </div>
            ))}
          </div>

          {/* Radix Popover 화살표 */}
          <Popover.Arrow style={{ fill: t.card }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
