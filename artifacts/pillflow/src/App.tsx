import { useCallback, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { usePersisted } from "@/hooks/use-persisted";
import { useDarkMode } from "@/hooks/use-theme";
import { useAndroidBackButton } from "@/hooks/use-android-back-button";
import { useMedications } from "@/hooks/use-medications";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useDayChange } from "@/hooks/use-day-change";
import { useConsent } from "@/hooks/use-consent";
import { isConsentComplete, type ConsentType } from "@/lib/consentUtils";
import { BottomNav } from "@/components/common/BottomNav";
import { TodayView } from "@/components/views/TodayView";
import { AddView } from "@/components/views/AddView";
import { StatsView } from "@/components/views/StatsView";
import { ConsentView } from "@/components/views/ConsentView";
import { LoginView } from "@/components/views/LoginView";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { DAY_KEYS_SUN_FIRST } from "@/constants";
import type { View, Medication, NotifCategories } from "@/types";

/** 공통 로딩 스피너 */
function LoadingSpinner() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-pf-bg">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[var(--pf-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-pf-subtext font-medium">정보를 불러오고 있어요</p>
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = usePersisted<boolean>("pillflow_dark", false);
  useDarkMode(dark);

  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const consent = useConsent(user?.id);
  const handleConsentRequired = useCallback(() => {
    void consent.reload();
  }, [consent.reload]);
  const recordPhotoConsent = useCallback(() => consent.save(["photo_analysis"]), [consent.save]);

  if (authLoading) return <LoadingSpinner />;
  if (!user) return <LoginView onSignIn={signInWithGoogle} />;
  if (consent.loading) return <LoadingSpinner />;

  if (consent.error) {
    return (
      <main className="min-h-full bg-pf-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-3xl bg-pf-card border border-pf-divider p-6 text-center">
          <h1 className="text-xl font-bold text-pf-text">동의 상태를 불러오지 못했어요</h1>
          <p className="mt-2 text-sm text-pf-subtext">연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => void consent.reload()}
            className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--pf-action)] text-white font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)]"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (!isConsentComplete(consent.status)) {
    return (
      <ConsentView
        status={consent.status}
        dark={dark}
        onAgree={(types: ConsentType[]) => consent.save(types)}
        onSignOut={signOut}
      />
    );
  }

  return (
    <AuthenticatedApp
      user={user}
      dark={dark}
      setDark={setDark}
      signOut={signOut}
      photoAnalysis={Boolean(consent.status?.photoAnalysis)}
      onPhotoConsent={recordPhotoConsent}
      onConsentRequired={handleConsentRequired}
    />
  );
}

/** 필수 동의가 끝난 뒤에만 마운트해 약·통계 조회가 동의 화면보다 먼저 실행되지 않게 한다. */
function AuthenticatedApp({
  user,
  dark,
  setDark,
  signOut,
  photoAnalysis,
  onPhotoConsent,
  onConsentRequired,
}: {
  user: User;
  dark: boolean;
  setDark: (value: boolean) => void;
  signOut: () => Promise<void>;
  photoAnalysis: boolean;
  onPhotoConsent: () => Promise<unknown>;
  onConsentRequired: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<View>("today");
  const [notif, setNotif] = usePersisted<boolean>("pillflow_notif", true);
  const [notifCategories, setNotifCategories] = usePersisted<NotifCategories>(
    "pillflow_notif_categories",
    { morning: true, lunch: true, evening: true },
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    meds,
    loading: medsLoading,
    error: medsError,
    addMed,
    deleteMed,
    toggleMed,
    resetAll,
    refetch: refetchMeds,
  } = useMedications(user.id, onConsentRequired);
  useNotifications(meds, notif, notifCategories);
  useDayChange(refetchMeds);

  const handleToggle = useCallback(
    async (id: string) => {
      const med = meds.find((m) => m.id === id);
      try {
        await toggleMed(id);
        if (med) {
          toast.dismiss();
          toast.success(med.completed ? `${med.name} 복용 취소` : `${med.name} 복용 완료`);
        }
      } catch {
        toast.dismiss();
        toast.error("처리에 실패했습니다. 다시 시도해주세요.");
      }
    },
    [meds, toggleMed],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const med = meds.find((m) => m.id === id);
      try {
        await deleteMed(id);
        if (med) toast.success(`${med.name} 삭제됨`);
      } catch {
        toast.error("삭제에 실패했습니다. 다시 시도해주세요.");
      }
    },
    [meds, deleteMed],
  );

  const handleAdd = useCallback(
    async (m: Omit<Medication, "id" | "completed">) => {
      await addMed(m);
      toast.success(`${m.name} 추가됨`);
    },
    [addMed],
  );

  const handleToggleNotif = useCallback(() => {
    setNotif((prev) => !prev);
  }, [setNotif]);

  const handleToggleCategory = useCallback(
    (key: keyof NotifCategories) => {
      setNotifCategories((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [setNotifCategories],
  );

  useAndroidBackButton(view, settingsOpen, {
    onNavigateToday: () => setView("today"),
    onCloseSettings: () => setSettingsOpen(false),
  });

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setSettingsOpen(false);
      toast.success("로그아웃되었습니다");
    } catch {
      toast.error("로그아웃 실패");
    }
  }, [signOut]);

  if (medsLoading) return <LoadingSpinner />;

  if (medsError && meds.length === 0) {
    return (
      <main className="min-h-full bg-pf-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-3xl bg-pf-card border border-pf-divider p-6 text-center">
          <h1 className="text-xl font-bold text-pf-text">약 정보를 불러오지 못했어요</h1>
          <p className="mt-2 text-sm text-pf-subtext">연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => void refetchMeds()}
            className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--pf-action)] text-white font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent)]"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  const todayKey = DAY_KEYS_SUN_FIRST[new Date().getDay()];
  const todayMeds = meds.filter((m) => m.days.includes(todayKey));

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: "var(--pf-bg)" }}>
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "today" && (
            <motion.div
              key="today"
              className="h-full"
              initial={reduceMotion ? false : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <TodayView
                meds={todayMeds}
                allMeds={meds}
                hasAnyMeds={meds.length > 0}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onAddClick={() => setView("add")}
                dark={dark}
                onOpenSettings={() => setSettingsOpen(true)}
                notifEnabled={notif}
                onToggleNotif={handleToggleNotif}
                categories={notifCategories}
                onToggleCategory={handleToggleCategory}
              />
            </motion.div>
          )}
          {view === "add" && (
            <motion.div
              key="add"
              className="h-full"
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <AddView onBack={() => setView("today")} onSave={handleAdd} dark={dark} photoAnalysis={photoAnalysis} onPhotoConsent={onPhotoConsent} />
            </motion.div>
          )}
          {view === "stats" && (
            <motion.div
              key="stats"
              className="h-full"
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <StatsView meds={meds} dark={dark} userId={user.id} onConsentRequired={onConsentRequired} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav view={view} setView={setView} dark={dark} />
      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            dark={dark}
            onToggleDark={() => setDark(!dark)}
            notif={notif}
            onToggleNotif={handleToggleNotif}
            user={user}
            onSignOut={handleSignOut}
            onResetAll={resetAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
