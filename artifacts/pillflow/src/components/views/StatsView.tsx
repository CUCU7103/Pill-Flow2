import { motion } from "framer-motion";
import { BarChart3, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { useStats } from "@/hooks/use-medications";
import { MedIcon } from "@/components/common/MedIcon";
import type { Medication } from "@/types";
import { getQuantityUnit } from "@/types";

/** 통계 화면 */
export function StatsView({ meds, dark, userId }: { meds: Medication[]; dark: boolean; userId?: string }) {
  const t = useTheme(dark);
  const completed = meds.filter((m) => m.completed).length;
  const total = meds.length;

  // Supabase에서 현재 유저의 실제 통계 데이터 조회
  const { weeklyData, streak } = useStats(total, userId);

  const weekRate = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((a, d) => a + d.rate, 0) / weeklyData.length)
    : 0;

  const achievements = [
    { icon: "🔥", label: `${streak}일 연속`, desc: "꾸준히 복용 중", color: "#FF6584" },
    { icon: "⭐", label: `달성률 ${weekRate}%`, desc: "이번 주 평균", color: "#FFD166" },
    { icon: "💎", label: "30일 달성", desc: "한 달 완주", color: "#6C63FF" },
  ];

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
      <div className="max-w-md mx-auto px-5 pt-14 pb-32 space-y-5">
        {/* 헤더 */}
        <header className="mb-2">
          <p
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: "#6C63FF" }}
          >
            통계
          </p>
          <h2 className="text-2xl font-black" style={{ color: t.text }}>
            복용 현황
          </h2>
        </header>

        {/* 주간 요약 카드 */}
        <section
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1A1A2E 0%,#16213E 100%)" }}
          aria-label="주간 달성률 요약"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                  주간 달성률
                </p>
                <p className="text-5xl font-black text-white mt-1">{weekRate}%</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                <BarChart3 size={26} className="text-white" />
              </div>
            </div>
            <div className="mt-4 h-px bg-white/10" />
            <div className="mt-4 flex gap-6">
              {[
                { label: "오늘 복용", val: `${completed}/${total}` },
                { label: "주간 평균", val: `${weekRate}%` },
                { label: "연속 일수", val: `${streak}일` },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-white font-black text-lg leading-none">{s.val}</p>
                  <p className="text-white/50 text-[10px] font-bold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 주간 바 차트 */}
        <section
          className="rounded-3xl p-5 shadow-sm"
          style={{ backgroundColor: t.card }}
          aria-label="주간 복용 차트"
        >
          <p className="text-sm font-bold mb-4" style={{ color: t.text }}>
            이번 주 복용 현황
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weeklyData} barSize={28} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: t.subtext, fontSize: 11, fontWeight: 700 }}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: t.subtext, fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: t.card,
                  border: "none",
                  borderRadius: 12,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                }}
                labelStyle={{ color: t.text, fontWeight: 700 }}
                formatter={(v: number) => [`${v}%`, "달성률"]}
                cursor={{ fill: t.divider, radius: 8 }}
              />
              <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                {weeklyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.day ===
                      new Date()
                        .toLocaleDateString("ko-KR", { weekday: "short" })
                        .replace("요일", "")
                        ? "#6C63FF"
                        : "#6C63FF50"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* 약별 상태 */}
        <section
          className="rounded-3xl p-5 shadow-sm"
          style={{ backgroundColor: t.card }}
          aria-label="약별 상태"
        >
          <p className="text-sm font-bold mb-4" style={{ color: t.text }}>
            약별 상태
          </p>
          {meds.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: t.subtext }}>
              등록된 약이 없어요
            </p>
          ) : (
            <div className="space-y-4">
              {meds.map((med) => (
                <div key={med.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <MedIcon type={med.type} color={med.color} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: t.text }}>
                          {med.name}
                        </p>
                        <p className="text-[10px]" style={{ color: t.subtext }}>
                          잔여 {med.remainingQuantity}{getQuantityUnit(med.type)}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-sm font-black"
                      style={{
                        color: med.remainingQuantity < 10 ? "#FF6584" : "#06D6A0",
                      }}
                    >
                      {med.completed ? "복용 완료" : "복용 전"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: t.divider }}>
                    <motion.div
                      className="h-full rounded-full"
                      animate={{
                        width: `${Math.min((med.remainingQuantity / 60) * 100, 100)}%`,
                      }}
                      transition={{ duration: 0.7 }}
                      style={{
                        backgroundColor:
                          med.remainingQuantity < 10 ? "#FF6584" : med.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 달성 뱃지 */}
        <section
          className="rounded-3xl p-5 shadow-sm"
          style={{ backgroundColor: t.card }}
          aria-label="달성 뱃지"
        >
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} style={{ color: "#6C63FF" }} />
            <p className="text-sm font-bold" style={{ color: t.text }}>
              달성 뱃지
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div
                key={a.label}
                className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: a.color + "15" }}
              >
                <span className="text-3xl">{a.icon}</span>
                <p className="text-xs font-black mt-2" style={{ color: a.color }}>
                  {a.label}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: t.subtext }}>
                  {a.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
