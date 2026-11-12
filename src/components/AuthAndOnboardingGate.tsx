import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowRight,
  LogOut,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Coins,
  Repeat,
  Sparkles,
  Layers,
  Award,
  BookOpen,
  ArrowDownRight,
  Zap,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { TransactionToast } from './TransactionToast';
import { ApplicantItem, PlacementMode } from '../utils/offChainSimulator';
import { UserProfile } from '../types';
import {
  getActiveReferralSponsorId,
  setActiveReferralSponsorId,
} from '../utils/referralLink';
import { RANK_PRICES_USDT } from '../contracts/config';

interface AuthAndOnboardingGateProps {
  mode: 'login' | 'Checking' | 'register_onboarding';
  language: 'th' | 'en';
  onToggleLanguage: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  account: string | null;
  detectedBrowserWallet: string | null;
  chainId: number | null;
  isBscTestnet: boolean;
  isConnecting: boolean;
  isLoadingProfile: boolean;
  profile: UserProfile | null;
  usdtBalance: string;
  bnbBalance: string;
  allowance: string;
  contractAddress: string;
  usdtAddress: string;
  txState: {
    isLoading: boolean;
    step: string;
    txHash: string | null;
    error: string | null;
    successMessage: string | null;
  };
  onClearTxState: () => void;
  onConnectWallet: () => void;
  onLoginCustomInput: (input: string) => Promise<boolean>;
  onLoginDemoUnregisteredWallet: () => Promise<void>;
  onDisconnect: () => void;
  onSwitchNetwork: () => void;
  onRefresh: () => void;
  onEnterGuestDashboard: () => void;
  onApproveUsdt: (amountUsdt?: number) => Promise<any>;
  onRegister: (
    sponsorNodeId: number,
    autoOptions?: {
      targetParentId?: number | string;
      isLeft?: boolean;
      mode?: PlacementMode;
      count?: number;
      owner?: string;
    }
  ) => Promise<any>;
  onExecuteOffChainBatch: (
    sponsorNodeId: number,
    applicantsQueue: ApplicantItem[],
    onStatusCallback?: (msg: string) => void,
    mode?: PlacementMode
  ) => Promise<any>;
  onCheckSponsor: (
    sponsorNodeId: number
  ) => Promise<{ isValid: boolean; reason: string; sponsorAddress: string }>;
  onPreviewPlacement: (
    rank: number,
    sponsorAddr: string
  ) => Promise<{ targetParentId: string; isLeft: boolean; activeRound: number } | null>;
  onUpgradeToRank: (rank: number) => Promise<any>;
}

