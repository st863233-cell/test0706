/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Plus, 
  Trash2, 
  Trophy, 
  ChevronRight, 
  Info, 
  X,
  Play,
  RotateCcw,
  BookOpen,
  Sliders,
  Check,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { subscribeToLeaderboard, submitScore, clearOnlineLeaderboard } from './firebase';

// ==========================================
// Types & Constants
// ==========================================

interface CardItem {
  id: string;
  value: number;
  label: string; // Keeps exact decimal string representation (e.g., "10.3" rather than "10.30")
}

interface LevelConfig {
  id: number;
  name: string;
  description: string;
  decimals: number[]; // the original numbers
  educationalTip: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  streak: number;
  date: string;
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { id: 'leader-1', name: '小華', score: 1500, streak: 5, date: '2026-07-05' },
  { id: 'leader-2', name: '阿明', score: 1200, streak: 4, date: '2026-07-05' },
  { id: 'leader-3', name: '小美', score: 900, streak: 3, date: '2026-07-05' },
  { id: 'leader-4', name: '大明', score: 600, streak: 2, date: '2026-07-05' },
  { id: 'leader-5', name: '小晴', score: 300, streak: 1, date: '2026-07-05' }
];

const PRESET_LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "第一關：經典挑戰",
    description: "找出十分位與百分位數的陷阱！注意 10.3 與其他數的差別喔。",
    decimals: [10.23, 10.13, 10.3, 10.03],
    educationalTip: "💡 提示：10.3 可以看作 10.30。比大小時，先看整數部分（都是 10），再看小數點後第一位（十分位）。如果十分位相同，再看小數點後第二位（百分位）。"
  },
  {
    id: 2,
    name: "第二關：純小數大作戰",
    description: "全部都是 0 開頭的純小數，看清楚每個位數喔！",
    decimals: [0.45, 0.54, 0.4, 0.05],
    educationalTip: "💡 提示：0.4 可以看作 0.40。0.05 的十分位是 0，而 0.4 的十分位是 4，所以 0.05 比 0.4 還要小喔！"
  },
  {
    id: 3,
    name: "第三關：七彩幸運 7",
    description: "被 7 圍繞的小數！這關十分位與百分位變化更多了。",
    decimals: [7.8, 7.08, 7.88, 7.18],
    educationalTip: "💡 提示：7.8 可以看作 7.80。比較時：7.08 (十分位為 0) < 7.18 (十分位為 1) < 7.80 (十分位為 8) < 7.88 (十分位為 8，但百分位為 8 比 0 大)。"
  },
  {
    id: 4,
    name: "第四關：一點多一點",
    description: "極為接近的數字！需要極度細心來觀察。",
    decimals: [1.25, 1.2, 1.02, 1.22],
    educationalTip: "💡 提示：1.2 可以看作 1.20。比較時：1.02 < 1.20 < 1.22 < 1.25。注意不要把 1.2 看成 1.02 喔！"
  },
  {
    id: 5,
    name: "第五關：九九歸一",
    description: "含有 9 的終極對決，究竟 0.09 與 0.9 誰才是老大？",
    decimals: [0.09, 0.9, 0.19, 0.91],
    educationalTip: "💡 提示：0.9 可以看作 0.90。0.09 表示只有 9 個百分之一，而 0.9（也就是 0.90）有 90 個百分之一！"
  }
];

// ==========================================
// Synth Sound Engine (Web Audio API)
// ==========================================

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playDrop() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Beautiful major pentatonic arpeggio: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.25);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playError() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Sad downward dual-tone
      const notes = [220, 180];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        
        gain.gain.setValueAtTime(0.12, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.22);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.22);
      });
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playGameComplete() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Bright major arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.4);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }
}

const sounds = new SoundEngine();

