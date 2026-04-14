import type { Medication } from "./types";

// ─── 앱 버전 ─────────────────────────────────────────────────────────────────
export const APP_VERSION = "1.0.0";

// ─── 약 색상 팔레트 ──────────────────────────────────────────────────────────
export const MED_COLORS = [
  "#6C63FF",
  "#FF6584",
  "#FFD166",
  "#06D6A0",
  "#4FACFE",
  "#F97316",
];

// ─── 초기 약 데이터 ──────────────────────────────────────────────────────────
export const INITIAL_MEDS: Medication[] = [
  {
    id: "1",
    name: "종합비타민",
    dosage: "1캡슐 · 식사 후",
    dosageAmount: 1,
    remainingQuantity: 28,
    time: "08:00 AM",
    category: "morning",
    completed: false,
    type: "capsule",
    color: "#6C63FF",
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  },
  {
    id: "2",
    name: "오메가-3",
    dosage: "2캡슐 · 고함량",
    dosageAmount: 2,
    remainingQuantity: 60,
    time: "08:30 AM",
    category: "morning",
    completed: false,
    type: "pill",
    color: "#FF6584",
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  },
  {
    id: "3",
    name: "비타민 D3",
    dosage: "1000 IU · 액상형",
    dosageAmount: 1,
    remainingQuantity: 15,
    time: "01:00 PM",
    category: "lunch",
    completed: false,
    type: "liquid",
    color: "#FFD166",
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  },
];

// ─── 주간 통계 데이터 (TODO: 백엔드 연동 후 실제 데이터로 교체) ─────────────
export const WEEKLY_DATA = [
  { day: "월", rate: 80 },
  { day: "화", rate: 100 },
  { day: "수", rate: 60 },
  { day: "목", rate: 100 },
  { day: "금", rate: 90 },
  { day: "토", rate: 40 },
  { day: "일", rate: 75 },
];
