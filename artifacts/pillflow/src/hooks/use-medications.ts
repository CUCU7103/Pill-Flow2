import { useState, useEffect, useCallback, useRef } from "react";
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
    // DB 컬럼이 없는 구버전 데이터 대비 — 없으면 전체 요일로 fallback
    days: (row.days as string[] | null) ?? ["mon","tue","wed","thu","fri","sat","sun"],
    completed: completedIds.has(row.id as string),
  };
}

/**
 * 로컬 시간 기준 날짜 문자열 (YYYY-MM-DD).
 * toISOString()은 UTC 기준이므로 KST(UTC+9) 자정 전후 시간대에
 * 날짜가 어긋나는 문제를 방지하기 위해 로컬 날짜를 직접 계산한다.
 */
function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 오늘 날짜 문자열 (로컬 시간 기준, YYYY-MM-DD) */
function getToday() {
  return toLocalDateStr(new Date());
}

/**
 * 복약 데이터를 관리하는 훅
 * @param userId 현재 로그인한 사용자 ID - 모든 쿼리에서 해당 유저의 데이터만 조회/수정
 */
export function useMedications(userId?: string) {
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
      const today = getToday();

      // medications는 user_id 컬럼으로 현재 유저 데이터만 조회
      const [medsRes, logsRes] = await Promise.all([
        supabase.from("medications").select("*").eq("user_id", userId).order("created_at"),
        supabase.from("medication_logs").select("medication_id").eq("date", today),
      ]);

      if (medsRes.error) throw medsRes.error;
      if (logsRes.error) throw logsRes.error;

      // 현재 유저의 약 id 목록
      const myMedIds = new Set((medsRes.data ?? []).map((r: { id: string }) => r.id));

      // 오늘 복용 완료된 약 중 현재 유저 소유의 것만 필터
      const completedIds = new Set(
        (logsRes.data ?? [])
          .map((l: { medication_id: string }) => l.medication_id)
          .filter((id) => myMedIds.has(id)),
      );

      setMeds((medsRes.data ?? []).map((row) => toMedication(row, completedIds)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [userId]); // userId가 변경되면 재조회

  useEffect(() => {
    fetchMeds();
  }, [fetchMeds]);

  // 약 추가 - user_id 포함하여 insert
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
      days: string[];
    }) => {
      // 로그인 전에는 추가 불가
      if (!userId) throw new Error("로그인이 필요합니다.");

      const { data: row, error: err } = await supabase
        .from("medications")
        .insert({
          user_id: userId, // 현재 유저 소유로 저장
          name: data.name,
          dosage: data.dosage,
          dosage_amount: data.dosageAmount,
          remaining_quantity: data.remainingQuantity,
          time: data.time,
          category: data.category,
          type: data.type,
          color: data.color,
          days: data.days,
        })
        .select()
        .single();

      if (err) throw err;
      const med = toMedication(row, new Set());
      setMeds((prev) => [...prev, med]);
      return med;
    },
    [userId],
  );

  // 약 삭제
  const deleteMed = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("medications").delete().eq("id", id);
    if (err) throw err;
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // 현재 처리 중인 약 ID 집합 — 더블 클릭 시 중복 요청 방지
  const pendingIds = useRef<Set<string>>(new Set());

  // 복용 토글
  const toggleMed = useCallback(async (id: string) => {
    // 이미 처리 중인 약이면 무시 (더블 클릭 방지)
    if (pendingIds.current.has(id)) return;
    pendingIds.current.add(id);

    const today = getToday();

    // setMeds 콜백 안에서 최신 med를 읽어 stale closure 방지
    // 낙관적으로 completed + remainingQuantity를 동시에 업데이트
    let snapshot: {
      wasCompleted: boolean;
      previousRemaining: number;
      dosageAmount: number;
      newRemaining: number;
    } | null = null;

    setMeds((prev) => {
      const med = prev.find((m) => m.id === id);
      if (!med) return prev;
      const newRemaining = med.completed
        ? med.remainingQuantity + med.dosageAmount          // 체크 취소 → 복원
        : Math.max(0, med.remainingQuantity - med.dosageAmount); // 체크 ON → 차감
      snapshot = {
        wasCompleted: med.completed,
        previousRemaining: med.remainingQuantity,
        dosageAmount: med.dosageAmount,
        newRemaining,
      };
      return prev.map((m) =>
        m.id === id ? { ...m, completed: !m.completed, remainingQuantity: newRemaining } : m,
      );
    });

    // snapshot이 없으면 해당 id의 약이 없는 것 — 조기 종료
    // TypeScript가 setMeds 콜백 내 할당을 narrowing하지 못해 명시적 타입 단언 사용
    const s = snapshot as {
      wasCompleted: boolean;
      previousRemaining: number;
      dosageAmount: number;
      newRemaining: number;
    } | null;
    if (!s) {
      pendingIds.current.delete(id);
      return;
    }

    try {
      // 단일 RPC로 medication_logs 조작 + remaining_quantity 업데이트를 원자적 처리
      const { error: rpcErr } = await supabase.rpc("toggle_medication_today", {
        p_medication_id: id,
        p_date: today,
        p_dosage_amount: s.dosageAmount,
      });
      if (rpcErr) throw rpcErr;
    } catch (err) {
      // RPC 실패 시 낙관적 업데이트 롤백 (completed + remainingQuantity 모두 원복)
      setMeds((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, completed: s.wasCompleted, remainingQuantity: s.previousRemaining }
            : m,
        ),
      );
      throw err;
    } finally {
      pendingIds.current.delete(id);
    }
  }, []);

  /**
   * 현재 유저의 모든 복용 기록과 약 데이터를 삭제
   * medications 삭제 시 해당 유저 데이터만 필터링
   */
  const resetAll = useCallback(async () => {
    if (!userId) return;

    // 현재 유저의 약 id 목록 조회
    const { data: myMeds, error: fetchErr } = await supabase
      .from("medications")
      .select("id")
      .eq("user_id", userId);
    if (fetchErr) throw fetchErr;

    const myMedIds = (myMeds ?? []).map((m: { id: string }) => m.id);

    // 해당 약들의 복용 기록 삭제 (medication_logs → medications 순서)
    if (myMedIds.length > 0) {
      const { error: logsErr } = await supabase
        .from("medication_logs")
        .delete()
        .in("medication_id", myMedIds);
      if (logsErr) throw logsErr;
    }

    // 현재 유저의 약 삭제
    const { error: medsErr } = await supabase
      .from("medications")
      .delete()
      .eq("user_id", userId);
    if (medsErr) throw medsErr;

    setMeds([]);
  }, [userId]);

  return { meds, loading, error, addMed, deleteMed, toggleMed, refetch: fetchMeds, resetAll };
}

