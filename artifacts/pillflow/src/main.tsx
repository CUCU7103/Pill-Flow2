import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { defineCustomElements } from "@ionic/pwa-elements/loader";
import { supabase } from "@/lib/supabase";
import { parseOAuthCallback } from "@/lib/oauthCallback";
import App from "./App";
import "./index.css";

// 웹 브라우저에서 Capacitor Camera 카메라 시트를 표시하기 위한 PWA Elements 초기화
// 네이티브(Android/iOS)에서는 불필요하지만 호출해도 무해함
defineCustomElements(window);

/**
 * 네이티브 앱(Android/iOS)에서 Google OAuth 콜백 처리
 * 저장된 PKCE verifier 검증으로 앱 재시작 후에도 authorization code를 교환한다.
 */
if (Capacitor.isNativePlatform()) {
  const handledUrls = new Set<string>();
  const errorMessage = "로그인을 완료하지 못했어요. 다시 시도해 주세요.";
  const handleOAuthCallback = async ({ url }: { url: string }) => {
    const callback = parseOAuthCallback(url);
    if (!callback || handledUrls.has(url)) return;

    // 초기 실행 URL과 이벤트가 같은 콜백을 전달해도 비동기 교환 전에 한 번만 접수한다.
    handledUrls.add(url);

    try {
      if ("error" in callback) {
        toast.error(errorMessage);
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (error) throw error;
    } catch {
      // 콜백 URL, 인증 코드, 공급자 오류 원문은 로그나 사용자 메시지에 노출하지 않는다.
      toast.error(errorMessage);
    }
  };

  CapApp.addListener("appUrlOpen", handleOAuthCallback);
  CapApp.getLaunchUrl()
    .then(async launchUrl => {
      if (launchUrl) await handleOAuthCallback(launchUrl);
    })
    .catch(() => toast.error(errorMessage));
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {/* visibleToasts={1}: 동시에 하나의 토스트만 표시, 새 토스트 발생 시 이전 토스트 자동 제거 */}
    <Toaster position="top-center" richColors visibleToasts={1} toastOptions={{ duration: 2500 }} />
  </>,
);
