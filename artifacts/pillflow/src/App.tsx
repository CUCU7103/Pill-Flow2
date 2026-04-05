import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { usePersisted } from "@/hooks/use-persisted";
import { useDarkMode } from "@/hooks/use-theme";
import { useMedications } from "@/hooks/use-medications";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
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
  const { meds, loading: medsLoading, addMed, deleteMed, toggleMed } = useMedications(user?.id);

  // 복약 알림 스케줄링 (네이티브 앱에서만 동작)
  useNotifications(meds, notif);

  const handleToggle = useCallback(async (id: string) => {
    const med = meds.find((m) => m.id === id);
    if (med) {
      toast.success(med.completed ? `${med.name} 복용 취소` : `${med.name} 복용 완료`);
    }
    await toggleMed(id);
  }, [meds, toggleMed]);

  const handleDelete = useCallback(async (id: string) => {
    const med = meds.find((m) => m.id === id);
    await deleteMed(id);
    if (med) toast.success(`${med.name} 삭제됨`);
  }, [meds, deleteMed]);

  const handleAdd = useCallback(async (m: Omit<Medication, "id" | "completed">) => {
    await addMed(m);
    toast.success(`${m.name} 추가됨`);
  }, [addMed]);

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
                meds={meds}
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
              <StatsView meds={meds} dark={dark} />
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
