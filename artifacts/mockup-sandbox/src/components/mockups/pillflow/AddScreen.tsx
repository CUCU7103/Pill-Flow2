import { useState } from "react";
import {
  ArrowLeft,
  Pill,
  Clock,
  Calendar,
  Activity,
  Camera,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const TYPES = [
  { id: "pill", label: "알약", emoji: "💊", color: "#6C63FF" },
  { id: "capsule", label: "캡슐", emoji: "💉", color: "#FF6584" },
  { id: "liquid", label: "액상", emoji: "🧪", color: "#4FACFE" },
];
const TIMES = [
  { id: "morning", label: "아침 (08:00)", emoji: "🌅", color: "#FFD166" },
  { id: "lunch", label: "점심 (13:00)", emoji: "☀️", color: "#FF6584" },
  { id: "evening", label: "저녁 (19:00)", emoji: "🌙", color: "#6C63FF" },
];

export function AddScreen() {
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("pill");
  const [selectedTime, setSelectedTime] = useState("morning");
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4]);
  const [dosage, setDosage] = useState("1");
  const [remaining, setRemaining] = useState("30");

  const toggleDay = (i: number) =>
    setSelectedDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
    );

  return (
    <div className="min-h-screen bg-[#F5F7FF] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Status Bar */}
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-2 pb-6 flex items-center gap-4">
        <button className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">새 약 추가</h1>
          <p className="text-[11px] text-gray-400 font-medium">복용 정보를 입력해주세요</p>
        </div>
      </div>

      <div className="px-6 space-y-5 pb-32">
        {/* Drug Name */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <label className="text-[10px] font-black text-[#6C63FF] uppercase tracking-widest mb-3 block">약 이름</label>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/10 flex items-center justify-center">
              <Pill size={20} className="text-[#6C63FF]" />
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 마그네슘, 종합비타민..."
              className="flex-1 bg-transparent border-none outline-none text-base font-bold text-gray-800 placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Type Selection */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <label className="text-[10px] font-black text-[#6C63FF] uppercase tracking-widest mb-4 block">약 유형</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`py-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                  selectedType === t.id
                    ? "shadow-md scale-105"
                    : "bg-gray-50"
                }`}
                style={
                  selectedType === t.id
                    ? { background: t.color, color: "white" }
                    : {}
                }
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className={`text-xs font-bold ${selectedType === t.id ? "text-white" : "text-gray-500"}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Selection */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <label className="text-[10px] font-black text-[#6C63FF] uppercase tracking-widest mb-4 block">복용 시간</label>
          <div className="space-y-2">
            {TIMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTime(t.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                  selectedTime === t.id ? "ring-2" : "bg-gray-50"
                }`}
                style={selectedTime === t.id ? { ringColor: t.color, backgroundColor: t.color + "15" } : {}}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                  style={{ backgroundColor: t.color + "20" }}
                >
                  {t.emoji}
                </div>
                <span className="font-semibold text-sm text-gray-700">{t.label}</span>
                <div className="ml-auto">
                  {selectedTime === t.id && (
                    <CheckCircle2 size={20} style={{ color: t.color }} fill="currentColor" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Custom Time */}
          <button className="mt-3 w-full flex items-center justify-between p-3 rounded-2xl bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                <Clock size={18} className="text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-500">직접 설정</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Days */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <label className="text-[10px] font-black text-[#6C63FF] uppercase tracking-widest mb-4 block">반복 요일</label>
          <div className="flex gap-2">
            {DAY_LABELS.map((day, i) => (
              <button
                key={day}
                onClick={() => toggleDay(i)}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
                  selectedDays.includes(i)
                    ? "text-white shadow-md"
                    : "bg-gray-100 text-gray-400"
                }`}
                style={
                  selectedDays.includes(i)
                    ? { background: "linear-gradient(135deg, #6C63FF 0%, #9B8FFF 100%)" }
                    : {}
                }
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Dosage & Remaining */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#FF6584]/10 flex items-center justify-center mb-3">
              <Pill size={20} className="text-[#FF6584]" />
            </div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">복용량</label>
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-12 bg-transparent border-none outline-none text-2xl font-black text-gray-800"
              />
              <span className="text-sm text-gray-400 font-bold">정</span>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#06D6A0]/10 flex items-center justify-center mb-3">
              <Activity size={20} className="text-[#06D6A0]" />
            </div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">잔여량</label>
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
                className="w-12 bg-transparent border-none outline-none text-2xl font-black text-gray-800"
              />
              <span className="text-sm text-gray-400 font-bold">개</span>
            </div>
          </div>
        </div>

        {/* Photo */}
        <button className="bg-white rounded-3xl p-5 shadow-sm w-full flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Camera size={26} className="text-gray-400" />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-800 text-sm">사진 추가</p>
            <p className="text-xs text-gray-400 font-medium">약을 빠르게 구분하는 데 도움돼요</p>
          </div>
          <ChevronRight size={18} className="text-gray-300 ml-auto" />
        </button>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#F5F7FF] via-[#F5F7FF] to-transparent pt-12">
        <button
          className="w-full py-5 rounded-2xl text-white font-black text-base flex items-center justify-center gap-3 shadow-xl"
          style={{
            background: "linear-gradient(135deg, #6C63FF 0%, #4FACFE 100%)",
            boxShadow: "0 12px 40px -8px rgba(108, 99, 255, 0.5)",
          }}
        >
          <CheckCircle2 size={22} />
          약 저장하기
        </button>
      </div>
    </div>
  );
}
