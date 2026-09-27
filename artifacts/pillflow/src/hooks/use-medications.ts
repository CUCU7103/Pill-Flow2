import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMedications,
  addMedication,
  deleteMedication,
  toggleMedicationLog,
  resetAllMedications,
} from "@/lib/medicationDataSource";
import { isConsentRequiredError } from "@/lib/consentUtils";
import type { Medication, MedType } from "@/types";

/**
 * 복약 데이터를 관리하는 훅.
 * 데이터 소스 선택은 medicationDataSource, 데이터 변환은 각 저장소에 위임한다.
 * @param userId 현재 로그인한 사용자 ID
 */
export function useMedications(userId?: string | null, onConsentRequired?: () => void) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const scope = useRef({ userId, generation: 0, active: true });
  const fetchSequence = useRef(0);
  const pendingIds = useRef<Set<string>>(new Set());

  // 계정 전환을 렌더 단계에서 무효화해 effect 실행 전에도 이전 응답을 차단한다.
  if (scope.current.userId !== userId) {
    scope.current = { userId, generation: scope.current.generation + 1, active: true };
    pendingIds.current = new Set();
  }
  const owner = scope.current;
  const [stateOwner, setStateOwner] = useState(owner);
  const ownerChanged = stateOwner !== owner;
  if (ownerChanged) {
    setStateOwner(owner);
    setMeds([]);
    setError(null);
    setLoading(Boolean(userId));
  }

  const isCurrent = useCallback(() => owner.active
    && scope.current.generation === owner.generation
    && scope.current.userId === owner.userId, [owner]);

  useEffect(() => {
    owner.active = true;
    return () => { owner.active = false; };
  }, [owner]);

  const notifyConsentRequired = useCallback((err: unknown) => {
    if (isCurrent() && isConsentRequiredError(err)) onConsentRequired?.();
  }, [isCurrent, onConsentRequired]);

  // 약 목록 + 오늘 복용 기록 조회 (userId 기준으로 필터)
  const fetchMeds = useCallback(async () => {
    if (!isCurrent()) return;
    const sequence = ++fetchSequence.current;
    const isCurrentFetch = () => isCurrent() && sequence === fetchSequence.current;
    // 로그인 전이면 데이터 초기화
    if (!userId) {
      setMeds([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchMedications(userId);
      if (!isCurrentFetch()) return;
      setMeds(prev => isCurrentFetch() ? data : prev);
      setError(prev => isCurrentFetch() ? null : prev);
    } catch (err) {
      if (!isCurrentFetch()) return;
      notifyConsentRequired(err);
      setError(prev => isCurrentFetch() ? (err instanceof Error ? err.message : "데이터 로딩 실패") : prev);
    } finally {
      if (isCurrentFetch()) setLoading(prev => isCurrentFetch() ? false : prev);
    }
  }, [userId, isCurrent, notifyConsentRequired]);

  useEffect(() => {
    fetchMeds();
  }, [fetchMeds]);

  // 약 추가
  const addMed = useCallback(
    async (data: {
      name: string;
      dosage: string;
      memo: string;
      times: string[];
      type: MedType;
      color: string;
      days: string[];
    }) => {
      if (!userId || !isCurrent()) throw new Error("로그인이 필요합니다.");
      try {
        const med = await addMedication(userId, data);
        if (isCurrent()) setMeds(prev => isCurrent() ? [...prev, med] : prev);
        return med;
      } catch (err) {
        notifyConsentRequired(err);
        throw err;
      }
    },
    [userId, isCurrent, notifyConsentRequired],
  );

  // 약 삭제
  const deleteMed = useCallback(async (id: string) => {
    if (!userId || !isCurrent()) throw new Error("로그인이 필요합니다.");
    try {
      await deleteMedication(id);
      if (isCurrent()) setMeds(prev => isCurrent() ? prev.filter(m => m.id !== id) : prev);
    } catch (err) {
      notifyConsentRequired(err);
      throw err;
    }
  }, [userId, isCurrent, notifyConsentRequired]);

  // 복용 토글 (낙관적 업데이트 — 실패 시 롤백)
  const toggleMed = useCallback(
    async (id: string) => {
      if (!userId || !isCurrent()) throw new Error("로그인이 필요합니다.");
      // 이전 계정 요청의 finally가 현재 계정의 중복 방지 상태를 해제하지 않도록 캡처한다.
      const pending = pendingIds.current;
      if (pending.has(id)) return;
      const med = meds.find((m) => m.id === id);
      if (!med) return;
      const wasCompleted = med.completed;
      pending.add(id);
      setMeds((prev) =>
        isCurrent() ? prev.map((m) => (m.id === id ? { ...m, completed: !wasCompleted } : m)) : prev,
      );

      try {
        await toggleMedicationLog(id, userId, wasCompleted);
      } catch (err) {
        notifyConsentRequired(err);
        // 실패 시 낙관적 업데이트 롤백
        if (isCurrent()) setMeds((prev) =>
          isCurrent() ? prev.map((m) => (m.id === id ? { ...m, completed: wasCompleted } : m)) : prev,
        );
        throw err;
      } finally {
        pending.delete(id);
      }
    },
    [meds, userId, isCurrent, notifyConsentRequired],
  );

  // 현재 유저의 모든 데이터 초기화
  const resetAll = useCallback(async () => {
    if (!userId || !isCurrent()) return;
    try {
      await resetAllMedications(userId);
      if (isCurrent()) setMeds(prev => isCurrent() ? [] : prev);
    } catch (err) {
      notifyConsentRequired(err);
      throw err;
    }
  }, [userId, isCurrent, notifyConsentRequired]);

  // 상태 초기화가 반영되기 전 렌더에서도 이전 계정 목록을 UI와 알림에 전달하지 않는다.
  return {
    meds: ownerChanged ? [] : meds,
    loading: ownerChanged ? Boolean(userId) : loading,
    error: ownerChanged ? null : error,
    addMed, deleteMed, toggleMed, refetch: fetchMeds, resetAll,
  };
}
