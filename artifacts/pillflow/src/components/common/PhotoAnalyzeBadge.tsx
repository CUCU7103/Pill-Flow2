import { motion, AnimatePresence } from "framer-motion";
import type { AnalyzeStatus } from "@/hooks/use-photo-analyzer";

// idle은 렌더링되지 않으므로 빈 문자열, 나머지는 상태별 이모지
const ICONS: Record<AnalyzeStatus, string> = {
  idle: "",
  uploading: "📷",
  analyzing: "🔍",
  slow: "⏳",
  done: "✓",
  error: "❌",
};

/** AddView 헤더 바로 아래에 표시되는 분석 진행 배지 (slideDown/Up 애니메이션 포함) */
export function PhotoAnalyzeBadge({
  status,
  message,
  dark,
}: {
  status: AnalyzeStatus;
  message: string;
  dark: boolean;
}) {
  // 진행 중인 상태 여부 판별 (스피너 표시 기준)
  const isActive = status === "uploading" || status === "analyzing" || status === "slow";

  // 다크모드 여부에 따라 배경·텍스트·테두리 색상 결정
  // -- 배경·테두리는 반투명이라 Tailwind arbitrary RGBA 값 사용
  // -- 텍스트는 CSS 변수(--color-accent) 또는 light-purple(#A5B4FC) arbitrary value 사용
  const bgColorClass = dark ? "bg-[rgba(108,99,255,0.18)]" : "bg-[rgba(108,99,255,0.10)]";
  const textColorClass = dark ? "text-[#A5B4FC]" : "text-[var(--color-accent)]";
  const borderColorClass = dark ? "border-[rgba(108,99,255,0.35)]" : "border-[rgba(108,99,255,0.25)]";

  return (
    <AnimatePresence>
      {/* idle이 아닐 때만 배지를 마운트하며, height 0→auto slideDown/Up 애니메이션 적용 */}
      {status !== "idle" && (
        <motion.div
          key="badge"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
          <div
            role="status"
            aria-live="polite"
            aria-label={message}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold mx-1 ${bgColorClass} ${textColorClass} ${borderColorClass}`}
          >
            {/* 진행 중이면 스피너, 아니면 상태 이모지 — 스크린 리더에는 aria-label로 전달 */}
            {isActive ? (
              <span
                aria-hidden="true"
                className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              />
            ) : (
              <span aria-hidden="true">{ICONS[status]}</span>
            )}
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
