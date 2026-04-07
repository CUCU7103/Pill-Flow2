import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bell, Clock, Moon, User, Shield, Info, LogOut, ChevronRight,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useTheme } from "@/hooks/use-theme";
import { Toggle } from "@/components/common/Toggle";
import { APP_VERSION } from "@/constants";
import { PrivacyModal } from "./PrivacyModal";
import { AboutModal } from "./AboutModal";
import { AccountModal } from "./AccountModal";

/**
 * 구글 계정 프로필 아바타
 * 사진이 있으면 이미지, 없으면 이름 첫 글자로 표시
 */
function ProfileAvatar({ user }: { user: SupabaseUser }) {
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  // Google 계정에서 제공하는 표시 이름 또는 이메일 앞부분으로 이니셜 생성
  const initial = ((user.user_metadata?.full_name as string | undefined) ?? user.email ?? "U")
    .charAt(0)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="프로필 사진"
        className="w-14 h-14 rounded-2xl object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black"
      style={{ background: "linear-gradient(135deg, #6C63FF, #9B8FFF)" }}
    >
      {initial}
    </div>
  );
}

/** 설정 모달 (바텀 시트) */
export function SettingsModal({
  onClose,
  dark,
  onToggleDark,
  notif,
  onToggleNotif,
  alarm,
  onAlarmChange,
  user,
  onSignOut,
  onResetAll,
}: {
  onClose: () => void;
  dark: boolean;
  onToggleDark: () => void;
  notif: boolean;
  onToggleNotif: () => void;
  alarm: string;
  onAlarmChange: (t: string) => void;
  user: SupabaseUser;
  onSignOut: () => Promise<void>;
  onResetAll: () => Promise<void>;
}) {
  const t = useTheme(dark);

  // 서브 모달 상태 - SettingsModal 내부에서 관리
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Google 계정에서 표시 이름 추출 (없으면 이메일 앞부분 사용)
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "사용자";
  const email = user.email ?? "";

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="설정"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full rounded-t-[2rem] overflow-y-auto max-h-[90vh]"
            style={{ backgroundColor: t.card }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.divider }} />
            </div>
            {/* 헤더 */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: t.divider }}
            >
              <h2 className="text-xl font-extrabold" style={{ color: t.text }}>
                설정
              </h2>
              <button
                onClick={onClose}
                aria-label="설정 닫기"
                className="w-9 h-9 rounded-full flex items-center justify-center min-w-[44px] min-h-[44px]"
                style={{ backgroundColor: t.surface }}
              >
                <X size={18} style={{ color: t.subtext }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 pb-12">
              {/* 프로필 - 구글 계정 정보 표시 */}
              <div
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{
                  background: dark
                    ? "linear-gradient(135deg,#6C63FF25,#4FACFE25)"
                    : "linear-gradient(135deg,#6C63FF15,#4FACFE15)",
                }}
              >
                <ProfileAvatar user={user} />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold truncate" style={{ color: t.text }}>
                    {displayName}
                  </p>
                  <p className="text-xs font-medium mt-0.5 truncate" style={{ color: t.subtext }}>
                    {email}
                  </p>
                </div>
              </div>

              {/* 앱 설정 */}
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-3 px-1"
                  style={{ color: t.subtext }}
                >
                  앱 설정
                </p>
                <div
                  className="rounded-2xl overflow-hidden divide-y"
                  style={{ backgroundColor: t.surface, borderColor: t.divider }}
                >
                  {/* 알림 */}
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6C63FF]/15">
                      <Bell size={18} style={{ color: "#6C63FF" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>복용 알림</p>
                      <p className="text-[11px] font-medium" style={{ color: t.subtext }}>
                        매일 알림을 받습니다
                      </p>
                    </div>
                    <Toggle on={notif} onToggle={onToggleNotif} />
                  </div>
                  {/* 알림 시간 */}
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FFD166]/20">
                      <Clock size={18} style={{ color: "#F59E0B" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>알림 시간</p>
                      <p className="text-[11px] font-medium" style={{ color: t.subtext }}>
                        매일 아침 복용 알림
                      </p>
                    </div>
                    <input
                      type="time"
                      value={alarm}
                      onChange={(e) => onAlarmChange(e.target.value)}
                      aria-label="알림 시간 설정"
                      className="text-sm font-bold bg-transparent border-none outline-none text-[#6C63FF]"
                    />
                  </div>
                  {/* 다크 모드 */}
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: dark ? "#374151" : "#1A1A2E20" }}
                    >
                      <Moon size={18} style={{ color: dark ? "#9B8FFF" : "#374151" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>다크 모드</p>
                      <p className="text-[11px] font-medium" style={{ color: t.subtext }}>
                        어두운 테마 사용
                      </p>
                    </div>
                    <Toggle on={dark} onToggle={onToggleDark} />
                  </div>
                </div>
              </div>

              {/* 정보 */}
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-3 px-1"
                  style={{ color: t.subtext }}
                >
                  정보
                </p>
                <div
                  className="rounded-2xl overflow-hidden divide-y"
                  style={{ backgroundColor: t.surface, borderColor: t.divider }}
                >
                  {/* 계정 관리 */}
                  <button
                    onClick={() => setAccountOpen(true)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:opacity-70 min-h-[48px]"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#06D6A0]/20">
                      <User size={18} style={{ color: "#06D6A0" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>계정 관리</p>
                      <p className="text-[11px] font-medium" style={{ color: t.subtext }}>
                        데이터 초기화 및 탈퇴
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: t.divider }} />
                  </button>

                  {/* 개인정보 처리방침 */}
                  <button
                    onClick={() => setPrivacyOpen(true)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:opacity-70 min-h-[48px]"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#4FACFE]/20">
                      <Shield size={18} style={{ color: "#4FACFE" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>개인정보 처리방침</p>
                    </div>
                    <ChevronRight size={16} style={{ color: t.divider }} />
                  </button>

                  {/* 버전 정보 */}
                  <button
                    onClick={() => setAboutOpen(true)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left active:opacity-70 min-h-[48px]"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#9B8FFF]/20">
                      <Info size={18} style={{ color: "#9B8FFF" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>버전 정보</p>
                      <p className="text-[11px] font-medium" style={{ color: t.subtext }}>
                        v{APP_VERSION}
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: t.divider }} />
                  </button>
                </div>
              </div>

              {/* 로그아웃 버튼 */}
              <button
                onClick={onSignOut}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm min-h-[48px] active:opacity-70 transition-opacity"
                style={{
                  backgroundColor: dark ? "#3B1A1A" : "#FEF2F2",
                  color: "#F87171",
                }}
              >
                <LogOut size={18} />
                로그아웃
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* 서브 모달 — SettingsModal 위에 레이어 (z-[60]) */}
      <AnimatePresence>
        {privacyOpen && (
          <PrivacyModal onClose={() => setPrivacyOpen(false)} dark={dark} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {aboutOpen && (
          <AboutModal onClose={() => setAboutOpen(false)} dark={dark} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {accountOpen && (
          <AccountModal
            onClose={() => setAccountOpen(false)}
            dark={dark}
            user={user}
            onResetAll={onResetAll}
          />
        )}
      </AnimatePresence>
    </>
  );
}
