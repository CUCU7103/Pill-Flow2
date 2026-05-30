import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toLocalDateStr } from "@/lib/medicationMapper";

/**
 * 주간 복약률과 연속 복용 일수(streak)를 계산하는 훅.
 * - 주간 통계: 최근 7일 복용 기록 조회
 * - streak: 최근 365일 복용 기록 조회 (7일만 조회하면 7일 초과 streak가 0이 되는 버그 방지)
 */
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
        const medIdFilter = myMedIds.length > 0 ? myMedIds : [""];

        // 주간 통계용 최근 7일 복용 기록 조회
        const { data: logs, error: err } = await supabase
          .from("medication_logs")
          .select("medication_id, date")
          .in("date", dates)
          .in("medication_id", medIdFilter);

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

        // streak 전용 365일 범위 쿼리
        // 7일 데이터로 streak를 계산하면 7일 초과 연속 복용이 0으로 표시되는 버그가 있어 별도 조회한다.
        const streakStart = new Date();
        streakStart.setDate(streakStart.getDate() - 365);
        const streakStartDate = toLocalDateStr(streakStart);

        const { data: streakLogs, error: streakErr } = await supabase
          .from("medication_logs")
          .select("medication_id, date")
          .gte("date", streakStartDate)
          .in("medication_id", medIdFilter);

        if (streakErr) throw streakErr;

        // 연속 일수 계산 (로컬 시간 기준, 365일 데이터 사용)
        let s = 0;
        for (let i = 1; i <= 365; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = toLocalDateStr(d);
          const dayLogs = (streakLogs ?? []).filter((l: { date: string }) => l.date === dateStr);
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
