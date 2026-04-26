import type { AnalyzeStatus } from "@/hooks/use-photo-analyzer";

// 각 상태별로 표시할 이모지 아이콘 매핑
const ICONS: Record<AnalyzeStatus, string> = {
  idle: "",
  uploading: "📷",
  analyzing: "🔍",
  slow: "⏳",
  done: "✓",
  error: "❌",
};

/** AddView 헤더 바로 아래에 표시되는 분석 진행 배지 */
export function PhotoAnalyzeBadge({
  status,
  message,
  dark,
}: {
  status: AnalyzeStatus;
  message: string;
  dark: boolean;
}) {
  // idle 상태에서는 배지를 렌더링하지 않음
  if (status === "idle") return null;

  // 진행 중인 상태 여부 판별 (스피너 표시 기준)
  const isActive = status === "uploading" || status === "analyzing" || status === "slow";

  // 다크모드 여부에 따라 배경·텍스트·테두리 색상 결정
  const bgColor = dark ? "rgba(108,99,255,0.18)" : "rgba(108,99,255,0.10)";
  const textColor = dark ? "#A5B4FC" : "#6C63FF";
  const borderColor = dark ? "rgba(108,99,255,0.35)" : "rgba(108,99,255,0.25)";

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold mx-1"
      style={{ backgroundColor: bgColor, borderColor, color: textColor }}
    >
      {/* 진행 중이면 스피너, 아니면 상태 이모지 */}
      {isActive ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <span>{ICONS[status]}</span>
      )}
      <span>{message}</span>
    </div>
  );
}
