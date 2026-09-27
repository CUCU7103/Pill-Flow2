import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { PrivacyModal } from "@/components/modals/PrivacyModal";
import { canStartWithConsent, type ConsentStatus, type ConsentType } from "@/lib/consentUtils";

const sensitiveHealthNotices = [
  ["목적", "복약 일정 관리, 복용 기록, 통계 제공"],
  ["항목", "약 이름, 용량, 종류, 복용 시간·요일, 메모, 날짜별 복용 기록"],
  ["보유기간", "회원 탈퇴 시까지(탈퇴 요청 후 10일 이내 파기)"],
  ["거부 권리와 불이익", "동의를 거부할 수 있으며, 거부하면 복약 기록 기능을 이용할 수 없습니다."],
  ["국외 처리 사실", "일본(AWS·Supabase)에서 저장·처리된다는 사실"],
] as const;

export function ConsentView({
  status,
  dark,
  onAgree,
  onSignOut,
}: {
  status: ConsentStatus | null;
  dark: boolean;
  onAgree: (types: ConsentType[]) => Promise<unknown>;
  onSignOut: () => Promise<void>;
}) {
  const [ageOver14, setAgeOver14] = useState(Boolean(status?.ageOver14));
  const [sensitiveHealth, setSensitiveHealth] = useState(Boolean(status?.sensitiveHealth));
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canStart = canStartWithConsent(ageOver14, sensitiveHealth);

  const handleAgree = async () => {
    if (!canStart || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAgree(["age_over_14", "sensitive_health"]);
    } catch {
      setError("동의를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await onSignOut();
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-dvh overflow-y-auto bg-pf-bg px-5 py-8 text-pf-text">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center gap-5 pb-[env(safe-area-inset-bottom)]">
        <header>
          <p className="text-xs font-bold tracking-wide text-[var(--pf-accent)]">PillFlow</p>
          <h1 className="mt-2 text-2xl font-black leading-tight">PillFlow를 시작하기 전에 확인해 주세요</h1>
          <p className="mt-2 text-sm leading-6 text-pf-subtext">복약 정보를 안전하게 관리하기 위해 아래 내용을 확인해 주세요.</p>
        </header>

        <section className="space-y-3 rounded-3xl border border-pf-divider bg-pf-card p-4" aria-label="필수 확인 항목">
          <label htmlFor="consent-age-over-14" className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--pf-accent)] focus-within:ring-offset-2">
            <input
              id="consent-age-over-14"
              type="checkbox"
              checked={ageOver14}
              onChange={(event) => setAgeOver14(event.target.checked)}
              className="h-5 w-5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)]"
              style={{ accentColor: "var(--pf-accent)" }}
            />
            <span>만 14세 이상입니다.</span>
          </label>

          <div className="border-t border-pf-divider pt-3">
            <label htmlFor="consent-sensitive-health" className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--pf-accent)] focus-within:ring-offset-2">
              <input
                id="consent-sensitive-health"
                type="checkbox"
                checked={sensitiveHealth}
                onChange={(event) => setSensitiveHealth(event.target.checked)}
                className="h-5 w-5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)]"
                style={{ accentColor: "var(--pf-accent)" }}
              />
              <span>[필수] 민감정보(건강 정보) 처리에 동의합니다.</span>
            </label>
            <dl className="mt-2 space-y-3 px-2 text-sm leading-6">
              {sensitiveHealthNotices.map(([label, detail]) => (
                <div key={label}>
                  <dt className="font-bold text-pf-text">{label}</dt>
                  <dd className="text-pf-subtext">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="min-h-11 self-start rounded-lg px-2 text-sm font-bold text-[var(--pf-accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)]"
        >
          전체 개인정보 처리방침 보기
        </button>

        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleAgree()}
            disabled={!canStart || saving || signingOut}
            className="min-h-12 w-full rounded-2xl px-5 py-3 font-extrabold text-white transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)] disabled:cursor-not-allowed disabled:opacity-45"
            style={{ backgroundColor: canStart && !saving ? "var(--pf-action)" : "var(--pf-divider)" }}
          >
            {saving ? "저장 중..." : "동의하고 시작하기"}
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={saving || signingOut}
            className="min-h-11 w-full rounded-2xl px-5 py-3 text-sm font-bold text-pf-subtext focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)] disabled:opacity-50"
          >
            {signingOut ? "로그아웃 중..." : "동의하지 않고 로그아웃"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} dark={dark} />}
      </AnimatePresence>
    </main>
  );
}
