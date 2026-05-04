import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  X,
} from "lucide-react";
import { usePhotoAnalyzer } from "@/hooks/use-photo-analyzer";
import { PhotoAnalyzeBadge } from "@/components/common/PhotoAnalyzeBadge";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { FormField } from "@/components/common/FormField";
import { TimePicker } from "@/components/modals/TimePicker";
import { MED_COLORS, DAY_KEYS_MON_FIRST } from "@/constants";
import type { Medication, MedType } from "@/types";
import { getDoseUnit } from "@/types";

/** 새 약 추가 시 전달할 데이터 (id, completed 제외) */
type NewMedication = Omit<Medication, "id" | "completed">;

/** 시간대 프리셋 */
type TimeSlot = {
  id: "morning" | "lunch" | "evening" | "custom";
  label: string;
  defaultValue: string;
  icon: typeof Sunrise;
  accent: string;
  accentSoft: string;
  glow: string;
  /** TimePicker 허용 최소 시(0~23) */
  minHour: number;
  /** TimePicker 허용 최대 시(0~23) */
  maxHour: number;
};

const TIME_SLOTS: TimeSlot[] = [
  {
    id: "morning",
    label: "아침",
    defaultValue: "08:00",
    icon: Sunrise,
    accent: "#F97316",
    accentSoft: "#FFF1E8",
    glow: "rgba(249,115,22,0.22)",
    minHour: 5,
    maxHour: 10,
  },
  {
    id: "lunch",
    label: "점심",
    defaultValue: "13:00",
    icon: SunMedium,
    accent: "#EAB308",
    accentSoft: "#FFF9DB",
    glow: "rgba(234,179,8,0.20)",
    minHour: 11,
    maxHour: 15,
  },
  {
    id: "evening",
    label: "저녁",
    defaultValue: "19:00",
    icon: MoonStar,
    accent: "#6C63FF",
    accentSoft: "#F0EEFF",
    glow: "rgba(108,99,255,0.22)",
    minHour: 16,
    maxHour: 23,
  },
  {
    id: "custom",
    label: "기타",
    defaultValue: "",
    icon: Clock,
    accent: "#14B8A6",
    accentSoft: "#F0FDFA",
    glow: "rgba(20,184,166,0.20)",
    minHour: 0,
    maxHour: 23,
  },
];

const MAX_TIMES = 4;

