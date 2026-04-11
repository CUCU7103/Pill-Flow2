import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { supabase } from "@/lib/supabase";
import App from "./App";
import "./index.css";

/**
 * 네이티브 앱(Android/iOS)에서 Google OAuth 콜백 처리
 * com.pillflow.app://callback?access_token=...&refresh_token=... 형태의
 * 딥링크를 Supabase가 처리할 수 있도록 세션을 복원한다
 */
if (Capacitor.isNativePlatform()) {
  CapApp.addListener("appUrlOpen", async ({ url }) => {
    if (url.startsWith("com.pillflow.app://callback")) {
      // URL 파라미터에서 토큰을 추출해 Supabase 세션 설정
      const params = new URLSearchParams(url.split("#")[1] ?? url.split("?")[1] ?? "");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {/* visibleToasts={1}: 동시에 하나의 토스트만 표시, 새 토스트 발생 시 이전 토스트 자동 제거 */}
    <Toaster position="top-center" richColors visibleToasts={1} toastOptions={{ duration: 2500 }} />
  </>,
);
