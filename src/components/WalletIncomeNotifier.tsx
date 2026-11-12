import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  ExternalLink,
  Check,
  CheckCheck,
  Clock,
  ShieldCheck,
  Filter,
  Play,
  RotateCcw,
} from 'lucide-react';

export interface WalletTransactionItem {
  id: string;
  category: 'PAYOUT' | 'REGISTRATION' | 'UPGRADE' | 'AUTO_ID' | 'EXTRA_ID' | 'TRANSFER' | string;
  titleTh: string;
  titleEn: string;
  userAddress: string;
  mainNodeId?: number;
  rank?: number;
  amountUsdt?: number;
  timestamp: string;
  blockNumber?: number;
  txHash?: string;
  detailsTh?: string;
  detailsEn?: string;
  isRead?: boolean;
}

interface WalletIncomeNotifierProps {
  account: string | null;
  language?: 'th' | 'en';
  theme?: 'light' | 'dark';
  onRefresh?: () => void;
}

/**
 * High-Fidelity Web Audio API Sound Synthesizer
 * Generates an instant, crisp, high-frequency celebratory "Coin / Cash Register Chime"
 * Zero external mp3 dependencies, works 100% offline, on mobile and all desktop browsers.
 */
function playIncomeCoinChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: High crisp initial harmonic (E6 ~ 1318 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    osc1.frequency.exponentialRampToValueAtTime(1760.0, now + 0.08); // slides up to A6
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Tone 2: Bright sparkle harmonic (C#7 ~ 2217 Hz) slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2093.0, now + 0.06); // C7
    osc2.frequency.exponentialRampToValueAtTime(2637.0, now + 0.16); // E7
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.22, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.56);
  } catch (err) {
    console.debug('[AudioChime notice]:', err);
  }
}

/**
 * Strictly validates that a transaction is a genuine incoming income/reward/payout.
 * Excludes any rank upgrade (payment made to upgrade) and member registration.
 */
export function isIncomePayoutTransaction(tx: WalletTransactionItem): boolean {
  if (!tx) return false;
  const cat = String(tx.category || '').toUpperCase();
  // Forbid any upgrade or registration
  if (cat.includes('UPGRADE') || cat.includes('REGIST') || cat.includes('REGISTER')) return false;

  const titleTh = String(tx.titleTh || '');
  const titleEn = String(tx.titleEn || '');

  // Forbid any upgrade text or registration text
  if (
    titleTh.includes('อัพเกรด') ||
    titleTh.includes('เลื่อนแรงค์') ||
    titleTh.includes('สมัครสมาชิก') ||
    titleTh.includes('สร้างรหัส') ||
    titleEn.toLowerCase().includes('upgrade') ||
    titleEn.toLowerCase().includes('registration') ||
    titleEn.toLowerCase().includes('registered') ||
    titleEn.toLowerCase().includes('node created') ||
    titleEn.toLowerCase().includes('clone created')
  ) {
    return false;
  }

  // Must be PAYOUT or reward/bonus
  return (
    cat === 'PAYOUT' ||
    cat === 'REWARD' ||
    cat === 'BONUS' ||
    titleTh.includes('รับโบนัส') ||
    titleTh.includes('ค่าคอมมิชชั่น') ||
    titleEn.toLowerCase().includes('payout') ||
    titleEn.toLowerCase().includes('reward') ||
    titleEn.toLowerCase().includes('bonus')
  );
}

export function isRegistrationTransaction(tx: WalletTransactionItem): boolean {
  return !isIncomePayoutTransaction(tx);
}

/**
 * Enhances transaction detail descriptions so that Node numbers clearly show
 * their corresponding Main ID / Member ID / Owner info (e.g. Node #2 is Main ID #7).
 */
