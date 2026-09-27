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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notifyConsentRequired = useCallback((err: unknown) => {
    if (isConsentRequiredError(err)) onConsentRequired?.();
  }, [onConsentRequired]);

  // 약 목록 + 오늘 복용 기록 조회 (userId 기준으로 필터)
  const fetchMeds = useCallback(async () => {
    // 로그인 전이면 데이터 초기화
    if (!userId) {
      setMeds([]);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchMedications(userId);
      setMeds(data);
      setError(null);
    } catch (err) {
      notifyConsentRequired(err);
      setError(err instanceof Error ? err.message : "데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [userId, notifyConsentRequired]);

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
      if (!userId) throw new Error("로그인이 필요합니다.");
      try {
        const med = await addMedication(userId, data);
        setMeds((prev) => [...prev, med]);
        return med;
      } catch (err) {
        notifyConsentRequired(err);
        throw err;
      }
    },
    [userId, notifyConsentRequired],
  );

  // 약 삭제
  const deleteMed = useCallback(async (id: string) => {
    try {
      await deleteMedication(id);
      setMeds((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      notifyConsentRequired(err);
      throw err;
    }
  }, [notifyConsentRequired]);

  // 현재 처리 중인 약 ID 집합 — 더블 클릭 시 중복 요청 방지
  const pendingIds = useRef<Set<string>>(new Set());

  // 복용 토글 (낙관적 업데이트 — 실패 시 롤백)
  const toggleMed = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      if (pendingIds.current.has(id)) return;
      const med = meds.find((m) => m.id === id);
      if (!med) return;
      const wasCompleted = med.completed;
      pendingIds.current.add(id);
      setMeds((prev) =>
        prev.map((m) => (m.id === id ? { ...m, completed: !wasCompleted } : m)),
      );

      try {
        await toggleMedicationLog(id, userId, wasCompleted);
      } catch (err) {
        notifyConsentRequired(err);
        // 실패 시 낙관적 업데이트 롤백
        setMeds((prev) =>
          prev.map((m) => (m.id === id ? { ...m, completed: wasCompleted } : m)),
        );
        throw err;
      } finally {
        pendingIds.current.delete(id);
      }
    },
    [meds, userId, notifyConsentRequired],
  );

  // 현재 유저의 모든 데이터 초기화
  const resetAll = useCallback(async () => {
    if (!userId) return;
    try {
      await resetAllMedications(userId);
      setMeds([]);
    } catch (err) {
      notifyConsentRequired(err);
      throw err;
    }
  }, [userId, notifyConsentRequired]);

  return { meds, loading, error, addMed, deleteMed, toggleMed, refetch: fetchMeds, resetAll };
}
