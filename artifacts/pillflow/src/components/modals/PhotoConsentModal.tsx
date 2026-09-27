import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

const photoNotices = [
  ["목적", "약 정보 자동 입력"],
  ["항목", "약 사진(1024px로 축소), 분석 결과"],
  ["받는 자와 국가", "Groq, Inc., 미국(AI 분석)"],
  ["보관", "저장하지 않음. Groq는 오류·남용 조사 시 최대 30일 보관할 수 있음"],
  ["거부 권리", "거부해도 직접 입력으로 약을 등록할 수 있음"],
] as const;

export function PhotoConsentModal({
  saving,
  error,
  onAgree,
  onCancel,
}: {
  saving: boolean;
  error: string | null;
  onAgree: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (saving) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saving, onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-3 pb-3 pt-8 sm:items-center" role="presentation">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-consent-title"
        className="w-full max-w-md rounded-3xl border border-pf-divider bg-pf-card p-5 text-pf-text shadow-2xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
      >
        <h2 id="photo-consent-title" className="text-xl font-black">사진 분석을 위해 확인해 주세요</h2>
        <p className="mt-2 text-sm leading-6 text-pf-subtext">사진 분석 동의는 선택 항목이며, 동의하지 않아도 직접 약 정보를 입력할 수 있어요.</p>
        <dl className="mt-4 space-y-3 rounded-2xl bg-pf-surface p-4 text-sm leading-6">
          {photoNotices.map(([label, detail]) => (
            <div key={label}>
              <dt className="font-bold">{label}</dt>
              <dd className="text-pf-subtext">{detail}</dd>
            </div>
          ))}
        </dl>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            disabled={saving}
            className="min-h-12 flex-1 rounded-2xl border border-pf-divider px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={saving}
            className="min-h-12 flex-1 rounded-2xl px-4 py-3 font-extrabold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)] disabled:opacity-50"
            style={{ backgroundColor: "var(--pf-action)" }}
          >
            {saving ? "저장 중..." : "동의하고 촬영"}
          </button>
        </div>
      </motion.section>
    </div>,
    document.body,
  );
}
