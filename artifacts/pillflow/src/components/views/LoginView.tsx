import { useState } from "react";
import { Pill, BellRing, ChartNoAxesColumn } from "lucide-react";

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
    <main className="min-h-full w-full bg-pf-bg px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex h-15 w-15 items-center justify-center rounded-[20px] bg-[var(--pf-action)] text-white">
          <Pill size={29} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <p className="text-sm font-bold text-[var(--pf-accent)]">PillFlow</p>
        <h1 className="mt-3 text-[30px] leading-[1.3] tracking-tight font-extrabold text-pf-text">
          오늘 복용할 약을<br />한눈에 확인하세요
        </h1>
        <p className="mt-3 text-base leading-6 text-pf-subtext">
          복용 시간을 챙기고, 완료한 기록을 쉽게 남길 수 있어요.
        </p>

        <div className="mt-9 space-y-3" aria-label="주요 기능">
          <div className="flex items-center gap-4 rounded-[20px] border border-pf-divider bg-pf-card p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--pf-accent-soft)] text-[var(--pf-accent)]"><BellRing size={21} aria-hidden="true" /></span>
            <div><p className="font-bold text-pf-text">복용 시간 알림</p><p className="mt-1 text-sm text-pf-subtext">설정한 시간에 알림을 받아요</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-[20px] border border-pf-divider bg-pf-card p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--pf-accent-soft)] text-[var(--pf-accent)]"><ChartNoAxesColumn size={21} aria-hidden="true" /></span>
            <div><p className="font-bold text-pf-text">복용 기록 확인</p><p className="mt-1 text-sm text-pf-subtext">최근 7일의 기록을 살펴봐요</p></div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="mt-10 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-pf-divider bg-pf-card text-base font-bold text-pf-text transition-colors hover:bg-pf-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)] disabled:opacity-50"
        >
          {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-pf-divider border-t-[var(--pf-accent)]" aria-hidden="true" /> : <GoogleIcon />}
          {loading ? "로그인 중..." : "Google로 시작하기"}
        </button>
        <p className="mt-4 text-center text-sm leading-5 text-pf-subtext">
          로그인하면 내 약 정보를 기기 간에 동기화할 수 있어요.
        </p>
      </div>
    </main>
  );
}
