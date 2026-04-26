import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Pill,
  Camera,
  ChevronLeft,
  Clock,
  ChevronRight,
  Droplets,
  Package,
  Hand,
  Eye,
  Wind,
  Sunrise,
  SunMedium,
  MoonStar,
} from "lucide-react";
import { usePhotoAnalyzer } from "@/hooks/use-photo-analyzer";
import { PhotoAnalyzeBadge } from "@/components/common/PhotoAnalyzeBadge";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { FormField } from "@/components/common/FormField";
import { TimePicker } from "@/components/modals/TimePicker";
import { MED_COLORS, DAY_KEYS_MON_FIRST } from "@/constants";
import type { Medication, MedType, Category } from "@/types";
import { getDoseUnit } from "@/types";

/** 새 약 추가 시 전달할 데이터 (id, completed 제외) */
type NewMedication = Omit<Medication, "id" | "completed">;

type TimeOption = {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
  accentSoft: string;
  glow: string;
};

const TIME_OPTIONS: TimeOption[] = [
  {
    icon: Sunrise,
    label: "아침",
    value: "08:00",
    accent: "#F97316",
    accentSoft: "#FFF1E8",
    glow: "rgba(249, 115, 22, 0.22)",
  },
  {
    icon: SunMedium,
    label: "점심",
    value: "13:00",
    accent: "#EAB308",
    accentSoft: "#FFF9DB",
    glow: "rgba(234, 179, 8, 0.20)",
  },
  {
    icon: MoonStar,
    label: "저녁",
    value: "19:00",
    accent: "#6C63FF",
    accentSoft: "#F0EEFF",
    glow: "rgba(108, 99, 255, 0.22)",
  },
];

