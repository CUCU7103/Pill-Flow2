import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Medication, Category, MedType } from "@/types";

/** DB 행을 프론트엔드 Medication 타입으로 변환 */
function toMedication(row: Record<string, unknown>, completedIds: Set<string>): Medication {
  return {
    id: row.id as string,
    name: row.name as string,
    dosage: row.dosage as string,
    dosageAmount: row.dosage_amount as number,
    remainingQuantity: row.remaining_quantity as number,
    time: row.time as string,
    category: row.category as Category,
    type: row.type as MedType,
    color: row.color as string,
    completed: completedIds.has(row.id as string),
  };
}

/** 오늘 날짜 문자열 (YYYY-MM-DD) */
function getToday() {
  return new Date().toISOString().split("T")[0];
}

/**
 * 복약 데이터를 관리하는 훅
 * @param userId 현재 로그인한 사용자 ID - insert 시 user_id 컬럼에 포함
 */
export function useMedications(userId?: string) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 약 목록 + 오늘 복용 기록 조회
  const fetchMeds = useCallback(async () => {
    try {
      const today = getToday();

      const [medsRes, logsRes] = await Promise.all([
        supabase.from("medications").select("*").order("created_at"),
        supabase.from("medication_logs").select("medication_id").eq("date", today),
      ]);

      if (medsRes.error) throw medsRes.error;
      if (logsRes.error) throw logsRes.error;

      const completedIds = new Set(
        (logsRes.data ?? []).map((l: { medication_id: string }) => l.medication_id),
      );

      setMeds((medsRes.data ?? []).map((row) => toMedication(row, completedIds)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeds();
  }, [fetchMeds]);

  // 약 추가
  const addMed = useCallback(
    async (data: {
      name: string;
      dosage: string;
      dosageAmount: number;
      remainingQuantity: number;
      time: string;
      category: Category;
      type: MedType;
      color: string;
    }) => {
      const { data: row, error: err } = await supabase
        .from("medications")
        .insert({
          name: data.name,
          dosage: data.dosage,
          dosage_amount: data.dosageAmount,
          remaining_quantity: data.remainingQuantity,
          time: data.time,
          category: data.category,
          type: data.type,
          color: data.color,
        })
        .select()
        .single();

      if (err) throw err;
      const med = toMedication(row, new Set());
      setMeds((prev) => [...prev, med]);
      return med;
    },
    [],
  );

  // 약 삭제
  const deleteMed = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("medications").delete().eq("id", id);
    if (err) throw err;
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // 복용 토글
  const toggleMed = useCallback(async (id: string) => {
    const today = getToday();

    setMeds((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m)),
    );

    const med = meds.find((m) => m.id === id);
    if (!med) return;

    try {
      if (!med.completed) {
        // 복용 기록 추가
        const { error: err } = await supabase
          .from("medication_logs")
          .insert({ medication_id: id, date: today });
        if (err) throw err;
      } else {
        // 복용 기록 삭제 (오늘 것만)
        const { error: err } = await supabase
          .from("medication_logs")
          .delete()
          .eq("medication_id", id)
          .eq("date", today);
        if (err) throw err;
      }
    } catch (err) {
      // DB 실패 시 낙관적 업데이트 롤백
      setMeds((prev) =>
        prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m)),
      );
      throw err;
    }
  }, [meds]);

  /** 모든 복용 기록과 약 데이터를 삭제 (RLS로 본인 데이터만 삭제됨) */
  const resetAll = useCallback(async () => {
    // medication_logs → medications 순서로 삭제 (외래 키 의존성)
    const { error: logsErr } = await supabase
      .from("medication_logs")
      .delete()
      .neq("medication_id", "");
    if (logsErr) throw logsErr;

    const { error: medsErr } = await supabase
      .from("medications")
      .delete()
      .neq("id", "");
    if (medsErr) throw medsErr;

    setMeds([]);
  }, []);

  return { meds, loading, error, addMed, deleteMed, toggleMed, refetch: fetchMeds, resetAll };
}

// ─── 통계 훅 ─────────────────────────────────────────────────────────────────
export function useStats(totalMeds: number) {
  const [weeklyData, setWeeklyData] = useState<{ day: string; rate: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const days = ["일", "월", "화", "수", "목", "금", "토"];
        const stats: { day: string; rate: number }[] = [];
        const total = totalMeds || 1;

        // 최근 7일 복용 기록 조회
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }

        const { data: logs, error: err } = await supabase
          .from("medication_logs")
          .select("medication_id, date")
          .in("date", dates);

        if (err) throw err;

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const dayLogs = (logs ?? []).filter((l: { date: string }) => l.date === dateStr);
          const uniqueMeds = new Set(dayLogs.map((l: { medication_id: string }) => l.medication_id));
          const rate = Math.round((uniqueMeds.size / total) * 100);
          stats.push({ day: days[d.getDay()], rate });
        }

        setWeeklyData(stats);

        // 연속 일수 계산
        let s = 0;
        for (let i = 1; i <= 365; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const dayLogs = (logs ?? []).filter((l: { date: string }) => l.date === dateStr);
          const uniqueMeds = new Set(dayLogs.map((l: { medication_id: string }) => l.medication_id));
          if (uniqueMeds.size >= total) {
            s++;
          } else {
            break;
          }
        }
        setStreak(s);
      } catch {
        // 통계 로딩 실패 시 빈 데이터
        setWeeklyData([]);
        setStreak(0);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [totalMeds]);

  return { weeklyData, streak, loading };
}
