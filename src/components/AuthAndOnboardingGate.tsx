import React, { useState } from 'react';
import {
  Wallet,
  Sparkles,
  ArrowRight,
  UserPlus,
  ExternalLink,
  LogOut,
  RefreshCw,
  Search,
  Eye,
  KeyRound,
  Network,
  Sun,
  Moon,
} from 'lucide-react';
import { MatrixTreeVisualizer } from './MatrixTreeVisualizer';
import { TransactionToast } from './TransactionToast';
import { ApplicantItem, PlacementMode } from '../utils/offChainSimulator';
import { UserProfile } from '../types';

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
  detectedBrowserWallet,
  chainId,
  isBscTestnet,
  isConnecting,
  usdtBalance,
  allowance,
  contractAddress,
  txState,
  onClearTxState,
  onConnectWallet,
  onLoginCustomInput,
  onLoginDemoUnregisteredWallet,
  onDisconnect,
  onSwitchNetwork,
  onRefresh,
  onEnterGuestDashboard,
  onApproveUsdt,
  onRegister,
  onUpgradeToRank,
}) => {
  const [customLoginInput, setCustomLoginInput] = useState<string>('');

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLoginInput.trim()) return;
    await onLoginCustomInput(customLoginInput);
  };

  // ============================================================================
  // 1. หน้าเข้าสู่ระบบ (WEB3 LOGIN SCREEN)
  // ============================================================================
  if (mode === 'login') {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
        {/* Subtle Pastel Gradient on Hero Section Top Background (Light Mode) + Ambient Glow (Dark Mode) */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-100/75 via-sky-50/50 to-transparent dark:from-transparent dark:to-transparent" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[360px] bg-blue-400/10 dark:bg-emerald-500/10 blur-[130px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[320px] bg-indigo-400/10 dark:bg-indigo-500/10 blur-[130px] rounded-full" />
        </div>

        {/* Sticky Glassmorphism Top Bar */}
        <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/75 backdrop-blur-md shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-gradient-to-br dark:from-emerald-500/25 dark:via-teal-500/20 dark:to-indigo-500/25 border border-blue-200/80 dark:border-emerald-500/40 flex items-center justify-center text-[#2563EB] dark:text-emerald-400 font-mono font-black text-lg shadow-xs">
                F27
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#0F172A] dark:bg-gradient-to-r dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-300 dark:bg-clip-text dark:text-transparent tracking-tight">
                  FractalFlowMatrix27
                </h1>
                <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-500/15 dark:text-emerald-400 font-semibold">
                    BNB Smart Chain Testnet (97)
                  </span>
                  <span>•</span>
                  <a
                    href={`https://testnet.bscscan.com/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[#2563EB] dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                  >
                    {contractAddress.substring(0, 6)}...{contractAddress.substring(contractAddress.length - 4)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onEnterGuestDashboard}
                className="text-xs px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-slate-900 dark:hover:bg-slate-800 border border-blue-200/80 dark:border-slate-700/80 text-[#1D4ED8] dark:text-slate-300 dark:hover:text-white font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#2563EB] dark:text-indigo-400" />
                <span className="hidden sm:inline">
                  {language === 'th' ? 'ดูผังโครงสร้างรวม' : 'Preview Matrix'}
                </span>
              </button>

              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="text-xs bg-white hover:bg-[#EFF6FF] dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-[#334155] hover:text-[#2563EB] dark:text-slate-200 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title={theme === 'light' ? 'เปลี่ยนเป็นโหมดมืด (Dark Mode)' : 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)'}
                >
                  {theme === 'light' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline font-medium">สว่าง</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="hidden sm:inline font-medium">มืด</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={onToggleLanguage}
                className="text-xs bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3 py-1.5 rounded-xl font-mono text-[#334155] dark:text-slate-200 transition cursor-pointer shadow-2xs"
              >
                {language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
              </button>
            </div>
          </div>
        </header>

        {/* Main Centered Login Content */}
        <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-xl space-y-6">
            {/* Framer Motion Blockchain Transaction Toast */}
            <TransactionToast
              txState={txState}
              onClear={onClearTxState}
              language={language}
            />

            {/* Login Hero Card (Pure White #FFFFFF in Light Mode with ultra-soft shadow) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] dark:shadow-2xl dark:shadow-black/60 backdrop-blur-xl space-y-6">
              {/* Title */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] dark:bg-indigo-500/15 border border-blue-200/80 dark:border-indigo-500/30 text-[#1D4ED8] dark:text-indigo-300 text-xs font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Web3 Decentralized Binary Matrix</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
                  {language === 'th' ? 'เข้าสู่ระบบ FractalFlow Matrix 27' : 'Sign In to FractalFlow Matrix 27'}
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
                  {language === 'th'
                    ? 'เชื่อมต่อกระเป๋า Web3 หรือระบุรหัสสมาชิกเพื่อดูผังโครงสร้างและผลประโยชน์แบบเรียลไทม์'
                    : 'Connect your Web3 wallet or enter a Node ID to inspect real-time matrix positions'}
                </p>
              </div>

              {/* Detected Browser Wallet Banner (Tinted Emerald Badge Style) */}
              {detectedBrowserWallet && (
                <div className="p-3.5 rounded-2xl bg-[#DCFCE7]/70 dark:bg-emerald-950/35 border border-emerald-300/80 dark:border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#15803D] dark:bg-emerald-400 animate-pulse shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-[#15803D] dark:text-emerald-300 font-semibold">
                        {language === 'th'
                          ? 'ตรวจพบกระเป๋า Web3 ในเบราว์เซอร์ของคุณ:'
                          : 'Detected Browser Wallet:'}
                      </div>
                      <div className="text-xs font-mono text-[#0F172A] dark:text-white font-semibold truncate">
                        {detectedBrowserWallet}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onConnectWallet}
                    disabled={isConnecting}
                    className="px-3 py-1.5 rounded-xl bg-[#15803D] hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition cursor-pointer shadow-xs"
                  >
                    {language === 'th' ? 'ใช้กระเป๋านี้' : 'Use Wallet'}
                  </button>
                </div>
              )}

              {/* Primary Button: Connect Web3 Wallet (#2563EB Primary CTA in Light Mode) */}
              <div className="space-y-3">
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
                          ? 'กำลังเชื่อมต่อและตรวจสอบข้อมูลบนบล็อกเชน...'
                          : 'Connecting & Verifying Wallet...'}
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

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200/80 dark:border-slate-800" />
                <span className="shrink-0 px-3 text-[11px] uppercase tracking-wider text-[#64748B] dark:text-slate-500 font-semibold">
                  {language === 'th'
                    ? 'หรือ เข้าสู่ระบบด้วยเลขกระเป๋า 0x... / รหัสสมาชิก #ID'
                    : 'OR LOGIN WITH WALLET ADDRESS / NODE ID'}
                </span>
                <div className="flex-grow border-t border-slate-200/80 dark:border-slate-800" />
              </div>

              {/* Manual Address or Node ID Login Form */}
              <form onSubmit={handleCustomSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-grow">
                    <KeyRound className="w-4 h-4 text-[#64748B] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customLoginInput}
                      onChange={(e) => setCustomLoginInput(e.target.value)}
                      placeholder={
                        language === 'th'
                          ? 'วางเลขกระเป๋า 0x... หรือพิมพ์รหัสสมาชิก เช่น 1, 2'
                          : 'Paste wallet 0x... or enter Node ID e.g. 1, 2'
                      }
                      className="w-full bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 focus:border-[#2563EB] dark:focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] dark:text-white placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none font-mono transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isConnecting || !customLoginInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Search className="w-4 h-4" />
                    <span>{language === 'th' ? 'ตรวจสอบ & เข้าสู่ระบบ' : 'Check & Login'}</span>
                  </button>
                </div>

                {/* Quick Action Tinted Buttons for Testing */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onLoginDemoUnregisteredWallet}
                    disabled={isConnecting}
                    className="flex-1 min-w-[200px] py-2 px-3 rounded-xl bg-[#FEF3C7] hover:bg-amber-200/70 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300/80 dark:border-amber-500/35 text-[#B45309] dark:text-amber-300 text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400 shrink-0" />
                    <span>
                      {language === 'th'
                        ? 'จำลองกระเป๋าใหม่ (ทดสอบหน้าฟอร์มสมัคร)'
                        : 'Test New Unregistered Wallet'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLoginCustomInput('1')}
                    disabled={isConnecting}
                    className="py-2 px-3 rounded-xl bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-blue-200/80 dark:border-slate-700 text-[#1D4ED8] dark:text-slate-300 dark:hover:text-white text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-emerald-400 shrink-0" />
                    <span>{language === 'th' ? 'เข้าด้วยรหัส #1 (Root)' : 'Login as #1 (Root)'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Active Smart Contract Footer Info */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748B] dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-[#15803D] dark:text-emerald-400 shrink-0" />
                <span className="font-medium text-[#334155] dark:text-slate-300">Smart Contract:</span>
                <span className="font-mono text-[#15803D] dark:text-emerald-300 break-all">{contractAddress}</span>
              </div>
              <button
                onClick={onEnterGuestDashboard}
                className="text-[#2563EB] hover:text-blue-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold underline shrink-0 cursor-pointer"
              >
                {language === 'th' ? 'เข้าสู่แดชบอร์ดโดยไม่ล็อกอิน →' : 'Continue as Guest →'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // 2. หน้ากำลังตรวจสอบข้อมูลกระเป๋า (CHECKING WALLET ON SMART CONTRACT)
  // ============================================================================
  if (mode === 'Checking') {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] dark:shadow-2xl">
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
    );
  }

  // ============================================================================
  // 3. หน้าฟอร์มสมัครสมาชิกสำหรับกระเป๋าที่ยังไม่เคยสมัคร (NEW WALLET REGISTRATION PAGE)
  // ============================================================================
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex flex-col justify-between relative">
      {/* Subtle Pastel Hero Gradient at top */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-100/60 via-sky-50/40 to-transparent dark:from-transparent dark:to-transparent z-0" />

      {/* Sticky Glassmorphic Onboarding Top Bar */}
      <header className="w-full bg-white/80 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-amber-500/30 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/40 flex items-center justify-center text-[#B45309] dark:text-amber-300 font-mono font-black text-base">
              F27
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                  {language === 'th'
                    ? 'หน้าฟอร์มสมัครสมาชิกใหม่ (New Member Registration)'
                    : 'New Member Registration Form'}
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300/80 dark:border-amber-500/40">
                  {language === 'th' ? 'กระเป๋านี้ยังไม่เคยสมัคร' : 'Unregistered Wallet'}
                </span>
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Contract:</span>
                <a
                  href={`https://testnet.bscscan.com/address/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[#15803D] dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  {contractAddress.substring(0, 8)}...{contractAddress.substring(contractAddress.length - 6)}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onEnterGuestDashboard}
              className="text-xs px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-slate-900 dark:hover:bg-slate-800 border border-blue-200/80 dark:border-slate-700 text-[#1D4ED8] dark:text-slate-200 font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#2563EB] dark:text-indigo-400" />
              <span>
                {language === 'th' ? 'เปิดดูหน้าแดชบอร์ดรวม' : 'View Full Dashboard'}
              </span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[#334155] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white transition cursor-pointer"
              title={language === 'th' ? 'ตรวจสอบสถานะกระเป๋าอีกครั้ง' : 'Refresh Wallet Status'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="text-xs bg-white hover:bg-[#EFF6FF] dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-[#334155] hover:text-[#2563EB] dark:text-slate-200 transition inline-flex items-center gap-1.5 cursor-pointer"
                title={theme === 'light' ? 'เปลี่ยนเป็นโหมดมืด (Dark Mode)' : 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)'}
              >
                {theme === 'light' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline font-medium">สว่าง</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline font-medium">มืด</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onToggleLanguage}
              className="text-xs bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-mono text-[#334155] dark:text-slate-200 transition cursor-pointer"
            >
              {language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
            </button>

            <button
              onClick={onDisconnect}
              className="text-xs px-3 py-1.5 rounded-xl bg-[#FEE2E2] hover:bg-rose-200/80 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 border border-rose-200/80 dark:border-rose-500/40 text-[#BE123C] dark:text-rose-200 font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'สลับกระเป๋า / ออก' : 'Switch Wallet'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Onboarding Body: แสดงเฉพาะผังต้นไม้ไบนารี่เท่านั้น แบบเต็มหน้าจอ Max */}
      <main className="relative z-10 flex-grow w-full max-w-none mx-auto px-1 sm:px-2.5 py-1.5 sm:py-3 flex flex-col space-y-2.5">
        {/* Framer Motion Blockchain Transaction Toast */}
        <TransactionToast
          txState={txState}
          onClear={onClearTxState}
          language={language}
        />

        <MatrixTreeVisualizer
          language={language}
          theme={theme}
          userAddress={account}
          chainId={chainId}
          isBscTestnet={isBscTestnet}
          contractAddress={contractAddress}
          usdtBalance={usdtBalance}
          allowance={allowance}
          onConnectWallet={onConnectWallet}
          onSwitchNetwork={onSwitchNetwork}
          onApproveUsdt={onApproveUsdt}
          onRegisterWithSponsor={onRegister}
          onUpgradeToRank={onUpgradeToRank}
          lastTxSuccess={txState.successMessage}
          refreshTrigger={txState.successMessage}
        />
      </main>
    </div>
  );
};

