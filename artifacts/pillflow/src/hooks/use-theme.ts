import { useEffect } from "react";

/**
 * 다크모드를 html 요소의 클래스로 관리하는 훅
 * CSS 변수는 index.css에서 :root / .dark로 정의됨
 */
export function useDarkMode(dark: boolean) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
}

/**
 * 하위 호환용: 기존 컴포넌트에서 인라인 스타일로 테마 색상을 사용하는 경우
 * 점진적으로 CSS 변수 유틸리티 클래스로 마이그레이션 후 제거 예정
 */
export function useTheme(_dark: boolean) {
  return {
    bg: "var(--pf-bg)",
    card: "var(--pf-card)",
    surface: "var(--pf-surface)",
    text: "var(--pf-text)",
    subtext: "var(--pf-subtext)",
    divider: "var(--pf-divider)",
    navBg: "var(--pf-nav-bg)",
  };
}
