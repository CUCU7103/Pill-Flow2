import { motion } from "framer-motion";
import { X } from "lucide-react";
import { MedIcon } from "@/components/common/MedIcon";
import { useTheme } from "@/hooks/use-theme";
import { formatMedicationTime } from "@/lib/notificationSchedule";
import { DAY_KEYS_MON_FIRST } from "@/constants";
import type { Medication } from "@/types";

const DAY_LABELS: Record<string, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

function getMedTypeLabel(type: Medication["type"]) {
  switch (type) {
    case "tablet":
      return "알약";
    case "syrup":
      return "시럽";
    case "powder":
      return "포장약";
    case "ointment":
      return "연고";
    case "drops":
      return "점안액";
    case "inhaler":
      return "흡입제";
  }
}

/** 약 상세정보 모달 */
export function MedicationDetailModal({
  med,
  dark,
  onClose,
}: {
  med: Medication;
  dark: boolean;
  onClose: () => void;
}) {
  const t = useTheme(dark);
  const days = DAY_KEYS_MON_FIRST
    .filter((day) => med.days.includes(day))
    .map((day) => DAY_LABELS[day]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(5px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="med-detail-title"
      aria-describedby="med-detail-desc"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-5"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <MedIcon type={med.type} color={med.color} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: med.color }}>
                등록 정보
              </p>
              <h3 id="med-detail-title" className="text-xl font-bold truncate" style={{ color: t.text }}>
                {med.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="상세정보 닫기"
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: t.surface, color: t.subtext }}
          >
            <X size={18} />
          </button>
        </div>

        <p id="med-detail-desc" className="text-sm leading-6" style={{ color: t.subtext }}>
          등록할 때 입력한 내용을 한눈에 확인할 수 있어요.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: t.surface }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: t.subtext }}>
              약 종류
            </p>
            <p className="text-sm font-semibold" style={{ color: t.text }}>
              {getMedTypeLabel(med.type)}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: t.surface }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: t.subtext }}>
              1회 용량
            </p>
            <p className="text-sm font-semibold" style={{ color: t.text }}>
              {med.dosage}
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: t.surface }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: t.subtext }}>
              복용 시간
            </p>
            <div className="flex flex-wrap gap-2">
              {med.times.map((time) => (
                <span
                  key={time}
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: dark ? "rgba(108,99,255,0.18)" : "rgba(108,99,255,0.10)",
                    color: "#6C63FF",
                  }}
                >
                  {formatMedicationTime(time)}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: t.subtext }}>
              복용 요일
            </p>
            <div className="flex flex-wrap gap-2">
              {days.length > 0 ? (
                days.map((day) => (
                  <span
                    key={day}
                    className="text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor: dark ? "rgba(20,184,166,0.18)" : "rgba(20,184,166,0.10)",
                      color: "#14B8A6",
                    }}
                  >
                    {day}
                  </span>
                ))
              ) : (
                <span className="text-sm" style={{ color: t.subtext }}>
                  선택된 요일이 없어요
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: t.subtext }}>
              메모
            </p>
            <p className="text-sm leading-6 whitespace-pre-wrap" style={{ color: med.memo ? t.text : t.subtext }}>
              {med.memo || "등록된 메모가 없어요"}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: t.subtext }}>
              카드 색상
            </p>
            <div className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-full border-4"
                style={{
                  backgroundColor: med.color,
                  borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)",
                  boxShadow: `0 0 0 4px ${med.color}22`,
                }}
              />
              <span className="text-sm font-medium" style={{ color: t.text }}>
                {med.color}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
