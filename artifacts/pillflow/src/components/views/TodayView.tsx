import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Settings, CheckCircle2, Clock3 } from "lucide-react";
import { MedIcon } from "@/components/common/MedIcon";
import { MedicationDetailModal } from "@/components/modals/MedicationDetailModal";
import { DeleteModal } from "@/components/modals/DeleteModal";
import { formatMedicationTime } from "@/lib/notificationSchedule";
import type { Medication, NotifCategories } from "@/types";
import { NotificationPopover } from "@/components/NotificationPopover";

/** 오늘의 복용 현황 화면 */
export function TodayView({
  meds,
  allMeds,
  onToggle,
  onDelete,
  onAddClick,
  dark,
  onOpenSettings,
  notifEnabled,
  onToggleNotif,
  categories,
  onToggleCategory,
  hasAnyMeds,
}: {
  meds: Medication[];
  allMeds: Medication[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  dark: boolean;
  onOpenSettings: () => void;
  notifEnabled: boolean;
  onToggleNotif: () => void;
  categories: NotifCategories;
  onToggleCategory: (key: keyof NotifCategories) => void;
  hasAnyMeds: boolean;
}) {
  const [detailMed, setDetailMed] = useState<Medication | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAllMeds, setShowAllMeds] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const completed = meds.filter((med) => med.completed).length;
  const total = meds.length;
  const remaining = total - completed;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const today = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // The API stores completion per medication/day. Sort medication cards by their
  // first scheduled time without suggesting each individual time is actionable.
  const schedule = useMemo(
    () => [...(showAllMeds ? allMeds : meds)].sort((a, b) => (a.times[0] ?? "99:99").localeCompare(b.times[0] ?? "99:99")),
    [allMeds, meds, showAllMeds],
  );
  const todaySchedule = useMemo(
    () => [...meds].sort((a, b) => (a.times[0] ?? "99:99").localeCompare(b.times[0] ?? "99:99")),
    [meds],
  );
  const todayMedIds = useMemo(() => new Set(meds.map((med) => med.id)), [meds]);

  const nextDose = useMemo(() => {
    const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return todaySchedule
      .flatMap((med) => med.times.map((time) => ({ med, time })))
      .filter(({ med, time }) => !med.completed && time >= current)
      .sort((a, b) => a.time.localeCompare(b.time))[0] ?? null;
  }, [todaySchedule, now]);

  return (
    <div className="h-full overflow-y-auto hide-scrollbar bg-pf-bg text-pf-text">
      <div className="max-w-md mx-auto px-4 sm:px-5 pt-8 sm:pt-12 pb-32">
        <header className="flex items-center justify-between mb-7">
          <div>
            <p className="text-xs font-semibold text-pf-subtext">{today}</p>
            <h1 className="text-2xl font-extrabold tracking-tight mt-1 leading-tight">{total === 0 ? "오늘의 복약" : remaining === 0 ? "오늘 복용을 마쳤어요" : <>오늘 복용할 약,<br />{remaining}개 남았어요</>}</h1>
          </div>
          <div className="flex items-center gap-1">
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
              className="w-11 h-11 rounded-full flex items-center justify-center bg-pf-card text-pf-subtext shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <section className="rounded-[22px] p-5 sm:p-6 mb-6 bg-[var(--pf-accent-soft)] text-pf-text" aria-label="오늘의 복약 요약">
          <div className="flex items-end justify-between gap-4">
            <div>
            <p className="text-sm font-semibold text-pf-subtext">오늘 약 복용 기록</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight"><span className="text-[var(--pf-accent)]">{completed}개 완료</span><span className="text-pf-subtext"> / 총 {total}개</span></p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold">{remaining}</p>
              <p className="text-xs font-medium text-pf-subtext">남은 약</p>
            </div>
          </div>
          <div className="h-2 mt-5 rounded-full bg-pf-card overflow-hidden" role="progressbar" aria-label="오늘 복약 완료율" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full rounded-full bg-[var(--pf-accent)]" animate={{ width: `${progress}%` }} transition={{ duration: reduceMotion ? 0 : 0.25 }} />
          </div>
          <p className="text-sm text-pf-subtext mt-3">{total === 0 ? "오늘 예정된 복용이 없어요." : remaining === 0 ? "오늘의 복용을 모두 기록했어요." : "차근차근 기록하고 있어요."}</p>
          <p className="text-xs leading-5 text-pf-subtext mt-2">완료 기록 1회는 오늘 하루 전체 복용을 뜻해요. 같은 약의 여러 복용 시간은 따로 체크하지 않아요.</p>
        </section>

        {nextDose ? (
          <section className="rounded-2xl p-4 mb-7 bg-pf-card border border-pf-divider shadow-sm" aria-label="다음 복용 예정">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Clock3 size={19} /></div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-pf-subtext">다음 복용 예정</p>
                <p className="font-bold truncate mt-0.5">{formatMedicationTime(nextDose.time)} · {nextDose.med.name}</p>
              </div>
            </div>
          </section>
        ) : remaining > 0 ? (
          <p className="mb-7 rounded-2xl border border-pf-divider bg-pf-card p-4 text-sm text-pf-subtext">예정 시간이 지난 약이 있어요. 아래 일정에서 확인해 주세요.</p>
        ) : null}

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">복용 일정</h2>
          {allMeds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllMeds((visible) => !visible)}
              aria-pressed={showAllMeds}
              className="min-h-10 rounded-xl px-3 text-xs font-bold text-[var(--pf-accent)] bg-accent/10 focus-visible:outline-2 focus-visible:outline-[var(--pf-accent)]"
            >
              {showAllMeds ? "오늘 일정만" : "전체 약 보기"}
            </button>
          )}
        </div>

        {showAllMeds && <p className="mb-3 text-xs leading-5 text-pf-subtext">전체 약 목록에서는 상세 확인과 삭제를 할 수 있어요. 오늘 복용일이 아닌 약은 완료 기록을 남길 수 없어요.</p>}

        {schedule.length > 0 ? (
          <div className="space-y-3" aria-label="복용 일정 목록">
            {schedule.map((med) => (
              <motion.article key={med.id} layout={!reduceMotion} className="rounded-2xl p-4 bg-pf-card border border-pf-divider flex items-center gap-3">
                <button type="button" onClick={() => setDetailMed(med)} aria-label={`${med.name} 상세정보 열기`} className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <MedIcon type={med.type} color={med.color} />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold truncate">{med.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {med.times.length > 0 ? med.times.map((time) => <span key={time} className="text-xs font-semibold px-2 py-1 rounded-lg bg-accent/10 text-accent">{formatMedicationTime(time)}</span>) : <span className="text-xs text-pf-subtext">복용 시간 미설정</span>}
                  </div>
                  <p className="text-xs text-pf-subtext truncate mt-1.5">{med.dosage}{med.memo ? ` · ${med.memo}` : ""}</p>
                </div>
                {todayMedIds.has(med.id) ? (
                  <button type="button" onClick={() => onToggle(med.id)} aria-label={`${med.name} ${med.completed ? "오늘 복용 기록 취소" : "오늘 복용 완료 기록"}`} className={med.completed ? "shrink-0 min-h-11 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold text-[var(--pf-success)] focus-visible:outline-2 focus-visible:outline-[var(--pf-accent)]" : "shrink-0 min-h-11 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold bg-[var(--pf-action)] text-white focus-visible:outline-2 focus-visible:outline-[var(--pf-accent)]"}>
                    {med.completed ? <><CheckCircle2 size={17} /> 오늘 기록 취소</> : "오늘 복용 완료"}
                  </button>
                ) : (
                  <span className="shrink-0 max-w-24 text-right text-[11px] leading-4 font-semibold text-pf-subtext">오늘 복용일 아님</span>
                )}
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl py-12 px-5 text-center bg-pf-card border border-pf-divider">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/10 text-3xl flex items-center justify-center" aria-hidden="true">💊</div>
            <h2 className="font-bold text-lg mt-4">{hasAnyMeds ? "오늘 예정된 약이 없어요" : "등록된 약이 없어요"}</h2>
            <p className="text-sm text-pf-subtext mt-1">{hasAnyMeds ? "다른 요일의 복용 일정은 그대로 유지돼요." : "첫 약을 등록하고 복용 시간을 정해 보세요."}</p>
            {!hasAnyMeds && <button type="button" onClick={onAddClick} className="mt-5 min-h-11 px-5 rounded-xl bg-[var(--pf-action)] text-white font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">첫 약 추가하기</button>}
          </div>
        )}
      </div>

      <AnimatePresence>{detailMed && <MedicationDetailModal med={detailMed} dark={dark} onClose={() => setDetailMed(null)} onDelete={() => { setDeleteId(detailMed.id); setDetailMed(null); }} />}</AnimatePresence>
      <AnimatePresence>
        {deleteId && <DeleteModal dark={dark} onCancel={() => setDeleteId(null)} onConfirm={() => { onDelete(deleteId); setDeleteId(null); }} />}
      </AnimatePresence>
    </div>
  );
}
