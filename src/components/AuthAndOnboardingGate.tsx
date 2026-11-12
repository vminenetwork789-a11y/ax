import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowRight,
  LogOut,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
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

  // ============================================================================
  // 1. หน้าเข้าสู่ระบบ (WEB3 LOGIN SCREEN) — แสดงชื่อเว็บไซต์ Fractal Flow + ปุ่ม Login ในกรอบการ์ด
  // ============================================================================
  if (mode === 'login') {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-200">
        <div className="w-full max-w-md space-y-4">
          <TransactionToast
            txState={txState}
            onClear={onClearTxState}
            language={language}
          />

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 sm:p-9 shadow-[0_8px_30px_rgb(15,23,42,0.06)] dark:shadow-2xl text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              Fractal Flow
            </h1>

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
        </div>
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
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#070b16] text-[#0F172A] dark:text-slate-100 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="w-full max-w-md space-y-5">
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

