import { motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { APP_VERSION } from "@/constants";

/** 앱 정보 모달 (버전 정보 버튼 클릭 시 표시) */
export function AboutModal({
  onClose,
  dark,
}: {
  onClose: () => void;
  dark: boolean;
}) {
  const t = useTheme(dark);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xs rounded-3xl p-8 space-y-6 shadow-2xl"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        // 내부 클릭은 모달 닫힘 방지
        onClick={(e) => e.stopPropagation()}
      >
        {/* 앱 아이콘 영역 */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-lg"
            style={{ background: "linear-gradient(135deg, #6C63FF, #4FACFE)" }}
          >
            💊
          </div>
          <div>
            <h3 id="about-title" className="text-2xl font-black" style={{ color: t.text }}>
              PillFlow
            </h3>
            <p className="text-sm font-medium mt-1" style={{ color: t.subtext }}>
              매일의 복약을 더 쉽게
            </p>
          </div>
        </div>

        {/* 앱 정보 항목 */}
        <div
          className="rounded-2xl overflow-hidden divide-y"
          style={{ backgroundColor: t.surface, borderColor: t.divider }}
        >
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: t.subtext }}>버전</span>
            <span className="text-sm font-bold" style={{ color: t.text }}>v{APP_VERSION}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: t.subtext }}>플랫폼</span>
            <span className="text-sm font-bold" style={{ color: t.text }}>Android</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: t.subtext }}>문의</span>
            <span className="text-xs font-bold" style={{ color: "#6C63FF" }}>
              privacy@pillflow.app
            </span>
          </div>
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl font-bold text-sm min-h-[48px]"
          style={{ backgroundColor: t.surface, color: t.subtext }}
        >
          닫기
        </button>
      </motion.div>
    </motion.div>
  );
}
