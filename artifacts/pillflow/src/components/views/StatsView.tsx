import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { useStats } from "@/hooks/use-stats";
import { MedIcon } from "@/components/common/MedIcon";
import type { Medication } from "@/types";

/** 통계 화면 */
export function StatsView({ meds, dark, userId }: { meds: Medication[]; dark: boolean; userId?: string }) {
  const t = useTheme(dark);
  const total = meds.length;
  const { weeklyData, loading } = useStats(total, userId);
  // Empty seven-day data is returned for zero registered medicines. It is not a
  // meaningful 0% result because there is no denominator yet.
  const hasStats = Boolean(userId && total > 0 && weeklyData.length > 0);
  const weekRate = hasStats
    ? Math.round(weeklyData.reduce((sum, day) => sum + day.rate, 0) / weeklyData.length)
    : null;
  const todayLabel = new Date().toLocaleDateString("ko-KR", { weekday: "short" }).replace("요일", "");

  return (
    <div className="h-full overflow-y-auto hide-scrollbar bg-pf-bg text-pf-text">
      <div className="max-w-md mx-auto px-5 pt-12 pb-32 space-y-5">
        <header className="mb-2">
          <p className="text-xs font-bold tracking-tight" style={{ color: "var(--pf-accent)" }}>통계</p>
          <h2 className="text-2xl font-black tracking-tight mt-1">복용 현황</h2>
          <p className="text-sm text-pf-subtext mt-2">복용 기록을 모아 한눈에 확인해요.</p>
        </header>

        {loading ? (
          <section className="rounded-[28px] p-6 bg-pf-card border border-pf-divider" aria-label="통계 불러오는 중">
            <div className="h-3 w-20 rounded-full bg-pf-divider animate-pulse" />
            <div className="h-12 w-28 rounded-xl bg-pf-divider mt-4 animate-pulse" />
            <div className="h-3 w-40 rounded-full bg-pf-divider mt-4 animate-pulse" />
          </section>
        ) : hasStats ? (
          <section className="rounded-[28px] p-6 bg-pf-card border border-pf-divider" aria-label="최근 7일 기록 비율 요약">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-pf-subtext">최근 7일 기록 비율</p>
                <p className="text-5xl font-black tracking-tight mt-2" style={{ color: "var(--pf-accent)" }}>{weekRate}%</p>
                <p className="text-xs text-pf-subtext mt-2">현재 등록된 약 {total}개 기준</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--pf-accent-soft)", color: "var(--pf-accent)" }}>
                <BarChart3 size={22} aria-hidden="true" />
              </div>
            </div>
            <p className="mt-5 border-t border-pf-divider pt-4 text-sm leading-6 text-pf-subtext">각 날짜에 기록한 약의 수를 현재 등록된 약 {total}개와 비교한 값이에요.</p>
          </section>
        ) : (
          <section className="rounded-[28px] p-6 bg-pf-card border border-pf-divider" aria-label="통계 안내">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--pf-accent-soft)", color: "var(--pf-accent)" }}>
              <BarChart3 size={22} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-black mt-5">복용 기록이 쌓이면 보여드릴게요</h3>
            <p className="text-sm text-pf-subtext leading-relaxed mt-2">{userId ? "약을 등록하고 복용을 기록하면 최근 7일 현황을 확인할 수 있어요." : "로그인하면 복용 현황을 안전하게 확인할 수 있어요."}</p>
          </section>
        )}

        <section className="rounded-[28px] p-5 bg-pf-card border border-pf-divider" aria-label="최근 7일 복용 차트">
          <div className="flex items-baseline justify-between gap-3 mb-5">
            <div><h3 className="text-base font-black">주간 기록</h3>{hasStats && <p className="text-xs text-pf-subtext mt-1">최근 7일 · 현재 등록 약 {total}개 기준</p>}</div>
            {hasStats && <span className="text-xs font-bold text-pf-subtext">오늘 {todayLabel}</span>}
          </div>
          {hasStats ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={weeklyData} barSize={24} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: t.subtext, fontSize: 11, fontWeight: 700 }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: t.subtext, fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
                <Tooltip contentStyle={{ backgroundColor: t.card, border: `1px solid ${t.divider}`, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }} labelStyle={{ color: t.text, fontWeight: 700 }} formatter={(value: number) => [`${value}%`, "기록 비율"]} cursor={{ fill: t.divider, radius: 8 }} />
                <Bar dataKey="rate" radius={[8, 8, 8, 8]}>
                  {weeklyData.map((entry, index) => <Cell key={`${entry.day}-${index}`} fill={entry.day === todayLabel ? "var(--pf-accent)" : "var(--pf-accent-soft)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[170px] flex items-center justify-center rounded-2xl bg-pf-surface text-sm text-pf-subtext">표시할 주간 기록이 없어요.</div>}
        </section>

        <section className="rounded-[28px] p-5 bg-pf-card border border-pf-divider" aria-label="약별 상태">
          <h3 className="text-base font-black mb-5">약별 상태</h3>
          <p className="-mt-2 mb-2 text-xs leading-5 text-pf-subtext">완료 기록 1회는 오늘 하루 전체 복용을 뜻해요. 같은 약의 여러 복용 시간은 따로 체크하지 않아요.</p>
          {meds.length === 0 ? <p className="text-sm text-center py-4 text-pf-subtext">등록된 약이 없어요.</p> : (
            <div className="space-y-1">
              {meds.map((med) => (
                <div key={med.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0"><MedIcon type={med.type} color={med.color} /><div className="min-w-0"><p className="text-sm font-bold truncate">{med.name}</p><p className="text-xs truncate text-pf-subtext">{med.memo || med.dosage}</p></div></div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: med.completed ? "var(--pf-success)" : t.subtext }}>{med.completed ? "오늘 하루 기록됨" : "오늘 기록 없음"}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
