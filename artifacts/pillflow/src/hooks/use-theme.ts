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
export function useTheme(dark: boolean) {
  return {
    bg: dark ? "#0D1117" : "#F5F7FF",
    card: dark ? "#161B22" : "#FFFFFF",
    surface: dark ? "#111827" : "#F9FAFB",
    text: dark ? "#F0F6FC" : "#111827",
    subtext: dark ? "#8B949E" : "#6B7280",
    divider: dark ? "#21262D" : "#F3F4F6",
    navBg: dark ? "rgba(22,27,34,0.95)" : "rgba(255,255,255,0.95)",
  };
}
