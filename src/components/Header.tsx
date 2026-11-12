import React, { useState } from 'react';
import { CONTRACT_ADDRESS } from '../contracts/config';
import { WalletIncomeNotifier } from './WalletIncomeNotifier';
import {
  ExternalLink,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  LogOut,
  Shield,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react';

interface HeaderProps {
  account: string | null;
  chainId: number | null;
  isBscTestnet: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitchNetwork: () => void;
  onRefresh: () => void;
  language: 'th' | 'en';
  onToggleLanguage: () => void;
  onOpenDeployModal: () => void;
  contractAddress?: string;
  isAdminUser?: boolean;
  isAdminView?: boolean;
  onToggleAdminView?: () => void;
  onClearCache?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  isBscTestnet,
  isConnecting,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
  onRefresh,
  language,
  onToggleLanguage,
  onOpenDeployModal,
  contractAddress,
  isAdminUser = false,
  isAdminView = false,
  onToggleAdminView,
  onClearCache,
  theme = 'light',
  onToggleTheme,
}) => {
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);

  const handleClearCache = async () => {
    if (isClearingCache) return;
    setIsClearingCache(true);
    setClearSuccessMsg(null);
    try {
      if (typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (
              k &&
              (k.toLowerCase().includes('matrix') ||
                k.toLowerCase().includes('tree') ||
                k.toLowerCase().includes('cache') ||
                k.toLowerCase().includes('f27_build'))
            ) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          sessionStorage.clear();
        } catch {
          // ignore
        }
      }

      await fetch('/api/matrix/clear-cache', { method: 'POST' }).catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrix:tree:refresh'));
      }
      onRefresh();
      if (onClearCache) {
        onClearCache();
      }

      setClearSuccessMsg(
        language === 'th' ? 'ล้างแคชสำเร็จ!' : 'Cache cleared!'
      );
      setTimeout(() => setClearSuccessMsg(null), 3000);
    } finally {
      setTimeout(() => setIsClearingCache(false), 600);
    }
  };
  const shortAddress = account
    ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
    : '';
  const currentContract = contractAddress || CONTRACT_ADDRESS;
  const shortContract = `${currentContract.substring(0, 6)}...${currentContract.substring(
    currentContract.length - 4
  )}`;

  return (
    <header className="w-full bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4">
          {/* Top Row on Mobile: Brand Lockup + Theme, Language & Refresh */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-indigo-500/20 border border-indigo-200/80 dark:border-emerald-500/30 text-indigo-600 dark:text-emerald-400 shadow-sm shrink-0">
                <span className="font-mono font-black text-base sm:text-xl tracking-tighter">
                  F27
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-base sm:text-xl font-extrabold text-slate-900 dark:bg-gradient-to-r dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-300 dark:bg-clip-text dark:text-transparent truncate">
                    Fractal Flow
                  </h1>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                  <span className="whitespace-nowrap">
                    {language === 'th' ? 'สัญญา:' : 'Contract:'}
                  </span>
                  <a
                    href={`https://testnet.bscscan.com/address/${currentContract}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 dark:text-amber-400 dark:hover:text-amber-300 font-mono font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                    title={currentContract}
                  >
                    <span>{shortContract}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('matrix:open-contract-switcher'))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#EFF6FF] hover:bg-blue-100/90 text-[#2563EB] border border-blue-200/80 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 dark:text-indigo-300 dark:border-indigo-500/30 font-bold text-[10.5px] transition cursor-pointer shrink-0"
                    title="คลิกเพื่อเปลี่ยน Smart Contract Address ใหม่ง่ายๆ"
                  >
                    <span>✏️ {language === 'th' ? 'เปลี่ยนสัญญา' : 'Change Contract'}</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="inline-flex items-center px-2 py-0.2 rounded-full bg-[#DCFCE7] text-[#15803D] dark:bg-transparent dark:text-emerald-400 font-semibold text-[10.5px] whitespace-nowrap">
                    BNB Testnet (97)
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile-only quick theme, language & refresh controls on top-right */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-indigo-200/80 dark:border-slate-700 text-indigo-700 dark:text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                  title={theme === 'light' ? 'สลับเป็นโหมดมืด (Dark Mode)' : 'สลับเป็นโหมดสว่าง (Light Mode)'}
                >
                  {theme === 'light' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>สว่าง</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-300" />
                      <span>มืด</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-200/80 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 transition cursor-pointer disabled:opacity-50"
                title={language === 'th' ? 'ล้างแคช' : 'Clear Cache'}
              >
                <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
              </button>
              {account && (
                <button
                  onClick={onRefresh}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                  title={language === 'th' ? 'รีเฟรชข้อมูลบล็อกเชน' : 'Refresh blockchain data'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onToggleLanguage}
                className="text-[11px] bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1.5 rounded-xl font-mono font-semibold text-slate-700 dark:text-slate-200 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
              </button>
            </div>
          </div>

          {/* Action Toolbar: Clean single-line pills on mobile & desktop */}
          <div className="flex items-center justify-between md:justify-end gap-2 overflow-x-auto no-scrollbar pt-1 md:pt-0 border-t border-slate-200/80 dark:border-slate-800/60 md:border-t-0">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Theme Switcher Button (Desktop) */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="hidden md:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold transition duration-200 border shadow-sm whitespace-nowrap shrink-0 cursor-pointer bg-[#EFF6FF] hover:bg-indigo-100/80 text-[#1D4ED8] border-blue-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-300 dark:border-slate-700"
                  title={theme === 'light' ? 'คลิกเพื่อสลับไปโหมดมืด (Dark Mode)' : 'คลิกเพื่อสลับไปโหมดสว่าง (Light Mode)'}
                >
                  {theme === 'light' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{language === 'th' ? 'โหมดสว่าง' : 'Light Mode'}</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                      <span>{language === 'th' ? 'โหมดมืด' : 'Dark Mode'}</span>
                    </>
                  )}
                </button>
              )}

              {/* Clear Cache Button */}
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="text-[11px] sm:text-xs bg-[#FEE2E2] hover:bg-rose-200/70 border border-rose-200/80 text-[#BE123C] dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:border-rose-500/35 dark:text-rose-300 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold transition duration-200 inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                title={
                  language === 'th'
                    ? 'ล้างแคชและดึงข้อมูลสดจาก Smart Contract 100%'
                    : 'Clear local/server cache and resync'
                }
              >
                <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
                <span>
                  {isClearingCache
                    ? language === 'th'
                      ? 'กำลังล้าง...'
                      : 'Clearing...'
                    : clearSuccessMsg || (language === 'th' ? 'ล้างแคช' : 'Clear Cache')}
                </span>
              </button>

              {/* Admin Control Center Toggle Button (Visible ONLY to Admin) */}
              {isAdminUser && onToggleAdminView && (
                <button
                  type="button"
                  onClick={onToggleAdminView}
                  className={`text-[11px] sm:text-xs px-3 py-1.5 rounded-xl font-bold transition duration-200 inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer ${
                    isAdminView
                      ? 'bg-indigo-600 text-white border border-indigo-500 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400'
                      : 'bg-[#FEF3C7] hover:bg-amber-200/70 border border-amber-200/80 text-[#B45309] dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:border-amber-500/40 dark:text-amber-300'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isAdminView
                      ? language === 'th'
                        ? 'กลับหน้าผังหลัก'
                        : 'Back to Matrix'
                      : language === 'th'
                      ? 'หน้า Admin'
                      : 'Admin Panel'}
                  </span>
                </button>
              )}

              {/* Deploy Contract Shortcut (Visible to Everyone) */}
              <button
                onClick={onOpenDeployModal}
                className="text-[11px] sm:text-xs bg-[#EFF6FF] hover:bg-indigo-100/80 border border-blue-200/80 text-[#1D4ED8] dark:bg-slate-800/80 dark:hover:bg-slate-700/80 dark:border-indigo-500/30 dark:text-indigo-300 px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition duration-200 inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
                title={
                  language === 'th'
                    ? 'ศูนย์จัดการและทดสอบ Deploy Smart Contract (เปิดให้ทุกคนเข้าดูได้)'
                    : 'Contract deployment manager (Public)'
                }
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400 shrink-0" />
                <span>{language === 'th' ? 'Deploy สัญญา' : 'Deploy Contract'}</span>
              </button>

              {/* Desktop Language Switch */}
              <button
                onClick={onToggleLanguage}
                className="hidden md:inline-flex text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-mono font-semibold text-slate-700 dark:text-slate-300 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
              </button>

              {/* Network Indicator / Switcher (Tinted Badge) */}
              {account &&
                (isBscTestnet ? (
                  <div className="inline-flex items-center gap-1.5 bg-[#DCFCE7] border border-emerald-200/80 text-[#15803D] dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] dark:text-emerald-400 shrink-0" />
                    <span>BSC Testnet</span>
                  </div>
                ) : (
                  <button
                    onClick={onSwitchNetwork}
                    className="inline-flex items-center gap-1.5 bg-[#FEF3C7] hover:bg-amber-200/70 border border-amber-200/80 text-[#B45309] dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:border-amber-500/40 dark:text-amber-300 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400 shrink-0" />
                    <span>{language === 'th' ? 'สลับไป BNB Testnet' : 'Switch Network'}</span>
                  </button>
                ))}

              {/* Desktop Refresh Profile */}
              {account && (
                <button
                  onClick={onRefresh}
                  className="hidden md:inline-flex p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition shrink-0 cursor-pointer"
                  title={language === 'th' ? 'รีเฟรชข้อมูลบล็อกเชน' : 'Refresh blockchain data'}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Wallet Income & Latest Transaction Alert Center */}
            <WalletIncomeNotifier
              account={account}
              language={language}
              theme={theme}
              onRefresh={onRefresh}
            />

            {/* Connect / Disconnect Button */}
            {account ? (
              <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {shortAddress}
                </span>
                <button
                  onClick={onDisconnect}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-bold transition pl-1.5 border-l border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-pointer"
                  title={language === 'th' ? 'ตัดการเชื่อมต่อกระเป๋า' : 'Disconnect Wallet'}
                >
                  <LogOut className="w-3 h-3 sm:hidden" />
                  <span>{language === 'th' ? 'ออก' : 'Exit'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                id="walletBtn"
                className="inline-flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-700 dark:bg-gradient-to-r dark:from-emerald-600 dark:to-teal-600 dark:hover:from-emerald-500 dark:hover:to-teal-500 text-white font-semibold text-xs px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition duration-200 shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isConnecting
                    ? language === 'th'
                      ? 'กำลังเชื่อมต่อ...'
                      : 'Connecting...'
                    : language === 'th'
                    ? 'เชื่อมต่อกระเป๋า'
                    : 'Connect Wallet'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
