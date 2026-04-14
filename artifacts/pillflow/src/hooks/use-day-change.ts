import { useEffect } from "react";

/**
 * 자정(00:00)이 지나면 callback을 호출하는 훅.
 * 앱이 자정을 넘겨 열린 채로 있을 때 복약 데이터를 자동 리셋하기 위해 사용한다.
 */
export function useDayChange(callback: () => void) {
  useEffect(() => {
    // 현재 활성 타이머 ID를 객체로 관리 — 재귀 호출 후에도 cleanup이 최신 타이머를 해제하도록 함.
    // 단순 변수로는 첫 번째 타이머만 cleanup되고 두 번째부터 누수가 발생한다.
    const timerRef = { current: 0 as ReturnType<typeof setTimeout> };

    function scheduleMidnight() {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        100, // 자정 + 100ms 여유
      );
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      // timerRef에 덮어쓰므로 cleanup 시 항상 최신 타이머 ID가 해제됨
      timerRef.current = setTimeout(() => {
        callback();
        // 자정 이후 다음 자정도 감지하기 위해 재귀 스케줄링
        scheduleMidnight();
      }, msUntilMidnight);
    }

    scheduleMidnight();
    // userId 변경 시 컴포넌트가 재마운트되므로 stale callback 참조 위험 없음
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearTimeout(timerRef.current);
  }, []);
}
