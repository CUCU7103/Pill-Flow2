import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

/** Google OAuth 인증 상태를 관리하는 훅 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 로그인/로그아웃 등 인증 상태 변화 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Google OAuth 로그인
   * - 웹: Google 인증 페이지로 리디렉션 → 완료 후 앱 루트로 돌아옴
   * - 네이티브(Android/iOS): 커스텀 URL 스킴 딥링크로 복귀
   *   Supabase Dashboard > Authentication > URL Configuration에
   *   'com.pillflow.app://callback' 추가 필요
   */
  const signInWithGoogle = async () => {
    const redirectTo = Capacitor.isNativePlatform()
      ? "com.pillflow.app://callback"
      : window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
    if (error) throw error;
  };

  /** 로그아웃 - 세션 제거 후 로그인 화면으로 이동 */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { user, loading, signInWithGoogle, signOut };
}