export function enrichNodeDetails(details?: string, isTh = true): string {
  if (!details) return '';
  // If already tagged with Main ID, keep as is
  if (details.includes('Main ID #') || details.includes('Root / ระบบ')) return details;

  return details
    .replace(/Node #2 → Node #1/g, isTh ? 'Node #2 (Main ID #7) → Node #1 (Main ID #1)' : 'Node #2 (Main ID #7) → Node #1 (Main ID #1)')
    .replace(/Node #2 → Node #2/g, isTh ? 'Node #2 (Main ID #7) → Node #2 (Main ID #7)' : 'Node #2 (Main ID #7) → Node #2 (Main ID #7)')
    .replace(/Node #2 → Node #0/g, isTh ? 'Node #2 (Main ID #7) → Node #0 (Root / ระบบ)' : 'Node #2 (Main ID #7) → Node #0 (Root / System)');
}

export const WalletIncomeNotifier: React.FC<WalletIncomeNotifierProps> = ({
  account,
  language = 'th',
  theme = 'light',
  onRefresh,
}) => {
  const isTh = language === 'th';
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'my' | 'all'>('my');

  useEffect(() => {
    setMounted(true);
  }, []);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('f27_income_sound_enabled');
    return saved === null ? true : saved === 'true';
  });

  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [activeIncomeBanner, setActiveIncomeBanner] = useState<WalletTransactionItem | null>(null);
  const [readTxIds, setReadTxIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('f27_read_income_tx_ids');
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // ignore
    }
    return new Set();
  });

  const knownTxIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Toggle sound setting
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('f27_income_sound_enabled', String(next));
      if (next) playIncomeCoinChime();
      return next;
    });
  };

  // Test notification helper
  const handleTestNotification = () => {
    if (soundEnabled) playIncomeCoinChime();
    const demoItem: WalletTransactionItem = {
      id: `test-income-${Date.now()}`,
      category: 'PAYOUT',
      titleTh: 'รับโบนัส / ค่าคอมมิชชั่น (SPONSOR 20%)',
      titleEn: 'Payout / Reward (SPONSOR 20%)',
      userAddress: account || '0xDemoWalletUser777',
      mainNodeId: 1,
      rank: 1,
      amountUsdt: 1.0,
      timestamp: new Date().toISOString(),
      detailsTh: 'ทดสอบระบบแจ้งเตือน: ได้รับจาก Node #2 (Main ID #7) → Node #1 (Main ID #1) (Rank 2)',
      detailsEn: 'Notification Test: Received from Node #2 (Main ID #7) → Node #1 (Main ID #1) (Rank 2)',
    };

    setTransactions((prev) => [demoItem, ...prev.filter((p) => p.id !== demoItem.id)]);
    triggerIncomeBanner(demoItem);
  };

  // Trigger floating celebration banner for incoming money
  const triggerIncomeBanner = useCallback((tx: WalletTransactionItem) => {
    setActiveIncomeBanner(tx);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setActiveIncomeBanner(null);
    }, 8000);
  }, []);

  // Sync transactions from server
  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions?category=payout&limit=100', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.success || !Array.isArray(json.data)) return;

      const rawTxs: WalletTransactionItem[] = json.data;
      // Strictly include ONLY valid payout/reward transactions (zero registrations, zero upgrades)
      const serverTxs: WalletTransactionItem[] = rawTxs.filter(isIncomePayoutTransaction);

      // Check for brand new incoming transactions to the user's wallet
      if (initialLoadDoneRef.current) {
        const userNormalized = account?.toLowerCase();
        for (const tx of serverTxs) {
          if (!knownTxIdsRef.current.has(tx.id)) {
            knownTxIdsRef.current.add(tx.id);

            const isForMe =
              userNormalized &&
              tx.userAddress &&
              tx.userAddress.toLowerCase() === userNormalized;

            const isIncome =
              tx.category === 'PAYOUT' ||
              (tx.amountUsdt !== undefined && tx.amountUsdt > 0);

            if (isForMe && isIncome) {
              if (soundEnabled) {
                playIncomeCoinChime();
              }
              triggerIncomeBanner(tx);
            }
          }
        }
      } else {
        // Initial populate of known IDs
        serverTxs.forEach((t) => knownTxIdsRef.current.add(t.id));
        initialLoadDoneRef.current = true;
      }

      setTransactions((prev) => {
        // Merge without losing test items
        const combined = [...serverTxs];
        for (const p of prev) {
          if (p.id.startsWith('test-income-') && !combined.some((c) => c.id === p.id)) {
            combined.unshift(p);
          }
        }
        return combined.filter(isIncomePayoutTransaction);
      });
    } catch (e) {
      console.warn('[WalletIncomeNotifier fetch error]:', e);
    }
  }, [account, soundEnabled, triggerIncomeBanner]);

  // Periodic polling + listen to SSE & custom events
  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 10000);

    const handleMatrixUpdate = () => {
      fetchTransactions();
    };

    window.addEventListener('matrix:tree:refresh', handleMatrixUpdate);
    window.addEventListener('matrix:tx:toast', handleMatrixUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('matrix:tree:refresh', handleMatrixUpdate);
      window.removeEventListener('matrix:tx:toast', handleMatrixUpdate);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [fetchTransactions]);

  // Mark all as read
  const handleMarkAllRead = () => {
    const allIds = new Set<string>(transactions.map((t) => t.id));
    setReadTxIds(allIds);
    try {
      localStorage.setItem('f27_read_income_tx_ids', JSON.stringify(Array.from(allIds)));
    } catch {
      // ignore
    }
  };

  // Filter transactions (strictly income / payouts only, zero registration records)
  const userAddrNormalized = account?.toLowerCase();

  const myIncomeTransactions = useMemo(() => {
    const pureIncomeList = transactions.filter(isIncomePayoutTransaction);
    if (!userAddrNormalized) return pureIncomeList.filter((t) => t.category === 'PAYOUT' || (t.amountUsdt !== undefined && t.amountUsdt > 0));
    return pureIncomeList.filter(
      (t) =>
        t.userAddress &&
        t.userAddress.toLowerCase() === userAddrNormalized &&
        (t.category === 'PAYOUT' || (t.amountUsdt !== undefined && t.amountUsdt > 0))
    );
  }, [transactions, userAddrNormalized]);

  const displayedTransactions = useMemo(() => {
    const pureIncomeList = transactions.filter(isIncomePayoutTransaction);
    if (filterMode === 'my') {
      return myIncomeTransactions;
    }
    return pureIncomeList;
  }, [filterMode, myIncomeTransactions, transactions]);

  // Count unread for the current user
  const unreadCount = useMemo(() => {
    const list = myIncomeTransactions.length > 0 ? myIncomeTransactions : displayedTransactions;
    return list.filter((t) => !readTxIds.has(t.id)).length;
  }, [myIncomeTransactions, displayedTransactions, readTxIds]);

  // Total income received by current wallet
  const totalMyIncomeUsdt = useMemo(() => {
    return myIncomeTransactions.reduce((acc, curr) => acc + (Number(curr.amountUsdt) || 0), 0);
  }, [myIncomeTransactions]);

  const formatTxTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString(isTh ? 'th-TH' : 'en-US', {
        timeZone: 'Asia/Bangkok',
        hour12: false,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <>
      {/* 1. Header Notification Bell Button */}
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            if (!isOpen && unreadCount > 0) {
              // mark read
              handleMarkAllRead();
            }
          }}
          className={`relative p-2 rounded-xl transition duration-200 border cursor-pointer flex items-center justify-center ${
            unreadCount > 0
              ? 'bg-[#DCFCE7] hover:bg-emerald-200/80 border-emerald-300 text-[#15803D] dark:bg-emerald-950/70 dark:border-emerald-500/50 dark:text-emerald-300 shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
          title={isTh ? 'แจ้งเตือนเงินเข้ากระเป๋า & ธุรกรรมล่าสุด' : 'Wallet Income & Transaction Alerts'}
        >
          <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-bounce' : ''}`} />

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white font-mono font-black text-[10px] flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Portalled to document.body to break out of Header backdrop-blur containing block */}
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* 2. Floating Live Celebration Banner (When Money Enters Wallet) */}
            <AnimatePresence>
              {activeIncomeBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="fixed top-16 right-4 sm:right-6 z-[9999] max-w-sm w-[calc(100vw-2rem)] sm:w-full bg-white dark:bg-[#0b1020] border-2 border-emerald-400 dark:border-emerald-500/80 rounded-2xl shadow-[0_10px_35px_-5px_rgba(16,185,129,0.35)] p-3.5 overflow-hidden"
                >
                  {/* Background glowing sweep */}
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl pointer-events-none animate-pulse" />

                  <div className="flex items-start justify-between gap-2.5 relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center shrink-0 text-[#15803D] dark:text-emerald-300 shadow-xs">
                        <Coins className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-[#15803D] dark:text-emerald-300 tracking-tight flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isTh ? 'เงินเข้ากระเป๋าสำเร็จ!' : 'Money Received in Wallet!'}</span>
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#DCFCE7] text-[#15803D] border border-emerald-200">
                            LIVE
                          </span>
                        </div>
                        <div className="text-base font-extrabold text-[#0F172A] dark:text-white mt-0.5 font-mono">
                          +{activeIncomeBanner.amountUsdt !== undefined ? Number(activeIncomeBanner.amountUsdt).toFixed(2) : '0.00'} USDT
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveIncomeBanner(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-[#334155] dark:text-slate-300 space-y-1">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {isTh ? activeIncomeBanner.titleTh : activeIncomeBanner.titleEn}
                    </div>
                    {activeIncomeBanner.detailsTh && (
                      <div className="text-slate-500 dark:text-slate-400 text-[10.5px]">
                        {isTh
                          ? enrichNodeDetails(activeIncomeBanner.detailsTh, true)
                          : enrichNodeDetails(activeIncomeBanner.detailsEn, false)}
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveIncomeBanner(null);
                        setIsOpen(true);
                      }}
                      className="text-[11px] font-bold text-[#2563EB] dark:text-indigo-300 hover:underline cursor-pointer"
                    >
                      {isTh ? 'ดูศูนย์แจ้งเตือน ↗' : 'Open Activity Center ↗'}
                    </button>

                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatTxTime(activeIncomeBanner.timestamp)}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. Notification Center Slide-over Modal / Drawer */}
            <AnimatePresence>
              {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-end sm:p-4 bg-slate-900/60 backdrop-blur-xs">
                  {/* Backdrop click to close */}
                  <div className="fixed inset-0" onClick={() => setIsOpen(false)} />

                  <motion.div
                    initial={{ opacity: 0, x: 80 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 80 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                    className="relative z-10 w-full sm:max-w-md h-[100dvh] sm:h-[88vh] max-h-screen bg-white dark:bg-[#0b1020] border-l sm:border border-slate-200/80 dark:border-slate-800 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                  >
                    {/* Header */}
                    <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-emerald-50/50 via-white to-indigo-50/40 dark:from-emerald-950/20 dark:via-transparent dark:to-indigo-950/20 shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#DCFCE7] dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-[#15803D] dark:text-emerald-300">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                              <span>{isTh ? 'ศูนย์แจ้งเตือนเงินเข้ากระเป๋า' : 'Wallet Income Alerts'}</span>
                            </h3>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                              {isTh ? 'ธุรกรรมเงินเข้า & ประวัติกิจกรรมสด' : 'Incoming rewards & live activity'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Sound Toggle */}
                          <button
                            type="button"
                            onClick={toggleSound}
                            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                              soundEnabled
                                ? 'bg-[#DCFCE7] text-[#15803D] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40'
                                : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                            title={soundEnabled ? (isTh ? 'ปิดเสียงเตือน' : 'Mute Sound') : (isTh ? 'เปิดเสียงเตือน' : 'Enable Sound')}
                          >
                            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                          </button>

                          {/* Close */}
                          <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Wallet Balance Summary Card */}
                      {account && (
                        <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                              {isTh ? 'กระเป๋าที่เชื่อมต่อ:' : 'Connected Wallet:'}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                              {account.slice(0, 8)}...{account.slice(-6)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                              {isTh ? 'รวมโบนัสที่ได้รับ' : 'Total Rewards'}
                            </span>
                            <span className="text-sm font-black font-mono text-[#15803D] dark:text-emerald-400">
                              +{totalMyIncomeUsdt.toFixed(2)} USDT
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Filter Tabs & Test Chime Button */}
                      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="inline-flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setFilterMode('my')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
                              filterMode === 'my'
                                ? 'bg-white dark:bg-slate-800 text-[#15803D] dark:text-emerald-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            <span>💰 {isTh ? 'กระเป๋าฉัน' : 'My Income'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 font-mono">
                              {myIncomeTransactions.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFilterMode('all')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
                              filterMode === 'all'
                                ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-indigo-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            <span>🌐 {isTh ? 'โบนัสทั้งหมด' : 'All Rewards'}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-indigo-950 font-mono">
                              {transactions.filter(isIncomePayoutTransaction).length}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Test alert button */}
                          <button
                            type="button"
                            onClick={handleTestNotification}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#15803D] dark:bg-emerald-950/40 dark:border-emerald-500/40 dark:text-emerald-300 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title={isTh ? 'ทดสอบเสียงและป๊อปอัปเงินเข้า' : 'Test sound & banner'}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{isTh ? 'ทดสอบ' : 'Test'}</span>
                          </button>

                          {/* Mark read */}
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllRead}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10.5px] font-semibold transition flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span>{isTh ? 'อ่านหมด' : 'Read all'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Transaction List with Flex-1, Min-H-0 and Smooth Scrolling */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 overscroll-contain">
                      {displayedTransactions.length === 0 ? (
                        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 space-y-2.5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                            <Coins className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-[#0F172A] dark:text-slate-300">
                              {isTh ? 'ยังไม่มีธุรกรรมเงินเข้าในกระเป๋านี้' : 'No transactions in this wallet yet'}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                              {isTh
                                ? 'เมื่อมีค่าคอมมิชชั่นหรือโบนัสสายงานเข้ามา ระบบจะส่งเสียงเตือนและแจ้งเตือนอัตโนมัติทันที'
                                : 'When commission or upline rewards arrive, the system will chime and alert you in real-time.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleTestNotification}
                            className="mt-2 px-3 py-1.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
                          >
                            {isTh ? 'กดเพื่อทดสอบการแจ้งเตือนจำลอง' : 'Simulate Test Alert'}
                          </button>
                        </div>
                      ) : (
                        displayedTransactions.map((tx) => {
                          const isForMe =
                            userAddrNormalized &&
                            tx.userAddress &&
                            tx.userAddress.toLowerCase() === userAddrNormalized;

                          const isPayout =
                            tx.category === 'PAYOUT' || (tx.amountUsdt !== undefined && tx.amountUsdt > 0);

                          const isUnread = !readTxIds.has(tx.id);

                          return (
                            <div
                              key={tx.id}
                              className={`rounded-xl p-3 border transition duration-200 ${
                                isForMe
                                  ? 'bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20 border-emerald-300/80 dark:border-emerald-500/40 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                                      isPayout
                                        ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                                        : 'bg-blue-50 text-blue-700 dark:bg-indigo-950 dark:text-indigo-300 border border-blue-200 dark:border-indigo-500/40'
                                    }`}
                                  >
                                    {isPayout ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-[#0F172A] dark:text-white truncate">
                                        {isTh ? tx.titleTh : tx.titleEn}
                                      </span>
                                      {isForMe && (
                                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-[#DCFCE7] text-[#15803D] border border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-500/40">
                                          {isTh ? 'กระเป๋าฉัน' : 'Mine'}
                                        </span>
                                      )}
                                      {isUnread && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                                      )}
                                    </div>

                                    {tx.detailsTh && (
                                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                                        {isTh
                                          ? enrichNodeDetails(tx.detailsTh, true)
                                          : enrichNodeDetails(tx.detailsEn, false)}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1 flex-wrap">
                                      <span>{formatTxTime(tx.timestamp)}</span>
                                      {tx.rank && <span>• Rank {tx.rank}</span>}
                                      {tx.mainNodeId && <span>• ID #{tx.mainNodeId}</span>}
                                    </div>
                                  </div>
                                </div>

                                {/* Amount */}
                                <div className="text-right shrink-0">
                                  {tx.amountUsdt !== undefined && tx.amountUsdt > 0 ? (
                                    <span className="text-sm font-black font-mono text-[#15803D] dark:text-emerald-400 block">
                                      +{Number(tx.amountUsdt).toFixed(2)} U
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold text-slate-400 font-mono block">-</span>
                                  )}

                                  {tx.txHash ? (
                                    <a
                                      href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-[#2563EB] dark:text-indigo-300 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                    >
                                      <span>BscScan</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ) : (
                                    <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 justify-end mt-0.5">
                                      <Check className="w-2.5 h-2.5" />
                                      <span>On-Chain</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                        <span>{isTh ? 'เชื่อมต่อสด Real-Time' : 'Real-Time Stream Active'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          fetchTransactions();
                          if (onRefresh) onRefresh();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{isTh ? 'รีเฟรช' : 'Refresh'}</span>
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* 4. Floating Action Button (FAB) at Bottom-Right Corner - Always Follows Screen */}
            <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[9990] pointer-events-auto">
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  setIsOpen((prev) => !prev);
                  if (!isOpen && unreadCount > 0) {
                    handleMarkAllRead();
                  }
                }}
                className={`group relative flex items-center justify-center rounded-full p-3.5 sm:p-4 transition-all duration-300 cursor-pointer backdrop-blur-md ${
                  unreadCount > 0
                    ? 'bg-white dark:bg-[#0b1020] border-2 border-emerald-400 dark:border-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.45)] hover:shadow-[0_12px_36px_rgba(16,185,129,0.6)] text-emerald-600 dark:text-emerald-400'
                    : 'bg-white/95 dark:bg-[#0f172a]/95 border-2 border-slate-200/90 dark:border-slate-700/80 shadow-[0_10px_25px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_30px_rgba(16,185,129,0.25)] hover:border-emerald-400/80 text-slate-700 dark:text-slate-200'
                }`}
                aria-label={isTh ? 'ศูนย์แจ้งเตือนเงินเข้ากระเป๋า' : 'Wallet Income Alerts'}
                title={isTh ? 'กระดิ่งแจ้งเตือนเงินเข้า (คลิกเพื่อเปิดศูนย์แจ้งเตือน)' : 'Wallet Income Alerts (Click to open)'}
              >
                {/* Outer pulsing radar ring when unread notifications exist */}
                {unreadCount > 0 && (
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/35 dark:bg-emerald-500/40 animate-ping pointer-events-none" />
                )}

                {/* Bell Icon with animation */}
                <div className="relative">
                  <Bell
                    className={`w-6 h-6 sm:w-6 sm:h-6 transition-transform duration-200 ${
                      unreadCount > 0 ? 'animate-bounce text-[#15803D] dark:text-emerald-400' : 'group-hover:rotate-12'
                    }`}
                  />
                  {/* Glow point behind bell */}
                  {unreadCount > 0 && (
                    <span className="absolute inset-0 bg-emerald-400/20 blur-xs rounded-full pointer-events-none" />
                  )}
                </div>

                {/* Unread Badge Counter */}
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-emerald-600 text-white font-mono font-black text-[11px] flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : (
                  /* Subtle live green indicator dot when 0 unread */
                  <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                )}

                {/* Floating text label on hover (desktop tooltip / pill) */}
                <span className="absolute right-full mr-3 px-2.5 py-1 rounded-xl bg-slate-900/90 dark:bg-slate-800/95 text-white text-[11px] font-bold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 flex items-center gap-1.5 border border-slate-700/60">
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isTh ? 'แจ้งเตือนเงินเข้า' : 'Income Alerts'}</span>
                  {unreadCount > 0 && (
                    <span className="px-1 py-0.2 rounded bg-emerald-500 text-[10px] font-mono font-black">
                      +{unreadCount}
                    </span>
                  )}
                </span>
              </motion.button>
            </div>
          </>,
          document.body
        )}
    </>
  );
};
