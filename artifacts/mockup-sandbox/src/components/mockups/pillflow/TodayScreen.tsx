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
  X,
  Moon,
  Clock,
  ChevronRight,
  Shield,
  Info,
  LogOut,
  User,
} from "lucide-react";

const MEDS = [
  { id: "1", name: "종합비타민", dosage: "1캡슐", note: "식사 후", time: "08:00 AM", category: "morning", completed: true, type: "capsule", remaining: 28, color: "#6C63FF" },
  { id: "2", name: "오메가-3", dosage: "2캡슐", note: "고함량", time: "08:30 AM", category: "morning", completed: false, type: "pill", remaining: 60, color: "#FF6584" },
  { id: "3", name: "비타민 D3", dosage: "1000 IU", note: "액상형", time: "01:00 PM", category: "lunch", completed: false, type: "liquid", remaining: 15, color: "#FFD166" },
];

const MedIcon = ({ type, color }: { type: string; color: string }) => {
  const Icon = type === "capsule" ? Pill : type === "pill" ? Activity : Droplets;
  return (
    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
      <Icon size={20} style={{ color }} />
    </div>
  );
};

function SettingsModal({
  onClose,
  darkMode,
  onToggleDark,
  notifOn,
  onToggleNotif,
  alarmTime,
  onAlarmChange,
}: {
  onClose: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  notifOn: boolean;
  onToggleNotif: () => void;
  alarmTime: string;
  onAlarmChange: (t: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full rounded-t-[2rem] overflow-y-auto"
        style={{
          maxHeight: "90vh",
          animation: "slideUp 0.3s ease-out",
          backgroundColor: darkMode ? "#1A1A2E" : "#ffffff",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: darkMode ? "#374151" : "#E5E7EB" }} />
        </div>

        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${darkMode ? "#374151" : "#F3F4F6"}` }}
        >
          <h2 className="text-xl font-extrabold" style={{ color: darkMode ? "#F9FAFB" : "#111827" }}>설정</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: darkMode ? "#374151" : "#F3F4F6" }}
          >
            <X size={18} style={{ color: darkMode ? "#9CA3AF" : "#6B7280" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 pb-10">
          {/* Profile Card */}
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: darkMode ? "linear-gradient(135deg, #6C63FF25, #4FACFE25)" : "linear-gradient(135deg, #6C63FF15, #4FACFE15)" }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black"
              style={{ background: "linear-gradient(135deg, #6C63FF, #9B8FFF)" }}>
              A
            </div>
            <div className="flex-1">
              <p className="font-extrabold" style={{ color: darkMode ? "#F9FAFB" : "#111827" }}>사용자 님</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: darkMode ? "#9CA3AF" : "#9CA3AF" }}>qkrwnsrb224@gmail.com</p>
            </div>
            <button className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#6C63FF] bg-[#6C63FF]/10">수정</button>
          </div>

          {/* App Settings */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3 px-1" style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}>앱 설정</p>
            <div className="rounded-2xl overflow-hidden divide-y" style={{ backgroundColor: darkMode ? "#111827" : "#F9FAFB", borderColor: darkMode ? "#374151" : "#F3F4F6" }}>

              {/* Notifications */}
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#6C63FF20" }}>
                  <Bell size={18} style={{ color: "#6C63FF" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: darkMode ? "#F9FAFB" : "#111827" }}>복용 알림</p>
                  <p className="text-[11px] font-medium" style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}>매일 알림을 받습니다</p>
                </div>
                <button
                  onClick={onToggleNotif}
                  className="relative w-12 h-6 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: notifOn ? "#6C63FF" : (darkMode ? "#374151" : "#E5E7EB") }}
                >
                  <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300"
                    style={{ left: notifOn ? "26px" : "4px" }} />
                </button>
              </div>

              {/* Alarm Time */}
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFD16620" }}>
                  <Clock size={18} style={{ color: "#F59E0B" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: darkMode ? "#F9FAFB" : "#111827" }}>알림 시간</p>
                  <p className="text-[11px] font-medium" style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}>매일 아침 복용 알림</p>
                </div>
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(e) => onAlarmChange(e.target.value)}
                  className="text-sm font-bold bg-transparent border-none outline-none"
                  style={{ color: "#6C63FF" }}
                />
              </div>

              {/* Dark Mode */}
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: darkMode ? "#374151" : "#1A1A2E20" }}>
                  <Moon size={18} style={{ color: darkMode ? "#9B8FFF" : "#374151" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: darkMode ? "#F9FAFB" : "#111827" }}>다크 모드</p>
                  <p className="text-[11px] font-medium" style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}>어두운 테마 사용</p>
                </div>
                <button
                  onClick={onToggleDark}
                  className="relative w-12 h-6 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: darkMode ? "#6C63FF" : "#E5E7EB" }}
                >
                  <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300"
                    style={{ left: darkMode ? "26px" : "4px" }} />
                </button>
              </div>
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3 px-1" style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}>정보</p>
            <div className="rounded-2xl overflow-hidden divide-y" style={{ backgroundColor: darkMode ? "#111827" : "#F9FAFB", borderColor: darkMode ? "#374151" : "#F3F4F6" }}>
              {[
                { icon: User, label: "프로필 관리", color: "#06D6A0", sub: "계정 정보 수정" },
                { icon: Shield, label: "개인정보 처리방침", color: "#4FACFE", sub: "" },
                { icon: Info, label: "버전 정보", color: "#9B8FFF", sub: "v1.0.0" },
              ].map(({ icon: Icon, label, color, sub }) => (
                <button key={label} className="w-full flex items-center gap-4 px-4 py-4 text-left">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: darkMode ? "#F9FAFB" : "#111827" }}>{label}</p>
                    {sub && <p className="text-[11px] font-medium" style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}>{sub}</p>}
                  </div>
                  <ChevronRight size={16} style={{ color: darkMode ? "#4B5563" : "#D1D5DB" }} />
                </button>
              ))}
            </div>
          </div>

          <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm"
            style={{ backgroundColor: darkMode ? "#3B1A1A" : "#FEF2F2", color: "#F87171" }}>
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export function TodayScreen() {
  const [meds, setMeds] = useState(MEDS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifOn, setNotifOn] = useState(true);
  const [alarmTime, setAlarmTime] = useState("08:00");

  const toggle = (id: string) =>
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m)));

  const completed = meds.filter((m) => m.completed).length;
  const total = meds.length;
  const progress = Math.round((completed / total) * 100);
  const morningMeds = meds.filter((m) => m.category === "morning");
  const lunchMeds = meds.filter((m) => m.category === "lunch");

  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  const dm = darkMode;
  const bg = dm ? "#0D1117" : "#F5F7FF";
  const cardBg = dm ? "#161B22" : "#FFFFFF";
  const textPrimary = dm ? "#F0F6FC" : "#111827";
  const textSecondary = dm ? "#8B949E" : "#6B7280";
  const divider = dm ? "#21262D" : "#F3F4F6";

  return (
    <div className="min-h-screen font-['Plus_Jakarta_Sans',sans-serif] overflow-auto transition-colors duration-300"
      style={{ backgroundColor: bg }}>
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6C63FF, #9B8FFF)" }}>
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: "#6C63FF" }}>{today}</p>
            <h1 className="text-[22px] font-extrabold leading-tight"
              style={{
                background: dm ? "linear-gradient(135deg, #F0F6FC 0%, #9B8FFF 100%)" : "linear-gradient(135deg, #1A1A2E 0%, #6C63FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              필플로우
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full shadow-sm flex items-center justify-center"
            style={{ backgroundColor: cardBg }}>
            <Bell size={18} style={{ color: "#6C63FF" }} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full shadow-sm flex items-center justify-center"
            style={{ backgroundColor: cardBg }}>
            <Settings size={18} style={{ color: textSecondary }} />
          </button>
        </div>
      </div>

      {/* Progress Hero Card */}
      <div className="px-6 mb-6">
        <div className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #6C63FF 0%, #4FACFE 100%)" }}>
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white opacity-10" />
          <div className="absolute right-6 bottom-0 w-20 h-20 rounded-full bg-white opacity-10" />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">오늘의 달성률</p>
                <div className="flex items-end gap-1">
                  <span className="text-white text-6xl font-black tracking-tighter">{progress}</span>
                  <span className="text-white/80 text-2xl font-bold mb-2">%</span>
                </div>
                <p className="text-white/80 text-sm font-medium mt-2">
                  {progress === 100 ? "🎉 오늘 모든 약을 복용했어요!" : `아직 ${total - completed}개가 남았어요`}
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>
            <div className="mt-5 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
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
          { label: "오늘", value: `${completed}/${total}`, icon: "💊" },
          { label: "이번주", value: "94%", icon: "📈" },
          { label: "잔여일", value: "15일", icon: "⏰" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: cardBg }}>
            <span className="text-2xl">{stat.icon}</span>
            <p className="font-black text-lg mt-1 leading-none" style={{ color: textPrimary }}>{stat.value}</p>
            <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wider" style={{ color: textSecondary }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Morning Meds */}
      <div className="px-6 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-lg">🌅</span>
          <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: textPrimary }}>아침</h3>
          <div className="flex-1 h-px" style={{ backgroundColor: divider }} />
          <span className="text-[11px] font-semibold" style={{ color: textSecondary }}>{morningMeds.filter(m => m.completed).length}/{morningMeds.length}</span>
        </div>
        <div className="space-y-3">
          {morningMeds.map((med) => <MedCard key={med.id} med={med} onToggle={toggle} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} />)}
        </div>
      </div>

      {/* Lunch Meds */}
      <div className="px-6 mb-24">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-lg">☀️</span>
          <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: textPrimary }}>점심</h3>
          <div className="flex-1 h-px" style={{ backgroundColor: divider }} />
          <span className="text-[11px] font-semibold" style={{ color: textSecondary }}>{lunchMeds.filter(m => m.completed).length}/{lunchMeds.length}</span>
        </div>
        <div className="space-y-3">
          {lunchMeds.map((med) => <MedCard key={med.id} med={med} onToggle={toggle} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} />)}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-6">
        <button className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)" }}>
          <Plus size={28} className="text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t px-6 py-3 pb-6 transition-colors duration-300"
        style={{ backgroundColor: dm ? "rgba(22,27,34,0.92)" : "rgba(255,255,255,0.92)", borderColor: divider }}>
        <div className="flex justify-around">
          {[
            { icon: Calendar, label: "오늘", active: true },
            { icon: Plus, label: "추가", active: false },
            { icon: TrendingUp, label: "통계", active: false },
          ].map(({ icon: Icon, label, active }) => (
            <button key={label}
              className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all"
              style={{ backgroundColor: active ? "#6C63FF18" : "transparent" }}>
              <Icon size={22} style={{ color: active ? "#6C63FF" : textSecondary }} fill={active ? "#6C63FF" : "none"} />
              <span className="text-[11px] font-bold" style={{ color: active ? "#6C63FF" : textSecondary }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(!darkMode)}
          notifOn={notifOn}
          onToggleNotif={() => setNotifOn(!notifOn)}
          alarmTime={alarmTime}
          onAlarmChange={setAlarmTime}
        />
      )}
    </div>
  );
}

function MedCard({
  med, onToggle, cardBg, textPrimary, textSecondary,
}: {
  med: (typeof MEDS)[0];
  onToggle: (id: string) => void;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm flex items-center gap-4 transition-all"
      style={{
        backgroundColor: cardBg,
        borderLeft: `3px solid ${med.completed ? "#374151" : med.color}`,
        opacity: med.completed ? 0.6 : 1,
      }}
    >
      <MedIcon type={med.type} color={med.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <h4 className="font-bold text-base" style={{
            color: med.completed ? textSecondary : textPrimary,
            textDecoration: med.completed ? "line-through" : "none",
          }}>
            {med.name}
          </h4>
          <span className="text-[11px] font-bold ml-2 shrink-0" style={{ color: textSecondary }}>{med.time}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-medium" style={{ color: textSecondary }}>{med.dosage} · {med.note}</span>
          <span className="text-xs font-bold" style={{ color: med.remaining < 10 ? "#FF6584" : "#06D6A0" }}>
            잔여 {med.remaining}개
          </span>
        </div>
      </div>
      <button onClick={() => onToggle(med.id)} className="flex-shrink-0 transition-transform active:scale-90">
        {med.completed
          ? <CheckCircle2 size={26} style={{ color: "#6C63FF" }} fill="#6C63FF" />
          : <Circle size={26} style={{ color: "#D1D5DB" }} />}
      </button>
    </div>
  );
}