// ─── 통계 훅 ─────────────────────────────────────────────────────────────────
export function useStats(totalMeds: number, userId?: string) {
  const [weeklyData, setWeeklyData] = useState<{ day: string; rate: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // 로그인 전이면 빈 데이터
      if (!userId) {
        setWeeklyData([]);
        setStreak(0);
        setLoading(false);
        return;
      }

      try {
        const days = ["일", "월", "화", "수", "목", "금", "토"];
        const stats: { day: string; rate: number }[] = [];
        const total = totalMeds || 1;

        // 최근 7일 날짜 목록 생성 (로컬 시간 기준 — KST 자정 시간대 불일치 방지)
        const dates: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dates.push(toLocalDateStr(d));
        }

        // 현재 유저의 약 id 목록 조회
        const { data: myMeds, error: medsErr } = await supabase
          .from("medications")
          .select("id")
          .eq("user_id", userId);
        if (medsErr) throw medsErr;

        const myMedIds = (myMeds ?? []).map((m: { id: string }) => m.id);

        // 현재 유저의 약에 대한 복용 기록만 조회
        const { data: logs, error: err } = await supabase
          .from("medication_logs")
          .select("medication_id, date")
          .in("date", dates)
          .in("medication_id", myMedIds.length > 0 ? myMedIds : [""]);

        if (err) throw err;

        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = toLocalDateStr(d);
          const dayLogs = (logs ?? []).filter((l: { date: string }) => l.date === dateStr);
          const uniqueMeds = new Set(dayLogs.map((l: { medication_id: string }) => l.medication_id));
          const rate = Math.round((uniqueMeds.size / total) * 100);
          stats.push({ day: days[d.getDay()], rate });
        }

        setWeeklyData(stats);

        // 연속 일수 계산 (로컬 시간 기준)
        let s = 0;
        for (let i = 1; i <= 365; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = toLocalDateStr(d);
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
  }, [totalMeds, userId]);

  return { weeklyData, streak, loading };
}
