import { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

/** 시간 선택 모달 */
export function TimePicker({
  onClose,
  onConfirm,
  dark,
}: {
  onClose: () => void;
  onConfirm: (t: string) => void;
  dark: boolean;
}) {
  const [h, setH] = useState("8");
  const [m, setM] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const t = useTheme(dark);

  const confirm = () => {
    let hr = parseInt(h) || 8;
    hr = Math.max(1, Math.min(12, hr));
    let mn = parseInt(m) || 0;
    mn = Math.max(0, Math.min(59, mn));
    if (ampm === "PM" && hr < 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    onConfirm(`${hr.toString().padStart(2, "0")}:${mn.toString().padStart(2, "0")}`);
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="시간 설정"
    >
      <motion.div
        className="w-full max-w-xs rounded-3xl p-8 space-y-6 shadow-2xl"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#6C63FF]">시간 설정</h3>
          <p className="text-xs mt-1" style={{ color: t.subtext }}>
            복용 시간을 직접 입력하세요
          </p>
        </div>
        {/* 오전/오후 선택 */}
        <div
          className="flex rounded-2xl overflow-hidden p-1 gap-1"
          style={{ backgroundColor: t.surface }}
          role="radiogroup"
          aria-label="오전/오후 선택"
        >
          {(["AM", "PM"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setAmpm(v)}
              role="radio"
              aria-checked={ampm === v}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                backgroundColor: ampm === v ? "#6C63FF" : "transparent",
                color: ampm === v ? "#fff" : t.subtext,
              }}
            >
              {v === "AM" ? "오전" : "오후"}
            </button>
          ))}
        </div>
        {/* 시간 입력 */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={h}
              onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 2))}
              aria-label="시"
              className="w-20 h-20 text-center text-4xl font-black rounded-3xl outline-none focus:ring-2 focus:ring-[#6C63FF]"
              style={{ backgroundColor: t.surface, color: "#6C63FF" }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: t.subtext }}
            >
              시
            </span>
          </div>
          <span className="text-4xl font-bold text-[#6C63FF] mb-6">:</span>
          <div className="flex flex-col items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={m}
              onChange={(e) => setM(e.target.value.replace(/\D/g, "").slice(0, 2))}
              aria-label="분"
              className="w-20 h-20 text-center text-4xl font-black rounded-3xl outline-none focus:ring-2 focus:ring-[#6C63FF]"
              style={{ backgroundColor: t.surface, color: "#6C63FF" }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: t.subtext }}
            >
              분
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-bold text-sm min-h-[48px]"
            style={{ backgroundColor: t.surface, color: t.subtext }}
          >
            취소
          </button>
          <button
            onClick={confirm}
            className="flex-1 py-4 rounded-2xl font-bold text-sm text-white min-h-[48px]"
            style={{ backgroundColor: "#6C63FF" }}
          >
            확인
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
