import { useState } from "react";
import { Pill } from "lucide-react";

/** Google 공식 G 아이콘 */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** 로그인 화면 - 인증되지 않은 사용자에게 표시 */
export function LoginView({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      // Google OAuth 리디렉션 시작 → 완료되면 페이지가 이동하므로 로딩 유지
      await onSignIn();
    } catch {
      // 리디렉션 전 오류 발생 시에만 로딩 해제
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-pf-bg px-8">
      {/* 앱 로고 */}
      <div className="flex flex-col items-center gap-5 mb-12">
        <div
          className="w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #6C63FF, #4FACFE)" }}
        >
          <Pill size={44} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-[2rem] font-extrabold tracking-tight text-pf-text">
            PillFlow
          </h1>
          <p className="text-sm font-medium mt-2 text-pf-subtext">
            건강한 복약 습관을 만들어요
          </p>
        </div>
      </div>

      {/* 주요 기능 안내 */}
      <div className="w-full space-y-3 mb-10">
        {[
          { emoji: "💊", text: "복약 시간 알림 및 기록 관리" },
          { emoji: "📊", text: "주간 복용 통계 한눈에 확인" },
          { emoji: "👨‍👩‍👧", text: "가족 모두의 약 정보 한 곳에" },
        ].map(({ emoji, text }) => (
          <div
            key={text}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-pf-card"
          >
            <span className="text-xl">{emoji}</span>
            <span className="text-sm font-semibold text-pf-text">{text}</span>
          </div>
        ))}
      </div>

      {/* 구글 로그인 버튼 */}
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm bg-pf-card border border-pf-divider shadow-sm active:opacity-70 disabled:opacity-50 min-h-[56px] transition-opacity text-pf-text"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-pf-divider border-t-[#6C63FF] rounded-full animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {loading ? "로그인 중..." : "Google로 시작하기"}
      </button>

      <p className="text-xs mt-5 text-center text-pf-subtext leading-relaxed">
        로그인하면 모든 기기에서 약 정보를 동기화할 수 있어요
      </p>
    </div>
  );
}
