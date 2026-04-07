import { useState } from "react";
import { motion } from "framer-motion";
import { X, AlertTriangle, RotateCcw } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useTheme } from "@/hooks/use-theme";

/** 계정 관리 모달 — 데이터 초기화 및 회원 탈퇴 */
export function AccountModal({
  onClose,
  dark,
  user,
  onResetAll,
}: {
  onClose: () => void;
  dark: boolean;
  user: SupabaseUser;
  onResetAll: () => Promise<void>;
}) {
  const t = useTheme(dark);

  // 데이터 초기화 확인 단계 (false: 기본, true: 확인 요청 중)
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "사용자";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initial = displayName.charAt(0).toUpperCase();

  /** 데이터 초기화 실행 */
  async function handleReset() {
    setResetting(true);
    try {
      await onResetAll();
      onClose();
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
    >
      <motion.div
        className="w-full max-w-xs rounded-3xl p-6 space-y-5 shadow-2xl"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 id="account-title" className="text-lg font-extrabold" style={{ color: t.text }}>
            계정 관리
          </h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]"
            style={{ backgroundColor: t.surface }}
          >
            <X size={16} style={{ color: t.subtext }} />
          </button>
        </div>

        {/* 계정 정보 (읽기 전용) */}
        <div
          className="rounded-2xl p-3 flex items-center gap-3"
          style={{
            background: dark
              ? "linear-gradient(135deg,#6C63FF25,#4FACFE25)"
              : "linear-gradient(135deg,#6C63FF15,#4FACFE15)",
          }}
        >
          {/* 아바타 */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="프로필 사진"
              className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-black flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6C63FF, #9B8FFF)" }}
            >
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: t.text }}>{displayName}</p>
            <p className="text-[11px] font-medium truncate" style={{ color: t.subtext }}>
              {user.email}
            </p>
          </div>
        </div>

        {/* 데이터 초기화 섹션 */}
        <div className="space-y-3">
          <p
            className="text-[10px] font-black uppercase tracking-widest px-1"
            style={{ color: t.subtext }}
          >
            데이터 관리
          </p>

          {/* 복약 데이터 초기화 */}
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl min-h-[48px] active:opacity-70"
              style={{ backgroundColor: t.surface }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-100">
                <RotateCcw size={16} className="text-orange-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold" style={{ color: t.text }}>복약 데이터 초기화</p>
                <p className="text-[11px]" style={{ color: t.subtext }}>
                  모든 약 및 복용 기록 삭제
                </p>
              </div>
            </button>
          ) : (
            // 확인 단계 - 인라인으로 취소/확인 버튼 표시
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ backgroundColor: t.surface }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                <p className="text-sm font-bold" style={{ color: t.text }}>
                  정말 초기화할까요?
                </p>
              </div>
              <p className="text-xs" style={{ color: t.subtext }}>
                모든 약 정보와 복용 기록이 삭제되며 복구할 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm min-h-[44px]"
                  style={{ backgroundColor: t.bg, color: t.subtext }}
                  disabled={resetting}
                >
                  취소
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-orange-500 text-white min-h-[44px] disabled:opacity-50"
                  disabled={resetting}
                >
                  {resetting ? "삭제 중..." : "초기화"}
                </button>
              </div>
            </div>
          )}

          {/* 회원 탈퇴 — 이메일 문의 안내 */}
          <div
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: t.surface }}
          >
            <p className="text-sm font-bold mb-0.5" style={{ color: t.subtext }}>
              회원 탈퇴
            </p>
            <p className="text-[11px]" style={{ color: t.subtext }}>
              탈퇴 요청은{" "}
              <span style={{ color: "#6C63FF" }}>privacy@pillflow.app</span>
              {" "}으로 문의해 주세요.
            </p>
          </div>
        </div>

        {/* 닫기 */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl font-bold text-sm min-h-[48px]"
          style={{ backgroundColor: t.surface, color: t.subtext }}
        >
          닫기
        </button>
      </motion.div>
    </motion.div>
  );
}
