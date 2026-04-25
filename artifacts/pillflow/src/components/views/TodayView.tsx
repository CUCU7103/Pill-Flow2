import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Plus, Sparkles, CheckCircle2, Trash2, Flame,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { MedIcon } from "@/components/common/MedIcon";
import { DeleteModal } from "@/components/modals/DeleteModal";
import type { Medication, NotifCategories } from "@/types";
import { NotificationPopover } from "@/components/NotificationPopover";

/** 오늘의 복용 현황 화면 */
export function TodayView({
  meds,
  onToggle,
  onDelete,
  onAddClick,
  dark,
  onOpenSettings,
  notifEnabled,
  onToggleNotif,
  categories,
  onToggleCategory,
}: {
  meds: Medication[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  dark: boolean;
  onOpenSettings: () => void;
  notifEnabled: boolean;
  onToggleNotif: () => void;
  categories: NotifCategories;
  onToggleCategory: (key: keyof NotifCategories) => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const t = useTheme(dark);
  const completed = meds.filter((m) => m.completed).length;
  const total = meds.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const today = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // 시간대별 그룹핑 (useMemo로 불필요한 재계산 방지)
  const groups = useMemo(
    () => ({
      "아침": meds.filter((m) => m.category === "morning"),
      "점심": meds.filter((m) => m.category === "lunch"),
      "저녁": meds.filter((m) => m.category === "evening"),
    }),
    [meds],
  );

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
      <div className="max-w-md mx-auto px-5 pt-14 pb-32">
        {/* 헤더 */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#6C63FF,#9B8FFF)" }}
            >
              A
            </div>
            <div>
              <p
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "#6C63FF" }}
              >
                {today}
              </p>
              <h1
                className="text-xl font-extrabold leading-tight"
                style={{
                  // Android WebView는 background-clip: text 미지원 → 단색으로 처리
                  color: dark ? "#C4B5FD" : "#6C63FF",
                }}
              >
                필플로우
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationPopover
              dark={dark}
              notifEnabled={notifEnabled}
              onToggleNotif={onToggleNotif}
              categories={categories}
              onToggleCategory={onToggleCategory}
            />
            <button
              onClick={onOpenSettings}
              aria-label="설정 열기"
              className="w-10 h-10 rounded-full shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]"
              style={{ backgroundColor: t.card }}
            >
              <Settings size={17} style={{ color: t.subtext }} />
            </button>
          </div>
        </header>

        {/* 달성률 히어로 */}
        <section
          className="rounded-3xl p-6 mb-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#6C63FF 0%,#4FACFE 100%)" }}
          aria-label="오늘의 달성률"
        >
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">
                  오늘의 달성률
                </p>
                <div className="flex items-end gap-1">
                  <motion.span
                    className="text-white text-6xl font-black tracking-tighter"
                    key={progress}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {progress}
                  </motion.span>
                  <span className="text-white/80 text-2xl font-bold mb-2">%</span>
                </div>
                <p className="text-white/80 text-sm font-medium mt-1">
                  {progress === 100
                    ? "오늘 모든 약을 복용했어요!"
                    : `아직 ${total - completed}개가 남았어요`}
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>
            <div className="mt-5 h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-white/60 text-[11px] font-medium">
                {completed}/{total} 복용
              </span>
              <span className="text-white/60 text-[11px] font-medium flex items-center gap-1">
                연속 7일 <Flame size={12} className="text-orange-300" />
              </span>
            </div>
          </div>
        </section>

        {/* 약 목록 */}
        {Object.entries(groups).map(([label, items]) => {
          if (items.length === 0) return null;
          return (
            <section key={label} className="mb-6" aria-label={`${label} 복용약`}>
              <div className="flex items-center gap-3 mb-3">
                <h3
                  className="text-sm font-bold uppercase tracking-widest"
                  style={{ color: t.text }}
                >
                  {label}
                </h3>
                <div className="flex-1 h-px" style={{ backgroundColor: t.divider }} />
                <span className="text-[11px] font-semibold" style={{ color: t.subtext }}>
                  {items.filter((m) => m.completed).length}/{items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((med) => (
                  <motion.div
                    key={med.id}
                    layout
                    className="rounded-xl p-4 shadow-sm flex items-center gap-4"
                    style={{
                      backgroundColor: t.card,
                      opacity: med.completed ? 0.6 : 1,
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <MedIcon type={med.type} color={med.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className="font-bold text-base truncate"
                          style={{
                            color: med.completed ? t.subtext : t.text,
                            textDecoration: med.completed ? "line-through" : "none",
                          }}
                        >
                          {med.name}
                        </h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: t.subtext }}
                          >
                            {med.time}
                          </span>
                          <button
                            onClick={() => setDeleteId(med.id)}
                            aria-label={`${med.name} 삭제`}
                            className="p-2 active:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            style={{ color: t.divider }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium" style={{ color: t.subtext }}>
                          {med.dosage}
                        </span>
                        {med.memo ? (
                          <span className="text-xs" style={{ color: t.subtext }}>
                            {med.memo}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={() => onToggle(med.id)}
                      aria-label={`${med.name} ${med.completed ? "복용 취소" : "복용 완료"}`}
                      className="flex-shrink-0 active:scale-90 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      {med.completed ? (
                        <CheckCircle2 size={26} style={{ color: "#6C63FF" }} fill="#6C63FF" />
                      ) : (
                        <div
                          className="w-[26px] h-[26px] rounded-full border-2"
                          style={{ borderColor: t.divider }}
                        />
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}

        {meds.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">💊</div>
            <p className="font-bold text-lg" style={{ color: t.text }}>
              등록된 약이 없어요
            </p>
            <p className="text-sm mt-1" style={{ color: t.subtext }}>
              + 버튼으로 약을 추가해보세요
            </p>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-32 right-6 z-40">
        <button
          onClick={onAddClick}
          aria-label="새 약 추가"
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-transform"
          style={{ background: "linear-gradient(135deg,#6C63FF,#9B8FFF)" }}
        >
          <Plus size={28} className="text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {deleteId && (
          <DeleteModal
            dark={dark}
            onCancel={() => setDeleteId(null)}
            onConfirm={() => {
              onDelete(deleteId);
              setDeleteId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
