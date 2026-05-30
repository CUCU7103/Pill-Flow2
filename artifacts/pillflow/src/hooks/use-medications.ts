import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMedications,
  addMedication,
  deleteMedication,
  toggleMedicationLog,
  resetAllMedications,
} from "@/lib/medicationRepository";
import type { Medication, MedType } from "@/types";

/**
 * 복약 데이터를 관리하는 훅.
 * DB 접근은 medicationRepository, 데이터 변환은 medicationMapper에 위임한다.
 * @param userId 현재 로그인한 사용자 ID
 */
export function useMedications(userId?: string | null) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
      const med = await addMedication(userId, data);
      setMeds((prev) => [...prev, med]);
      return med;
    },
    [userId],
  );

  // 약 삭제
  const deleteMed = useCallback(async (id: string) => {
    await deleteMedication(id);
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // 현재 처리 중인 약 ID 집합 — 더블 클릭 시 중복 요청 방지
  const pendingIds = useRef<Set<string>>(new Set());

  // 복용 토글 (낙관적 업데이트 — 실패 시 롤백)
  const toggleMed = useCallback(
    async (id: string) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      if (pendingIds.current.has(id)) return;
      pendingIds.current.add(id);

      let wasCompleted: boolean | null = null;

      setMeds((prev) => {
        const med = prev.find((m) => m.id === id);
        if (!med) return prev;
        wasCompleted = med.completed;
        return prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m));
      });

      if (wasCompleted === null) {
        pendingIds.current.delete(id);
        return;
      }

      try {
        await toggleMedicationLog(id, userId, wasCompleted);
      } catch (err) {
        // 실패 시 낙관적 업데이트 롤백
        setMeds((prev) =>
          prev.map((m) => (m.id === id ? { ...m, completed: wasCompleted as boolean } : m)),
        );
        throw err;
      } finally {
        pendingIds.current.delete(id);
      }
    },
    [userId],
  );

  // 현재 유저의 모든 데이터 초기화
  const resetAll = useCallback(async () => {
    if (!userId) return;
    await resetAllMedications(userId);
    setMeds([]);
  }, [userId]);

  return { meds, loading, error, addMed, deleteMed, toggleMed, refetch: fetchMeds, resetAll };
}
