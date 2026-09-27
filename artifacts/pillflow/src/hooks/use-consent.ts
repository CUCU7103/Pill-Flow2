import { useCallback, useEffect, useRef, useState } from "react";
import { fetchConsentStatus, recordConsents } from "@/lib/consentDataSource";
import type { ConsentStatus, ConsentType } from "@/lib/consentUtils";

type ConsentState = {
  userId: string | null;
  status: ConsentStatus | null;
  loading: boolean;
  revalidating: boolean;
  error: string | null;
};

/** 로그인 사용자의 현재 처리방침 동의 상태를 조회·기록한다. */
export function useConsent(userId?: string | null) {
  const [state, setState] = useState<ConsentState>({ userId: null, status: null, loading: true, revalidating: false, error: null });
  const requestVersion = useRef(0);
  const latestUserId = useRef(userId);
  latestUserId.current = userId;

  const reload = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return;
    const requestVersionAtStart = ++requestVersion.current;
    setState((current) => current.userId === targetUserId && current.status !== null
      ? { ...current, loading: false, revalidating: true, error: null }
      : { userId: targetUserId, status: null, loading: true, revalidating: false, error: null });
    try {
      const status = await fetchConsentStatus(targetUserId);
      if (requestVersionAtStart !== requestVersion.current) return;
      setState({ userId: targetUserId, status, loading: false, revalidating: false, error: null });
    } catch (error) {
      if (requestVersionAtStart !== requestVersion.current) return;
      const message = error instanceof Error ? error.message : "동의 상태를 불러오지 못했어요.";
      setState((current) => {
        const preserveStatus = current.userId === targetUserId && current.status !== null;
        return {
          userId: targetUserId,
          status: preserveStatus ? current.status : null,
          loading: false,
          revalidating: false,
          error: message,
        };
      });
    }
  }, [userId]);

  const reloadCurrentUser = useCallback(() => reload(userId), [reload, userId]);

  useEffect(() => {
    if (!userId) {
      requestVersion.current++;
      setState({ userId: null, status: null, loading: false, revalidating: false, error: null });
      return;
    }
    void reload(userId);
  }, [userId, reload]);

  const save = useCallback(async (types: ConsentType[]) => {
    if (!userId) throw new Error("로그인이 필요합니다.");
    const status = await recordConsents(userId, types);
    if (latestUserId.current === userId) {
      setState((current) => ({
        userId,
        status: { ...(current.userId === userId ? current.status : null), ...status },
        loading: false,
        revalidating: false,
        error: null,
      }));
    }
    return status;
  }, [userId]);

  const stateMatchesUser = Boolean(userId && state.userId === userId);
  return {
    status: stateMatchesUser ? state.status : null,
    loading: Boolean(userId && (!stateMatchesUser || state.loading)),
    revalidating: stateMatchesUser && state.revalidating,
    error: stateMatchesUser ? state.error : null,
    reload: reloadCurrentUser,
    save,
  };
}
