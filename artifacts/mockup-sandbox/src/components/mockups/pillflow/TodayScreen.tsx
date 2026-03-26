import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Pill,
  Activity,
  Droplets,
  Plus,
  Settings,
  Bell,
  Calendar,
  TrendingUp,
  Sparkles,
} from "lucide-react";

const MEDS = [
  { id: "1", name: "종합비타민", dosage: "1캡슐", note: "식사 후", time: "08:00 AM", category: "morning", completed: true, type: "capsule", remaining: 28, color: "#6C63FF" },
  { id: "2", name: "오메가-3", dosage: "2캡슐", note: "고함량", time: "08:30 AM", category: "morning", completed: false, type: "pill", remaining: 60, color: "#FF6584" },
  { id: "3", name: "비타민 D3", dosage: "1000 IU", note: "액상형", time: "01:00 PM", category: "lunch", completed: false, type: "liquid", remaining: 15, color: "#FFD166" },
];

const MedIcon = ({ type, color }: { type: string; color: string }) => {
  const Icon = type === "capsule" ? Pill : type === "pill" ? Activity : Droplets;
  return (
    <div
      className="w-11 h-11 rounded-2xl flex items-center justify-center"
      style={{ backgroundColor: color + "20" }}
    >
      <Icon size={20} style={{ color }} />
    </div>
  );
};

export function TodayScreen() {
  const [meds, setMeds] = useState(MEDS);

  const toggle = (id: string) =>
    setMeds((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    );

  const completed = meds.filter((m) => m.completed).length;
  const total = meds.length;
  const progress = Math.round((completed / total) * 100);

  const morningMeds = meds.filter((m) => m.category === "morning");
  const lunchMeds = meds.filter((m) => m.category === "lunch");

  const today = new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="min-h-screen bg-[#F5F7FF] font-['Plus_Jakarta_Sans',sans-serif] overflow-auto">
      {/* Status Bar Area */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#9B8FFF] flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <p className="text-[11px] text-[#6C63FF] font-semibold tracking-wider uppercase">{today}</p>
            <h1
              className="text-[22px] font-extrabold leading-tight"
              style={{
                background: "linear-gradient(135deg, #1A1A2E 0%, #6C63FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              필플로우
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
            <Bell size={18} className="text-[#6C63FF]" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
            <Settings size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Progress Hero Card */}
      <div className="px-6 mb-6">
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #6C63FF 0%, #4FACFE 100%)",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white opacity-10" />
          <div className="absolute right-6 bottom-0 w-20 h-20 rounded-full bg-white opacity-10" />

          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                  오늘의 달성률
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-white text-6xl font-black tracking-tighter">{progress}</span>
                  <span className="text-white/80 text-2xl font-bold mb-2">%</span>
                </div>
                <p className="text-white/80 text-sm font-medium mt-2">
                  {progress === 100
                    ? "🎉 오늘 모든 약을 복용했어요!"
                    : `아직 ${total - completed}개가 남았어요`}
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-white/60 text-[11px] font-medium">{completed}/{total} 복용</span>
              <span className="text-white/60 text-[11px] font-medium">연속 7일 🔥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="px-6 mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "오늘", value: `${completed}/${total}`, icon: "💊", color: "#6C63FF" },
          { label: "이번주", value: "94%", icon: "📈", color: "#06D6A0" },
          { label: "잔여일", value: "15일", icon: "⏰", color: "#FFD166" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm">
            <span className="text-2xl">{stat.icon}</span>
            <p className="font-black text-lg text-gray-800 mt-1 leading-none">{stat.value}</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Morning Meds */}
      <div className="px-6 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-lg">🌅</span>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">아침</h3>
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] font-semibold text-gray-400">{morningMeds.filter(m=>m.completed).length}/{morningMeds.length}</span>
        </div>
        <div className="space-y-3">
          {morningMeds.map((med) => (
            <MedCard key={med.id} med={med} onToggle={toggle} />
          ))}
        </div>
      </div>

      {/* Lunch Meds */}
      <div className="px-6 mb-24">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-lg">☀️</span>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">점심</h3>
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] font-semibold text-gray-400">{lunchMeds.filter(m=>m.completed).length}/{lunchMeds.length}</span>
        </div>
        <div className="space-y-3">
          {lunchMeds.map((med) => (
            <MedCard key={med.id} med={med} onToggle={toggle} />
          ))}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-6">
        <button
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)" }}
        >
          <Plus size={28} className="text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-6 py-3 pb-6">
        <div className="flex justify-around">
          {[
            { icon: Calendar, label: "오늘", active: true },
            { icon: Plus, label: "추가", active: false },
            { icon: TrendingUp, label: "통계", active: false },
          ].map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all ${
                active ? "bg-[#6C63FF]/10" : ""
              }`}
            >
              <Icon
                size={22}
                className={active ? "text-[#6C63FF]" : "text-gray-400"}
                fill={active ? "currentColor" : "none"}
              />
              <span
                className={`text-[11px] font-bold ${active ? "text-[#6C63FF]" : "text-gray-400"}`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MedCard({
  med,
  onToggle,
}: {
  med: (typeof MEDS)[0];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 transition-all ${
        med.completed ? "opacity-60" : ""
      }`}
      style={{
        borderLeft: `3px solid ${med.completed ? "#E5E7EB" : med.color}`,
      }}
    >
      <MedIcon type={med.type} color={med.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <h4
            className={`font-bold text-base ${
              med.completed ? "line-through text-gray-400" : "text-gray-800"
            }`}
          >
            {med.name}
          </h4>
          <span className="text-[11px] font-bold text-gray-400 ml-2 shrink-0">{med.time}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 font-medium">{med.dosage} · {med.note}</span>
          <span className="text-xs font-bold" style={{ color: med.remaining < 10 ? "#FF6584" : "#06D6A0" }}>
            잔여 {med.remaining}개
          </span>
        </div>
      </div>
      <button
        onClick={() => onToggle(med.id)}
        className="flex-shrink-0 transition-transform active:scale-90"
      >
        {med.completed ? (
          <CheckCircle2 size={26} className="text-[#6C63FF]" fill="#6C63FF" />
        ) : (
          <Circle size={26} className="text-gray-300" />
        )}
      </button>
    </div>
  );
}
