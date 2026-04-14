import { useEffect } from "react";

/**
 * 자정(00:00)이 지나면 callback을 호출하는 훅.
 * 앱이 자정을 넘겨 열린 채로 있을 때 복약 데이터를 자동 리셋하기 위해 사용한다.
 */
export function useDayChange(callback: () => void) {
  useEffect(() => {
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

      const timer = setTimeout(() => {
        callback();
        // 자정 이후 다음 자정도 감지하기 위해 재귀 스케줄링
        scheduleMidnight();
      }, msUntilMidnight);

      return timer;
    }

    const timer = scheduleMidnight();
    return () => clearTimeout(timer);
    // callback이 바뀌어도 타이머를 재설정하지 않도록 의존성 배열 비움
    // (App.tsx에서 useCallback으로 감싼 refetch를 전달하므로 안전)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
