/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Pill, 
  Clock, 
  Check, 
  Settings, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Droplets, 
  AlertCircle,
  Calendar,
  TrendingUp,
  Activity,
  CheckCircle2,
  Circle,
  Moon,
  Sun,
  Camera,
  Bell,
  Sparkles,
  Award,
  BarChart3,
  User,
  ArrowLeft,
  Trophy,
  ChevronDown,
  Home,
  BarChart2,
  Trash2,
  Sprout,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type View = 'today' | 'add' | 'stats';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosageAmount: number;
  remainingQuantity: number;
  time: string;
  category: 'morning' | 'lunch' | 'evening';
  completed: boolean;
  type: 'pill' | 'liquid' | 'capsule';
  image?: string;
}

// --- Mock Data ---
const INITIAL_MEDS: Medication[] = [
  { id: '1', name: '종합비타민', dosage: '1캡슐 • 식사 후', dosageAmount: 1, remainingQuantity: 28, time: '08:00 AM', category: 'morning', completed: true, type: 'capsule' },
  { id: '2', name: '오메가-3', dosage: '2캡슐 • 고함량', dosageAmount: 2, remainingQuantity: 60, time: '08:30 AM', category: 'morning', completed: false, type: 'pill' },
  { id: '3', name: '비타민 D3', dosage: '1000 IU • 액상형', dosageAmount: 1, remainingQuantity: 15, time: '01:00 PM', category: 'lunch', completed: false, type: 'liquid' },
];

// --- Components ---

