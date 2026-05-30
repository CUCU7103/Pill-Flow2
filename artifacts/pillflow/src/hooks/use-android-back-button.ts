import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { toast } from "sonner";
import type { View } from "@/types";

/**
 * Android 하드웨어 뒤로가기 버튼을 처리하는 훅.
 * 네이티브 앱에서만 동작하며 웹에서는 아무것도 하지 않는다.
 *
 * - 설정 모달 열림 → 모달 닫기
 * - add/stats 뷰 → today 뷰로 이동
 * - today 뷰 첫 누름 → "한 번 더 누르면 종료" 토스트
 * - today 뷰 2회 누름(2초 이내) → 앱 종료
 */
export function useAndroidBackButton(
  view: View,
  settingsOpen: boolean,
  callbacks: {
    onNavigateToday: () => void;
    onCloseSettings: () => void;
  },
) {
  const backPressedRef = useRef(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapApp.addListener("backButton", () => {
      // 설정 모달이 열려있으면 모달을 닫음
      if (settingsOpen) {
        callbacks.onCloseSettings();
        return;
      }
      // add/stats 뷰에서는 today로 이동
      if (view !== "today") {
        callbacks.onNavigateToday();
        return;
      }
      // today 뷰에서 이미 한 번 눌렀으면 앱 종료
      if (backPressedRef.current) {
        CapApp.exitApp();
        return;
      }
      // today 뷰에서 첫 번째 누름 → 2초 내 다시 누르면 종료 안내
      backPressedRef.current = true;
      toast("한 번 더 누르면 앱이 종료됩니다", { duration: 2000 });
      backTimerRef.current = setTimeout(() => {
        backPressedRef.current = false;
      }, 2000);
    });

    return () => {
      listenerPromise.then((l) => l.remove());
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, [view, settingsOpen, callbacks]);
}
