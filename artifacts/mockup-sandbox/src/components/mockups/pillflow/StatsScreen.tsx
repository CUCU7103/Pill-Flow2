import { useState } from "react";
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, TrendingUp, Calendar, Award, Flame } from "lucide-react";

const MEDS = [
  { id: "1", name: "종합비타민", remaining: 28, color: "#6C63FF", streak: 12 },
  { id: "2", name: "오메가-3", remaining: 60, color: "#FF6584", streak: 7 },
  { id: "3", name: "비타민 D3", remaining: 8, color: "#FFD166", streak: 3 },
];

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const BAR_HEIGHTS = [85, 92, 78, 96, 88, 72, 94];

export function StatsScreen() {
  const [month] = useState("2026년 3월");
  const lowMeds = MEDS.filter((m) => m.remaining < 10);

  return (
    <div className="min-h-screen bg-[#F5F7FF] font-['Plus_Jakarta_Sans',sans-serif] overflow-auto">
      {/* Status Bar */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">통계</h1>
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest">월간 요약</p>
          </div>
          <div
            className="px-4 py-2 rounded-2xl text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #6C63FF 0%, #4FACFE 100%)" }}
          >
            {month}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5 pb-28">
        {/* Hero Stats */}
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)" }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#6C63FF]/20" />
          <div className="absolute right-10 bottom-4 w-16 h-16 rounded-full bg-[#4FACFE]/20" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">전체 복용 이행률</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-white text-6xl font-black tracking-tighter">94</span>
                  <span className="text-white/60 text-2xl font-bold">%</span>
                </div>
                <p className="text-white/60 text-xs font-medium mt-1">지난달 대비 <span className="text-[#06D6A0] font-bold">+2%</span> 향상</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#6C63FF]/30 flex items-center justify-center backdrop-blur-sm">
                <TrendingUp size={24} className="text-[#6C63FF]" />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: "94%",
                  background: "linear-gradient(90deg, #6C63FF 0%, #4FACFE 100%)",
                }}
              />
            </div>

            {/* Mini Stats Row */}
            <div className="flex gap-4 mt-4">
              {[
                { label: "연속 달성", value: "12일", icon: "🔥" },
                { label: "총 복용", value: "847회", icon: "💊" },
                { label: "최고 기록", value: "31일", icon: "🏆" },
              ].map((s) => (
                <div key={s.label} className="flex-1 text-center">
                  <p className="text-lg">{s.icon}</p>
                  <p className="text-white font-black text-sm">{s.value}</p>
                  <p className="text-white/40 text-[10px] font-semibold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-800">주간 복용률</h3>
              <p className="text-[11px] text-gray-400 font-medium">이번 주</p>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-orange-400" />
              <span className="text-sm font-bold text-gray-700">7일 연속</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {WEEK_DAYS.map((day, i) => {
              const barH = Math.round((BAR_HEIGHTS[i] / 100) * 90);
              const emptyH = 90 - barH;
              const isToday = i === 4;
              const isHigh = BAR_HEIGHTS[i] >= 90;
              return (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ height: `${emptyH}px` }} />
                  <div
                    style={{
                      width: "100%",
                      height: `${barH}px`,
                      borderRadius: "10px",
                      background: isToday
                        ? "linear-gradient(180deg, #6C63FF 0%, #9B8FFF 100%)"
                        : isHigh
                        ? "linear-gradient(180deg, #06D6A0 0%, #4FACFE 100%)"
                        : "#E8E8F0",
                    }}
                  />
                  <span style={{ fontSize: "10px", fontWeight: "700", color: isToday ? "#6C63FF" : "#9CA3AF", marginTop: "6px" }}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <h3 className="font-bold text-gray-800">{month}</h3>
            <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-[10px] font-bold text-gray-400 uppercase pb-1">
                {d}
              </div>
            ))}
            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1;
              const missed = day === 5 || day === 12;
              const completed = day < 14 && !missed;
              const today = day === 14;
              return (
                <div key={i} className="flex items-center justify-center py-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      today
                        ? "text-white ring-4 ring-[#6C63FF]/30"
                        : missed
                        ? "bg-[#FF6584]/10 text-[#FF6584]"
                        : completed
                        ? "text-[#6C63FF]"
                        : "text-gray-300"
                    }`}
                    style={
                      today
                        ? { background: "linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)" }
                        : completed
                        ? { backgroundColor: "#6C63FF15" }
                        : {}
                    }
                  >
                    {today ? (
                      <Calendar size={14} />
                    ) : completed ? (
                      <CheckCircle2 size={12} fill="currentColor" className="text-[#6C63FF]" />
                    ) : missed ? (
                      <span>{day}</span>
                    ) : (
                      <span>{day}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-5 mt-4 pt-4 border-t border-gray-100">
            {[
              { color: "#6C63FF", label: "완료" },
              { color: "#FF6584", label: "미복용" },
              { color: "#E8E8F0", label: "예정" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-[#FFD166]" />
            <h3 className="font-bold text-gray-800">달성 뱃지</h3>
          </div>
          <div className="flex gap-3">
            {[
              { emoji: "🔥", label: "7일 연속", done: true },
              { emoji: "🏆", label: "30일 달성", done: true },
              { emoji: "💎", label: "90% 이상", done: false },
              { emoji: "⭐", label: "100% 달성", done: false },
            ].map((b) => (
              <div
                key={b.label}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl"
                style={b.done ? { background: "linear-gradient(135deg, #6C63FF15, #4FACFE15)" } : { backgroundColor: "#F5F5F5" }}
              >
                <span className={`text-2xl ${!b.done ? "grayscale opacity-30" : ""}`}>{b.emoji}</span>
                <span className={`text-[10px] font-bold text-center ${b.done ? "text-[#6C63FF]" : "text-gray-300"}`}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        {lowMeds.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <AlertCircle size={18} className="text-[#FF6584]" />
              잔여량 부족 알림
            </h3>
            {lowMeds.map((med) => (
              <div
                key={med.id}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4"
                style={{ borderLeft: "3px solid #FF6584" }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#FF6584]/10 flex items-center justify-center">
                  <AlertCircle size={18} className="text-[#FF6584]" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{med.name}</p>
                  <p className="text-xs text-[#FF6584] font-semibold">잔여 {med.remaining}개 — 곧 부족해요</p>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #FF6584 0%, #FF8FAB 100%)" }}
                >
                  충전
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-6 py-3 pb-6">
        <div className="flex justify-around">
          {[
            { label: "오늘", emoji: "📅", active: false },
            { label: "추가", emoji: "➕", active: false },
            { label: "통계", emoji: "📊", active: true },
          ].map(({ label, emoji, active }) => (
            <button
              key={label}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl ${active ? "bg-[#6C63FF]/10" : ""}`}
            >
              <span className="text-xl">{emoji}</span>
              <span className={`text-[11px] font-bold ${active ? "text-[#6C63FF]" : "text-gray-400"}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