const BottomNav = ({ currentView, setView }: { currentView: View, setView: (v: View) => void }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-outline-variant/5 px-6 pb-8 pt-2 max-w-md mx-auto">
      <div className="flex justify-around items-center">
        {[
          { id: 'today', icon: <Calendar size={24} />, label: '오늘' },
          { id: 'add', icon: <Plus size={28} />, label: '추가' },
          { id: 'stats', icon: <TrendingUp size={24} />, label: '통계' },
        ].map((item) => {
          const isActive = currentView === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => setView(item.id as View)}
              className="flex flex-col items-center gap-1 group py-2"
            >
              <div className={`w-16 h-14 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 ${
                isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant/40'
              }`}>
                {item.icon}
              </div>
              <span className={`text-[11px] font-bold transition-colors ${
                isActive ? 'text-primary' : 'text-on-surface-variant/40'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const Header = ({ 
  title, 
  showBack, 
  onBack, 
  onSettingsClick,
  rightElement
}: { 
  title: string, 
  showBack?: boolean, 
  onBack?: () => void, 
  onSettingsClick?: () => void,
  rightElement?: React.ReactNode
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl px-6 pt-8 pb-4 flex items-center justify-between max-w-md mx-auto">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-surface soft-shadow flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
          >
            <ChevronLeft size={20} />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
            A
          </div>
        )}
        <div>
          {!showBack && <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">3월 27일 금요일</p>}
          <h1 className="text-xl font-black text-primary tracking-tight leading-none">{title}</h1>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {rightElement}
        {!rightElement && !showBack && (
          <>
            <button className="w-10 h-10 rounded-full bg-surface soft-shadow flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform">
              <Bell size={20} />
            </button>
            <button 
              onClick={onSettingsClick}
              className="w-10 h-10 rounded-full bg-surface soft-shadow flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
            >
              <Settings size={20} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};

const SettingsModal = ({ isOpen, onClose, isDarkMode, onToggleDarkMode, onAlarmClick, alarmTime }: { isOpen: boolean, onClose: () => void, isDarkMode: boolean, onToggleDarkMode: () => void, onAlarmClick: () => void, alarmTime: string }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-md bg-surface rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-2xl overscroll-behavior-contain"
          >
            <div className="p-8 space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="font-headline text-2xl font-bold text-on-surface">설정</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container transition-colors">
                  <ArrowLeft className="rotate-90 text-outline" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-surface-container-low">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-container">
                    <img 
                      className="w-full h-full object-cover" 
                      src="https://picsum.photos/seed/alex/100/100" 
                      alt="Profile" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface">사용자 님</h3>
                    <p className="text-xs text-outline">qkrwnsrb224@gmail.com</p>
                  </div>
                  <button className="ml-auto p-2 text-primary font-bold text-sm">수정</button>
                </div>

                <div className="space-y-2">
                  <label className="font-label text-xs font-semibold uppercase tracking-wider text-outline px-1">앱 설정</label>
                  <div className="bg-surface-container-lowest rounded-3xl overflow-hidden border border-outline-variant/10">
                    <button 
                      onClick={onAlarmClick}
                      className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors border-b border-outline-variant/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Clock size={20} />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-on-surface block text-left">알림 시간 설정</span>
                          <span className="text-[10px] text-outline font-medium">{alarmTime}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-outline" />
                    </button>
                    <button 
                      onClick={onToggleDarkMode}
                      className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                          <Moon size={20} />
                        </div>
                        <span className="font-bold text-sm text-on-surface">다크 모드</span>
                      </div>
                      <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-primary' : 'bg-surface-container-highest'}`}>
                        <motion.div 
                          animate={{ x: isDarkMode ? 24 : 4 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-label text-xs font-semibold uppercase tracking-wider text-outline px-1">정보</label>
                  <div className="bg-surface-container-lowest rounded-3xl overflow-hidden border border-outline-variant/10">
                    <button className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors border-b border-outline-variant/10">
                      <span className="font-bold text-sm text-on-surface">버전 정보</span>
                      <span className="text-xs text-outline font-medium">v1.0.0</span>
                    </button>
                    <button className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors">
                      <span className="font-bold text-sm text-on-surface">이용 약관</span>
                      <ChevronRight size={18} className="text-outline" />
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="w-full bg-surface-container-highest text-on-surface py-4 rounded-2xl font-bold transition-all active:scale-[0.98]"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AlarmTimeModal = ({ isOpen, onClose, time, onSave }: { isOpen: boolean, onClose: () => void, time: string, onSave: (time: string) => void }) => {
  const [tempTime, setTempTime] = useState(time);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-xs bg-surface rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-2xl p-8 space-y-6 overscroll-behavior-contain"
          >
            <div className="text-center space-y-2">
              <h3 className="font-headline text-xl font-bold text-on-surface">알림 시간 설정</h3>
              <p className="text-xs text-outline">매일 아침 복용 알림을 받을 시간을 선택하세요.</p>
            </div>

            <div className="flex justify-center">
              <input 
                type="time" 
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="text-4xl font-headline font-extrabold text-primary bg-surface-container-low p-6 rounded-3xl border-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl font-bold text-outline hover:bg-surface-container transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  onSave(tempTime);
                  onClose();
                }}
                className="flex-1 bg-primary text-on-primary py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-[0.95] transition-all"
              >
                저장
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const TodayView = ({ meds, toggleMed, onDelete, onAddClick }: { meds: Medication[], toggleMed: (id: string) => void, onDelete: (id: string) => void, onAddClick: () => void }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const completedCount = meds.filter(m => m.completed).length;
  const progress = Math.round((completedCount / meds.length) * 100) || 0;
  const remainingCount = meds.length - completedCount;

  const groupedMeds = meds.reduce((acc, med) => {
    const time = med.category === 'morning' ? '아침' : med.category === 'lunch' ? '점심' : '저녁';
    if (!acc[time]) acc[time] = [];
    acc[time].push(med);
    return acc;
  }, {} as Record<string, Medication[]>);

  return (
    <div className="pt-24 px-6 pb-32 max-w-md mx-auto flex flex-col gap-6">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-on-surface/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-surface-container-lowest w-full max-w-xs rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-outline-variant/10"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-on-surface">정말 삭제할까요?</h3>
                <p className="text-sm text-on-surface-variant opacity-60">삭제된 정보는 복구할 수 없습니다.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-4 rounded-2xl bg-surface-container text-on-surface font-bold text-sm active:scale-95 transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={() => {
                    onDelete(deleteId);
                    setDeleteId(null);
                  }}
                  className="flex-1 py-4 rounded-2xl bg-error text-white font-bold text-sm active:scale-95 transition-all shadow-lg shadow-error/20"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#6366F1] to-[#3B82F6] dark:from-[#6366F1]/80 dark:to-[#3B82F6]/80 p-8 text-white editorial-shadow border border-white/10">
        {/* Decorative Circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        
        <div className="relative z-10">
          <p className="text-sm font-medium opacity-80 mb-2">오늘의 달성률</p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-6xl font-black tracking-tighter">{progress}</span>
            <span className="text-2xl font-bold opacity-80">%</span>
          </div>
          <p className="text-sm font-medium mb-6">아직 {remainingCount}개가 남았어요</p>
          
          <div className="w-full h-3 bg-white/20 rounded-full mb-4 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-white rounded-full"
            />
          </div>
          
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="opacity-80">{completedCount}/{meds.length} 복용</span>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1">
              <span>연속 7일</span>
              <span>🔥</span>
            </div>
          </div>
        </div>
        
        <div className="absolute top-6 right-6 w-20 h-20 bg-white/15 rounded-[2rem] flex items-center justify-center backdrop-blur-md border border-white/10">
          <Sparkles size={32} className="text-white/60" />
        </div>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '오늘', value: `${completedCount}/${meds.length}`, icon: <Pill size={18} className="text-primary" /> },
          { label: '이번주', value: '94%', icon: <TrendingUp size={18} className="text-secondary" /> },
          { label: '잔여일', value: '15일', icon: <Clock size={18} className="text-tertiary" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-surface rounded-[1.5rem] p-4 soft-shadow flex flex-col gap-2 border border-outline-variant/10">
            <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center">
              {stat.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-on-surface tracking-tight">{stat.value}</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Medication List */}
      <div className="flex flex-col gap-8 mt-2">
        {['아침', '점심', '저녁'].map((timeLabel) => {
          const sectionMeds = groupedMeds[timeLabel] || [];
          if (sectionMeds.length === 0 && timeLabel === '저녁') return null;
          
          return (
            <div key={timeLabel}>
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{timeLabel === '아침' ? '🌅' : timeLabel === '점심' ? '☀️' : '🌙'}</span>
                  <h3 className="text-base font-bold text-on-surface">{timeLabel}</h3>
                </div>
                <span className="text-xs font-bold text-on-surface-variant opacity-40">
                  {sectionMeds.filter(m => m.completed).length}/{sectionMeds.length}
                </span>
              </div>
              
              <div className="space-y-4">
                {sectionMeds.map((med) => (
                  <motion.div
                    key={med.id}
                    layout
                    className={`relative overflow-hidden rounded-[2rem] bg-surface soft-shadow p-5 flex items-center gap-4 border-l-[6px] transition-all active:scale-[0.98] border-outline-variant/10 ${
                      med.category === 'morning' ? 'border-l-primary' : 
                      med.category === 'lunch' ? 'border-l-secondary' : 'border-l-tertiary'
                    }`}
                  >
            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden flex-shrink-0 border border-outline-variant/10">
                      {med.image ? (
                        <img src={med.image} alt={med.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-primary/40 text-2xl">
                          {med.type === 'pill' ? '💊' : med.type === 'capsule' ? '💊' : '💧'}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-base font-bold truncate ${med.completed ? 'text-on-surface-variant/30 line-through' : 'text-on-surface'}`}>
                          {med.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-on-surface-variant opacity-50 uppercase">{med.time}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(med.id);
                            }}
                            className="p-1 text-on-surface-variant/20 hover:text-error transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-on-surface-variant opacity-60">
                        <span>{med.dosageAmount}정 · {med.dosage}</span>
                        <span className="text-secondary">잔여 {med.remainingQuantity}개</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleMed(med.id)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                        med.completed 
                          ? 'bg-primary text-white scale-110' 
                          : 'bg-surface-container text-transparent'
                      }`}
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-32 right-6 z-50">
        <button 
          onClick={onAddClick}
          className="w-16 h-16 rounded-[1.5rem] bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center active:scale-90 transition-transform"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};

const TimePickerModal = ({ 
  isOpen, 
  onClose, 
  initialTime, 
  onConfirm 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  initialTime: string, 
  onConfirm: (time: string) => void 
}) => {
  const [hoursInput, setHoursInput] = useState(() => {
    const h = parseInt(initialTime.split(':')[0]);
    return (h % 12 || 12).toString();
  });
  const [minutesInput, setMinutesInput] = useState(() => initialTime.split(':')[1]);
  const [ampm, setAmpm] = useState(() => parseInt(initialTime.split(':')[0]) >= 12 ? 'PM' : 'AM');

  if (!isOpen) return null;

  const handleConfirm = () => {
    let h = parseInt(hoursInput);
    if (isNaN(h)) h = 12;
    h = Math.max(1, Math.min(12, h));

    let m = parseInt(minutesInput);
    if (isNaN(m)) m = 0;
    m = Math.max(0, Math.min(59, m));

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    onConfirm(timeString);
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/20 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-surface-container-lowest w-full max-w-xs rounded-[2.5rem] editorial-shadow overflow-y-auto max-h-[90vh]"
      >
        <div className="p-8 space-y-8">
          <div className="text-center">
            <h3 className="font-headline text-xl font-bold text-primary">시간 설정</h3>
            <p className="text-xs text-outline mt-1">복용 시간을 직접 입력해주세요</p>
          </div>

          <div className="flex flex-col items-center gap-6">
            {/* AM/PM Toggle */}
            <div className="flex bg-surface-container-low p-1 rounded-2xl w-full">
              {['AM', 'PM'].map(val => (
                <button 
                  key={val}
                  onClick={() => setAmpm(val)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${ampm === val ? 'bg-primary text-on-primary shadow-md' : 'text-outline hover:text-primary'}`}
                >
                  {val === 'AM' ? '오전' : '오후'}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              {/* Hours Input */}
              <div className="flex flex-col items-center gap-2">
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={hoursInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                    setHoursInput(val);
                  }}
                  onBlur={() => {
                    let h = parseInt(hoursInput);
                    if (isNaN(h) || h < 1) setHoursInput('1');
                    else if (h > 12) setHoursInput('12');
                    else setHoursInput(h.toString());
                  }}
                  className="w-20 h-20 text-center text-4xl font-headline font-bold bg-surface-container-highest rounded-3xl text-primary focus:ring-2 focus:ring-primary outline-none transition-all"
                />
                <span className="text-[10px] font-bold text-outline uppercase tracking-widest">시</span>
              </div>

              <div className="text-primary font-bold text-4xl mb-6">:</div>

              {/* Minutes Input */}
              <div className="flex flex-col items-center gap-2">
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={minutesInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                    setMinutesInput(val);
                  }}
                  onBlur={() => {
                    let m = parseInt(minutesInput);
                    if (isNaN(m) || m < 0) setMinutesInput('00');
                    else if (m > 59) setMinutesInput('59');
                    else setMinutesInput(m.toString().padStart(2, '0'));
                  }}
                  className="w-20 h-20 text-center text-4xl font-headline font-bold bg-surface-container-highest rounded-3xl text-primary focus:ring-2 focus:ring-primary outline-none transition-all"
                />
                <span className="text-[10px] font-bold text-outline uppercase tracking-widest">분</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl bg-surface-container text-outline font-bold text-sm active:scale-95 transition-all"
            >
              취소
            </button>
            <button 
              onClick={handleConfirm}
              className="flex-1 py-4 rounded-2xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              확인
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AddMedicationView = ({ onBack, onSave, isTimePickerOpen, setIsTimePickerOpen }: { onBack: () => void, onSave: (med: Medication) => void, isTimePickerOpen: boolean, setIsTimePickerOpen: (o: boolean) => void }) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [dosage, setDosage] = useState('1');
  const [remaining, setRemaining] = useState('30');
  const [type, setType] = useState<'pill' | 'capsule' | 'liquid'>('pill');
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    const h = parseInt(time.split(':')[0]);
    let category: Medication['category'] = 'morning';
    if (h >= 11 && h < 16) category = 'lunch';
    if (h >= 16) category = 'evening';

    const newMed: Medication = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      dosage: `${dosage}정`,
      dosageAmount: parseInt(dosage) || 1,
      remainingQuantity: parseInt(remaining) || 0,
      time: formatTimeDisplay(time),
      category,
      completed: false,
      type,
      image: image || undefined
    };
    onSave(newMed);
    onBack();
  };

  const toggleDay = (index: number) => {
    setSelectedDays(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const formatTimeDisplay = (t: string) => {
    const [hours, minutes] = t.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  return (
    <div className="pt-24 pb-40 px-6 max-w-md mx-auto flex flex-col gap-8">
      {/* Header Info */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-12 h-12 rounded-full bg-surface soft-shadow flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-on-surface tracking-tight">새 약 추가</h2>
          <p className="text-xs font-bold text-on-surface-variant/40">복용 정보를 입력해주세요</p>
        </div>
      </div>

      {/* Form Sections */}
      <div className="flex flex-col gap-6">
        {/* Name Section */}
        <div className="bg-surface rounded-[2rem] p-6 soft-shadow space-y-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">약 이름</p>
          <div className="flex items-center gap-4 bg-surface-container/30 rounded-2xl px-4 py-3 border border-outline-variant/20">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Pill size={20} />
            </div>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 마그네슘, 종합비타민..."
              className="flex-1 bg-transparent border-none outline-none font-bold text-on-surface placeholder:text-on-surface-variant/20"
            />
          </div>
        </div>

        {/* Type Section */}
        <div className="bg-surface rounded-[2rem] p-6 soft-shadow space-y-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">약 유형</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'pill', label: '알약', icon: '💊' },
              { id: 'capsule', label: '캡슐', icon: '💊' },
              { id: 'liquid', label: '액상', icon: '💧' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id as any)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                  type === t.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-surface-container/30 text-on-surface-variant/60'
                }`}
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-xs font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Section */}
        <div className="bg-surface rounded-[2rem] p-6 soft-shadow space-y-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">복용 시간</p>
          <div className="flex flex-col gap-2">
            {[
              { label: '아침 (08:00)', time: '08:00', icon: '🌅' },
              { label: '점심 (13:00)', time: '13:00', icon: '☀️' },
              { label: '저녁 (19:00)', time: '19:00', icon: '🌙' },
            ].map((item) => (
              <button
                key={item.time}
                onClick={() => setTime(item.time)}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${
                  time === item.time ? 'border-primary bg-primary/5' : 'border-transparent bg-surface-container/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-bold text-on-surface">{item.label}</span>
                </div>
                <div className={`w-4 h-4 rounded-full ${time === item.time ? 'bg-primary' : 'bg-surface-container-highest'}`} />
              </button>
            ))}
            <button 
              onClick={() => setIsTimePickerOpen(true)}
              className="flex items-center justify-between p-4 rounded-2xl bg-surface-container/30 text-on-surface-variant/60"
            >
              <div className="flex items-center gap-3">
                <Clock size={20} />
                <span className="font-bold">직접 설정</span>
              </div>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days Section */}
        <div className="bg-surface rounded-[2rem] p-6 soft-shadow space-y-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">반복 요일</p>
          <div className="flex justify-between">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <button 
                key={day}
                onClick={() => toggleDay(i)}
                className={`w-10 h-10 rounded-xl font-bold text-xs transition-all ${
                  selectedDays.includes(i) ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-container/30 text-on-surface-variant/40'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Dosage & Remaining Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-[2rem] p-6 soft-shadow space-y-4 border border-outline-variant/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center text-error">
                <Pill size={16} />
              </div>
              <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">복용량</p>
            </div>
            <div className="flex items-baseline gap-1">
              <input 
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full bg-transparent border-none outline-none font-black text-3xl text-on-surface"
              />
              <span className="text-sm font-bold text-on-surface-variant/40">정</span>
            </div>
          </div>
          <div className="bg-surface rounded-[2rem] p-6 soft-shadow space-y-4 border border-outline-variant/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <Activity size={16} />
              </div>
              <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">잔여량</p>
            </div>
            <div className="flex items-baseline gap-1">
              <input 
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
                className="w-full bg-transparent border-none outline-none font-black text-3xl text-on-surface"
              />
              <span className="text-sm font-bold text-on-surface-variant/40">개</span>
            </div>
          </div>
        </div>

        {/* Photo Section */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="bg-surface rounded-[2rem] p-6 soft-shadow flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-container/30 flex items-center justify-center text-on-surface-variant/40 overflow-hidden">
              {image ? <img src={image} className="w-full h-full object-cover" /> : <Camera size={24} />}
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">사진 추가</p>
              <p className="text-[10px] font-medium text-on-surface-variant/40">약을 빠르게 구분하는 데 도움돼요</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-on-surface-variant/20" />
          <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-32 left-0 right-0 px-6 max-w-md mx-auto">
        <button 
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full bg-gradient-to-r from-primary-container to-primary dark:from-primary dark:to-primary-container text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={24} />
          약 저장하기
        </button>
      </div>

      <AnimatePresence>
        {isTimePickerOpen && (
          <TimePickerModal 
            isOpen={isTimePickerOpen}
            onClose={() => setIsTimePickerOpen(false)}
            initialTime={time}
            onConfirm={(newTime) => setTime(newTime)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
const StatsView = ({ meds }: { meds: Medication[] }) => {
  const completionRate = 94; // Mock data for design
  const weeklyData = [
    { day: '월', rate: 100 },
    { day: '화', rate: 85 },
    { day: '수', rate: 100 },
    { day: '목', rate: 90 },
    { day: '금', rate: 100 },
    { day: '토', rate: 70 },
    { day: '일', rate: 0 },
  ];

  return (
    <div className="pt-24 pb-40 px-6 max-w-md mx-auto flex flex-col gap-8">
      {/* Monthly Summary Card */}
      <div className="bg-surface rounded-[2.5rem] p-8 soft-shadow space-y-8 border border-outline-variant/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">전체 복용 이행률</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black text-on-surface">{completionRate}%</h3>
              <span className="text-xs font-bold text-success">+2% 향상</span>
            </div>
          </div>
          <div className="relative w-20 h-20">
            <svg className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-container" />
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 36}`} strokeDashoffset={`${2 * Math.PI * 36 * (1 - completionRate / 100)}`} className="text-primary" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Trophy size={20} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${completionRate}%` }}
            className="h-full bg-gradient-to-r from-primary to-secondary"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '연속 달성', value: '7일', icon: '🔥', color: 'bg-primary/10 text-primary' },
            { label: '총 복용', value: '124회', icon: '💊', color: 'bg-secondary/10 text-secondary' },
            { label: '최고 기록', value: '28일', icon: '⭐', color: 'bg-tertiary/10 text-tertiary' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center text-lg`}>
                {stat.icon}
              </div>
              <p className="text-[10px] font-bold text-on-surface-variant/40">{stat.label}</p>
              <p className="text-sm font-black text-on-surface">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Activity Card */}
      <div className="bg-surface rounded-[2.5rem] p-8 soft-shadow space-y-6 border border-outline-variant/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">주간 복용률</p>
            <h3 className="text-xl font-black text-on-surface">7일 연속 달성 중!</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="flex items-end justify-between h-32 pt-4">
          {weeklyData.map((data) => (
            <div key={data.day} className="flex flex-col items-center gap-3 flex-1">
              <div className="relative w-full flex justify-center items-end h-full">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${data.rate}%` }}
                  className={`w-3 rounded-full ${data.rate === 100 ? 'bg-primary' : 'bg-surface-container-high'}`}
                />
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant/40">{data.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">달성 뱃지</p>
          <button className="text-[10px] font-bold text-primary">전체보기</button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {[
            { name: '꾸준함의 정석', icon: <Trophy className="w-8 h-8 text-white" strokeWidth={1.5} />, color: 'from-yellow-400 to-orange-500' },
            { name: '첫 걸음', icon: <Sprout className="w-8 h-8 text-white" strokeWidth={1.5} />, color: 'from-green-400 to-emerald-600' },
            { name: '건강 지킴이', icon: <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.5} />, color: 'from-blue-400 to-indigo-600' },
            { name: '완벽한 한 주', icon: <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />, color: 'from-purple-400 to-pink-600' },
          ].map((badge) => (
            <div key={badge.name} className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center shadow-lg shadow-black/5`}>
                {badge.icon}
              </div>
              <p className="text-[10px] font-bold text-on-surface-variant/60">{badge.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Low Medication Alerts */}
      <div className="space-y-4">
        <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-2">잔여량 부족 알림</p>
        <div className="flex flex-col gap-3">
          {meds.filter(m => m.remainingQuantity < 5).map(med => (
            <div key={med.id} className="bg-error/10 rounded-2xl p-4 flex items-center justify-between border border-error/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-error">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">{med.name}</h4>
                  <p className="text-[10px] font-medium text-error">잔여량이 {med.remainingQuantity}개 남았습니다</p>
                </div>
              </div>
              <button className="px-4 py-2 rounded-xl bg-error text-white text-xs font-bold">구매하기</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<View>('today');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  const [alarmTime, setAlarmTime] = useState(() => {
    return localStorage.getItem('alarmTime') || '08:00';
  });
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [meds, setMeds] = useState<Medication[]>(() => {
    const saved = localStorage.getItem('meds');
    return saved ? JSON.parse(saved) : INITIAL_MEDS;
  });

  useEffect(() => {
    localStorage.setItem('meds', JSON.stringify(meds));
  }, [meds]);

  useEffect(() => {
    localStorage.setItem('darkMode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('alarmTime', alarmTime);
  }, [alarmTime]);

  const toggleMed = (id: string) => {
    setMeds(prev => prev.map(m => {
      if (m.id === id) {
        const newCompleted = !m.completed;
        const newRemaining = newCompleted 
          ? Math.max(0, m.remainingQuantity - m.dosageAmount) 
          : m.remainingQuantity + m.dosageAmount;
        return { ...m, completed: newCompleted, remainingQuantity: newRemaining };
      }
      return m;
    }));
  };

  const deleteMed = (id: string) => {
    setMeds(prev => prev.filter(m => m.id !== id));
  };

  const currentTitle = {
    today: '필플로우',
    add: '새로운 복용 추가',
    stats: '복용 통계'
  }[view];

  const isAnyModalOpen = isSettingsOpen || isAlarmModalOpen || isTimePickerOpen;

  return (
    <div className={`h-screen bg-background pb-32 overflow-x-hidden ${isAnyModalOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      {view !== 'add' && (
        <Header 
          title={view === 'today' ? '필플로우' : '통계'} 
          showBack={false} 
          onSettingsClick={() => setIsSettingsOpen(true)}
          rightElement={view === 'stats' ? (
            <button className="px-4 py-2 rounded-full bg-surface soft-shadow flex items-center gap-2 text-[10px] font-bold text-on-surface-variant">
              2026년 3월 <ChevronDown size={12} />
            </button>
          ) : undefined}
        />
      )}
      
      <main className="relative z-0">
        <AnimatePresence mode="wait">
          {view === 'today' && (
            <motion.div
              key="today"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TodayView meds={meds} toggleMed={toggleMed} onDelete={deleteMed} onAddClick={() => setView('add')} />
            </motion.div>
          )}
          {view === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <AddMedicationView 
                onBack={() => setView('today')} 
                onSave={(newMed) => setMeds(prev => [...prev, newMed])}
                isTimePickerOpen={isTimePickerOpen}
                setIsTimePickerOpen={setIsTimePickerOpen}
              />
            </motion.div>
          )}
          {view === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StatsView meds={meds} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {view !== 'add' && <BottomNav currentView={view} setView={setView} />}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onAlarmClick={() => setIsAlarmModalOpen(true)}
        alarmTime={alarmTime}
      />

      <AlarmTimeModal 
        isOpen={isAlarmModalOpen}
        onClose={() => setIsAlarmModalOpen(false)}
        time={alarmTime}
        onSave={setAlarmTime}
      />
    </div>
  );
}
