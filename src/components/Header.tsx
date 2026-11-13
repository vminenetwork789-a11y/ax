import React, { useState } from 'react';
import { CONTRACT_ADDRESS } from '../contracts/config';
import { WalletIncomeNotifier } from './WalletIncomeNotifier';
import {
  Wallet,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Shield,
  Trash2,
  Sun,
  Moon,
  Zap,
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

  return (
    <header className="w-full bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          {/* Brand Lockup */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-indigo-500/20 border border-indigo-200/80 dark:border-emerald-500/30 text-indigo-600 dark:text-emerald-400 shadow-sm shrink-0">
              <span className="font-mono font-black text-sm sm:text-lg tracking-tighter">
                F27
              </span>
            </div>

            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 dark:bg-gradient-to-r dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-300 dark:bg-clip-text dark:text-transparent truncate">
                Fractal Flow
              </h1>
            </div>
          </div>

          {/* Right Controls: [Theme] [Clear Cache] [Refresh] [Language] + Admin (if admin) + Wallet/Exit */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-indigo-200/80 dark:border-slate-700 text-indigo-700 dark:text-amber-300 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                title={theme === 'light' ? 'สลับเป็นโหมดมืด (Dark Mode)' : 'สลับเป็นโหมดสว่าง (Light Mode)'}
              >
                {theme === 'light' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>{language === 'th' ? 'สว่าง' : 'Light'}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-300" />
                    <span>{language === 'th' ? 'มืด' : 'Dark'}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-200/80 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 transition cursor-pointer disabled:opacity-50 shrink-0"
              title={clearSuccessMsg || (language === 'th' ? 'ล้างแคช' : 'Clear Cache')}
            >
              <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
            </button>

            {account && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 transition cursor-pointer shrink-0"
                title={language === 'th' ? 'รีเฟรชข้อมูลบล็อกเชน' : 'Refresh blockchain data'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onToggleLanguage}
              className="text-[11px] sm:text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1.5 rounded-xl font-mono font-semibold text-slate-700 dark:text-slate-200 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              {language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
            </button>

            {/* Deploy Smart Contract Button (Visible ONLY to Admin) */}
            {isAdminUser && (
              <button
                type="button"
                onClick={onOpenDeployModal}
                className="text-[11px] sm:text-xs px-2.5 py-1.5 rounded-xl font-bold transition duration-200 inline-flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0 cursor-pointer bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-700 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:border-emerald-500/40 dark:text-emerald-300"
                title={language === 'th' ? 'Deploy Smart Contract ใหม่ (เฉพาะแอดมิน)' : 'Deploy Smart Contract (Admin only)'}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'th' ? 'Deploy สัญญา' : 'Deploy Contract'}</span>
              </button>
            )}

            {/* Admin Control Center Toggle Button (Visible ONLY to Admin) */}
            {isAdminUser && onToggleAdminView && (
              <button
                type="button"
                onClick={onToggleAdminView}
                className={`text-[11px] sm:text-xs px-2.5 py-1.5 rounded-xl font-bold transition duration-200 inline-flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0 cursor-pointer ${
                  isAdminView
                    ? 'bg-indigo-600 text-white border border-indigo-500 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400'
                    : 'bg-[#FEF3C7] hover:bg-amber-200/70 border border-amber-200/80 text-[#B45309] dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:border-amber-500/40 dark:text-amber-300'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isAdminView
                    ? language === 'th'
                      ? 'กลับหน้าผัง'
                      : 'Matrix'
                    : language === 'th'
                    ? 'Admin'
                    : 'Admin'}
                </span>
              </button>
            )}

            {/* Switch Network Button (Only shown if connected to wrong network) */}
            {account && !isBscTestnet && (
              <button
                onClick={onSwitchNetwork}
                className="inline-flex items-center gap-1 bg-[#FEF3C7] hover:bg-amber-200/70 border border-amber-200/80 text-[#B45309] dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:border-amber-500/40 dark:text-amber-300 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'th' ? 'สลับเครือข่าย' : 'Switch Net'}</span>
              </button>
            )}

            {/* Wallet Income & Latest Transaction Alert Center (Floating Bell) */}
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