// ==========================================
// Sub-Components
// ==========================================
function CustomLevelForm({ 
  onSave, 
  onClose 
}: { 
  onSave: (nums: number[]) => void; 
  onClose: () => void; 
}) {
  const [inputs, setInputs] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (index: number, val: string) => {
    // Only allow numbers and decimal point, up to 2 decimal places
    if (val === "" || /^[0-9]*\.?[0-9]{0,2}$/.test(val)) {
      const updated = [...inputs];
      updated[index] = val;
      setInputs(updated);
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if any is empty
    if (inputs.some(val => val.trim() === "")) {
      setError("❌ 請填寫所有 4 個小數欄位喔！");
      sounds.playError();
      return;
    }

    const nums = inputs.map(val => parseFloat(val));
    
    // Check if any is NaN
    if (nums.some(isNaN)) {
      setError("❌ 請輸入有效的數字。");
      sounds.playError();
      return;
    }

    // Check duplicates
    const uniqueNums = new Set(nums);
    if (uniqueNums.size < 4) {
      setError("❌ 請輸入 4 個不同的數字，比大小才會好玩喔！");
      sounds.playError();
      return;
    }

    sounds.playSuccess();
    onSave(nums);
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 p-5 shadow-lg max-w-lg mx-auto mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-1.5">
          <Sliders className="w-5 h-5 text-indigo-500" />
          自訂專屬小數關卡
        </h3>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        請在下方輸入 4 個不同的二位小數（例如：<code>1.25</code>、<code>0.4</code>、<code>10.05</code>、<code>10.3</code>），系統會自動將它們打亂。
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {inputs.map((val, idx) => (
            <div key={idx} className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                #{idx + 1}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={val}
                placeholder="0.00"
                onChange={(e) => handleChange(idx, e.target.value)}
                className="w-full pl-7 pr-2 py-2 text-center text-sm font-semibold font-display border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all bg-slate-50 hover:bg-white"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 justify-center animate-pulse">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" /> 產生題目
          </button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// Main Application Component
// ==========================================

export default function App() {
  // Game state
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(PRESET_LEVELS[0]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [pool, setPool] = useState<string[]>([]); // Card IDs in the pool
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]); // IDs of cards in slots
  
  // Custom mode helper
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  
  // UI States
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [correctStreak, setCorrectStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  
  // Leaderboard & Scoring States
  const [totalScore, setTotalScore] = useState<number>(0);
  const [solvedLevels, setSolvedLevels] = useState<number[]>([]);
  const [attemptsThisLevel, setAttemptsThisLevel] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState<string>('');
  
  // Modal states
  const [modalType, setModalType] = useState<'none' | 'success' | 'error' | 'game-complete' | 'score-submission'>('none');
  const [modalMessage, setModalMessage] = useState<string>('');
  
  // Drag and drop tracking states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null); // 'pool' or 'slot-X'
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [isDragOverPool, setIsDragOverPool] = useState<boolean>(false);

  // Initialize sounds config and leaderboard
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    // Subscribe to real-time online leaderboard from Firestore
    const unsubscribe = subscribeToLeaderboard((updatedLeaderboard) => {
      setLeaderboard(updatedLeaderboard);
    });
    return () => unsubscribe();
  }, []);

  // Update max streak when current streak changes
  useEffect(() => {
    if (correctStreak > maxStreak) {
      setMaxStreak(correctStreak);
    }
  }, [correctStreak, maxStreak]);

  // Load level and shuffle cards
  useEffect(() => {
    if (currentLevel) {
      initializeLevel(currentLevel.decimals);
    }
  }, [currentLevel]);

  // Handle initialization of level decimals
  const initializeLevel = (numbers: number[]) => {
    // Generate unique card items
    const generatedCards: CardItem[] = numbers.map((num, idx) => ({
      id: `card-${idx}-${Date.now()}`,
      value: num,
      label: num.toString()
    }));

    setCards(generatedCards);

    // Shuffle card IDs for the pool
    const shuffledIds = generatedCards.map(c => c.id).sort(() => Math.random() - 0.5);
    setPool(shuffledIds);
    setSlots([null, null, null, null]);
    setModalType('none');
    setAttemptsThisLevel(0);
  };

  // Submit score to real-time Firestore leaderboard
  const saveScoreToLeaderboard = async (nameToSave: string) => {
    const name = nameToSave.trim() || "匿名小學家";
    try {
      await submitScore(name, totalScore, maxStreak);
      sounds.playSuccess();
      setModalType('none');
    } catch (e) {
      console.error("Failed to submit score to online leaderboard:", e);
      alert("登錄分數失敗，請稍後再試！");
    }
  };

  const clearLeaderboard = async () => {
    if (window.confirm("確定要清除所有線上排行榜紀錄嗎？")) {
      try {
        await clearOnlineLeaderboard();
        sounds.playPop();
      } catch (e) {
        console.error("Failed to clear online leaderboard:", e);
        alert("清除排行榜失敗，請稍後再試！");
      }
    }
  };

  const handleFullReset = () => {
    setTotalScore(0);
    setCorrectStreak(0);
    setMaxStreak(0);
    setSolvedLevels([]);
    setAttemptsThisLevel(0);
    setCurrentLevel(PRESET_LEVELS[0]);
    initializeLevel(PRESET_LEVELS[0].decimals);
    sounds.playPop();
  };

  // Switch presets
  const handleLevelSelect = (level: LevelConfig) => {
    setIsCustomMode(false);
    setCurrentLevel(level);
    sounds.playPop();
  };

  // Save custom decimals and start playing
  const handleCustomDecimals = (nums: number[]) => {
    const customConfig: LevelConfig = {
      id: 99,
      name: "自訂關卡",
      description: "挑戰你自己出的四個二位小數！",
      decimals: nums,
      educationalTip: "💡 提示：把所有數字都寫成兩位小數的格式（不夠補0），從十分位、百分位依序往右比，很容易就能找出正確的順序唷！"
    };
    setCurrentLevel(customConfig);
    initializeLevel(nums);
    setIsCustomMode(false);
  };

  // Check the correctness of current order
  const checkAnswer = () => {
    // Check if any slot is empty
    if (slots.some(id => id === null)) {
      setModalType('error');
      setModalMessage("⚠️ 請先將 4 張小數卡片全部放置到下方空槽中，再進行檢查喔！");
      sounds.playError();
      return;
    }

    // Resolve actual card values placed in slots
    const placedCards = slots.map(id => cards.find(c => c.id === id)!);
    
    // Check if the order is strictly ascending
    let isCorrect = true;
    for (let i = 0; i < placedCards.length - 1; i++) {
      if (placedCards[i].value > placedCards[i + 1].value) {
        isCorrect = false;
        break;
      }
    }

    if (isCorrect) {
      const levelId = currentLevel?.id || 1;
      const isAlreadySolved = solvedLevels.includes(levelId);
      
      let earnedPoints = 0;
      if (!isAlreadySolved) {
        setSolvedLevels(prev => [...prev, levelId]);
        const basePoints = levelId === 99 ? 250 : levelId * 100;
        const perfectBonus = attemptsThisLevel === 0 ? 50 : 0;
        const streakBonus = correctStreak * 10;
        earnedPoints = basePoints + perfectBonus + streakBonus;
        setTotalScore(prev => prev + earnedPoints);
      }

      setCorrectStreak(prev => prev + 1);
      sounds.playSuccess();
      
      // Beautiful full-screen confetti animation
      const duration = 2.5 * 1000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 },
          colors: ['#3b82f6', '#f59e0b', '#10b981', '#ec4899']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 },
          colors: ['#3b82f6', '#f59e0b', '#10b981', '#ec4899']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      // If Level 5 (final level) is solved, trigger game-complete modal!
      if (levelId === 5) {
        setTimeout(() => {
          sounds.playGameComplete();
          setModalType('game-complete');
        }, 1200);
      } else {
        setModalType('success');
      }
    } else {
      setAttemptsThisLevel(prev => prev + 1);
      setModalType('error');
      setModalMessage("順序還有點不對喔，再試試看！");
      sounds.playError();
    }
  };

  // Next level action
  const handleNextLevel = () => {
    const currentIndex = PRESET_LEVELS.findIndex(l => l.id === currentLevel?.id);
    if (currentIndex !== -1 && currentIndex < PRESET_LEVELS.length - 1) {
      setCurrentLevel(PRESET_LEVELS[currentIndex + 1]);
    } else {
      // Re-shuffle the current custom/level
      if (currentLevel) {
        initializeLevel(currentLevel.decimals);
      }
    }
    setModalType('none');
    sounds.playPop();
  };

  // Restart level / Reshuffle pool
  const handleRestart = () => {
    if (currentLevel) {
      initializeLevel(currentLevel.decimals);
    }
    sounds.playPop();
  };

  // ==========================================
  // Interaction Logic (Drag & Drop & Tap)
  // ==========================================

  // Card Tapped / Clicked (Fallback support for responsive and touch)
  const handleCardTap = (cardId: string, source: 'pool' | number) => {
    sounds.playPop();
    if (source === 'pool') {
      // Tap unplaced card: Find first empty slot and move there
      const emptySlotIndex = slots.findIndex(s => s === null);
      if (emptySlotIndex !== -1) {
        const newSlots = [...slots];
        newSlots[emptySlotIndex] = cardId;
        setSlots(newSlots);
        setPool(prev => prev.filter(id => id !== cardId));
        sounds.playDrop();
      }
    } else {
      // Tap card in slot: Remove and return to pool
      const newSlots = [...slots];
      newSlots[source] = null;
      setSlots(newSlots);
      setPool(prev => [...prev, cardId]);
      sounds.playDrop();
    }
  };

  // Drag Start (HTML5 API)
  const handleDragStart = (e: React.DragEvent, cardId: string, source: 'pool' | number) => {
    setDraggedCardId(cardId);
    setDragSource(source === 'pool' ? 'pool' : `slot-${source}`);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
    sounds.playPop();
  };

  // Drag End
  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragSource(null);
    setDragOverSlotIndex(null);
    setIsDragOverPool(false);
  };

  // DropZone DragOver (HTML5 API)
  const handleDragOverSlot = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Highlight dropzone if it's empty
    if (slots[index] === null) {
      setDragOverSlotIndex(index);
    }
  };

  // DropZone DragLeave
  const handleDragLeaveSlot = () => {
    setDragOverSlotIndex(null);
  };

  // Drop action into a timeline Slot (HTML5 API)
  const handleDropOnSlot = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverSlotIndex(null);
    
    const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
    if (!cardId) return;

    // Check if slot already has a card
    if (slots[index] !== null) {
      // Instruction: "當地二個卡片要放入已有卡片的空槽時，則無法放入"
      // Rejects dropping if occupied. Just exit.
      return;
    }

    const newSlots = [...slots];

    // Source of the card
    if (dragSource === 'pool') {
      // From pool to slot
      newSlots[index] = cardId;
      setSlots(newSlots);
      setPool(prev => prev.filter(id => id !== cardId));
    } else if (dragSource?.startsWith('slot-')) {
      // From slot A to slot B
      const fromIndex = parseInt(dragSource.split('-')[1]);
      newSlots[fromIndex] = null;
      newSlots[index] = cardId;
      setSlots(newSlots);
    }

    sounds.playDrop();
  };

  // Pool DragOver (Allows returning cards back to pool via drag)
  const handleDragOverPool = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragSource !== 'pool') {
      setIsDragOverPool(true);
    }
  };

  // Pool Drop
  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPool(false);
    
    const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
    if (!cardId) return;

    if (dragSource?.startsWith('slot-')) {
      const fromIndex = parseInt(dragSource.split('-')[1]);
      const newSlots = [...slots];
      newSlots[fromIndex] = null;
      setSlots(newSlots);
      setPool(prev => [...prev, cardId]);
      sounds.playDrop();
    }
  };

  // Helper to pad decimals to two spaces (for education explanation)
  const padDecimal = (num: number): string => {
    return num.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-800">
      
      {/* Top Banner / Navigation */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg text-slate-800 tracking-tight flex items-center gap-1.5">
                二位小數排序挑戰
              </h2>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Decimal Sorting Master</p>
            </div>
          </div>

          {/* Quick Stats & Toggles */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Streak Counter */}
            <div className="bg-amber-50 border border-amber-100 px-4 py-1.5 rounded-xl flex items-center gap-1.5 text-amber-800 text-xs sm:text-sm font-semibold shadow-xs">
              <Trophy className="w-4 h-4 text-amber-500 fill-amber-50" />
              <span>連續正確: {correctStreak}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                sounds.playPop();
              }}
              title={soundEnabled ? "靜音音效" : "開啟音效"}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                soundEnabled 
                  ? 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100' 
                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Quick Tutorial Toggle */}
            <button
              onClick={() => {
                setShowTutorial(!showTutorial);
                sounds.playPop();
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                showTutorial
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden md:inline">玩法說明</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Educational Dashboard Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
        
        {/* Dynamic header reflecting design requirement */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight font-display">
              二位小數排序挑戰
            </h1>
            <p className="text-sm md:text-base text-slate-500 font-medium">
              將上方的數字卡片，按照由小到大的順序放入下方排序區的空槽中。
            </p>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 shrink-0 self-stretch md:self-auto flex md:flex-col justify-between items-center md:items-start">
            <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">當前挑戰</span>
            <div className="text-xl md:text-2xl font-black text-blue-600 italic font-mono">
              {currentLevel ? (currentLevel.id === 99 ? "CUSTOM" : `LEVEL 0${currentLevel.id}`) : "LEVEL 01"}
            </div>
          </div>
        </div>

        {/* Tutorial / Concept Overlay */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-blue-50/90 border border-blue-100 rounded-2xl p-5 shadow-sm text-slate-700 leading-relaxed text-sm relative"
            >
              <button 
                onClick={() => setShowTutorial(false)}
                className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-100/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="font-display font-bold text-blue-900 mb-2 flex items-center gap-1.5 text-base">
                <BookOpen className="w-5 h-5 text-blue-600" />
                如何比較二位小數的大小？
              </h3>
              <ul className="space-y-1.5 list-disc list-inside text-blue-800">
                <li><strong>對齊位數：</strong> 最好將所有數都寫成「兩位小數」的樣子。例如：將 <code className="bg-blue-100 px-1 rounded font-mono">10.3</code> 看作 <code className="bg-blue-100 px-1 rounded font-mono">10.30</code>。</li>
                <li><strong>從高位比起：</strong> 先比較整數部分。如果整數相同，再比較小數點後第一位（十分位）。</li>
                <li><strong>依序向後：</strong> 十分位大的人就比較大。如果十分位又相同，才看第二位（百分位）。</li>
                <li><strong>互動方法：</strong> 電腦端可以用滑鼠拖曳卡片到下方的空格；手機或平板則可以直接「點擊卡片」快速移動！</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Preset Selectors */}
        <section className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-1.5 w-full sm:w-auto">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 font-mono">選擇關卡</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_LEVELS.map((lvl) => {
                const isActive = currentLevel?.id === lvl.id && !isCustomMode;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => handleLevelSelect(lvl)}
                    className={`px-4 py-2 text-xs sm:text-sm rounded-xl font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    關卡 {lvl.id}
                  </button>
                );
              })}
              
              {/* Custom Level trigger */}
              <button
                onClick={() => {
                  setIsCustomMode(!isCustomMode);
                  sounds.playPop();
                }}
                className={`px-4 py-2 text-xs sm:text-sm rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  isCustomMode
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                自訂題目
              </button>
            </div>
          </div>
        </section>

        {/* Custom Level Creator Panel (if expanded) */}
        {isCustomMode && (
          <CustomLevelForm 
            onSave={handleCustomDecimals} 
            onClose={() => setIsCustomMode(false)} 
          />
        )}

        {/* Level Description Info */}
        {currentLevel && (
          <div className="bg-blue-50/40 border border-blue-100/40 rounded-2xl px-5 py-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-display font-bold text-blue-900 text-sm">{currentLevel.name}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{currentLevel.description}</p>
            </div>
          </div>
        )}

        {/* =======================================================
            2-COLUMN GRID SYSTEM (Main Game & Sidebar Leaderboard)
            ======================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* LEFT SIDE: Main Game Area (Col Span 3) */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            
            {/* POOL DECK (Upper random area) */}
            <section 
              className={`bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm transition-all relative ${
                isDragOverPool ? 'border-dashed border-blue-400 bg-blue-50/20' : ''
              }`}
              onDragOver={handleDragOverPool}
              onDragLeave={() => setIsDragOverPool(false)}
              onDrop={handleDropOnPool}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="font-display font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <span>隨機小數卡片池</span>
                    <span className="text-xs font-normal text-slate-400 font-sans">(請拖曳卡片或點擊放置)</span>
                  </h2>
                </div>
                
                <button
                  onClick={handleRestart}
                  className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 bg-slate-100 hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  title="重新打亂卡片順序"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 重新打亂
                </button>
              </div>

              <div className="min-h-[160px] flex flex-wrap gap-5 items-center justify-center p-4 border border-slate-100 rounded-2xl bg-slate-50/50">
                <AnimatePresence>
                  {pool.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-slate-400 font-bold py-8 text-center"
                    >
                      🎉 所有數字卡片都已放入下方時間軸空槽！
                    </motion.div>
                  ) : (
                    pool.map((id) => {
                      const card = cards.find(c => c.id === id)!;
                      if (!card) return null;
                      
                      const isBeingDragged = draggedCardId === id;

                      return (
                        <motion.div
                          key={id}
                          layoutId={id}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: isBeingDragged ? 0.3 : 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          whileHover={{ scale: 1.05, y: -2 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, id, 'pool')}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleCardTap(id, 'pool')}
                          className={`cursor-grab active:cursor-grabbing select-none rounded-2xl bg-white border border-slate-150 shadow-md hover:shadow-lg p-4 w-full sm:w-[128px] text-center flex flex-col items-center justify-center transition-all group ${
                            isBeingDragged 
                              ? 'opacity-30 border-dashed border-slate-300 shadow-none' 
                              : 'hover:border-blue-200 active:scale-95'
                          }`}
                        >
                          <div className="w-6 h-1 rounded bg-slate-200 mb-3 group-hover:bg-blue-400 transition-colors" />

                          <span className="font-display font-black text-2xl tracking-tight text-slate-700 block my-1.5">
                            {card.label}
                          </span>
                          
                          <span className="text-[9px] text-blue-500 font-bold mt-3 hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                            點擊可放置 ➜
                          </span>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* HORIZONTAL TIMELINE / DROP ZONES */}
            <section className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm flex flex-col gap-6">
              <div>
                <h2 className="font-display font-extrabold text-slate-800 text-lg flex items-center gap-2">
                  <span>排序區</span>
                  <span className="text-xs font-normal text-slate-400 font-sans">(請按「由小到大」順序排好卡片)</span>
                </h2>
              </div>

              <div className="relative">
                <div className="absolute left-[12%] right-[12%] top-[44px] h-[4px] bg-slate-200 -z-0 hidden md:block" />

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
                  {slots.map((cardId, index) => {
                    const card = cardId ? cards.find(c => c.id === cardId) : null;
                    const isOver = dragOverSlotIndex === index;
                    
                    const labelColors = [
                      "bg-amber-500 text-white", // 1st
                      "bg-slate-400 text-white", // 2nd
                      "bg-slate-400 text-white", // 3rd
                      "bg-blue-600 text-white"  // 4th
                    ];
                    const slotTitles = ["1. 最小", "2. 其次", "3. 再大", "4. 最大"];

                    return (
                      <div key={index} className="flex flex-col gap-3.5">
                        <div className="flex items-center justify-between px-1">
                          <span className={`text-[10px] px-3 py-1 rounded-full font-extrabold tracking-wider font-display uppercase ${labelColors[index]}`}>
                            {slotTitles[index]}
                          </span>
                          {card && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              位置 {index + 1}
                            </span>
                          )}
                        </div>

                        <div
                          onDragOver={(e) => handleDragOverSlot(e, index)}
                          onDragLeave={handleDragLeaveSlot}
                          onDrop={(e) => handleDropOnSlot(e, index)}
                          className={`min-h-[128px] md:min-h-[142px] rounded-3xl border-2 flex flex-col items-center justify-center p-3 transition-all duration-300 relative ${
                            card 
                              ? 'border-slate-100 bg-white shadow-sm' 
                              : isOver
                                ? 'border-blue-500 border-solid bg-sky-100/90 scale-[1.02] shadow-md ring-4 ring-blue-500/10'
                                : 'border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100/50'
                          }`}
                        >
                          <AnimatePresence mode="wait">
                            {card ? (
                              <motion.div
                                key={card.id}
                                layoutId={card.id}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                whileHover={{ scale: 1.02 }}
                                draggable
                                onDragStart={(e) => handleDragStart(e, card.id, index)}
                                onDragEnd={handleDragEnd}
                                onClick={() => handleCardTap(card.id, index)}
                                className="cursor-grab active:cursor-grabbing select-none w-full bg-white p-3.5 rounded-2xl border border-slate-150 shadow-sm flex flex-col items-center justify-center text-center relative group"
                              >
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardTap(card.id, index);
                                  }}
                                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-opacity cursor-pointer"
                                  title="點擊回收到卡片池"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>

                                <div className="w-5 h-1 rounded bg-slate-200 mb-2.5 group-hover:bg-blue-400 transition-colors" />

                                <span className="font-display font-black text-xl tracking-tight text-slate-700 block my-1">
                                  {card.label}
                                </span>

                                <span className="text-[9px] text-rose-500 font-bold mt-2.5 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                                  點擊退回卡片池
                                </span>
                              </motion.div>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-slate-400 flex flex-col items-center gap-2 p-3 text-center pointer-events-none"
                              >
                                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center bg-white text-slate-500 font-extrabold text-xs font-display shadow-inner">
                                  {index + 1}
                                </div>
                                <span className="text-[11px] font-extrabold text-slate-500">放卡片到這裡</span>
                                <span className="text-[9px] text-slate-400 hidden md:block">拖曳至此</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 px-5 py-3 rounded-2xl text-xs font-bold text-slate-500 font-mono border border-slate-100">
                <span>◀ 最小 (Min)</span>
                <span className="text-slate-300 text-base font-normal tracking-widest hidden sm:inline">━━━━━━━━━━━━━━━━━━━━━━━━━━━━►</span>
                <span>最大 (Max) ▶</span>
              </div>
            </section>

            {/* Validation Action Area */}
            <section className="flex flex-col sm:flex-row gap-4 justify-center items-center py-6 border-t border-slate-200/60">
              <button
                onClick={checkAnswer}
                className="w-full sm:w-auto px-12 py-4 bg-slate-900 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 transition-all transform active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-base"
              >
                <CheckCircle2 className="w-5 h-5" />
                檢查答案
              </button>

              <button
                onClick={handleRestart}
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-full shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                重置並打亂
              </button>
            </section>

            {/* Level Educational Tip (Static Banner) */}
            {currentLevel && (
              <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs text-xs text-slate-600 font-sans leading-relaxed">
                {currentLevel.educationalTip}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Sidebar Stats & Leaderboard (Col Span 1) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Live Stats Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col gap-5">
              <h3 className="font-display font-extrabold text-slate-800 text-base flex items-center gap-1.5 border-b border-slate-100 pb-3">
                🎯 當前挑戰成績
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-sans">當前分數</div>
                  <div className="text-xl font-mono font-black text-blue-600 mt-1">{totalScore}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-sans">最高連勝</div>
                  <div className="text-xl font-mono font-black text-amber-600 mt-1">{maxStreak}</div>
                </div>
              </div>

              {/* Level Progress Checkboxes */}
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 font-mono mb-2">關卡破關進度</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_LEVELS.map((lvl) => {
                    const isPassed = solvedLevels.includes(lvl.id);
                    return (
                      <div 
                        key={lvl.id}
                        title={lvl.name}
                        className={`py-1 rounded-lg border text-center text-xs font-bold font-mono flex flex-col items-center justify-center transition-all ${
                          isPassed 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 font-black shadow-inner' 
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <span>L0{lvl.id}</span>
                        <span className="text-[10px] mt-0.5">{isPassed ? '✓' : '✗'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => {
                    sounds.playPop();
                    setModalType('score-submission');
                  }}
                  disabled={totalScore === 0}
                  className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                    totalScore > 0 
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer hover:shadow' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                  結算分數並登錄
                </button>
                <button
                  onClick={handleFullReset}
                  className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                >
                  重新開始大挑戰
                </button>
              </div>
            </div>

            {/* Leaderboard Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-display font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                  🏆 英雄排行榜
                </h3>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-sans uppercase">Top 10</span>
              </div>

              {/* Leaderboard list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {leaderboard.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-6">尚無紀錄，快來搶佔第一名！</div>
                ) : (
                  leaderboard.map((entry, index) => {
                    const isTop3 = index < 3;
                    const rankMedals = ["👑", "🥈", "🥉"];
                    return (
                      <div 
                        key={entry.id || index}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          isTop3 
                            ? 'bg-blue-50/30 border-blue-100/50' 
                            : 'bg-slate-50/50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-mono text-slate-400 w-5 text-center">
                            {isTop3 ? rankMedals[index] : index + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[80px]" title={entry.name}>
                              {entry.name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">{entry.date}</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs font-black font-mono text-blue-600">{entry.score} 分</div>
                          {entry.streak > 0 && (
                            <div className="text-[8px] text-amber-600 font-bold font-mono">
                              🔥 {entry.streak} 連勝
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {leaderboard.length > 0 && (
                <button
                  onClick={clearLeaderboard}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors text-right mt-1 w-fit self-end cursor-pointer"
                >
                  清除排行榜紀錄
                </button>
              )}
            </div>

          </div>
        </div>

      </main>

      {/* =======================================================
          OUTCOMES MODALS (Framer Motion popups)
          ======================================================= */}
      <AnimatePresence>
        {modalType !== 'none' && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 md:p-10 max-w-lg w-full shadow-2xl relative border border-slate-100 overflow-hidden"
            >
              {/* Confetti element header visual decoration */}
              {modalType === 'success' && (
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500" />
              )}
              {modalType === 'error' && (
                <div className="absolute top-0 left-0 right-0 h-2 bg-rose-500" />
              )}

              {/* Close Button */}
              <button 
                onClick={() => setModalType('none')}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {modalType === 'success' && (
                /* =======================================================
                   SUCCESS POPUP
                   ======================================================= */
                <div className="text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-6 animate-bounce shadow-inner">
                    <Trophy className="w-10 h-10 fill-amber-50" />
                  </div>
                  
                  <h3 className="font-display font-black text-2xl text-slate-800 mb-1">
                    恭喜答對！完全正確！
                  </h3>
                  <p className="text-xs text-blue-500 uppercase tracking-widest font-black mb-6">
                    Excellent Math Skills!
                  </p>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 w-full mb-6 text-left">
                    <h4 className="font-display font-extrabold text-sm text-slate-800 mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      數學原理與大小分析：
                    </h4>
                    
                    <div className="space-y-2.5 text-xs text-slate-600">
                      <p>
                        在二位小數的比較中，將位數對齊十分關鍵：
                      </p>
                      
                      <div className="grid grid-cols-4 gap-2 text-center py-2 bg-white rounded-xl border border-slate-200">
                        {slots.map((id, index) => {
                          const card = id ? cards.find(c => c.id === id) : null;
                          if (!card) return null;
                          return (
                            <div key={id} className="border-r last:border-0 border-slate-100 px-1">
                              <div className="font-extrabold text-slate-800 font-display text-sm">{card.label}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">({padDecimal(card.value)})</div>
                              <div className="text-[10px] text-blue-600 font-extrabold mt-1">第 {index + 1}</div>
                            </div>
                          );
                        })}
                      </div>

                      <p className="leading-relaxed mt-2 text-slate-500">
                        當我們把十分位、百分位補齊（如上方括號中的二位小數格式），就可以很清楚地看到數字的連續增長關係：
                        <br />
                        <span className="font-mono text-blue-600 font-bold">
                          {slots.map((id) => {
                            const val = id ? cards.find(c => c.id === id)?.value : null;
                            return val !== null && val !== undefined ? padDecimal(val) : '';
                          }).filter(Boolean).join(' < ')}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setModalType('none')}
                      className="flex-1 py-3.5 px-4 border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-colors text-sm cursor-pointer"
                    >
                      留在本關
                    </button>
                    
                    {currentLevel && currentLevel.id !== 99 && currentLevel.id < PRESET_LEVELS.length ? (
                      <button
                        onClick={handleNextLevel}
                        className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-1 cursor-pointer"
                      >
                        挑戰下一關 <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleRestart}
                        className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-1 cursor-pointer"
                      >
                        再玩一次！ <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {modalType === 'error' && (
                /* =======================================================
                   ERROR POPUP
                   ======================================================= */
                <div className="text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    ⚠️
                  </div>
                  
                  <h3 className="font-display font-black text-2xl text-slate-800 mb-2">
                    {modalMessage.startsWith("⚠️") ? "提示訊息" : "順序還有點不對喔"}
                  </h3>
                  
                  <p className="text-sm text-slate-500 leading-relaxed max-w-sm mb-8">
                    {modalMessage.startsWith("⚠️") 
                      ? "需要將所有的數字卡片，拖入或點擊放到下方的 4 個空槽中，再檢查答案喔！" 
                      : "別灰心！再仔細檢查一下小數點後的數字大小關係。你可以點擊「玩法說明」或參考下方的小提示唷！"}
                  </p>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setModalType('none')}
                      className="flex-1 py-4 bg-slate-100 text-slate-800 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-sm"
                    >
                      我再試試
                    </button>
                    
                    {!modalMessage.startsWith("⚠️") && (
                      <button
                        onClick={() => {
                          setModalType('none');
                          setShowTutorial(true);
                          sounds.playPop();
                        }}
                        className="flex-1 py-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors cursor-pointer text-sm flex items-center justify-center gap-1"
                      >
                        看大小比較教學
                      </button>
                    )}
                  </div>
                </div>
              )}

              {(modalType === 'game-complete' || modalType === 'score-submission') && (
                /* =======================================================
                   GAME COMPLETE / SCORE SUBMISSION POPUP
                   ======================================================= */
                <div className="text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mb-6 animate-pulse shadow-inner">
                    <Trophy className="w-10 h-10 fill-yellow-50 text-yellow-500" />
                  </div>
                  
                  <h3 className="font-display font-black text-2xl text-slate-800 mb-1">
                    {modalType === 'game-complete' ? "🎉 恭喜完成全關挑戰！" : "🏆 結算成績登錄排行榜"}
                  </h3>
                  <p className="text-xs text-blue-500 uppercase tracking-widest font-black mb-6">
                    Leaderboard Score Submission
                  </p>

                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 w-full mb-6 text-left space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-bold">總過關數：</span>
                      <span className="font-mono font-black text-slate-800">{solvedLevels.filter(id => id !== 99).length} / 5 關</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
                      <span className="text-slate-500 font-bold">最高連續正確：</span>
                      <span className="font-mono font-black text-amber-600">{maxStreak} 次</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-slate-500 font-bold text-base">最終總得分：</span>
                      <span className="font-mono font-black text-2xl text-blue-600">{totalScore} 分</span>
                    </div>
                  </div>

                  <div className="w-full text-left mb-6">
                    <label htmlFor="playerNameInput" className="block text-xs font-bold text-slate-500 mb-2 font-sans">
                      請輸入您的英雄榜姓名：
                    </label>
                    <input
                      id="playerNameInput"
                      type="text"
                      maxLength={10}
                      placeholder="例如：小數大王 👑"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all bg-slate-50 font-semibold text-slate-800 text-sm"
                    />
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setModalType('none')}
                      className="flex-1 py-3.5 px-4 border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-colors text-sm cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => saveScoreToLeaderboard(playerName)}
                      className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      登錄英雄榜 <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12 text-center text-xs text-slate-400 font-sans">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>© 2026 二位小數比大小排序挑戰 - 互動學習遊戲</span>
          <span className="flex items-center gap-1 text-slate-400 font-medium">
            <span>精美紙牌風格與 HTML5 拖曳排序 API </span>
          </span>
        </div>
      </footer>

    </div>
  );
}
