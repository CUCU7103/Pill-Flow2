import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill, Clock, Check, Settings, Plus, ChevronLeft, ChevronRight,
  Droplets, Calendar, TrendingUp, Activity, CheckCircle2, Moon,
  Bell, Sparkles, BarChart3, ArrowLeft, Trash2, Shield, Info,
  User, LogOut, X, Award, Flame,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────
type View = "today" | "add" | "stats";
type Category = "morning" | "lunch" | "evening";
type MedType = "pill" | "capsule" | "liquid";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosageAmount: number;
  remainingQuantity: number;
  time: string;
  category: Category;
  completed: boolean;
  type: MedType;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MED_COLORS = ["#6C63FF", "#FF6584", "#FFD166", "#06D6A0", "#4FACFE", "#F97316"];

const INITIAL_MEDS: Medication[] = [
  { id: "1", name: "종합비타민", dosage: "1캡슐 · 식사 후", dosageAmount: 1, remainingQuantity: 28, time: "08:00 AM", category: "morning", completed: false, type: "capsule", color: "#6C63FF" },
  { id: "2", name: "오메가-3", dosage: "2캡슐 · 고함량", dosageAmount: 2, remainingQuantity: 60, time: "08:30 AM", category: "morning", completed: false, type: "pill", color: "#FF6584" },
  { id: "3", name: "비타민 D3", dosage: "1000 IU · 액상형", dosageAmount: 1, remainingQuantity: 15, time: "01:00 PM", category: "lunch", completed: false, type: "liquid", color: "#FFD166" },
];

const WEEKLY_DATA = [
  { day: "월", rate: 80 }, { day: "화", rate: 100 }, { day: "수", rate: 60 },
  { day: "목", rate: 100 }, { day: "금", rate: 90 }, { day: "토", rate: 40 },
  { day: "일", rate: 75 },
];

function usePersisted<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal] as const;
}

// ─── Theme helpers ─────────────────────────────────────────────────────────────
function useTheme(dark: boolean) {
  return {
    bg: dark ? "#0D1117" : "#F5F7FF",
    card: dark ? "#161B22" : "#FFFFFF",
    surface: dark ? "#111827" : "#F9FAFB",
    text: dark ? "#F0F6FC" : "#111827",
    subtext: dark ? "#8B949E" : "#6B7280",
    divider: dark ? "#21262D" : "#F3F4F6",
    navBg: dark ? "rgba(22,27,34,0.95)" : "rgba(255,255,255,0.95)",
  };
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
function MedIcon({ type, color }: { type: MedType; color: string }) {
  const Icon = type === "capsule" ? Pill : type === "pill" ? Activity : Droplets;
  return (
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color + "20" }}>
      <Icon size={22} style={{ color }} />
    </div>
  );
}

