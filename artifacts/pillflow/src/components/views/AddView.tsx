import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Pill, ChevronLeft, Clock, ChevronRight, Circle, Droplets } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { FormField } from "@/components/common/FormField";
import { TimePicker } from "@/components/modals/TimePicker";
import { MED_COLORS } from "@/constants";
import type { Medication, MedType, Category } from "@/types";

/** 새 약 추가 시 전달할 데이터 (id, completed 제외) */
type NewMedication = Omit<Medication, "id" | "completed">;

/** 약 추가 화면 */
export function AddView({
  onBack,
  onSave,
  dark,
}: {
  onBack: () => void;
  onSave: (m: NewMedication) => void;
  dark: boolean;
}) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [dosage, setDosage] = useState("1");
  const [remaining, setRemaining] = useState("30");
  const [type, setType] = useState<MedType>("pill");
  const [color, setColor] = useState(MED_COLORS[0]);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [showPicker, setShowPicker] = useState(false);
  const t = useTheme(dark);

  const formatDisplay = (raw: string) => {
    const [hh, mm] = raw.split(":");
    const h = parseInt(hh);
    const a = h >= 12 ? "PM" : "AM";
    const d = h % 12 || 12;
    return `${d.toString().padStart(2, "0")}:${mm} ${a}`;
  };

  const save = () => {
    if (!name.trim()) return;
    const h = parseInt(time.split(":")[0]);
    let cat: Category = "morning";
    if (h >= 11 && h < 16) cat = "lunch";
    if (h >= 16) cat = "evening";
    onSave({
      name: name.trim(),
      dosage: `${dosage}정`,
      dosageAmount: parseInt(dosage) || 1,
      remainingQuantity: parseInt(remaining) || 0,
      time: formatDisplay(time),
      category: cat,
      type,
      color,
    });
    onBack();
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
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
        </header>

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
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="약 유형 선택">
            {(
              [
                { id: "pill" as const, label: "알약", Icon: Circle },
                { id: "capsule" as const, label: "캡슐", Icon: Pill },
                { id: "liquid" as const, label: "액상", Icon: Droplets },
              ]
            ).map(({ id, label, Icon }) => (
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

        {/* 복용 시간 */}
        <FormField label="복용 시간" cardBg={t.card} accentColor="#6C63FF">
          <div className="space-y-2" role="radiogroup" aria-label="복용 시간 선택">
            {[
              ["🌅", "아침", "08:00"],
              ["☀️", "점심", "13:00"],
              ["🌙", "저녁", "19:00"],
            ].map(([icon, label, t24]) => (
              <button
                key={t24}
                onClick={() => setTime(t24)}
                role="radio"
                aria-checked={time === t24}
                className="w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all min-h-[48px]"
                style={{
                  borderColor: time === t24 ? "#6C63FF" : "transparent",
                  backgroundColor: time === t24 ? "#6C63FF0D" : t.surface,
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <span className="font-bold" style={{ color: t.text }}>
                    {label} ({t24})
                  </span>
                </div>
                <div
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: time === t24 ? "#6C63FF" : "transparent",
                    borderColor: time === t24 ? "#6C63FF" : t.divider,
                  }}
                />
              </button>
            ))}
            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl min-h-[48px]"
              style={{ backgroundColor: t.surface }}
            >
              <div className="flex items-center gap-3">
                <Clock size={20} style={{ color: t.subtext }} />
                <span className="font-bold" style={{ color: t.subtext }}>
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
                  setDays((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
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

        {/* 용량 / 잔여량 */}
        <FormField label="용량 / 잔여량" cardBg={t.card} accentColor="#6C63FF">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "1회 용량 (정)", val: dosage, set: setDosage },
              { label: "총 잔여량 (개)", val: remaining, set: setRemaining },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <p className="text-[10px] font-bold mb-2" style={{ color: t.subtext }}>
                  {label}
                </p>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  aria-label={label}
                  className="w-full text-center text-2xl font-black rounded-2xl py-4 outline-none focus:ring-2 focus:ring-[#6C63FF]"
                  style={{ backgroundColor: t.surface, color: "#6C63FF" }}
                />
              </div>
            ))}
          </div>
        </FormField>

        {/* 저장 버튼 */}
        <button
          onClick={save}
          disabled={!name.trim()}
          className="w-full py-5 rounded-2xl font-extrabold text-lg text-white shadow-lg transition-all active:scale-[0.98] min-h-[48px]"
          style={{
            background: name.trim()
              ? "linear-gradient(135deg,#6C63FF,#4FACFE)"
              : t.divider,
          }}
        >
          저장하기
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <TimePicker dark={dark} onClose={() => setShowPicker(false)} onConfirm={setTime} />
        )}
      </AnimatePresence>
    </div>
  );
}
