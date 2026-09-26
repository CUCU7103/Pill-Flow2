/** 접근 가능한 설정 스위치. */
export function Toggle({
  on,
  onToggle,
  ariaLabel,
  disabled = false,
}: {
  on: boolean;
  onToggle: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-label={ariaLabel}
      aria-checked={on}
      disabled={disabled}
      className="relative flex h-11 w-12 shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)] disabled:opacity-40"
    >
      <span className="h-7 w-12 rounded-full transition-colors" style={{ backgroundColor: on ? "var(--pf-action)" : "var(--pf-divider)" }} />
      <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform" style={{ transform: on ? "translateX(20px)" : "none" }} />
    </button>
  );
}
