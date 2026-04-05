import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

/** 약 삭제 확인 모달 */
export function DeleteModal({
  onCancel,
  onConfirm,
  dark,
}: {
  onCancel: () => void;
  onConfirm: () => void;
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
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-desc"
    >
      <motion.div
        className="w-full max-w-xs rounded-3xl p-8 space-y-6 shadow-2xl"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-400 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={30} />
          </div>
          <h3 id="delete-title" className="text-xl font-bold" style={{ color: t.text }}>
            정말 삭제할까요?
          </h3>
          <p id="delete-desc" className="text-sm" style={{ color: t.subtext }}>
            삭제된 정보는 복구할 수 없습니다.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl font-bold text-sm min-h-[48px]"
            style={{ backgroundColor: t.surface, color: t.subtext }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 rounded-2xl font-bold text-sm bg-red-400 text-white min-h-[48px]"
          >
            삭제
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
