import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // 앱 고유 식별자 (Play Store에 한 번 등록하면 변경 불가)
  appId: "com.pillflow.app",
  appName: "PillFlow",
  // Vite 빌드 출력 디렉토리
  webDir: "dist/public",
  server: {
    // HTTPS 스킴 사용 (Supabase Auth 쿠키 처리에 필요)
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#F5F7FF",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    LocalNotifications: {
      // 알림 아이콘 (Android res/drawable에 추가 필요)
      smallIcon: "ic_stat_pill",
      iconColor: "#6C63FF",
    },
    StatusBar: {
      // 상태바를 앱 배경색과 통일
      style: "LIGHT",
      backgroundColor: "#F5F7FF",
    },
  },
};

export default config;