/** 약 추가 화면 (3단계 위저드) */
export function AddView({
  onBack,
  onSave,
  dark,
}: {
  onBack: () => void;
  onSave: (m: NewMedication) => Promise<void>;
  dark: boolean;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [name, setName] = useState("");
  const [type, setType] = useState<MedType>("tablet");
  const [dosage, setDosage] = useState("1");

  // Step 2
  const [color, setColor] = useState(MED_COLORS[0]);
  /** 선택된 시간 배열 (HH:MM 형식, 최대 4개) */
  const [times, setTimes] = useState<string[]>([]);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);

  // TimePicker: 어떤 슬롯을 수정 중인지
  const [pickerFor, setPickerFor] = useState<{
    slotId: string;
    existingTime?: string;
    initialTime: string;
    minHour: number;
    maxHour: number;
  } | null>(null);

  // Step 3
  const [memo, setMemo] = useState("");

  const [saving, setSaving] = useState(false);
  const t = useTheme(dark);
  const doseUnit = getDoseUnit(type);

  // 사진 분석 훅 — 결과가 오면 비어있는 필드만 채운다
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

  /** 해당 슬롯에 이미 선택된 시간 찾기 */
  const getSlotTime = useCallback((slot: TimeSlot): string | undefined => {
    if (slot.id === "custom") return undefined;
    return times.find((t) => {
      const h = parseInt(t.split(":")[0], 10);
      if (slot.id === "morning") return h >= slot.minHour && h <= slot.maxHour;
      if (slot.id === "lunch")   return h >= slot.minHour && h <= slot.maxHour;
      if (slot.id === "evening") return h >= slot.minHour && h <= slot.maxHour;
      return false;
    });
  }, [times]);

  /**
   * 슬롯 클릭:
   * - 미선택 상태 → TimePicker 열기 (기본값으로 초기화, 범위 제한 적용)
   * - 선택 상태 → TimePicker 열어서 시간 수정 가능 (단, X 버튼으로 제거도 가능)
   * - 최대 4개 초과 시 토스트
   */
  const handleSlotClick = useCallback((slot: TimeSlot) => {
    const existing = getSlotTime(slot);
    if (!existing && times.length >= MAX_TIMES) {
      toast.info(`복용 시간은 최대 ${MAX_TIMES}개까지 설정할 수 있어요.`);
      return;
    }
    setPickerFor({
      slotId: slot.id,
      existingTime: existing,
      initialTime: existing ?? slot.defaultValue,
      minHour: slot.minHour,
      maxHour: slot.maxHour,
    });
  }, [times, getSlotTime]);

  /** TimePicker 확인 — 기존 시간 교체 or 새 시간 추가 */
  const handlePickerConfirm = useCallback((newTime: string) => {
    if (!pickerFor) return;
    setTimes((prev) => {
      if (pickerFor.existingTime) {
        // 기존 시간 교체
        return prev.map((t) => t === pickerFor.existingTime ? newTime : t).sort();
      }
      // 새 시간 추가
      if (prev.includes(newTime)) return prev;
      if (prev.length >= MAX_TIMES) return prev;
      return [...prev, newTime].sort();
    });
    setPickerFor(null);
  }, [pickerFor]);

  /** 시간 제거 */
  const removeTime = useCallback((time: string) => {
    setTimes((prev) => prev.filter((t) => t !== time));
  }, []);

  const save = useCallback(async () => {
    if (!name.trim() || saving) return;
    if (times.length === 0) {
      toast.error("복용 시간을 최소 1개 선택해주세요.");
      return;
    }
    if (days.length === 0) {
      toast.error("복용 요일을 최소 1개 선택해주세요.");
      return;
    }
    setSaving(true);
    try {
      const selectedDays = DAY_KEYS_MON_FIRST.filter((_, i) => days.includes(i));
      await onSave({
        name: name.trim(),
        dosage: `${dosage}${doseUnit}`,
        memo: memo.trim(),
        times,
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
  }, [name, saving, times, dosage, doseUnit, memo, type, color, days, onSave, onBack]);

  const canGoStep2 = name.trim().length > 0;
  const canGoStep3 = times.length > 0 && days.length > 0;

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
      <div className="max-w-md mx-auto px-5 pt-14 pb-32 space-y-4">

        {/* 헤더 */}
        <header className="flex items-center gap-4 mb-2">
          <button
            onClick={step === 1 ? onBack : () => setStep((s) => (s - 1) as 1 | 2 | 3)}
            aria-label="뒤로 가기"
            className="w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform min-w-[44px] min-h-[44px]"
            style={{ backgroundColor: t.card }}
          >
            <ChevronLeft size={22} style={{ color: t.text }} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-black" style={{ color: t.text }}>
              새 약 추가
            </h2>
            <p className="text-xs font-medium" style={{ color: t.subtext }}>
              {step === 1 ? "약 기본 정보를 입력해주세요" : step === 2 ? "복용 일정을 설정해주세요" : "메모를 입력해주세요 (선택)"}
            </p>
          </div>
          {/* 카메라 버튼 — Step 1에서만 표시 */}
          {step === 1 && (
            <button
              onClick={photo.start}
              disabled={
                photo.status !== "idle" &&
                photo.status !== "done" &&
                photo.status !== "error"
              }
              aria-label="사진으로 약 정보 자동 입력"
              className="w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform min-w-[44px] min-h-[44px] disabled:opacity-50"
              style={{ backgroundColor: t.card }}
            >
              <Camera size={22} style={{ color: "#6C63FF" }} />
            </button>
          )}
        </header>

        {/* 단계 인디케이터 */}
        <div className="flex gap-2 mb-2">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className="h-1.5 flex-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: s <= step ? "#6C63FF" : t.divider,
              }}
            />
          ))}
        </div>

        {/* 사진 분석 배지 */}
        <PhotoAnalyzeBadge status={photo.status} message={photo.message} dark={dark} />

        <AnimatePresence mode="wait">
          {/* ───── Step 1: 약 이름 + 유형 + 용량 ───── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
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
                      <Icon size={28} fill={type === id ? "rgba(255,255,255,0.3)" : "none"} />
                      {label}
                    </button>
                  ))}
                </div>
              </FormField>

              {/* 1회 용량 */}
              <FormField label={`1회 용량 (${doseUnit})`} cardBg={t.card} accentColor="#6C63FF">
                <input
                  type="number"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  aria-label={`1회 용량 (${doseUnit})`}
                  className="w-full text-center text-2xl font-black rounded-2xl py-4 outline-none focus:ring-2 focus:ring-[#6C63FF]"
                  style={{ backgroundColor: t.surface, color: "#6C63FF" }}
                />
              </FormField>

              {/* 다음 버튼 */}
              <button
                onClick={() => canGoStep2 && setStep(2)}
                disabled={!canGoStep2}
                className="w-full py-5 rounded-2xl font-extrabold text-lg text-white shadow-lg transition-all active:scale-[0.98] min-h-[48px] flex items-center justify-center gap-2"
                style={{
                  background: canGoStep2
                    ? "linear-gradient(135deg,#6C63FF,#4FACFE)"
                    : t.divider,
                }}
              >
                다음
                <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {/* ───── Step 2: 색상 + 복용 시간 + 반복 요일 ───── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* 색상 */}
              <FormField label="색상" cardBg={t.card} accentColor="#6C63FF">
                <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="색상 선택">
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

              {/* 복용 시간 — 아침/점심/저녁/기타 */}
              <FormField label={`복용 시간 (최대 ${MAX_TIMES}개)`} cardBg={t.card} accentColor="#6C63FF">
                <div className="space-y-3">
                  {/* 슬롯 버튼 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    {TIME_SLOTS.map((slot) => {
                      const Icon = slot.icon;
                      const matchedTime = getSlotTime(slot);
                      const isSelected = !!matchedTime;
                      const isDisabled = !isSelected && times.length >= MAX_TIMES;

                      return (
                        <button
                          key={slot.id}
                          onClick={() => handleSlotClick(slot)}
                          disabled={isDisabled}
                          aria-pressed={isSelected}
                          className="relative flex flex-col items-center gap-2 p-4 rounded-2xl font-bold text-sm transition-all active:scale-95 min-h-[90px] border-2"
                          style={{
                            backgroundColor: isSelected ? slot.accentSoft : t.surface,
                            borderColor: isSelected ? slot.accent : t.divider,
                            boxShadow: isSelected ? `0 6px 16px ${slot.glow}` : "none",
                            opacity: isDisabled ? 0.4 : 1,
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                              background: isSelected
                                ? `linear-gradient(135deg, ${slot.accent}, ${slot.accent}CC)`
                                : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            }}
                          >
                            <Icon size={20} style={{ color: isSelected ? "#fff" : t.subtext }} />
                          </div>
                          <span style={{ color: isSelected ? slot.accent : t.subtext }}>
                            {slot.label}
                          </span>
                          {/* 선택된 시간 표시 — 클릭으로 수정 가능함을 암시 */}
                          {isSelected && matchedTime ? (
                            <span
                              className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: slot.accent + "22", color: slot.accent }}
                            >
                              {matchedTime}
                            </span>
                          ) : slot.id === "custom" ? (
                            <span className="text-[10px]" style={{ color: t.subtext }}>
                              직접 설정
                            </span>
                          ) : (
                            <span className="text-[10px]" style={{ color: t.subtext }}>
                              탭하여 설정
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 선택된 커스텀 시간 칩 목록 */}
                  {times.filter((t) => {
                    const h = parseInt(t.split(":")[0], 10);
                    // 아침/점심/저녁 슬롯에 해당하지 않는 것들 = 기타
                    return !(h >= 5 && h < 11) && !(h >= 11 && h < 16) && !(h >= 16 || h < 5);
                  }).length === 0 && null}

                  {/* 선택된 시간 전체 요약 */}
                  {times.length > 0 && (
                    <div
                      className="rounded-xl px-3 py-2 flex flex-wrap gap-2"
                      style={{ backgroundColor: t.surface }}
                    >
                      <span className="text-[10px] font-bold w-full mb-0.5" style={{ color: t.subtext }}>
                        선택된 시간 ({times.length}/{MAX_TIMES})
                      </span>
                      {times.map((time) => (
                        <span
                          key={time}
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: "rgba(108,99,255,0.12)", color: "#6C63FF" }}
                        >
                          {time}
                          <button
                            onClick={() => removeTime(time)}
                            aria-label={`${time} 제거`}
                            className="ml-0.5 active:opacity-50"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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

              {/* 다음 버튼 */}
              <button
                onClick={() => canGoStep3 && setStep(3)}
                disabled={!canGoStep3}
                className="w-full py-5 rounded-2xl font-extrabold text-lg text-white shadow-lg transition-all active:scale-[0.98] min-h-[48px] flex items-center justify-center gap-2"
                style={{
                  background: canGoStep3
                    ? "linear-gradient(135deg,#6C63FF,#4FACFE)"
                    : t.divider,
                }}
              >
                다음
                <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {/* ───── Step 3: 메모 + 저장 ───── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* 등록 요약 카드 */}
              <div
                className="rounded-2xl p-4 space-y-1"
                style={{ backgroundColor: t.card }}
              >
                <p className="text-xs font-bold mb-2" style={{ color: t.subtext }}>등록 요약</p>
                <p className="font-extrabold text-base" style={{ color: t.text }}>{name}</p>
                <p className="text-sm" style={{ color: t.subtext }}>
                  {type === "tablet" ? "알약" : type === "syrup" ? "시럽" : type === "powder" ? "포장약" : type === "ointment" ? "연고" : type === "drops" ? "점안액" : "흡입제"}
                  {" · "}{dosage}{doseUnit}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {times.map((t_) => (
                    <span
                      key={t_}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(108,99,255,0.12)", color: "#6C63FF" }}
                    >
                      {t_}
                    </span>
                  ))}
                </div>
              </div>

              {/* 메모 */}
              <FormField label="복용 메모 (선택)" cardBg={t.card} accentColor="#6C63FF">
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  aria-label="복용 메모"
                  placeholder="예: 식후 30분 복용, 물 한 컵과 함께..."
                  rows={4}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] resize-none"
                  style={{ backgroundColor: t.surface, color: t.text }}
                />
              </FormField>

              {/* 저장 버튼 */}
              <button
                onClick={save}
                disabled={!name.trim() || saving || times.length === 0 || days.length === 0}
                className="w-full py-5 rounded-2xl font-extrabold text-lg text-white shadow-lg transition-all active:scale-[0.98] min-h-[48px]"
                style={{
                  background:
                    name.trim() && !saving && times.length > 0 && days.length > 0
                      ? "linear-gradient(135deg,#6C63FF,#4FACFE)"
                      : t.divider,
                }}
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TimePicker 모달 */}
      <AnimatePresence>
        {pickerFor && (
          <TimePicker
            dark={dark}
            onClose={() => setPickerFor(null)}
            onConfirm={handlePickerConfirm}
            initialTime={pickerFor.initialTime}
            minHour={pickerFor.minHour}
            maxHour={pickerFor.maxHour}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
