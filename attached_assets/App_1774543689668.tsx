/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Pill, 
  Activity, 
  Droplets, 
  Moon, 
  Calendar as CalendarIcon, 
  PlusCircle, 
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Camera,
  ArrowLeft,
  Clock,
  AlertCircle
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
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface/80 dark:bg-surface-container/80 backdrop-blur-2xl rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.2)] px-6 pb-8 pt-4 border-t border-outline-variant/10">
      <div className="max-w-md mx-auto flex justify-around items-center">
        <button 
          onClick={() => setView('today')}
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all ${currentView === 'today' ? 'bg-primary/10 text-primary' : 'text-on-surface/40'}`}
        >
          <CalendarIcon size={24} fill={currentView === 'today' ? 'currentColor' : 'none'} className={currentView === 'today' ? 'text-primary' : 'text-outline'} />
          <span className="text-[11px] font-bold">오늘</span>
        </button>
        <button 
          onClick={() => setView('add')}
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all ${currentView === 'add' ? 'bg-primary/10 text-primary' : 'text-on-surface/40'}`}
        >
          <PlusCircle size={24} fill={currentView === 'add' ? 'currentColor' : 'none'} className={currentView === 'add' ? 'text-primary' : 'text-outline'} />
          <span className="text-[11px] font-bold">추가</span>
        </button>
        <button 
          onClick={() => setView('stats')}
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all ${currentView === 'stats' ? 'bg-primary/10 text-primary' : 'text-on-surface/40'}`}
        >
          <TrendingUp size={24} fill={currentView === 'stats' ? 'currentColor' : 'none'} className={currentView === 'stats' ? 'text-primary' : 'text-outline'} />
          <span className="text-[11px] font-bold">통계</span>
        </button>
      </div>
    </nav>
  );
};

const Header = ({ title, showBack, onBack, onSettingsClick }: { title: string, showBack?: boolean, onBack?: () => void, onSettingsClick?: () => void }) => (
  <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl">
    <div className="flex justify-between items-center px-6 py-4 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <ArrowLeft size={24} className="text-primary" />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary-container">
            <img 
              className="w-full h-full object-cover" 
              src="https://picsum.photos/seed/alex/100/100" 
              alt="Profile" 
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-primary">{title}</h1>
      </div>
      {!showBack && (
        <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-surface-container transition-colors">
          <Settings size={24} className="text-primary" />
        </button>
      )}
    </div>
  </header>
);

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

const TodayView = ({ meds, toggleMed, onAddClick }: { meds: Medication[], toggleMed: (id: string) => void, onAddClick: () => void }) => {
  const completedCount = meds.filter(m => m.completed).length;
  const progress = Math.round((completedCount / meds.length) * 100) || 0;
  const remainingCount = meds.length - completedCount;

  const renderSection = (title: string, category: Medication['category']) => {
    const sectionMeds = meds.filter(m => m.category === category);
    if (sectionMeds.length === 0 && category === 'evening') {
      return (
        <div className="mt-8">
          <div className="flex items-center gap-4 mb-6 opacity-40">
            <h3 className="font-label text-xs font-semibold uppercase tracking-widest">저녁</h3>
            <div className="h-[1px] flex-grow bg-surface-container-highest"></div>
          </div>
          <div className="p-8 text-center bg-surface-container-low rounded-[2rem] border border-dashed border-outline-variant/30 flex flex-col items-center gap-2">
            <Moon size={24} className="text-outline-variant" />
            <p className="text-xs font-medium text-on-surface-variant">오늘 저녁에 예정된 일정이 없습니다.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-8">
        <div className="flex items-center gap-4 mb-6">
          <h3 className={`font-label text-xs font-semibold uppercase tracking-widest ${category === 'morning' ? 'text-secondary' : 'text-primary'}`}>{title}</h3>
          <div className="h-[1px] flex-grow bg-surface-container-highest opacity-50"></div>
        </div>
        <div className="space-y-4">
          {sectionMeds.map(med => (
            <motion.div 
              key={med.id}
              layout
              className="bg-surface-container-lowest p-5 rounded-[1.5rem] editorial-shadow flex items-center gap-4 transition-all active:scale-95"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${med.type === 'capsule' ? 'bg-secondary-container text-on-secondary-container' : med.type === 'pill' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                {med.image ? (
                  <img src={med.image} alt={med.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  med.type === 'capsule' ? <Pill size={20} /> : med.type === 'pill' ? <Activity size={20} /> : <Droplets size={20} />
                )}
              </div>
              <div className="flex-grow">
                <div className="flex justify-between items-start">
                  <h4 className="font-headline text-lg font-bold text-on-surface">{med.name}</h4>
                  <span className="font-label text-[10px] font-bold text-outline uppercase tracking-tighter">{med.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-on-surface-variant font-medium">{med.dosage}</p>
                  <span className="text-[10px] text-outline">•</span>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">잔여: {med.remainingQuantity}개</p>
                </div>
              </div>
              <button 
                onClick={() => toggleMed(med.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${med.completed ? 'bg-primary/10 text-primary' : 'bg-surface-container border border-outline-variant/20 text-outline-variant'}`}
              >
                {med.completed ? <CheckCircle2 size={24} fill="currentColor" className="text-primary" /> : <Circle size={24} />}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="pt-24 px-6 pb-32 max-w-md mx-auto">
      <section className="mb-10">
        <p className="font-label text-xs font-semibold uppercase tracking-wider text-primary mb-1">{currentDate}</p>
        <h2 className="font-headline text-4xl font-extrabold tracking-tight leading-tight">좋은 아침이에요,<br />알렉스님</h2>
        
        <div className="mt-8 p-6 rounded-[2rem] bg-gradient-to-br from-primary to-primary-container text-on-primary editorial-shadow relative overflow-hidden">
          <div className="relative z-10">
            <p className="font-label text-[11px] font-semibold uppercase tracking-widest opacity-80">일일 달성도</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="font-headline text-5xl font-bold">{progress}</span>
              <span className="font-headline text-2xl font-bold opacity-70 mb-1.5">%</span>
            </div>
            <p className="mt-4 text-sm font-medium opacity-90">
              {progress === 100 ? "대단해요! 오늘의 모든 약을 복용했습니다." : `거의 다 왔어요! 오늘 남은 약은 ${remainingCount}개입니다.`}
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      </section>

      <section>
        {renderSection('아침', 'morning')}
        {renderSection('점심', 'lunch')}
        {renderSection('저녁', 'evening')}
      </section>

      <div className="fixed bottom-32 right-6 z-50">
        <button 
          onClick={onAddClick}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-[0_12px_32px_rgba(0,98,142,0.3)] flex items-center justify-center active:scale-90 transition-transform"
        >
          <Plus size={32} />
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
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 2, 4]);
  const [dosage, setDosage] = useState('1');
  const [remaining, setRemaining] = useState('30');
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
    if (!name.trim()) {
      alert('약 이름을 입력해주세요.');
      return;
    }
    
    const h = parseInt(time.split(':')[0]);
    let category: Medication['category'] = 'morning';
    if (h >= 11 && h < 16) category = 'lunch';
    if (h >= 16) category = 'evening';

    // Clean up dosage and remaining strings
    const cleanDosage = dosage.includes('정') || dosage.includes('캡슐') ? dosage : `${dosage}정`;
    const cleanRemaining = remaining.includes('정') || remaining.includes('개') ? remaining : `${remaining}정`;

    const newMed: Medication = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      dosage: cleanDosage,
      dosageAmount: parseInt(dosage) || 1,
      remainingQuantity: parseInt(remaining) || 0,
      time: formatTimeDisplay(time),
      category,
      completed: false,
      type: 'pill',
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
    <div className="pt-24 pb-32 px-6 max-w-md mx-auto">
      <div className="space-y-10">
        <section className="space-y-4">
          <label className="font-label text-xs font-semibold uppercase tracking-wider text-outline px-1">약 이름</label>
          <div className="relative group">
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant font-medium" 
              placeholder="예: 마그네슘" 
              type="text" 
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Pill className="text-outline-variant" size={20} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <label className="font-label text-xs font-semibold uppercase tracking-wider text-outline px-1">시간 및 일정</label>
          <div className="bg-surface-container-low rounded-3xl p-6 space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-on-surface font-bold text-lg">알림 시간</span>
                <p className="text-xs text-outline">알림을 받을 시간을 설정하세요</p>
              </div>
              <button 
                onClick={() => setIsTimePickerOpen(true)}
                className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
              >
                <span className="font-headline text-3xl font-extrabold">{formatTimeDisplay(time)}</span>
                <Clock size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <span className="text-xs font-semibold text-outline">반복 요일</span>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-4 -mx-2 px-2">
                {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                  <button 
                    key={day}
                    onClick={() => toggleDay(i)}
                    className={`shrink-0 w-14 py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 ${selectedDays.includes(i) ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container-highest text-on-surface-variant'}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <label className="font-label text-xs font-semibold uppercase tracking-wider text-outline px-1">복용 상세 정보</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low p-5 rounded-3xl flex items-center gap-4 transition-all hover:bg-surface-container-highest group">
              <div className="w-12 h-12 rounded-2xl bg-secondary-container/30 flex items-center justify-center shrink-0">
                <Pill size={24} className="text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] text-outline font-bold uppercase tracking-widest mb-1">복용량</span>
                <input 
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full bg-transparent border-none p-0 focus:ring-0 font-headline text-xl font-extrabold text-on-surface placeholder:text-outline-variant"
                  placeholder="예: 1정"
                />
              </div>
            </div>
            <div className="bg-surface-container-low p-5 rounded-3xl flex items-center gap-4 transition-all hover:bg-surface-container-highest group">
              <div className="w-12 h-12 rounded-2xl bg-tertiary-fixed/30 flex items-center justify-center shrink-0">
                <Activity size={24} className="text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] text-outline font-bold uppercase tracking-widest mb-1">잔여량</span>
                <input 
                  value={remaining}
                  onChange={(e) => setRemaining(e.target.value)}
                  className="w-full bg-transparent border-none p-0 focus:ring-0 font-headline text-xl font-extrabold text-on-surface placeholder:text-outline-variant"
                  placeholder="예: 30정"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/10">
            <div className="flex items-center gap-4 mb-6">
              {image ? (
                <img 
                  src={image} 
                  alt="Preview" 
                  className="w-16 h-16 rounded-2xl object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-outline-variant">
                  <Camera size={32} />
                </div>
              )}
              <div>
                <span className="text-sm font-bold text-on-surface block">시각적 구분</span>
                <p className="text-xs text-outline">선택사항: 빠른 식별을 도와줍니다</p>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/*" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-xl bg-surface-container-highest text-primary font-bold text-sm hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
            >
              <Camera size={18} /> {image ? '사진 변경' : '사진 업데이트'}
            </button>
          </div>
        </section>

        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background to-transparent pt-12 z-50">
          <div className="max-w-md mx-auto">
            <button 
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-5 rounded-2xl font-headline font-bold text-lg shadow-[0_12px_40px_-12px_rgba(0,98,142,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle2 size={24} /> 약 저장하기
            </button>
          </div>
        </div>
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
  const lowMeds = meds.filter(m => m.remainingQuantity < 10); // 10개 미만일 때 알림

  const currentYearMonth = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="pt-24 pb-32 px-6 max-w-md mx-auto space-y-8">
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-headline text-3xl font-bold text-on-surface tracking-tight">통계</h2>
          <span className="font-label text-xs font-semibold uppercase tracking-wider text-primary">월간 요약</span>
        </div>
        <div className="p-6 rounded-[2rem] bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-xl overflow-hidden relative">
          <div className="relative z-10">
            <p className="font-label text-xs font-semibold uppercase tracking-widest opacity-80">전체 복용 이행률</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-headline text-5xl font-extrabold tracking-tighter">94%</span>
              <span className="font-body text-sm opacity-90">지난달 대비 +2%</span>
            </div>
            <div className="mt-6 h-3 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '94%' }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-white rounded-full"
              />
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-headline text-lg font-bold text-on-surface">주간 연속 기록</h3>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm -mx-1 px-5">
          {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
            <div key={day} className="flex flex-col items-center gap-2 shrink-0">
              <span className={`font-label text-[10px] font-bold uppercase tracking-tighter ${i === 4 ? 'text-primary' : 'text-outline'}`}>{day}</span>
              {i < 3 ? (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <CheckCircle2 size={18} fill="currentColor" />
                </div>
              ) : i === 4 ? (
                <div className="w-12 h-12 rounded-full bg-primary text-on-primary shadow-lg shadow-primary/20 flex items-center justify-center">
                  <span className="font-bold text-xs">오늘</span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-outline-variant">
                  <span className="font-bold text-xs">{day === '토' || day === '일' ? 'S' : <Circle size={18} />}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-headline text-lg font-bold text-on-surface">복용 기록</h3>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/30"></div>
              <span className="text-[10px] font-semibold text-outline uppercase tracking-tighter">완료</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-surface-container-highest"></div>
              <span className="text-[10px] font-semibold text-outline uppercase tracking-tighter">미복용</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-[2rem] shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <button className="p-2 hover:bg-surface-container rounded-full transition-colors"><ChevronLeft size={20} /></button>
            <span className="font-headline font-bold text-primary">{currentYearMonth}</span>
            <button className="p-2 hover:bg-surface-container rounded-full transition-colors"><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 gap-y-4 text-center">
            {['월', '화', '수', '목', '금', '토', '일'].map(d => (
              <div key={d} className="font-label text-[10px] font-bold text-outline/60 uppercase">{d}</div>
            ))}
            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1;
              const isMissed = day === 5;
              const isCompleted = day < 14 && day !== 5;
              const isToday = day === 14;
              
              return (
                <div key={i} className="py-2 flex items-center justify-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isMissed ? 'bg-surface-container-highest text-outline-variant' : 
                    isCompleted ? 'bg-primary/15 text-primary' : 
                    isToday ? 'bg-primary text-on-primary ring-4 ring-primary/20' : 
                    'text-outline/40'
                  }`}>
                    {day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-headline text-lg font-bold text-on-surface">잔여량 알림</h3>
        <div className="space-y-3">
          {lowMeds.length > 0 ? (
            lowMeds.map(med => (
              <div key={med.id} className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-4 border border-error/10">
                <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-on-surface text-sm">{med.name}</h4>
                  <p className="text-[11px] text-error font-semibold">잔여량이 {med.remainingQuantity}개 남았습니다.</p>
                </div>
                <button className="px-3 py-1.5 bg-surface-container-highest rounded-lg text-[10px] font-bold text-primary uppercase tracking-wider">
                  충전하기
                </button>
              </div>
            ))
          ) : (
            <div className="bg-surface-container-low p-8 rounded-[2rem] text-center">
              <p className="text-xs text-outline font-medium">모든 약의 잔여량이 충분합니다.</p>
            </div>
          )}
        </div>
      </section>
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

  const currentTitle = {
    today: '필플로우',
    add: '새로운 복용 추가',
    stats: '복용 통계'
  }[view];

  const isAnyModalOpen = isSettingsOpen || isAlarmModalOpen || isTimePickerOpen;

  return (
    <div className={`h-screen bg-background pb-32 overflow-x-hidden ${isAnyModalOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <Header 
        title={currentTitle} 
        showBack={view === 'add'} 
        onBack={() => setView('today')} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      
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
              <TodayView meds={meds} toggleMed={toggleMed} onAddClick={() => setView('add')} />
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