// ─── Settings Modal ─────────────────────────────────────────────────────────────
function SettingsModal({
  onClose, dark, onToggleDark, notif, onToggleNotif, alarm, onAlarmChange,
}: {
  onClose: () => void; dark: boolean; onToggleDark: () => void;
  notif: boolean; onToggleNotif: () => void; alarm: string; onAlarmChange: (t: string) => void;
}) {
  const t = useTheme(dark);
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-end"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div className="relative w-full rounded-t-[2rem] overflow-y-auto max-h-[90vh]"
          style={{ backgroundColor: t.card }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.divider }} />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: t.divider }}>
            <h2 className="text-xl font-extrabold" style={{ color: t.text }}>설정</h2>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: t.surface }}>
              <X size={18} style={{ color: t.subtext }} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6 pb-12">
            {/* Profile */}
            <div className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: dark ? "linear-gradient(135deg,#6C63FF25,#4FACFE25)" : "linear-gradient(135deg,#6C63FF15,#4FACFE15)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black"
                style={{ background: "linear-gradient(135deg,#6C63FF,#9B8FFF)" }}>A</div>
              <div className="flex-1">
                <p className="font-extrabold" style={{ color: t.text }}>사용자 님</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: t.subtext }}>pillflow@example.com</p>
              </div>
              <button className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#6C63FF] bg-[#6C63FF]/10">수정</button>
            </div>

            {/* App Settings */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 px-1" style={{ color: t.subtext }}>앱 설정</p>
              <div className="rounded-2xl overflow-hidden divide-y" style={{ backgroundColor: t.surface, borderColor: t.divider }}>
                {/* Notification */}
                <div className="flex items-center gap-4 px-4 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6C63FF]/15">
                    <Bell size={18} style={{ color: "#6C63FF" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: t.text }}>복용 알림</p>
                    <p className="text-[11px] font-medium" style={{ color: t.subtext }}>매일 알림을 받습니다</p>
                  </div>
                  <Toggle on={notif} onToggle={onToggleNotif} />
                </div>
                {/* Alarm time */}
                <div className="flex items-center gap-4 px-4 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FFD166]/20">
                    <Clock size={18} style={{ color: "#F59E0B" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: t.text }}>알림 시간</p>
                    <p className="text-[11px] font-medium" style={{ color: t.subtext }}>매일 아침 복용 알림</p>
                  </div>
                  <input type="time" value={alarm} onChange={e => onAlarmChange(e.target.value)}
                    className="text-sm font-bold bg-transparent border-none outline-none text-[#6C63FF]" />
                </div>
                {/* Dark mode */}
                <div className="flex items-center gap-4 px-4 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: dark ? "#374151" : "#1A1A2E20" }}>
                    <Moon size={18} style={{ color: dark ? "#9B8FFF" : "#374151" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: t.text }}>다크 모드</p>
                    <p className="text-[11px] font-medium" style={{ color: t.subtext }}>어두운 테마 사용</p>
                  </div>
                  <Toggle on={dark} onToggle={onToggleDark} />
                </div>
              </div>
            </div>

            {/* Info */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 px-1" style={{ color: t.subtext }}>정보</p>
              <div className="rounded-2xl overflow-hidden divide-y" style={{ backgroundColor: t.surface, borderColor: t.divider }}>
                {[
                  { icon: User, label: "프로필 관리", color: "#06D6A0", sub: "계정 정보 수정" },
                  { icon: Shield, label: "개인정보 처리방침", color: "#4FACFE", sub: "" },
                  { icon: Info, label: "버전 정보", color: "#9B8FFF", sub: "v1.0.0" },
                ].map(({ icon: Icon, label, color, sub }) => (
                  <button key={label} className="w-full flex items-center gap-4 px-4 py-4 text-left active:opacity-70">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "20" }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: t.text }}>{label}</p>
                      {sub && <p className="text-[11px] font-medium" style={{ color: t.subtext }}>{sub}</p>}
                    </div>
                    <ChevronRight size={16} style={{ color: t.divider }} />
                  </button>
                ))}
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm"
              style={{ backgroundColor: dark ? "#3B1A1A" : "#FEF2F2", color: "#F87171" }}>
              <LogOut size={18} />
              로그아웃
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="relative w-12 h-6 rounded-full transition-colors duration-300"
      style={{ backgroundColor: on ? "#6C63FF" : "#E5E7EB" }}>
      <motion.span
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        animate={{ left: on ? "26px" : "4px" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ onCancel, onConfirm, dark }: { onCancel: () => void; onConfirm: () => void; dark: boolean }) {
  const t = useTheme(dark);
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="w-full max-w-xs rounded-3xl p-8 space-y-6 shadow-2xl"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-400 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={30} />
          </div>
          <h3 className="text-xl font-bold" style={{ color: t.text }}>정말 삭제할까요?</h3>
          <p className="text-sm" style={{ color: t.subtext }}>삭제된 정보는 복구할 수 없습니다.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-4 rounded-2xl font-bold text-sm"
            style={{ backgroundColor: t.surface, color: t.subtext }}>취소</button>
          <button onClick={onConfirm} className="flex-1 py-4 rounded-2xl font-bold text-sm bg-red-400 text-white">삭제</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Today View ───────────────────────────────────────────────────────────────
function TodayView({
  meds, onToggle, onDelete, onAddClick,
  dark, onOpenSettings,
}: {
  meds: Medication[]; onToggle: (id: string) => void; onDelete: (id: string) => void;
  onAddClick: () => void; dark: boolean; onOpenSettings: () => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const t = useTheme(dark);
  const completed = meds.filter(m => m.completed).length;
  const total = meds.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  const groups: Record<string, Medication[]> = {
    "아침 🌅": meds.filter(m => m.category === "morning"),
    "점심 ☀️": meds.filter(m => m.category === "lunch"),
    "저녁 🌙": meds.filter(m => m.category === "evening"),
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
      <div className="max-w-md mx-auto px-5 pt-14 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#6C63FF,#9B8FFF)" }}>A</div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6C63FF" }}>{today}</p>
              <h1 className="text-xl font-extrabold leading-tight" style={{
                background: dark ? "linear-gradient(135deg,#F0F6FC,#9B8FFF)" : "linear-gradient(135deg,#1A1A2E,#6C63FF)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>필플로우</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full shadow-sm flex items-center justify-center"
              style={{ backgroundColor: t.card }}>
              <Bell size={17} style={{ color: "#6C63FF" }} />
            </button>
            <button onClick={onOpenSettings} className="w-9 h-9 rounded-full shadow-sm flex items-center justify-center"
              style={{ backgroundColor: t.card }}>
              <Settings size={17} style={{ color: t.subtext }} />
            </button>
          </div>
        </div>

        {/* Progress Hero */}
        <div className="rounded-3xl p-6 mb-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#6C63FF 0%,#4FACFE 100%)" }}>
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10" />
          <div className="absolute right-6 bottom-0 w-20 h-20 rounded-full bg-white/10" />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">오늘의 달성률</p>
                <div className="flex items-end gap-1">
                  <motion.span className="text-white text-6xl font-black tracking-tighter"
                    key={progress} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    {progress}
                  </motion.span>
                  <span className="text-white/80 text-2xl font-bold mb-2">%</span>
                </div>
                <p className="text-white/80 text-sm font-medium mt-1">
                  {progress === 100 ? "🎉 오늘 모든 약을 복용했어요!" : `아직 ${total - completed}개가 남았어요`}
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>
            <div className="mt-5 h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white rounded-full"
                animate={{ width: `${progress}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-white/60 text-[11px] font-medium">{completed}/{total} 복용</span>
              <span className="text-white/60 text-[11px] font-medium flex items-center gap-1">
                연속 7일 <Flame size={12} className="text-orange-300" />
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "오늘", value: `${completed}/${total}`, icon: "💊" },
            { label: "이번주", value: "94%", icon: "📈" },
            { label: "잔여일", value: "15일", icon: "⏰" },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: t.card }}>
              <span className="text-2xl">{stat.icon}</span>
              <p className="font-black text-lg mt-1 leading-none" style={{ color: t.text }}>{stat.value}</p>
              <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wider" style={{ color: t.subtext }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Medication Groups */}
        {Object.entries(groups).map(([label, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={label} className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: t.text }}>{label}</h3>
                <div className="flex-1 h-px" style={{ backgroundColor: t.divider }} />
                <span className="text-[11px] font-semibold" style={{ color: t.subtext }}>
                  {items.filter(m => m.completed).length}/{items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map(med => (
                  <motion.div key={med.id} layout
                    className="rounded-2xl p-4 shadow-sm flex items-center gap-4"
                    style={{
                      backgroundColor: t.card,
                      borderLeft: `4px solid ${med.completed ? t.divider : med.color}`,
                      opacity: med.completed ? 0.6 : 1,
                    }}
                    whileTap={{ scale: 0.98 }}>
                    <MedIcon type={med.type} color={med.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-base truncate" style={{
                          color: med.completed ? t.subtext : t.text,
                          textDecoration: med.completed ? "line-through" : "none",
                        }}>{med.name}</h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] font-bold" style={{ color: t.subtext }}>{med.time}</span>
                          <button onClick={() => setDeleteId(med.id)} className="p-1 active:opacity-50"
                            style={{ color: t.divider }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium" style={{ color: t.subtext }}>{med.dosage}</span>
                        <span className="text-xs font-bold" style={{ color: med.remainingQuantity < 10 ? "#FF6584" : "#06D6A0" }}>
                          잔여 {med.remainingQuantity}개
                        </span>
                      </div>
                    </div>
                    <button onClick={() => onToggle(med.id)} className="flex-shrink-0 active:scale-90 transition-transform">
                      {med.completed
                        ? <CheckCircle2 size={26} style={{ color: "#6C63FF" }} fill="#6C63FF" />
                        : <div className="w-[26px] h-[26px] rounded-full border-2" style={{ borderColor: t.divider }} />}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}

        {meds.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">💊</div>
            <p className="font-bold text-lg" style={{ color: t.text }}>등록된 약이 없어요</p>
            <p className="text-sm mt-1" style={{ color: t.subtext }}>+ 버튼으로 약을 추가해보세요</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-24 right-6 z-40">
        <button onClick={onAddClick}
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-transform"
          style={{ background: "linear-gradient(135deg,#6C63FF,#9B8FFF)" }}>
          <Plus size={28} className="text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <DeleteModal dark={dark}
            onCancel={() => setDeleteId(null)}
            onConfirm={() => { onDelete(deleteId); setDeleteId(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Time Picker ──────────────────────────────────────────────────────────────
function TimePicker({ onClose, onConfirm, dark }: {
  onClose: () => void; onConfirm: (t: string) => void; dark: boolean;
}) {
  const [h, setH] = useState("8");
  const [m, setM] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const t = useTheme(dark);
  const confirm = () => {
    let hr = parseInt(h) || 8;
    hr = Math.max(1, Math.min(12, hr));
    let mn = parseInt(m) || 0;
    mn = Math.max(0, Math.min(59, mn));
    if (ampm === "PM" && hr < 12) hr += 12;
    if (ampm === "AM" && hr === 12) hr = 0;
    onConfirm(`${hr.toString().padStart(2, "0")}:${mn.toString().padStart(2, "0")}`);
    onClose();
  };
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="w-full max-w-xs rounded-3xl p-8 space-y-6 shadow-2xl"
        style={{ backgroundColor: t.card }}
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
        <div className="text-center">
          <h3 className="text-xl font-bold text-[#6C63FF]">시간 설정</h3>
          <p className="text-xs mt-1" style={{ color: t.subtext }}>복용 시간을 직접 입력하세요</p>
        </div>
        {/* AM/PM */}
        <div className="flex rounded-2xl overflow-hidden p-1 gap-1" style={{ backgroundColor: t.surface }}>
          {(["AM", "PM"] as const).map(v => (
            <button key={v} onClick={() => setAmpm(v)}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ backgroundColor: ampm === v ? "#6C63FF" : "transparent", color: ampm === v ? "#fff" : t.subtext }}>
              {v === "AM" ? "오전" : "오후"}
            </button>
          ))}
        </div>
        {/* Time inputs */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <input type="text" inputMode="numeric" value={h} onChange={e => setH(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="w-20 h-20 text-center text-4xl font-black rounded-3xl outline-none focus:ring-2 focus:ring-[#6C63FF]"
              style={{ backgroundColor: t.surface, color: "#6C63FF" }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.subtext }}>시</span>
          </div>
          <span className="text-4xl font-bold text-[#6C63FF] mb-6">:</span>
          <div className="flex flex-col items-center gap-2">
            <input type="text" inputMode="numeric" value={m} onChange={e => setM(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="w-20 h-20 text-center text-4xl font-black rounded-3xl outline-none focus:ring-2 focus:ring-[#6C63FF]"
              style={{ backgroundColor: t.surface, color: "#6C63FF" }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.subtext }}>분</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold text-sm"
            style={{ backgroundColor: t.surface, color: t.subtext }}>취소</button>
          <button onClick={confirm} className="flex-1 py-4 rounded-2xl font-bold text-sm text-white"
            style={{ backgroundColor: "#6C63FF" }}>확인</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Field wrapper (must be defined outside AddView to avoid remount on rerender) ──
function FormField({ label, children, cardBg, accentColor }: {
  label: string; children: React.ReactNode; cardBg: string; accentColor: string;
}) {
  return (
    <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: cardBg }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: accentColor }}>{label}</p>
      {children}
    </div>
  );
}

// ─── Add Medication View ───────────────────────────────────────────────────────
function AddView({
  onBack, onSave, dark,
}: { onBack: () => void; onSave: (m: Medication) => void; dark: boolean }) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [dosage, setDosage] = useState("1");
  const [remaining, setRemaining] = useState("30");
  const [type, setType] = useState<MedType>("pill");
  const [color, setColor] = useState(MED_COLORS[0]);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [showPicker, setShowPicker] = useState(false);
  const t = useTheme(dark);

  const formatDisplay = (raw: string) => {
    const [hh, mm] = raw.split(":");
    const h = parseInt(hh);
    const a = h >= 12 ? "PM" : "AM";
    const d = h % 12 || 12;
    return `${d.toString().padStart(2, "0")}:${mm} ${a}`;
  };

  const save = () => {
    if (!name.trim()) return;
    const h = parseInt(time.split(":")[0]);
    let cat: Category = "morning";
    if (h >= 11 && h < 16) cat = "lunch";
    if (h >= 16) cat = "evening";
    onSave({
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      dosage: `${dosage}정`,
      dosageAmount: parseInt(dosage) || 1,
      remainingQuantity: parseInt(remaining) || 0,
      time: formatDisplay(time),
      category: cat,
      completed: false,
      type,
      color,
    });
    onBack();
  };

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
      <div className="max-w-md mx-auto px-5 pt-14 pb-32 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <button onClick={onBack} className="w-11 h-11 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform"
            style={{ backgroundColor: t.card }}>
            <ChevronLeft size={22} style={{ color: t.text }} />
          </button>
          <div>
            <h2 className="text-2xl font-black" style={{ color: t.text }}>새 약 추가</h2>
            <p className="text-xs font-medium" style={{ color: t.subtext }}>복용 정보를 입력해주세요</p>
          </div>
        </div>

        {/* Name */}
        <FormField label="약 이름" cardBg={t.card} accentColor="#6C63FF">
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 border-2"
            style={{ borderColor: name ? "#6C63FF" : t.divider, backgroundColor: t.surface }}>
            <Pill size={18} style={{ color: "#6C63FF" }} />
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 마그네슘, 종합비타민..."
              className="flex-1 bg-transparent outline-none font-bold text-base"
              style={{ color: t.text }} />
          </div>
        </FormField>

        {/* Type */}
        <FormField label="약 유형" cardBg={t.card} accentColor="#6C63FF">
          <div className="grid grid-cols-3 gap-3">
            {([["pill", "알약", "💊"], ["capsule", "캡슐", "💊"], ["liquid", "액상", "💧"]] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => setType(id)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{
                  backgroundColor: type === id ? "#6C63FF" : t.surface,
                  color: type === id ? "#fff" : t.subtext,
                }}>
                <span className="text-2xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </FormField>

        {/* Color */}
        <FormField label="색상" cardBg={t.card} accentColor="#6C63FF">
          <div className="flex gap-3 flex-wrap">
            {MED_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className="w-10 h-10 rounded-full transition-transform active:scale-90"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `3px solid ${c}` : "none",
                  outlineOffset: "3px",
                }} />
            ))}
          </div>
        </FormField>

        {/* Time */}
        <FormField label="복용 시간" cardBg={t.card} accentColor="#6C63FF">
          <div className="space-y-2">
            {[["🌅", "아침", "08:00"], ["☀️", "점심", "13:00"], ["🌙", "저녁", "19:00"]].map(([icon, label, t24]) => (
              <button key={t24} onClick={() => setTime(t24)}
                className="w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all"
                style={{
                  borderColor: time === t24 ? "#6C63FF" : "transparent",
                  backgroundColor: time === t24 ? "#6C63FF0D" : t.surface,
                }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <span className="font-bold" style={{ color: t.text }}>{label} ({t24})</span>
                </div>
                <div className="w-4 h-4 rounded-full border-2"
                  style={{ backgroundColor: time === t24 ? "#6C63FF" : "transparent", borderColor: time === t24 ? "#6C63FF" : t.divider }} />
              </button>
            ))}
            <button onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl"
              style={{ backgroundColor: t.surface }}>
              <div className="flex items-center gap-3">
                <Clock size={20} style={{ color: t.subtext }} />
                <span className="font-bold" style={{ color: t.subtext }}>직접 설정</span>
              </div>
              <ChevronRight size={16} style={{ color: t.subtext }} />
            </button>
          </div>
        </FormField>

        {/* Days */}
        <FormField label="반복 요일" cardBg={t.card} accentColor="#6C63FF">
          <div className="flex justify-between">
            {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
              <button key={d} onClick={() => setDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                className="w-10 h-10 rounded-xl font-bold text-xs transition-all active:scale-90"
                style={{
                  backgroundColor: days.includes(i) ? "#6C63FF" : t.surface,
                  color: days.includes(i) ? "#fff" : t.subtext,
                }}>
                {d}
              </button>
            ))}
          </div>
        </FormField>

        {/* Dosage & Remaining */}
        <FormField label="용량 / 잔여량" cardBg={t.card} accentColor="#6C63FF">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "1회 용량 (정)", val: dosage, set: setDosage },
              { label: "총 잔여량 (개)", val: remaining, set: setRemaining },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <p className="text-[10px] font-bold mb-2" style={{ color: t.subtext }}>{label}</p>
                <input type="number" value={val} onChange={e => set(e.target.value)}
                  className="w-full text-center text-2xl font-black rounded-2xl py-4 outline-none focus:ring-2 focus:ring-[#6C63FF]"
                  style={{ backgroundColor: t.surface, color: "#6C63FF" }} />
              </div>
            ))}
          </div>
        </FormField>

        {/* Save */}
        <button onClick={save} disabled={!name.trim()}
          className="w-full py-5 rounded-2xl font-extrabold text-lg text-white shadow-lg transition-all active:scale-[0.98]"
          style={{ background: name.trim() ? "linear-gradient(135deg,#6C63FF,#4FACFE)" : t.divider }}>
          저장하기
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <TimePicker dark={dark}
            onClose={() => setShowPicker(false)}
            onConfirm={setTime} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats View ───────────────────────────────────────────────────────────────
function StatsView({ meds, dark }: { meds: Medication[]; dark: boolean }) {
  const t = useTheme(dark);
  const completed = meds.filter(m => m.completed).length;
  const total = meds.length;
  const weekRate = Math.round(WEEKLY_DATA.reduce((a, d) => a + d.rate, 0) / WEEKLY_DATA.length);

  const achievements = [
    { icon: "🔥", label: "7일 연속", desc: "꾸준히 복용 중", color: "#FF6584" },
    { icon: "⭐", label: "달성률 94%", desc: "이번 주 평균", color: "#FFD166" },
    { icon: "💎", label: "30일 달성", desc: "한 달 완주", color: "#6C63FF" },
  ];

  return (
    <div className="h-full overflow-y-auto hide-scrollbar" style={{ backgroundColor: t.bg }}>
      <div className="max-w-md mx-auto px-5 pt-14 pb-32 space-y-5">
        {/* Header */}
        <div className="mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#6C63FF" }}>통계</p>
          <h2 className="text-2xl font-black" style={{ color: t.text }}>복용 현황</h2>
        </div>

        {/* Hero dark card */}
        <div className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1A1A2E 0%,#16213E 100%)" }}>
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ backgroundColor: "#6C63FF20" }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">주간 달성률</p>
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
                { label: "이번 달", val: "28일" },
                { label: "연속 일수", val: "7일 🔥" },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-white font-black text-lg leading-none">{s.val}</p>
                  <p className="text-white/50 text-[10px] font-bold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly bar chart */}
        <div className="rounded-3xl p-5 shadow-sm" style={{ backgroundColor: t.card }}>
          <p className="text-sm font-bold mb-4" style={{ color: t.text }}>이번 주 복용 현황</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={WEEKLY_DATA} barSize={28} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="day" axisLine={false} tickLine={false}
                tick={{ fill: t.subtext, fontSize: 11, fontWeight: 700 }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false}
                tick={{ fill: t.subtext, fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: t.card, border: "none", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
                labelStyle={{ color: t.text, fontWeight: 700 }}
                formatter={(v: number) => [`${v}%`, "달성률"]}
                cursor={{ fill: t.divider, radius: 8 }}
              />
              <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                {WEEKLY_DATA.map((entry, i) => (
                  <Cell key={i}
                    fill={entry.day === new Date().toLocaleDateString("ko-KR", { weekday: "short" }).replace("요일", "") ? "#6C63FF" : "#6C63FF50"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Medication status */}
        <div className="rounded-3xl p-5 shadow-sm" style={{ backgroundColor: t.card }}>
          <p className="text-sm font-bold mb-4" style={{ color: t.text }}>약별 상태</p>
          {meds.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: t.subtext }}>등록된 약이 없어요</p>
          ) : (
            <div className="space-y-4">
              {meds.map(med => (
                <div key={med.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <MedIcon type={med.type} color={med.color} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: t.text }}>{med.name}</p>
                        <p className="text-[10px]" style={{ color: t.subtext }}>잔여 {med.remainingQuantity}개</p>
                      </div>
                    </div>
                    <span className="text-sm font-black" style={{ color: med.remainingQuantity < 10 ? "#FF6584" : "#06D6A0" }}>
                      {med.completed ? "✅ 완료" : "⏳ 대기"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: t.divider }}>
                    <motion.div className="h-full rounded-full"
                      animate={{ width: `${Math.min((med.remainingQuantity / 60) * 100, 100)}%` }}
                      transition={{ duration: 0.7 }}
                      style={{ backgroundColor: med.remainingQuantity < 10 ? "#FF6584" : med.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Achievements */}
        <div className="rounded-3xl p-5 shadow-sm" style={{ backgroundColor: t.card }}>
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} style={{ color: "#6C63FF" }} />
            <p className="text-sm font-bold" style={{ color: t.text }}>달성 뱃지</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map(a => (
              <div key={a.label} className="rounded-2xl p-4 text-center" style={{ backgroundColor: a.color + "15" }}>
                <span className="text-3xl">{a.icon}</span>
                <p className="text-xs font-black mt-2" style={{ color: a.color }}>{a.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.subtext }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ view, setView, dark }: { view: View; setView: (v: View) => void; dark: boolean }) {
  const t = useTheme(dark);
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl px-6 py-3 pb-6"
      style={{ backgroundColor: t.navBg, borderColor: t.divider }}>
      <div className="max-w-md mx-auto flex justify-around">
        {[
          { id: "today", icon: Calendar, label: "오늘" },
          { id: "add", icon: Plus, label: "추가" },
          { id: "stats", icon: TrendingUp, label: "통계" },
        ].map(({ id, icon: Icon, label }) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id as View)}
              className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all"
              style={{ backgroundColor: active ? "#6C63FF18" : "transparent" }}>
              <Icon size={22} style={{ color: active ? "#6C63FF" : t.subtext }} fill={active ? "#6C63FF" : "none"} />
              <span className="text-[11px] font-bold" style={{ color: active ? "#6C63FF" : t.subtext }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>("today");
  const [meds, setMeds] = usePersisted<Medication[]>("pillflow_meds", INITIAL_MEDS);
  const [dark, setDark] = usePersisted<boolean>("pillflow_dark", false);
  const [notif, setNotif] = usePersisted<boolean>("pillflow_notif", true);
  const [alarm, setAlarm] = usePersisted<string>("pillflow_alarm", "08:00");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleMed = (id: string) =>
    setMeds(prev => prev.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  const deleteMed = (id: string) =>
    setMeds(prev => prev.filter(m => m.id !== id));
  const addMed = (m: Medication) =>
    setMeds(prev => [...prev, m]);

  return (
    <div className="h-full w-full flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "today" && (
            <motion.div key="today" className="h-full"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}>
              <TodayView meds={meds} onToggle={toggleMed} onDelete={deleteMed}
                onAddClick={() => setView("add")} dark={dark} onOpenSettings={() => setSettingsOpen(true)} />
            </motion.div>
          )}
          {view === "add" && (
            <motion.div key="add" className="h-full"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>
              <AddView onBack={() => setView("today")} onSave={addMed} dark={dark} />
            </motion.div>
          )}
          {view === "stats" && (
            <motion.div key="stats" className="h-full"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>
              <StatsView meds={meds} dark={dark} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <BottomNav view={view} setView={setView} dark={dark} />

      {/* Settings */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            dark={dark} onToggleDark={() => setDark(!dark)}
            notif={notif} onToggleNotif={() => setNotif(!notif)}
            alarm={alarm} onAlarmChange={setAlarm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
