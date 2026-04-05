import { useState, useEffect } from "react";

/**
 * localStorage에 값을 영속 저장하는 커스텀 훅
 * JSON 파싱 실패 시 초기값으로 fallback
 */
export function usePersisted<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // localStorage quota 초과 시 무시
    }
  }, [key, val]);

  return [val, setVal] as const;
}
