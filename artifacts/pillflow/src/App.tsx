import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { usePersisted } from "@/hooks/use-persisted";
import { useDarkMode } from "@/hooks/use-theme";
import { useMedications } from "@/hooks/use-medications";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useDayChange } from "@/hooks/use-day-change";
import { BottomNav } from "@/components/common/BottomNav";
import { TodayView } from "@/components/views/TodayView";
import { AddView } from "@/components/views/AddView";
import { StatsView } from "@/components/views/StatsView";
import { LoginView } from "@/components/views/LoginView";
import { SettingsModal } from "@/components/modals/SettingsModal";
import type { View, Medication } from "@/types";

/** 공통 로딩 스피너 */
function LoadingSpinner() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-pf-bg">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-pf-subtext font-medium">로딩 중...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("today");
  const [dark, setDark] = usePersisted<boolean>("pillflow_dark", false);
  const [notif, setNotif] = usePersisted<boolean>("pillflow_notif", true);
  const [alarm, setAlarm] = usePersisted<string>("pillflow_alarm", "08:00");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // html 요소에 dark 클래스 동기화 (인증 여부와 무관하게 항상 적용)
  useDarkMode(dark);

  // 인증 상태 관리
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  // Supabase 기반 약 데이터 (로그인 후에만 사용)
  // user.id를 전달해 RLS insert 시 user_id가 포함되도록 함
  const { meds, loading: medsLoading, addMed, deleteMed, toggleMed, resetAll, refetch: refetchMeds } = useMedications(user?.id);

  // 복약 알림 스케줄링 (네이티브 앱에서만 동작)
  useNotifications(meds, notif);

  // 자정이 지나면 복약 데이터 재조회 (completed 상태 리셋)
  useDayChange(refetchMeds);

  const handleToggle = useCallback(async (id: string) => {
    const med = meds.find((m) => m.id === id);
    try {
      await toggleMed(id);
      if (med) {
        // 이전 토스트를 모두 제거하고 새 토스트 표시 (중복 쌓임 방지)
        toast.dismiss();
        toast.success(med.completed ? `${med.name} 복용 취소` : `${med.name} 복용 완료`);
      }
    } catch {
      toast.dismiss();
      toast.error("처리에 실패했습니다. 다시 시도해주세요.");
    }
  }, [meds, toggleMed]);

  const handleDelete = useCallback(async (id: string) => {
    const med = meds.find((m) => m.id === id);
    try {
      await deleteMed(id);
      if (med) toast.success(`${med.name} 삭제됨`);
    } catch {
      toast.error("삭제에 실패했습니다. 다시 시도해주세요.");
    }
  }, [meds, deleteMed]);

  const handleAdd = useCallback(async (m: Omit<Medication, "id" | "completed">) => {
    await addMed(m); // 실패 시 throw → AddView에서 에러 토스트 처리
    toast.success(`${m.name} 추가됨`);
  }, [addMed]);

  // 두 번 누르면 종료 패턴을 위한 ref
  const backPressedRef = useRef(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 네이티브 앱(Android)에서만 뒤로가기 버튼 처리
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapApp.addListener("backButton", () => {
      // 설정 모달이 열려있으면 모달을 닫음
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      // add/stats 뷰에서는 today로 이동
      if (view !== "today") {
        setView("today");
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
  }, [view, settingsOpen]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setSettingsOpen(false);
      toast.success("로그아웃되었습니다");
    } catch {
      toast.error("로그아웃 실패");
    }
  }, [signOut]);

  // Google OAuth 세션 확인 중
  if (authLoading) return <LoadingSpinner />;

  // 미로그인 → 로그인 화면 표시
  if (!user) return <LoginView onSignIn={signInWithGoogle} />;

  // 약 데이터 로딩 중
  if (medsLoading) return <LoadingSpinner />;

  // 오늘 요일 키 계산 (일=0, 월=1 ... 토=6 → DB 키로 변환)
  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
  const todayKey = DAY_KEYS[new Date().getDay()];

  // 오늘 복용해야 할 약만 필터링 (로그인 + 로딩 완료 후에만 실행)
  const todayMeds = meds.filter((m) => m.days.includes(todayKey));

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "today" && (
            <motion.div
              key="today"
              className="h-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <TodayView
                meds={todayMeds}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onAddClick={() => setView("add")}
                dark={dark}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </motion.div>
          )}
          {view === "add" && (
            <motion.div
              key="add"
              className="h-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <AddView onBack={() => setView("today")} onSave={handleAdd} dark={dark} />
            </motion.div>
          )}
          {view === "stats" && (
            <motion.div
              key="stats"
              className="h-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <StatsView meds={meds} dark={dark} userId={user?.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 하단 네비게이션 */}
      <BottomNav view={view} setView={setView} dark={dark} />

      {/* 설정 모달 */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            dark={dark}
            onToggleDark={() => setDark(!dark)}
            notif={notif}
            onToggleNotif={() => setNotif(!notif)}
            alarm={alarm}
            onAlarmChange={setAlarm}
            user={user}
            onSignOut={handleSignOut}
            onResetAll={resetAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