/** 약 추가 화면 */
export function AddView({
  onBack,
  onSave,
  dark,
}: {
  onBack: () => void;
  onSave: (m: NewMedication) => Promise<void>;
  dark: boolean;
}) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [dosage, setDosage] = useState("1");
  const [memo, setMemo] = useState("");
  const [type, setType] = useState<MedType>("tablet");
  const [color, setColor] = useState(MED_COLORS[0]);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = useTheme(dark);
  const doseUnit = getDoseUnit(type);

  // 사진 분석 훅 — 결과가 오면 비어있는 필드만 채운다 (이미 입력된 값 보호)
  const photo = usePhotoAnalyzer({
    onResult: ({ name: analyzedName, summary }) => {
      if (!name.trim() && analyzedName) setName(analyzedName);
      if (!memo.trim() && summary) setMemo(summary);
      if (!analyzedName) {
        toast.info("약 이름을 식별하지 못했어요. 직접 입력해주세요.");
      } else {
        toast.success("✓ 분석 완료. 내용을 확인해주세요.");
      }
    },
  });

  const formatDisplay = (raw: string) => {
    const [hh, mm] = raw.split(":");
    const h = parseInt(hh);
    const a = h >= 12 ? "PM" : "AM";
    const d = h % 12 || 12;
    return `${d.toString().padStart(2, "0")}:${mm} ${a}`;
  };

  // onSave(DB insert) 완료 후 화면 전환 — 중간에 실패하면 에러 토스트
  const save = useCallback(async () => {
    if (!name.trim() || saving) return;
    if (days.length === 0) {
      toast.error("복용 요일을 최소 1개 선택해주세요.");
      return;
    }
    const h = parseInt(time.split(":")[0]);
    let cat: Category = "morning";
    if (h >= 11 && h < 16) cat = "lunch";
    if (h >= 16) cat = "evening";
    setSaving(true);
    try {
      // 숫자 인덱스(월=0 기준)를 DB 문자열 키로 변환 (DAY_KEYS_MON_FIRST는 constants에서 import)
      const selectedDays = DAY_KEYS_MON_FIRST.filter((_, i) => days.includes(i));

      await onSave({
        name: name.trim(),
        dosage: `${dosage}${doseUnit}`,
        memo: memo.trim(),
        time: formatDisplay(time),
        category: cat,
        type,
        color,
        days: selectedDays,
      });
      onBack();
    } catch {
      toast.error("약 추가에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }, [name, saving, time, dosage, doseUnit, memo, type, color, days, onSave, onBack]);

  return (
    <div
      className="h-full overflow-y-auto hide-scrollbar"
      style={{ backgroundColor: t.bg }}
    >
      <div className="max-w-md mx-auto px-5 pt-14 pb-32 space-y-4">
        {/* 헤더 */}
        <header className="flex items-center gap-4 mb-2">
          <button
            onClick={onBack}
            aria-label="뒤로 가기"
            className="w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform min-w-[44px] min-h-[44px]"
            style={{ backgroundColor: t.card }}
          >
            <ChevronLeft size={22} style={{ color: t.text }} />
          </button>
          <div>
            <h2 className="text-2xl font-black" style={{ color: t.text }}>
              새 약 추가
            </h2>
            <p className="text-xs font-medium" style={{ color: t.subtext }}>
              복용 정보를 입력해주세요
            </p>
          </div>
          {/* 카메라 버튼 — 분석 진행 중에는 비활성화 */}
          <button
            onClick={photo.start}
            disabled={
              photo.status !== "idle" &&
              photo.status !== "done" &&
              photo.status !== "error"
            }
            aria-label="사진으로 약 정보 자동 입력"
            className="ml-auto w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform min-w-[44px] min-h-[44px] disabled:opacity-50"
            style={{ backgroundColor: t.card }}
          >
            <Camera size={22} style={{ color: "#6C63FF" }} />
          </button>
        </header>
        {/* 사진 분석 진행 배지 — idle이면 null 반환 */}
        <PhotoAnalyzeBadge status={photo.status} message={photo.message} dark={dark} />

        {/* 약 이름 */}
        <FormField label="약 이름" cardBg={t.card} accentColor="#6C63FF">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 border-2"
            style={{
              borderColor: name ? "#6C63FF" : t.divider,
              backgroundColor: t.surface,
            }}
          >
            <Pill size={18} style={{ color: "#6C63FF" }} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 마그네슘, 종합비타민..."
              aria-label="약 이름"
              className="flex-1 bg-transparent outline-none font-bold text-base"
              style={{ color: t.text }}
            />
          </div>
        </FormField>

        {/* 약 유형 */}
        <FormField label="약 유형" cardBg={t.card} accentColor="#6C63FF">
          <div
            className="grid grid-cols-2 gap-3"
            role="radiogroup"
            aria-label="약 유형 선택"
          >
            {[
              { id: "tablet"   as const, label: "알약",   Icon: Pill },
              { id: "syrup"    as const, label: "시럽",   Icon: Droplets },
              { id: "powder"   as const, label: "포장약", Icon: Package },
              { id: "ointment" as const, label: "연고",   Icon: Hand },
              { id: "drops"    as const, label: "점안액", Icon: Eye },
              { id: "inhaler"  as const, label: "흡입제", Icon: Wind },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setType(id)}
                role="radio"
                aria-checked={type === id}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl font-bold text-sm transition-all active:scale-95 min-h-[48px]"
                style={{
                  backgroundColor: type === id ? "#6C63FF" : t.surface,
                  color: type === id ? "#fff" : t.subtext,
                }}
              >
                <Icon
                  size={28}
                  fill={type === id ? "rgba(255,255,255,0.3)" : "none"}
                />
                {label}
              </button>
            ))}
          </div>
        </FormField>

        {/* 색상 */}
        <FormField label="색상" cardBg={t.card} accentColor="#6C63FF">
          <div
            className="flex gap-3 flex-wrap"
            role="radiogroup"
            aria-label="색상 선택"
          >
            {MED_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className="w-10 h-10 rounded-full transition-transform active:scale-90 min-w-[44px] min-h-[44px]"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `3px solid ${c}` : "none",
                  outlineOffset: "3px",
                }}
              />
            ))}
          </div>
        </FormField>

        {/* 복용 시간 */}
        <FormField label="복용 시간" cardBg={t.card} accentColor="#6C63FF">
          <div
            className="space-y-2"
            role="radiogroup"
            aria-label="복용 시간 선택"
          >
            {TIME_OPTIONS.map(({ icon: Icon, label, value, accent, accentSoft, glow }) => {
              const selected = time === value;
              return (
              <button
                key={value}
                onClick={() => setTime(value)}
                role="radio"
                aria-checked={selected}
                className="w-full flex items-center justify-between p-4 rounded-[1.35rem] border transition-all min-h-[52px] overflow-hidden"
                style={{
                  borderColor: selected ? accent : t.divider,
                  backgroundColor: selected ? accentSoft : t.surface,
                  boxShadow: selected
                    ? `0 10px 24px ${glow}, inset 0 1px 0 rgba(255,255,255,0.6)`
                    : "0 1px 0 rgba(255,255,255,0.35)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
                      boxShadow: `0 10px 20px ${glow}`,
                    }}
                  >
                    <Icon size={22} strokeWidth={2.3} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="font-extrabold tracking-tight text-[1.08rem]" style={{ color: t.text }}>
                      {label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: t.subtext }}>
                      {value}
                    </span>
                  </div>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 shrink-0"
                  style={{
                    backgroundColor: selected ? accent : "transparent",
                    borderColor: selected ? accent : t.divider,
                    boxShadow: selected ? `0 0 0 5px ${glow}` : "none",
                  }}
                />
              </button>
              );
            })}
            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-between p-4 rounded-[1.35rem] min-h-[52px] border transition-all"
              style={{
                backgroundColor: t.surface,
                borderColor: t.divider,
                boxShadow: "0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: dark
                      ? "linear-gradient(135deg, rgba(108,99,255,0.18), rgba(108,99,255,0.08))"
                      : "linear-gradient(135deg, rgba(108,99,255,0.12), rgba(108,99,255,0.04))",
                    border: `1px solid ${t.divider}`,
                  }}
                >
                  <Clock size={20} style={{ color: "#6C63FF" }} />
                </div>
                <span className="font-extrabold" style={{ color: t.text }}>
                  직접 설정
                </span>
              </div>
              <ChevronRight size={16} style={{ color: t.subtext }} />
            </button>
          </div>
        </FormField>

        {/* 반복 요일 */}
        <FormField label="반복 요일" cardBg={t.card} accentColor="#6C63FF">
          <div className="flex justify-between">
            {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
              <button
                key={d}
                onClick={() =>
                  setDays((p) =>
                    p.includes(i) ? p.filter((x) => x !== i) : [...p, i],
                  )
                }
                aria-pressed={days.includes(i)}
                className="w-10 h-10 rounded-xl font-bold text-xs transition-all active:scale-90 min-w-[44px] min-h-[44px]"
                style={{
                  backgroundColor: days.includes(i) ? "#6C63FF" : t.surface,
                  color: days.includes(i) ? "#fff" : t.subtext,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </FormField>

        {/* 용량 / 메모 */}
        <FormField label="용량 / 메모" cardBg={t.card} accentColor="#6C63FF">
          <div className="space-y-3">
            {/* 1회 용량 */}
            <div>
              <p className="text-[10px] font-bold mb-2" style={{ color: t.subtext }}>
                1회 용량 ({doseUnit})
              </p>
              <input
                type="number"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                aria-label={`1회 용량 (${doseUnit})`}
                className="w-full text-center text-2xl font-black rounded-2xl py-4 outline-none focus:ring-2 focus:ring-[#6C63FF]"
                style={{ backgroundColor: t.surface, color: "#6C63FF" }}
              />
            </div>
            {/* 복용 메모 */}
            <div>
              <p className="text-[10px] font-bold mb-2" style={{ color: t.subtext }}>
                복용 메모 (선택)
              </p>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                aria-label="복용 메모"
                placeholder="예: 식후 30분 복용, 물 한 컵과 함께..."
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] resize-none"
                style={{
                  backgroundColor: t.surface,
                  color: t.text,
                }}
              />
            </div>
          </div>
        </FormField>

        {/* 저장 버튼 — DB insert 완료 전까지 비활성화 */}
        <button
          onClick={save}
          disabled={!name.trim() || saving || days.length === 0}
          className="w-full py-5 rounded-2xl font-extrabold text-lg text-white shadow-lg transition-all active:scale-[0.98] min-h-[48px]"
          style={{
            background: name.trim() && !saving && days.length > 0
              ? "linear-gradient(135deg,#6C63FF,#4FACFE)"
              : t.divider,
          }}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <TimePicker
            dark={dark}
            onClose={() => setShowPicker(false)}
            onConfirm={setTime}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
