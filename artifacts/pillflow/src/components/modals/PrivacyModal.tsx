import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

/** 개인정보 처리방침 모달 (전체 화면 바텀시트) */
export function PrivacyModal({
  onClose,
  dark,
}: {
  onClose: () => void;
  dark: boolean;
}) {
  const t = useTheme(dark);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="개인정보 처리방침"
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 패널 - 화면의 95% 높이 */}
      <motion.div
        className="relative w-full rounded-t-[2rem] flex flex-col"
        style={{ backgroundColor: t.card, height: "95dvh" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.divider }} />
        </div>

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: t.divider }}
        >
          <h2 className="text-xl font-extrabold" style={{ color: t.text }}>
            개인정보 처리방침
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]"
            style={{ backgroundColor: t.surface }}
          >
            <X size={18} style={{ color: t.subtext }} />
          </button>
        </div>

        {/* 본문 - iframe으로 privacy.html 렌더링 */}
        <iframe
          src="/privacy.html"
          title="개인정보 처리방침"
          className="flex-1 w-full border-none"
          style={{
            // 다크모드에서 iframe 배경 색상 보정
            filter: dark ? "invert(0.85) hue-rotate(180deg)" : "none",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