export const AuthAndOnboardingGate: React.FC<AuthAndOnboardingGateProps> = ({
  mode,
  language,
  onToggleLanguage,
  theme = 'light',
  onToggleTheme,
  account,
  isBscTestnet,
  isConnecting,
  usdtBalance,
  allowance,
  txState,
  onClearTxState,
  onConnectWallet,
  onDisconnect,
  onSwitchNetwork,
  onApproveUsdt,
  onRegister,
  onCheckSponsor,
}) => {
  const [sponsorInput, setSponsorInput] = useState<string>(() => {
    const detected = getActiveReferralSponsorId();
    return String(detected && detected >= 1 ? detected : 1);
  });
  const [sponsorCheck, setSponsorCheck] = useState<{
    checking: boolean;
    isValid: boolean | null;
    reason: string;
    sponsorAddress: string;
  }>({
    checking: false,
    isValid: null,
    reason: '',
    sponsorAddress: '',
  });

  useEffect(() => {
    const detected = getActiveReferralSponsorId();
    if (detected && detected >= 1) {
      setSponsorInput(String(detected));
    }
  }, []);

  const parsedSponsorId = Math.max(0, parseInt(sponsorInput.trim(), 10) || 0);

  useEffect(() => {
    if (mode !== 'register_onboarding') return;
    if (!parsedSponsorId || parsedSponsorId < 1) {
      setSponsorCheck({
        checking: false,
        isValid: false,
        reason: language === 'th' ? 'กรุณาระบุเลขผู้แนะนำตั้งแต่ #1 ขึ้นไป' : 'Please enter a valid Sponsor ID (#1 or higher)',
        sponsorAddress: '',
      });
      return;
    }

    let cancelled = false;
    setSponsorCheck((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await onCheckSponsor(parsedSponsorId);
        if (!cancelled) {
          setSponsorCheck({
            checking: false,
            isValid: res.isValid,
            reason: res.reason,
            sponsorAddress: res.sponsorAddress,
          });
        }
      } catch {
        if (!cancelled) {
          setSponsorCheck({
            checking: false,
            isValid: true,
            reason: '',
            sponsorAddress: '',
          });
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, parsedSponsorId, onCheckSponsor, language]);

  const [loginStats, setLoginStats] = useState<{
    loading: boolean;
    mainIdsRank1: number;
    autoIdsCount: number;
    cloneIdsCount: number;
    totalRank1FundsUsdt: number;
  }>({
    loading: true,
    mainIdsRank1: 0,
    autoIdsCount: 0,
    cloneIdsCount: 0,
    totalRank1FundsUsdt: 0,
  });

  useEffect(() => {
    let active = true;
    const fetchLoginStats = async () => {
      try {
        const res = await fetch('/api/matrix/per-id-history');
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data?.success) return;

        const reports: any[] = Array.isArray(data.reports) ? data.reports : [];
        // เฉพาะไอดีหลัก Rank 1 (ไม่นับรหัสโคลน และไม่นับ Auto ID)
        const manualMainReports = reports.filter(
          (r) => !r.isClone && !r.isExtraId && r.nodeType !== 'AUTO_ID'
        );
        const autoReports = reports.filter((r) => r.nodeType === 'AUTO_ID');
        const cloneReports = reports.filter((r) => Boolean(r.isClone));

        const mainCount = manualMainReports.length;
        const autoCount = autoReports.length;
        const cloneCount = cloneReports.length;
        // สูตรตามที่ระบุ: ยอดเงิน = จำนวน ไอดีหลัก * 5 USDT
        const fundsUsdt = mainCount * 5;

        setLoginStats({
          loading: false,
          mainIdsRank1: mainCount,
          autoIdsCount: autoCount,
          cloneIdsCount: cloneCount,
          totalRank1FundsUsdt: fundsUsdt,
        });
      } catch {
        if (active) {
          setLoginStats((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    fetchLoginStats();
    const timer = setInterval(fetchLoginStats, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const [isPlanExpanded, setIsPlanExpanded] = useState<boolean>(true);

  // สวิตช์โหมดสว่าง/โหมดมืด และปุ่มสลับภาษาสำหรับหน้า Login และ สมัครสมาชิก
  const renderTopToolbar = () => (
    <div className="flex items-center justify-between w-full px-1">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 dark:bg-emerald-500/15 border border-blue-200/80 dark:border-emerald-500/30 text-[#2563EB] dark:text-emerald-400 font-mono font-black text-xs shadow-xs">
          F27
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Fractal Flow
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            title={
              theme === 'light'
                ? language === 'th'
                  ? 'สลับเป็นโหมดมืด (Dark Mode)'
                  : 'Switch to Dark Mode'
                : language === 'th'
                ? 'สลับเป็นโหมดสว่าง (Light Mode)'
                : 'Switch to Light Mode'
            }
          >
            {theme === 'light' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'th' ? 'โหมดสว่าง' : 'Light'}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-300" />
                <span>{language === 'th' ? 'โหมดมืด' : 'Dark'}</span>
              </>
            )}
          </button>
        )}

        {onToggleLanguage && (
          <button
            type="button"
            onClick={onToggleLanguage}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer font-mono"
            title={language === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          >
            <Globe className="w-3.5 h-3.5 text-[#2563EB] dark:text-emerald-400" />
            <span>{language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}</span>
          </button>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // 1. หน้าเข้าสู่ระบบ (WEB3 LOGIN SCREEN) — แสดงชื่อเว็บไซต์ Fractal Flow + ยอดสมาชิกไอดีหลัก Rank 1 & ยอดเงิน + แผนรายได้และหลักการทำงาน
  // ============================================================================
  if (mode === 'login') {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-y-auto transition-colors duration-200">
        <div className="w-full max-w-lg space-y-4">
          {renderTopToolbar()}

          <TransactionToast
            txState={txState}
            onClear={onClearTxState}
            language={language}
          />

          {/* Login Card */}
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(15,23,42,0.08)] dark:shadow-2xl text-center space-y-5 ring-4 ring-blue-500/10 dark:ring-emerald-500/10">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              Fractal Flow
            </h1>

            {/* สถิติยอดสมาชิกเฉพาะไอดีหลัก Rank 1 และยอดเงิน (จำนวนไอดีหลัก * 5 USDT) */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/90 dark:border-slate-800 p-3.5 space-y-1">
                <div className="text-xs font-bold text-[#64748B] dark:text-slate-400">
                  {language === 'th' ? 'ยอดสมาชิก (ไอดีหลัก Rank 1)' : 'Total Members (Main ID)'}
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#0F172A] dark:text-white">
                  {loginStats.loading ? '...' : `${loginStats.mainIdsRank1.toLocaleString()}`}{' '}
                  <span className="text-xs font-bold text-[#2563EB] dark:text-emerald-400">
                    {language === 'th' ? 'รหัส' : 'IDs'}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium">
                  {language === 'th'
                    ? `ไอดีหลัก ${loginStats.mainIdsRank1} • Auto ID ${loginStats.autoIdsCount}`
                    : `Main ID ${loginStats.mainIdsRank1} • Auto ID ${loginStats.autoIdsCount}`}
                </div>
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/90 dark:border-slate-800 p-3.5 space-y-1">
                <div className="text-xs font-bold text-[#64748B] dark:text-slate-400">
                  {language === 'th' ? 'ยอดเงิน (Rank 1)' : 'Total Amount (Rank 1)'}
                </div>
                <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {loginStats.loading ? '...' : loginStats.totalRank1FundsUsdt.toFixed(2)}{' '}
                  <span className="text-xs font-bold">USDT</span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium">
                  {language === 'th'
                    ? `${loginStats.mainIdsRank1} ไอดีหลัก × 5 USDT`
                    : `${loginStats.mainIdsRank1} Main IDs × 5 USDT`}
                </div>
              </div>
            </div>

            <button
              onClick={onConnectWallet}
              disabled={isConnecting}
              className="w-full py-4 px-6 rounded-2xl bg-[#2563EB] hover:bg-blue-700 dark:bg-gradient-to-r dark:from-emerald-600 dark:via-teal-600 dark:to-emerald-600 dark:hover:from-emerald-500 dark:hover:via-teal-500 dark:hover:to-emerald-500 text-white font-bold text-base shadow-[0_4px_20px_-2px_rgba(37,99,235,0.35)] dark:shadow-xl dark:shadow-emerald-950/60 border border-blue-500/30 dark:border-emerald-400/30 transition duration-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
            >
              {isConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {language === 'th'
                      ? 'กำลังเข้าสู่ระบบ...'
                      : 'Signing in...'}
                  </span>
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  <span>
                    {language === 'th'
                      ? 'เข้าสู่ระบบด้วยกระเป๋า Web3 (MetaMask / TrustWallet)'
                      : 'Login with Web3 Wallet (MetaMask / TrustWallet)'}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* แผนรายได้และหลักการทำงานของระบบ (Plan & Mechanics Breakdown) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] dark:shadow-xl space-y-4 text-left transition duration-200">
            {/* Header Accordion Toggle */}
            <button
              type="button"
              onClick={() => setIsPlanExpanded(!isPlanExpanded)}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-emerald-500/15 border border-blue-200/80 dark:border-emerald-500/30 flex items-center justify-center text-[#2563EB] dark:text-emerald-400 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white group-hover:text-[#2563EB] dark:group-hover:text-emerald-400 transition-colors">
                    {language === 'th'
                      ? 'แผนรายได้ & หลักการทำงาน'
                      : 'Compensation Plan & System Rules'}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 font-medium">
                    {language === 'th'
                      ? 'ระบบผังไบนารี่อัตโนมัติ 100% • เริ่มต้น 5 USDT'
                      : '100% Automated Binary Matrix • Starting at 5 USDT'}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#64748B] dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 transition">
                {isPlanExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isPlanExpanded && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                {/* 1. โครงสร้างผังไบนารี่ 2 สายงาน */}
                <div className="bg-[#F8FAFC] dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
                    <GitBranch className="w-4 h-4 text-[#2563EB] dark:text-emerald-400" />
                    <span>
                      {language === 'th'
                        ? '1. โครงสร้างผังไบนารี่ 2 สายงาน (ซ้าย / ขวา)'
                        : '1. Binary Tree Matrix Structure (Left / Right)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                    {language === 'th'
                      ? 'แต่ละรหัส (Node) มีลูกติดตัวได้ 2 ขา (ซ้ายและขวา) ความลึกสูงสุด 15 ชั้น โดยระบบแยกฟังก์ชันการทำงานของ 2 ฝั่งอย่างชัดเจนเพื่อความยั่งยืนของสมาชิกทุกคน'
                      : 'Each Node accommodates 2 direct child positions (Left and Right) spanning 15 levels deep, with distinctive functionalities on each leg for maximum sustainability.'}
                  </p>
                </div>

                {/* 2. การกระจายรายได้ขารหัสซ้าย 100% */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-500/20 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                      <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {language === 'th'
                          ? '2. ขารหัสซ้าย (Left Child) — กระจายรายได้ 100%'
                          : '2. Left Child Node — 100% Revenue Distribution'}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      100% Payout
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 space-y-0.5">
                      <div className="font-bold text-[#0F172A] dark:text-white flex items-center justify-between">
                        <span>🎯 ค่าแนะนำตรง (Direct Sponsor)</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">30%</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {language === 'th' ? 'จ่ายทันทีให้กระเป๋าผู้แนะนำตรง' : 'Paid instantly to direct sponsor'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 space-y-0.5">
                      <div className="font-bold text-[#0F172A] dark:text-white flex items-center justify-between">
                        <span>🌐 โบนัสบริหาร 15 ชั้น (Unilevel)</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">30%</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {language === 'th' ? 'กระจายชั้นละ 2% รวม 15 ชั้นลึก' : '2% per tier across 15 levels'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 space-y-0.5 sm:col-span-2">
                      <div className="font-bold text-[#0F172A] dark:text-white flex items-center justify-between">
                        <span>🏦 กระปุกสะสมประจำรหัส (Vault Pools)</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">35%</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {language === 'th'
                          ? 'สะสมแยกรายรหัสหลัก (เงินแยกของใครของมัน) สำหรับ Upgrade Rank Pool (อัปเกรดอัตโนมัติ), New Auto ID Pool (สร้างรหัส Auto วนลง Rank 1) และ New Extra ID Pool'
                          : 'Accumulated per Main ID for auto rank upgrades, New Auto ID Pool (5 USDT), and New Extra ID Pool.'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 space-y-0.5">
                      <div className="font-bold text-[#0F172A] dark:text-white flex items-center justify-between">
                        <span>🏆 กองทุน AllSell (4 กอง)</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">4%</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {language === 'th' ? 'แบ่งปันผลให้สมาชิกที่ผ่านคุณสมบัติ' : 'Shared among qualified members'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 space-y-0.5">
                      <div className="font-bold text-[#0F172A] dark:text-white flex items-center justify-between">
                        <span>🤖 ระบบบอทคำนวณอัตโนมัติ</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">1%</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {language === 'th' ? 'ค่าบำรุงรักษา Server บอทอัตโนมัติ' : 'Automated bot engine maintenance'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. การโคลนนิ่งขารหัสขวา 100% Rebirth */}
                <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-500/20 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-purple-800 dark:text-purple-300">
                      <Repeat className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>
                        {language === 'th'
                          ? '3. ขารหัสขวา (Right Child) — โคลนนิ่ง 100% (Rebirth)'
                          : '3. Right Child Node — 100% Automated Rebirth'}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                      100% Clone
                    </span>
                  </div>

                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                    {language === 'th'
                      ? 'เมื่อมีสมาชิกหรือรหัสลงในตำแหน่งขารหัสขวา เงิน 100% ของตำแหน่งนี้จะถูกนำไปสร้างรหัสโคลน (Clone ID) ใหม่ให้เจ้าของรหัสทันที โดยทำงานสลับ 2 รูปแบบ:'
                      : 'When a placement occurs on the right child position, 100% of the slot fee is reinvested into creating a fresh automated Clone ID for the node owner:'}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/40 flex items-start gap-2">
                      <span className="font-extrabold text-purple-600 dark:text-purple-400 shrink-0">รอบที่ 1:</span>
                      <span className="text-[#475569] dark:text-slate-300">
                        {language === 'th'
                          ? 'วางติดตัวในสายงานของผู้แนะนำตรง (Direct Sponsor Lineage) ซ้ายก่อน ขวาตาม'
                          : 'Placed under the direct sponsor sub-tree (Left first, then Right).'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/40 flex items-start gap-2">
                      <span className="font-extrabold text-purple-600 dark:text-purple-400 shrink-0">รอบที่ 2:</span>
                      <span className="text-[#475569] dark:text-slate-300">
                        {language === 'th'
                          ? 'ผังรวมระบบ (Global BFS Level Order) เติมเต็มตำแหน่งว่างในชั้นที่ตื้นที่สุดจากซ้ายไปขวา ช่วยเหลือสมาชิกทุกคนในระบบไม่ให้เกิดจุดตัน'
                          : 'Global BFS Level Order filling the shallowest empty position from left to right across the entire system.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. สรุปจุดเด่นและเงื่อนไขการเริ่มต้น */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs text-[#64748B] dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{language === 'th' ? 'จุดเด่นของ Fractal Flow Matrix' : 'Key Highlights'}</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-[#475569] dark:text-slate-300">
                    <li>{language === 'th' ? 'เริ่มต้นสมัครเพียง 5 USDT (Rank 1) จ่ายผ่าน Smart Contract บน BNB Smart Chain' : 'Starts at only 5 USDT (Rank 1) via BNB Smart Chain Smart Contract.'}</li>
                    <li>{language === 'th' ? 'กระจายรายได้และสร้างรหัสโคลนอัตโนมัติ 100% โปร่งใส ไร้คนกลาง' : '100% automated on-chain payouts and auto-cloning without intermediaries.'}</li>
                    <li>{language === 'th' ? 'ระบบแยกกระเป๋า Vault ของใครของมัน อิสระรายรหัสหลัก ไม่ปะปนกัน' : 'Isolated Vault pools per Main ID guaranteeing individual financial autonomy.'}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. หน้ากำลังตรวจสอบข้อมูลกระเป๋า (CHECKING WALLET ON SMART CONTRACT)
  // ============================================================================
  if (mode === 'Checking') {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex flex-col items-center justify-center p-4 transition-colors duration-200">
        <div className="max-w-md w-full space-y-3">
          {renderTopToolbar()}
          <div className="w-full bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] dark:shadow-2xl">
            <div className="text-xl font-extrabold text-[#2563EB] dark:text-emerald-400">
              Fractal Flow
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] dark:bg-emerald-500/15 border border-blue-200/80 dark:border-emerald-500/30 flex items-center justify-center mx-auto">
              <div className="w-7 h-7 border-3 border-[#2563EB] dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">
                {language === 'th'
                  ? 'กำลังตรวจสอบสถานะกระเป๋า...'
                  : 'Verifying Wallet...'}
              </h3>
              {account && (
                <p className="text-xs font-mono text-[#2563EB] dark:text-emerald-400 break-all px-2">{account}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. หน้าฟอร์มสมัครสมาชิก (NEW WALLET REGISTRATION FORM ONLY)
  // ============================================================================
  const r1Price = RANK_PRICES_USDT[0] || 5;
  const numericAllowance = parseFloat(allowance || '0');
  const numericUsdtBalance = parseFloat(usdtBalance || '0');
  const isApproved = numericAllowance >= r1Price;

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedSponsorId || parsedSponsorId < 1) return;
    setActiveReferralSponsorId(parsedSponsorId);
    await onRegister(parsedSponsorId);
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex items-center justify-center px-4 py-8 relative overflow-hidden transition-colors duration-200">
      <div className="w-full max-w-md space-y-4">
        {renderTopToolbar()}

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            Fractal Flow
          </h1>
        </div>

        <TransactionToast
          txState={txState}
          onClear={onClearTxState}
          language={language}
        />

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(15,23,42,0.06)] dark:shadow-2xl space-y-5">
          {/* Header inside Registration Form */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#EFF6FF] dark:bg-emerald-500/15 border border-blue-200/80 dark:border-emerald-500/30 flex items-center justify-center text-[#2563EB] dark:text-emerald-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#0F172A] dark:text-white">
                  {language === 'th' ? 'สมัครสมาชิกใหม่' : 'Member Registration'}
                </h2>
                {account && (
                  <p className="text-xs font-mono text-[#64748B] dark:text-slate-400">
                    {account.substring(0, 6)}...{account.substring(account.length - 4)}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDisconnect}
              className="text-xs px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 border border-rose-200/80 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ออก' : 'Logout'}</span>
            </button>
          </div>

          <form onSubmit={handleSubmitRegistration} className="space-y-4">
            {/* ช่องกรอกเลขผู้แนะนำ (Sponsor ID Input) */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[#0F172A] dark:text-slate-200">
                {language === 'th' ? 'เลขผู้แนะนำ (Sponsor ID)' : 'Sponsor Node ID'}
              </label>
              <input
                type="number"
                min={1}
                required
                value={sponsorInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSponsorInput(val);
                  const num = parseInt(val, 10);
                  if (num >= 1) {
                    setActiveReferralSponsorId(num);
                  }
                }}
                placeholder={language === 'th' ? 'กรอกเลขผู้แนะนำ เช่น 1' : 'Enter Sponsor ID e.g. 1'}
                className="w-full bg-[#F8FAFC] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-[#2563EB] dark:focus:border-emerald-500 rounded-2xl px-4 py-3 text-base font-mono font-bold text-[#0F172A] dark:text-white focus:outline-none transition"
              />

              {/* Sponsor Validation Status */}
              {sponsorCheck.checking ? (
                <div className="text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-1.5 pt-1">
                  <div className="w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  <span>{language === 'th' ? 'กำลังตรวจสอบรหัสผู้แนะนำ...' : 'Checking Sponsor ID...'}</span>
                </div>
              ) : sponsorCheck.isValid === true ? (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {language === 'th'
                      ? `รหัสผู้แนะนำ #${parsedSponsorId} พร้อมใช้งาน`
                      : `Sponsor #${parsedSponsorId} is valid`}
                  </span>
                </div>
              ) : sponsorCheck.isValid === false ? (
                <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{sponsorCheck.reason}</span>
                </div>
              ) : null}
            </div>

            {/* สรุปยอดชำระค่าสมัคร Rank 1 */}
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B] dark:text-slate-400">
                  {language === 'th' ? 'ค่าสมัครสมาชิก (Rank 1):' : 'Registration Fee (Rank 1):'}
                </span>
                <span className="font-mono font-extrabold text-sm text-[#2563EB] dark:text-emerald-400">
                  {r1Price.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B] dark:text-slate-400">
                  {language === 'th' ? 'ยอดคงเหลือในกระเป๋า:' : 'Your USDT Balance:'}
                </span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-slate-200">
                  {numericUsdtBalance.toFixed(2)} USDT
                </span>
              </div>
            </div>

            {/* ปุ่มสลับเครือข่าย / อนุมัติ USDT / ยืนยันสมัครสมาชิก */}
            {!isBscTestnet ? (
              <button
                type="button"
                onClick={onSwitchNetwork}
                className="w-full py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-sm transition cursor-pointer"
              >
                {language === 'th'
                  ? 'สลับเป็นเครือข่าย BNB Smart Chain Testnet'
                  : 'Switch to BNB Smart Chain Testnet'}
              </button>
            ) : !isApproved ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => onApproveUsdt(r1Price)}
                  disabled={txState.isLoading || !parsedSponsorId}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {txState.isLoading
                      ? language === 'th'
                        ? 'กำลังดำเนินการ...'
                        : 'Processing...'
                      : language === 'th'
                      ? `1. อนุมัติเหรียญ (${r1Price} USDT)`
                      : `1. Approve ${r1Price} USDT`}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={txState.isLoading || !parsedSponsorId || sponsorCheck.isValid === false}
                  className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {language === 'th'
                      ? `2. ยืนยันสมัครสมาชิก (ผู้แนะนำ #${parsedSponsorId || 1})`
                      : `2. Confirm Registration (Sponsor #${parsedSponsorId || 1})`}
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={txState.isLoading || !parsedSponsorId || sponsorCheck.isValid === false}
                className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-[0_4px_20px_-2px_rgba(16,185,129,0.35)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {txState.isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {language === 'th' ? 'กำลังดำเนินการสมัครสมาชิก...' : 'Registering...'}
                    </span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>
                      {language === 'th'
                        ? `สมัครสมาชิก (${r1Price} USDT)`
                        : `Register Now (${r1Price} USDT)`}
                    </span>
                  </>
                )}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

