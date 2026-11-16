import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RANK_PRICES_USDT,
  CONTRACT_ADDRESS,
} from '../contracts/config';
import { calculateMainIdVaultPools } from '../utils/vaultPools';
import { buildReferralLink } from '../utils/referralLink';
import {
  RefreshCw,
  Check,
  Copy,
  X,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Wallet,
  Network,
  Sun,
  Moon,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';

interface Dashboard2ViewProps {
  language: 'th' | 'en';
  theme: 'light' | 'dark';
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  account: string | null;
  chainId: number | null;
  isBscTestnet: boolean;
  usdtBalance: string;
  bnbBalance: string;
  allowance: string;
  contractAddress: string;
  profile: any;
  selectedMainId: string;
  onSelectMainId: (mainId: string) => void;
  onOpenMatrixTree: (targetRank?: number) => void;
  onOpenRegisterModal: () => void;
  onOpenContractSwitcher: () => void;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
  onApproveUsdt: (amountUsdt?: number) => Promise<any>;
  onUpgradeToRank: (targetRank: number, targetMainId?: number | string) => Promise<any>;
  isLoadingTx?: boolean;
  refreshTrigger?: any;
}

type BottomTabKey = 'home' | 'history' | 'transactions' | 'help' | 'settings';
type DetailModalKey =
  | null
  | 'switch_id'
  | 'members'
  | 'upgrade'
  | 'wallet'
  | 'vault'
  | 'allsell';

const ALLSELL_DIRECT_REQUIREMENTS: Record<
  number,
  { label: string; count: number; rangeText: string }
> = {
  11: { label: '5 IDs (R8–11)', count: 5, rangeText: 'r-8 ถึง r-11' },
  14: { label: '2 IDs (R12–14)', count: 2, rangeText: 'r-12 ถึง r-14' },
  16: { label: '2 IDs (R14–16)', count: 2, rangeText: 'r-14 ถึง r-16' },
  18: { label: '5 IDs (R16–18)', count: 5, rangeText: 'r-16 ถึง r-18' },
};

const SvgProgressBar: React.FC<{
  percent: number;
  variant?: 'sky' | 'gold' | 'emerald' | 'purple';
  heightClass?: string;
  trackClass?: string;
}> = ({
  percent,
  variant = 'sky',
  heightClass = 'h-2.5',
  trackClass = 'bg-[#9ccdf1]',
}) => {
  const safePct = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const fillColor =
    variant === 'gold'
      ? 'url(#d2GoldGrad)'
      : variant === 'emerald'
      ? 'url(#d2EmeraldGrad)'
      : variant === 'purple'
      ? 'url(#d2PurpleGrad)'
      : 'url(#d2SkyGrad)';

  return (
    <div
      className={`w-full ${heightClass} rounded-full overflow-hidden ${trackClass}`}
      role="progressbar"
      aria-valuenow={Math.round(safePct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          <linearGradient id="d2SkyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#087cf4" />
            <stop offset="100%" stopColor="#54dfff" />
          </linearGradient>
          <linearGradient id="d2GoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffc52e" />
            <stop offset="100%" stopColor="#fff18b" />
          </linearGradient>
          <linearGradient id="d2EmeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="d2PurpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        {safePct > 0 && <rect x="0" y="0" width={safePct} height="10" rx="5" fill={fillColor} />}
      </svg>
    </div>
  );
};

export const Dashboard2View: React.FC<Dashboard2ViewProps> = ({
  language,
  theme,
  onToggleLanguage,
  onToggleTheme,
  account,
  chainId,
  isBscTestnet,
  usdtBalance,
  bnbBalance,
  allowance,
  contractAddress,
  profile,
  selectedMainId,
  onSelectMainId,
  onOpenMatrixTree,
  onOpenRegisterModal,
  onOpenContractSwitcher,
  onConnectWallet,
  onSwitchNetwork,
  onApproveUsdt,
  onUpgradeToRank,
  isLoadingTx = false,
  refreshTrigger,
}) => {
  const [bottomTab, setBottomTab] = useState<BottomTabKey>('home');
  const [activeModal, setActiveModal] = useState<DetailModalKey>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [reports, setReports] = useState<any[]>([]);
  const [systemPools, setSystemPools] = useState<any>(null);
  const [rankCounts, setRankCounts] = useState<Record<number, number>>({});
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentUpgrades, setRecentUpgrades] = useState<any[]>([]);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [refStatusText, setRefStatusText] = useState<string>('');
  const [customInspectInput, setCustomInspectInput] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'direct' | 'level' | 'vault'>('all');

  const activeIdNum = Math.max(1, Number(selectedMainId || profile?.mainNodeIdRank1 || 1));

  const fetchDashboardData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [perIdRes, countsRes, txRes, upRes] = await Promise.all([
        fetch('/api/matrix/per-id-history', { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch('/api/matrix/rank-counts', { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch('/api/transactions?limit=30', { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch('/api/upgrades?limit=30', { headers: { Accept: 'application/json' } }).catch(() => null),
      ]);

      if (perIdRes?.ok) {
        const d = await perIdRes.json();
        if (d?.success) {
          setReports(Array.isArray(d.reports) ? d.reports : []);
          if (d.systemPools) setSystemPools(d.systemPools);
        }
      }
      if (countsRes?.ok) {
        const c = await countsRes.json();
        if (c?.success && c.counts) {
          setRankCounts(c.counts);
        }
      }
      if (txRes?.ok) {
        const t = await txRes.json();
        if (Array.isArray(t?.transactions)) setRecentTransactions(t.transactions);
        else if (Array.isArray(t?.data)) setRecentTransactions(t.data);
      }
      if (upRes?.ok) {
        const u = await upRes.json();
        if (Array.isArray(u?.upgrades)) setRecentUpgrades(u.upgrades);
        else if (Array.isArray(u?.data)) setRecentUpgrades(u.data);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const onRefresh = () => fetchDashboardData();
    window.addEventListener('matrix:tree:refresh', onRefresh);
    const interval = setInterval(fetchDashboardData, 15000);
    return () => {
      window.removeEventListener('matrix:tree:refresh', onRefresh);
      clearInterval(interval);
    };
  }, [fetchDashboardData, contractAddress, refreshTrigger]);

  // Active report for selected Main ID
  const activeReport = useMemo(() => {
    if (reports.length === 0) return null;
    const exact = reports.find((r) => Number(r.id) === activeIdNum);
    if (exact) return exact;
    if (account) {
      const lower = account.toLowerCase();
      const firstOwned = reports.find(
        (r) => String(r.owner || '').toLowerCase() === lower && !r.isClone && !r.isExtraId
      );
      if (firstOwned) return firstOwned;
    }
    return reports[0];
  }, [reports, activeIdNum, account]);

  const displayId = Number(activeReport?.id || activeIdNum || 1);
  const currentRank = Math.max(
    1,
    Math.min(18, Number(activeReport?.currentMaxRank || profile?.currentMaxRank || 1))
  );
  const displayOwner = String(
    activeReport?.owner || account || '0x0000000000000000000000000000000000000000'
  );
  const shortWallet = `${displayOwner.slice(0, 6)}...${displayOwner.slice(-5)}`;

  // Build Vault breakdown from report or utility fallback
  const vaultPools = useMemo(() => {
    if (activeReport) {
      const upgradeRankPool = Number(activeReport.upgradeRankPool ?? 0);
      const newAutoIdPool = Number(activeReport.newAutoIdPool ?? 0);
      const newExtraIdPool = Number(activeReport.newExtraIdPool ?? 0);
      return {
        upgradeRankPool,
        newAutoIdPool,
        newExtraIdPool,
        totalRemaining: Number(
          (
            activeReport.vault35RemainingTotalUsdt ??
            upgradeRankPool + newAutoIdPool + newExtraIdPool
          ).toFixed(2)
        ),
        grossTotal: Number(activeReport.vault35GrossTotalUsdt ?? 0),
        deductedTotal: Number(activeReport.vault35DeductedTotalUsdt ?? 0),
      };
    }
    const vMap: Record<number, number> = {};
    if (Array.isArray(profile?.vaults)) {
      profile.vaults.forEach((v: any) => {
        vMap[Number(v.rank)] = parseFloat(v.balance || '0');
      });
    }
    const calc = calculateMainIdVaultPools(displayId, currentRank, vMap, 0);
    return {
      upgradeRankPool: calc.upgradeRankPool,
      newAutoIdPool: calc.newAutoIdPool,
      newExtraIdPool: calc.newExtraIdPool,
      totalRemaining: Number(
        (calc.upgradeRankPool + calc.newAutoIdPool + calc.newExtraIdPool).toFixed(2)
      ),
      grossTotal: calc.totalAccumulatedVault,
      deductedTotal: 0,
    };
  }, [activeReport, profile?.vaults, displayId, currentRank]);

  const direct30Total = Number(activeReport?.direct30TotalUsdt ?? 0);
  const level30Total = Number(activeReport?.level30TotalUsdt ?? 0);
  const totalIncomeUsdt = Number((direct30Total + level30Total).toFixed(2));
  const totalMembersR1 = Number(rankCounts[1] ?? reports.length ?? 0);
  const directMainIdsList: any[] = activeReport?.allSellQualification?.directMainIdsList || [];
  const totalAutoIds = Number(activeReport?.totalAutoIdCount ?? 0);
  const totalExtraIds = Number(activeReport?.totalExtraIdCount ?? 0);
  const totalClones = Number(activeReport?.totalClonesCount ?? 0);

  const nextRank = currentRank < 18 ? currentRank + 1 : 18;
  const nextRankPrice = RANK_PRICES_USDT[nextRank - 1] || 5000;
  const upgradePoolPct =
    currentRank >= 18
      ? 100
      : Math.min(100, (vaultPools.upgradeRankPool / Math.max(1, nextRankPrice)) * 100);
  const autoPoolPct = Math.min(100, (vaultPools.newAutoIdPool / 5) * 100);
  const extraPoolPct = Math.min(100, (vaultPools.newExtraIdPool / 10) * 100);
  const overallRankPct = Math.round((currentRank / 18) * 100);

  const referralUrl = useMemo(() => buildReferralLink(displayId), [displayId]);

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedRef(true);
      setRefStatusText(
        language === 'th'
          ? `คัดลอกลิงก์ของ ID #${displayId} เรียบร้อยแล้ว`
          : `Referral link for ID #${displayId} copied!`
      );
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      setRefStatusText(
        language === 'th' ? 'กรุณาคัดลอกลิงก์จากช่องด้านบน' : 'Please copy the link above manually'
      );
    }
  };

  // All IDs owned by connected wallet (for Switch ID modal)
  const ownedWalletReports = useMemo(() => {
    const walletLower = (account || displayOwner || '').toLowerCase();
    if (!walletLower) return reports.slice(0, 20);
    const list: Array<{
      key: string;
      id: number;
      mainIdToSelect: number;
      label: string;
      badge: string;
      rank: number;
      directSponsorNodeId: number;
      isExtra?: boolean;
      isAuto?: boolean;
    }> = [];
    for (const r of reports) {
      if (String(r.owner || '').toLowerCase() !== walletLower) continue;
      list.push({
        key: `MAIN-${r.id}`,
        id: Number(r.id),
        mainIdToSelect: Number(r.id),
        label: r.isAutoId ? `Auto ID #${r.id}` : `Main ID #${r.id}`,
        badge: r.isAutoId ? 'AUTO ID' : 'MAIN ID',
        rank: Number(r.currentMaxRank || 1),
        directSponsorNodeId: Number(r.directSponsorNodeId || 1),
        isAuto: Boolean(r.isAutoId),
      });
    }
    return list.sort((a, b) => a.id - b.id);
  }, [reports, account, displayOwner]);

  const ownedExtraIds = useMemo(() => {
    const walletLower = (account || displayOwner || '').toLowerCase();
    const extras: any[] = [];
    for (const r of reports) {
      for (const ex of r.autoExtraIdsSpawned || []) {
        if (!walletLower || String(ex.owner || r.owner || '').toLowerCase() === walletLower) {
          extras.push(ex);
        }
      }
    }
    return extras;
  }, [reports, account, displayOwner]);

  const allSellPools: any[] = activeReport?.allSellQualification?.pools || [];

  const combinedHistoryRows = useMemo(() => {
    if (!activeReport) return [];
    const rows: Array<{
      id: string;
      kind: 'direct' | 'level' | 'vault';
      label: string;
      rank: number;
      fromNodeId: number;
      amount: number;
      note: string;
      timestamp: string;
      txHash?: string;
    }> = [];
    (activeReport.direct30History || []).forEach((h: any, i: number) => {
      rows.push({
        id: `d-${i}-${h.fromNodeId}-${h.rank}`,
        kind: 'direct',
        label: '30% Direct',
        rank: Number(h.rank || 1),
        fromNodeId: Number(h.fromNodeId || 0),
        amount: Number(h.amountUsdt || 0),
        note: String(h.note || ''),
        timestamp: String(h.timestamp || ''),
        txHash: h.txHash,
      });
    });
    (activeReport.level30History || []).forEach((h: any, i: number) => {
      rows.push({
        id: `l-${i}-${h.fromNodeId}-${h.rank}`,
        kind: 'level',
        label: h.tier ? `Level ${h.tier}` : '30% Level',
        rank: Number(h.rank || 1),
        fromNodeId: Number(h.fromNodeId || 0),
        amount: Number(h.amountUsdt || 0),
        note: String(h.note || ''),
        timestamp: String(h.timestamp || ''),
        txHash: h.txHash,
      });
    });
    (activeReport.vault35History || []).forEach((h: any, i: number) => {
      rows.push({
        id: `v-${i}-${h.fromNodeId}-${h.rank}`,
        kind: 'vault',
        label: '35% Vault',
        rank: Number(h.rank || 1),
        fromNodeId: Number(h.fromNodeId || 0),
        amount: Number(h.amountUsdt || 0),
        note: String(h.note || ''),
        timestamp: String(h.timestamp || ''),
        txHash: h.txHash,
      });
    });
    return rows.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
  }, [activeReport]);

  const filteredHistoryRows = useMemo(() => {
    if (historyFilter === 'all') return combinedHistoryRows;
    return combinedHistoryRows.filter((r) => r.kind === historyFilter);
  }, [combinedHistoryRows, historyFilter]);

  const isOwnedByConnectedWallet = Boolean(
    account && displayOwner && account.toLowerCase() === displayOwner.toLowerCase()
  );

  const walletNeededForNextRank = Math.max(
    0,
    Number((nextRankPrice - vaultPools.upgradeRankPool).toFixed(2))
  );
  const needsUsdtApproval = Number(allowance || 0) < walletNeededForNextRank;

  return (
    <div className="relative min-h-[calc(100vh-56px)] w-full rounded-2xl overflow-x-hidden bg-gradient-to-br from-[#043b9c] via-[#087fe9] via-25% to-[#e7f6ff] text-[#09265f] pb-28">
      {/* Subtle Sparkle Starfield Overlay matching prototype */}
      <div className="pointer-events-none fixed inset-0 opacity-60 bg-[radial-gradient(circle_at_17%_12%,#8efaff_0_1px,transparent_3px),radial-gradient(circle_at_68%_8%,#ffffff_0_2px,transparent_4px),radial-gradient(circle_at_83%_23%,#72e5ff_0_2px,transparent_5px),radial-gradient(circle_at_31%_40%,#ffffff_0_1px,transparent_4px),radial-gradient(circle_at_92%_57%,#6beaff_0_2px,transparent_5px)] bg-[length:230px_210px,300px_260px,260px_230px,190px_180px,320px_280px]" />

      <div className="relative z-10 max-w-[760px] md:max-w-[1080px] mx-auto px-2.5 sm:px-5 pt-0 space-y-4">
        {/* 1. SAPPHIRE HERO HEADER */}
        <header className="relative h-[160px] md:h-[186px] text-white px-4 sm:px-6 pt-5 pb-3 overflow-hidden bg-[radial-gradient(ellipse_at_80%_72%,rgba(64,217,255,0.53),transparent_35%),linear-gradient(125deg,#05256d,#0066d7_58%,#031e68)] rounded-b-[28px] shadow-[0_8px_28px_rgba(0,62,155,0.53)]">
          {/* Glowing Orbital Arc */}
          <div className="pointer-events-none absolute w-[310px] h-[190px] -right-14 -bottom-20 border-2 border-[#69eaff]/60 rounded-[50%] shadow-[0_0_0_13px_rgba(70,207,255,0.13),0_0_0_28px_rgba(70,207,255,0.09),0_0_30px_#5ceaff] -rotate-24" />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-[54px] sm:text-[66px] leading-[0.8] text-[#7af1ff] font-black drop-shadow-[0_0_16px_rgba(0,186,255,0.95)] select-none">
                ∞
              </div>
              <div>
                <h1 className="text-[20px] sm:text-[27px] font-black leading-[1.06] tracking-wide m-0">
                  FRACTAL FLOW
                  <br />
                  MATRIX 18
                </h1>
                <small className="block text-[10px] sm:text-[11px] tracking-[1.2px] mt-1.5 text-[#d8f8ff] font-semibold">
                  Smart · Secure · Sustainable
                </small>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={fetchDashboardData}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 border border-cyan-300/40 text-white transition cursor-pointer"
                title={language === 'th' ? 'รีเฟรชข้อมูลจริง' : 'Refresh Live Data'}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onOpenMatrixTree(currentRank)}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-cyan-300/40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title={language === 'th' ? 'เปิดหน้าผัง Matrix' : 'Open Matrix Tree'}
              >
                <span className="text-base leading-none">♟</span>
                <span className="hidden sm:inline">Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => setBottomTab((prev) => (prev === 'settings' ? 'home' : 'settings'))}
                className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-cyan-300/40 text-white font-bold text-base leading-none transition cursor-pointer"
                title={language === 'th' ? 'เมนูและตั้งค่า' : 'Menu & Settings'}
              >
                ☰
              </button>
            </div>
          </div>
        </header>

        {/* 2. IDENTITY CARD */}
        <section className="-mt-6 mx-1 p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4 rounded-[25px] bg-gradient-to-br from-[#fffefa]/95 to-[#d5f3ff]/95 border-2 border-[#a9e7ff] shadow-[0_8px_24px_rgba(0,88,184,0.33)]">
          <div className="w-[66px] h-[66px] sm:w-[88px] sm:h-[88px] flex-none rounded-full grid place-items-center text-white text-[34px] sm:text-[42px] bg-[radial-gradient(circle_at_35%_25%,#5ceaff,#087cf4_48%,#032b93)] shadow-[0_0_0_5px_#b7eaff,0_0_20px_#00aaff]">
            ♙
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-[19px] sm:text-[23px] font-black text-[#09265f]">
                ID #{displayId}
              </strong>
              {activeReport?.isAutoId && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-extrabold">
                  AUTO ID
                </span>
              )}
            </div>

            <div className="my-1 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block bg-gradient-to-r from-[#ffdb62] to-[#fff0a6] rounded-[18px] px-3 py-1 font-bold text-[11px] sm:text-[12px] text-[#09265f] shadow-2xs">
                ⭐ Rank {currentRank} Member
              </span>
              <span className="text-[11px] font-bold text-[#0756bc]">
                · ผู้แนะนำ #{activeReport?.directSponsorNodeId || 1}
              </span>
            </div>

            <div className="text-[11px] sm:text-[12px] font-bold text-[#09265f] truncate font-mono">
              ▣ Wallet: {shortWallet}
              {account && (
                <span className="ml-2 text-[#0756bc] font-semibold">
                  ({Number(usdtBalance || 0).toFixed(2)} USDT)
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal('switch_id')}
            className="border-0 rounded-[16px] px-3 py-3 text-white font-bold text-xs sm:text-sm bg-gradient-to-br from-[#23caff] to-[#0755d7] shadow-[0_5px_15px_rgba(8,124,244,0.47)] hover:brightness-105 transition whitespace-nowrap cursor-pointer"
          >
            ⇄ สลับบัญชี
          </button>
        </section>

        {/* TAB: HOME (DASHBOARD OVERVIEW) */}
        {bottomTab === 'home' && (
          <>
            {/* 3. REFERRAL CARD */}
            <section className="mx-1 p-3.5 sm:p-4 rounded-[21px] bg-gradient-to-br from-white/95 to-[#d7f0ff]/95 border-[1.5px] border-[#a8ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)]">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[26px] text-[#087cf4] leading-none">🔗</span>
                <div>
                  <strong className="block text-[15px] font-extrabold text-[#09265f]">
                    ลิงก์ผู้แนะนำของคุณ
                  </strong>
                  <small className="block text-[11px] text-[#58769e]">
                    ส่งลิงก์นี้ให้สมาชิกใหม่สมัครภายใต้รหัสแนะนำของคุณ
                  </small>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralUrl}
                  aria-label="ลิงก์ผู้แนะนำ"
                  className="min-w-0 flex-1 border border-[#a9d7ff] rounded-[12px] bg-[#f7fcff] px-3 py-2.5 text-[#17477e] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className="border-0 rounded-[12px] px-4 text-white font-bold text-xs bg-gradient-to-br from-[#24caff] to-[#0754d2] shadow-[0_4px_12px_rgba(8,124,244,0.33)] hover:brightness-105 transition cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRef ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>

              <div className="text-[11px] text-[#55769b] mt-2">
                {refStatusText ||
                  `รหัสผู้แนะนำ: ID #${displayId} · ลิงก์นี้ใช้โดเมนของเว็บไซต์ที่เปิดอยู่`}
              </div>
            </section>

            {/* 4. 3 SUMMARY STATS CARDS */}
            <section className="grid grid-cols-3 gap-2.5 mx-1">
              <article
                onClick={() => setBottomTab('history')}
                className="min-w-0 p-3 sm:p-4 rounded-[21px] bg-gradient-to-br from-white to-[#d8f0ff] border-[1.5px] border-[#a8dfff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] min-h-[126px] cursor-pointer hover:border-[#087cf4] transition"
              >
                <div className="text-[24px] sm:text-[28px] text-[#087cf4] leading-none">▰</div>
                <label className="block text-[11px] sm:text-[12px] font-bold mt-1.5 min-h-[28px] text-[#09265f]">
                  รายได้ทั้งหมด
                </label>
                <strong className="block text-[20px] sm:text-[28px] leading-[1.15] my-1 tracking-tight text-[#09265f] font-black truncate">
                  {totalIncomeUsdt.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
                <small className="block text-[10px] sm:text-[11px] font-bold text-[#0c559f] truncate">
                  USDT (แนะนำ {direct30Total.toFixed(1)} + ชั้น {level30Total.toFixed(1)})
                </small>
              </article>

              <article
                onClick={() => setActiveModal('members')}
                className="min-w-0 p-3 sm:p-4 rounded-[21px] bg-gradient-to-br from-white to-[#d8f0ff] border-[1.5px] border-[#a8dfff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] min-h-[126px] cursor-pointer hover:border-[#087cf4] transition"
              >
                <div className="text-[24px] sm:text-[28px] text-[#087cf4] leading-none">👥</div>
                <label className="block text-[11px] sm:text-[12px] font-bold mt-1.5 min-h-[28px] text-[#09265f]">
                  สมาชิกทั้งหมด
                </label>
                <strong className="block text-[20px] sm:text-[28px] leading-[1.15] my-1 tracking-tight text-[#09265f] font-black">
                  {totalMembersR1.toLocaleString()}
                </strong>
                <small className="block text-[10px] sm:text-[11px] font-bold text-[#0c559f] truncate">
                  R1 Members (ตรง {directMainIdsList.length} IDs)
                </small>
              </article>

              <article
                onClick={() => setActiveModal('vault')}
                className="min-w-0 p-3 sm:p-4 rounded-[21px] bg-gradient-to-br from-white to-[#d8f0ff] border-[1.5px] border-[#a8dfff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] min-h-[126px] cursor-pointer hover:border-[#087cf4] transition"
              >
                <div className="text-[24px] sm:text-[28px] text-[#087cf4] leading-none">▣</div>
                <label className="block text-[11px] sm:text-[12px] font-bold mt-1.5 min-h-[28px] text-[#09265f]">
                  ยอดสะสมในถัง (Vault)
                </label>
                <strong className="block text-[20px] sm:text-[28px] leading-[1.15] my-1 tracking-tight text-[#09265f] font-black truncate">
                  {vaultPools.totalRemaining.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
                <small className="block text-[10px] sm:text-[11px] font-bold text-[#0c559f] truncate">
                  USDT คงเหลือ (รวมรับ {vaultPools.grossTotal.toFixed(2)})
                </small>
              </article>
            </section>

            {/* 5. MY VAULT — 3 SMART POOLS */}
            <section className="mx-1 p-3.5 sm:p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)]">
              <h2 className="flex items-center justify-between gap-2 mb-3 px-0.5 text-[16px] sm:text-[18px] font-black text-[#09265f]">
                <span>🛡 ถังสะสมเงิน (My Vault)</span>
                <button
                  type="button"
                  onClick={() => setActiveModal('vault')}
                  className="text-xs font-bold text-[#0756bc] hover:underline cursor-pointer"
                >
                  ดูทั้งหมด ›
                </button>
              </h2>

              <div className="grid grid-cols-3 gap-2.5">
                <article
                  onClick={() => setActiveModal('vault')}
                  className="p-2.5 sm:p-4 rounded-[20px] text-center bg-gradient-to-br from-[#f4fcff] to-[#cce8ff] border border-[#a8d9ff] shadow-[0_4px_13px_rgba(11,115,197,0.16)] cursor-pointer hover:scale-[1.01] transition"
                >
                  <div className="text-[26px] sm:text-[29px]">🚀</div>
                  <h3 className="text-[11px] sm:text-[13px] font-bold leading-snug my-1 text-[#09265f]">
                    ถังอัปเกรดแรงก์
                    <br />
                    (Upgrade Rank Pool)
                  </h3>
                  <strong className="text-[18px] sm:text-[22px] font-black block text-[#09265f]">
                    {vaultPools.upgradeRankPool.toFixed(2)}
                  </strong>
                  <small className="text-[10px] font-bold text-[#0c559f]">
                    {currentRank >= 18
                      ? 'USDT (Max R18)'
                      : `USDT / เป้า R${nextRank}: ${nextRankPrice} U`}
                  </small>
                  <div className="mt-2">
                    <SvgProgressBar percent={upgradePoolPct} variant="sky" heightClass="h-2" />
                  </div>
                </article>

                <article
                  onClick={() => setActiveModal('vault')}
                  className="p-2.5 sm:p-4 rounded-[20px] text-center bg-gradient-to-br from-[#eafff4] to-[#bdf5dc] border border-[#9ce9c5] shadow-[0_4px_13px_rgba(11,115,197,0.16)] cursor-pointer hover:scale-[1.01] transition"
                >
                  <div className="text-[26px] sm:text-[29px]">👤</div>
                  <h3 className="text-[11px] sm:text-[13px] font-bold leading-snug my-1 text-[#09265f]">
                    ถังสร้าง Main ID
                    <br />
                    (New Auto ID Pool)
                  </h3>
                  <strong className="text-[18px] sm:text-[22px] font-black block text-[#09265f]">
                    {vaultPools.newAutoIdPool.toFixed(2)}
                  </strong>
                  <small className="text-[10px] font-bold text-[#0f6b47]">
                    USDT (แตกแล้ว {totalAutoIds} Auto ID)
                  </small>
                  <div className="mt-2">
                    <SvgProgressBar
                      percent={autoPoolPct}
                      variant="emerald"
                      heightClass="h-2"
                      trackClass="bg-[#a7e6c9]"
                    />
                  </div>
                </article>

                <article
                  onClick={() => setActiveModal('vault')}
                  className="p-2.5 sm:p-4 rounded-[20px] text-center bg-gradient-to-br from-[#fbf5ff] to-[#e0ccff] border border-[#d4b8ff] shadow-[0_4px_13px_rgba(11,115,197,0.16)] cursor-pointer hover:scale-[1.01] transition"
                >
                  <div className="text-[26px] sm:text-[29px]">✦</div>
                  <h3 className="text-[11px] sm:text-[13px] font-bold leading-snug my-1 text-[#09265f]">
                    ถังสร้าง Extra ID
                    <br />
                    (New Extra ID Pool)
                  </h3>
                  <strong className="text-[18px] sm:text-[22px] font-black block text-[#09265f]">
                    {vaultPools.newExtraIdPool.toFixed(2)}
                  </strong>
                  <small className="text-[10px] font-bold text-[#5b21b6]">
                    USDT (แตกแล้ว {totalExtraIds} Extra ID)
                  </small>
                  <div className="mt-2">
                    <SvgProgressBar
                      percent={extraPoolPct}
                      variant="purple"
                      heightClass="h-2"
                      trackClass="bg-[#ccb3f7]"
                    />
                  </div>
                </article>
              </div>
            </section>

            {/* 6. RANK HERO BANNER */}
            <section className="mx-1 rounded-[23px] p-4 sm:px-5 text-white bg-[radial-gradient(circle_at_16%_50%,#1168d9,#061d68_47%,#063f9f)] shadow-[0_7px_22px_rgba(3,67,164,0.47)] flex items-center gap-3.5 border border-[#42bfff]">
              <div className="text-[40px] sm:text-[49px] drop-shadow-[0_0_7px_#ffdc5a] shrink-0">
                🏆
              </div>

              <div className="flex-1 min-w-0">
                <small className="block text-[11px] sm:text-[12px] text-[#d7f3ff]">
                  ระดับปัจจุบันของคุณ
                </small>
                <strong className="block text-[26px] sm:text-[34px] leading-[1.05] text-[#fff2a4] font-black">
                  RANK {currentRank}
                </strong>
                <em className="not-italic text-[10px] sm:text-[11px] text-cyan-200">
                  FRACTAL FLOW MATRIX 18 · โคลน {totalClones} ใบ
                </em>
              </div>

              <div className="w-[38%] font-bold text-[11px] sm:text-[12px]">
                <div className="flex items-center justify-between mb-1">
                  <span>ความคืบหน้า</span>
                  <span className="text-[#fff2a4]">{overallRankPct}%</span>
                </div>
                <SvgProgressBar
                  percent={overallRankPct}
                  variant="gold"
                  heightClass="h-3.5"
                  trackClass="bg-[#164c93] border border-[#77cfff]"
                />
                <small className="block mt-1 text-[10px] text-[#d7f3ff] truncate">
                  {currentRank >= 18
                    ? 'ปลดล็อกครบสูงสุด 18 Rank แล้ว'
                    : `เป้าหมายถัดไป: R${nextRank} (${nextRankPrice.toLocaleString()} U)`}
                </small>
              </div>
            </section>

            {/* 7. 18-RANK MEMBER TABLE */}
            <section className="mx-1 p-3.5 sm:p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)]">
              <h2 className="flex items-center justify-between gap-2 mb-3 px-0.5 text-[16px] sm:text-[18px] font-black text-[#09265f]">
                <span>👑 ตารางสมาชิกครบ 18 RANK</span>
                <span className="text-xs font-bold text-[#0756bc]">RANK 1–18</span>
              </h2>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => {
                  const isCurrent = n === currentRank;
                  const isUnlocked = n < currentRank;
                  const priceUsdt = RANK_PRICES_USDT[n - 1] || 5;
                  const membersInRank = Number(rankCounts[n] ?? 0);
                  const req = ALLSELL_DIRECT_REQUIREMENTS[n];
                  const matchingPool = allSellPools.find((p) => Number(p.targetRank) === n);

                  return (
                    <article
                      key={`d2-rank-${n}`}
                      onClick={() => onOpenMatrixTree(n)}
                      className={`rounded-[16px] p-2.5 sm:p-3 min-w-0 cursor-pointer transition hover:-translate-y-0.5 ${
                        isCurrent
                          ? 'bg-gradient-to-br from-[#087cf4] to-[#0646b3] border border-[#5ddcff] text-white shadow-[0_5px_14px_rgba(8,101,215,0.47)]'
                          : isUnlocked
                          ? 'bg-gradient-to-br from-[#f2fbff] to-[#cdeaff] border border-[#6ec8ff] text-[#09265f] shadow-[0_4px_11px_rgba(7,86,165,0.16)]'
                          : 'bg-gradient-to-br from-white to-[#d9efff] border border-[#a6d8ff] text-[#09265f] shadow-[0_4px_11px_rgba(7,86,165,0.16)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <b
                          className={`text-[13px] sm:text-[15px] font-black ${
                            isCurrent ? 'text-white' : 'text-[#0754b9]'
                          }`}
                        >
                          RANK {n}
                        </b>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[10px] whitespace-nowrap ${
                            isCurrent
                              ? 'bg-[#ffdf6d] text-[#173b77]'
                              : isUnlocked
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-[#d7efff] text-[#0754b9]'
                          }`}
                        >
                          {isCurrent
                            ? 'CURRENT'
                            : isUnlocked
                            ? 'UNLOCKED'
                            : n === 1
                            ? 'START'
                            : `${priceUsdt.toLocaleString()}U`}
                        </span>
                      </div>

                      <div
                        className={`text-[10px] sm:text-[11px] leading-relaxed ${
                          isCurrent ? 'text-[#e3f6ff]' : 'text-[#45668f]'
                        }`}
                      >
                        <div>
                          ราคา:{' '}
                          <strong className={isCurrent ? 'text-white' : 'text-[#082d73]'}>
                            {priceUsdt.toLocaleString()} U
                          </strong>
                        </div>
                        <div>
                          สมาชิกใน Rank:{' '}
                          <strong className={isCurrent ? 'text-white' : 'text-[#082d73]'}>
                            {membersInRank}
                          </strong>
                        </div>
                        <div>
                          Direct Sponsor:{' '}
                          <strong
                            className={
                              isCurrent
                                ? 'text-[#ffdf6d]'
                                : req
                                ? 'text-[#b45309]'
                                : 'text-[#082d73]'
                            }
                          >
                            {req
                              ? matchingPool
                                ? `${matchingPool.qualifiedDirectCount}/${req.count} IDs*`
                                : req.label
                              : 'ไม่กำหนด'}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <p className="text-[10px] text-[#54759c] leading-relaxed mt-2.5">
                สมาชิกใน Rank = จำนวนโหนดจริงใน Rank นั้นจากระบบ · Direct Sponsor (*) = เกณฑ์ผู้แนะนำตรงสำหรับสิทธิ์รับกองทุน AllSell (R11: 5 IDs ใน R8-11 · R14: 2 IDs ใน R12-14 · R16: 2 IDs ใน R14-16 · R18: 5 IDs ใน R16-18) · กดที่การ์ด Rank เพื่อเปิดดูผัง Matrix ของ Rank นั้น
              </p>
            </section>

            {/* 8. MAIN MENU (6 ACTION CARDS) */}
            <section className="mx-1 p-3.5 sm:p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)]">
              <h2 className="flex items-center justify-between gap-2 mb-3 px-0.5 text-[16px] sm:text-[18px] font-black text-[#09265f]">
                <span>เมนูหลัก</span>
                <span className="text-xs font-bold text-[#0756bc]">ทางลัดจัดการบัญชี</span>
              </h2>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveModal('members')}
                  className="p-3.5 text-center rounded-[18px] bg-gradient-to-br from-white to-[#d5edff] border border-[#a7d8ff] shadow-[0_4px_12px_rgba(7,86,165,0.16)] text-xs font-black text-[#09265f] hover:border-[#087cf4] hover:-translate-y-0.5 transition cursor-pointer"
                >
                  <b className="block text-[28px] text-[#087cf4] mb-1">👥</b>
                  <span>สมาชิก</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenMatrixTree(currentRank)}
                  className="p-3.5 text-center rounded-[18px] bg-gradient-to-br from-white to-[#d5edff] border border-[#a7d8ff] shadow-[0_4px_12px_rgba(7,86,165,0.16)] text-xs font-black text-[#09265f] hover:border-[#087cf4] hover:-translate-y-0.5 transition cursor-pointer"
                >
                  <b className="block text-[28px] text-[#087cf4] mb-1">⌘</b>
                  <span>Matrix</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('upgrade')}
                  className="p-3.5 text-center rounded-[18px] bg-gradient-to-br from-white to-[#d5edff] border border-[#a7d8ff] shadow-[0_4px_12px_rgba(7,86,165,0.16)] text-xs font-black text-[#09265f] hover:border-[#087cf4] hover:-translate-y-0.5 transition cursor-pointer"
                >
                  <b className="block text-[28px] text-[#087cf4] mb-1">📈</b>
                  <span>อัปเกรด Rank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('wallet')}
                  className="p-3.5 text-center rounded-[18px] bg-gradient-to-br from-white to-[#d5edff] border border-[#a7d8ff] shadow-[0_4px_12px_rgba(7,86,165,0.16)] text-xs font-black text-[#09265f] hover:border-[#087cf4] hover:-translate-y-0.5 transition cursor-pointer"
                >
                  <b className="block text-[28px] text-[#087cf4] mb-1">▰</b>
                  <span>กระเป๋าเงิน</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('vault')}
                  className="p-3.5 text-center rounded-[18px] bg-gradient-to-br from-white to-[#d5edff] border border-[#a7d8ff] shadow-[0_4px_12px_rgba(7,86,165,0.16)] text-xs font-black text-[#09265f] hover:border-[#087cf4] hover:-translate-y-0.5 transition cursor-pointer"
                >
                  <b className="block text-[28px] text-[#087cf4] mb-1">▣</b>
                  <span>Vault</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('allsell')}
                  className="p-3.5 text-center rounded-[18px] bg-gradient-to-br from-white to-[#d5edff] border border-[#a7d8ff] shadow-[0_4px_12px_rgba(7,86,165,0.16)] text-xs font-black text-[#09265f] hover:border-[#087cf4] hover:-translate-y-0.5 transition cursor-pointer"
                >
                  <b className="block text-[28px] text-[#087cf4] mb-1">🎁</b>
                  <span>AllSell Pool</span>
                </button>
              </div>
            </section>

            {/* 9. FOOTER BANNER */}
            <div className="mx-1 p-4 text-center text-white rounded-[20px] bg-[radial-gradient(circle_at_20%_50%,#168be9,#041b61_70%)] shadow-[0_8px_22px_rgba(0,72,190,0.23)] font-bold">
              <div className="text-[34px] text-[#66eaff] leading-none">∞</div>
              <div className="text-sm mt-1">Together We Grow</div>
              <strong className="text-[17px] text-[#ffe57d] block my-1">
                “เติบโตไปด้วยกัน สู่ความสำเร็จที่ยิ่งใหญ่”
              </strong>
              <div className="text-xs tracking-wider text-cyan-100">FRACTAL FLOW MATRIX 18</div>
            </div>
          </>
        )}

        {/* TAB: HISTORY (PAYOUT LOGS FOR SELECTED ID) */}
        {bottomTab === 'history' && (
          <section className="mx-1 p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-[#09265f]">
                ▥ ประวัติรายได้ของ ID #{displayId}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'direct', 'level', 'vault'] as const).map((fk) => (
                  <button
                    key={fk}
                    type="button"
                    onClick={() => setHistoryFilter(fk)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      historyFilter === fk
                        ? 'bg-[#087cf4] text-white'
                        : 'bg-white text-[#0756bc] border border-[#a9ddff]'
                    }`}
                  >
                    {fk === 'all'
                      ? 'ทั้งหมด'
                      : fk === 'direct'
                      ? '30% แนะนำ'
                      : fk === 'level'
                      ? '30% ค่าชั้น'
                      : '35% Vault'}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistoryRows.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-white/70 border border-[#b8e5ff] text-xs font-semibold text-[#54759c]">
                ยังไม่มีรายการรับรายได้ในหมวดนี้สำหรับ ID #{displayId}
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredHistoryRows.map((row) => (
                  <div
                    key={row.id}
                    className="p-3 rounded-xl bg-white/90 border border-[#b8e5ff] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            row.kind === 'direct'
                              ? 'bg-emerald-100 text-emerald-700'
                              : row.kind === 'level'
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {row.label}
                        </span>
                        <span className="font-mono font-bold text-[#0754b9]">
                          Rank {row.rank} · จาก #{row.fromNodeId}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#45668f] truncate">{row.note}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <strong className="text-sm font-black text-emerald-600 block">
                        +{row.amount.toFixed(2)} U
                      </strong>
                      {row.txHash && row.txHash.startsWith('0x') && row.txHash.length >= 60 && (
                        <a
                          href={`https://testnet.bscscan.com/tx/${row.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#087cf4] hover:underline inline-flex items-center gap-0.5"
                        >
                          BscScan <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB: TRANSACTIONS */}
        {bottomTab === 'transactions' && (
          <section className="mx-1 p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#09265f]">
                ⇄ ธุรกรรมและประวัติอัปเกรดล่าสุด
              </h2>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="px-3 py-1 rounded-xl bg-white border border-[#a9ddff] text-xs font-bold text-[#0756bc] cursor-pointer"
              >
                รีเฟรช
              </button>
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {recentUpgrades.slice(0, 15).map((up: any, i: number) => (
                <div
                  key={`up-${i}-${up.newNodeId}-${up.toRank}`}
                  className="p-3 rounded-xl bg-white/90 border border-[#b8e5ff] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#09265f] flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-[#0754b9] font-mono text-[10px]">
                        R{up.fromRank} ➔ R{up.toRank}
                      </span>
                      <span>
                        Main #{up.mainNodeId} · Node #{up.newNodeId}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#55769b] font-mono mt-0.5">
                      ผู้แนะนำ #{up.directSponsorNodeId} · อัพไลน์ #{up.parentId} ({up.side})
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <strong className="text-sm font-black text-[#0754b9] block">
                      {Number(up.rankPriceUsdt || 0).toFixed(2)} U
                    </strong>
                    <span className="text-[10px] text-emerald-700">
                      Vault -{Number(up.vaultDeductedUsdt || 0).toFixed(2)} U
                    </span>
                  </div>
                </div>
              ))}

              {recentTransactions.slice(0, 15).map((tx: any, i: number) => (
                <div
                  key={`tx-${i}-${tx.txHash || tx.id}`}
                  className="p-3 rounded-xl bg-white/90 border border-[#b8e5ff] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#09265f]">
                      {tx.type || 'ONCHAIN'} · Node #{tx.nodeId || tx.mainNodeId || '—'} (Rank{' '}
                      {tx.rank || 1})
                    </div>
                    <div className="text-[11px] text-[#55769b] font-mono truncate">
                      {String(tx.owner || '').slice(0, 10)}...{String(tx.owner || '').slice(-6)}
                    </div>
                  </div>
                  {tx.txHash && String(tx.txHash).startsWith('0x') && (
                    <a
                      href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-[#eff8ff] border border-[#a9d7ff] text-[11px] font-bold text-[#0756bc] hover:underline shrink-0 inline-flex items-center gap-1"
                    >
                      BscScan <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}

              {recentUpgrades.length === 0 && recentTransactions.length === 0 && (
                <div className="p-6 text-center rounded-2xl bg-white/70 border border-[#b8e5ff] text-xs font-semibold text-[#54759c]">
                  ยังไม่มีข้อมูลธุรกรรมในระบบ
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB: HELP */}
        {bottomTab === 'help' && (
          <section className="mx-1 p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] space-y-3 text-xs text-[#09265f]">
            <h2 className="text-base sm:text-lg font-black">◉ คู่มือระบบ FRACTAL FLOW MATRIX 18</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/85 border border-[#b8e5ff] space-y-1">
                <strong className="text-sm text-[#0754b9] block">1. การจ่ายรายได้ 100% ทุกแรงค์</strong>
                <p className="text-[#45668f] leading-relaxed">
                  30% ค่าแนะนำตรง (อ้างอิง Rank 1 เสมอ) + 30% ค่าชั้น 15 ชั้น (ชั้นละ 2%) + 35% กระปุกอัปเกรด (Vault) + 4% กองทุน AllSell + 1% บอทระบบ
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/85 border border-[#b8e5ff] space-y-1">
                <strong className="text-sm text-[#0754b9] block">2. กฎผังไบนารี่ ซ้าย-ขวา</strong>
                <p className="text-[#45668f] leading-relaxed">
                  เม็ดซ้ายส่ง 35% เข้ากระปุก Vault ของผู้เป็นอัพไลน์ ส่วนเม็ดขวาจะกระตุ้น Rebirth Clone 100% สลับรอบ 1 (ติดผู้แนะนำ) และรอบ 2 (BFS ผังกลาง)
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/85 border border-[#b8e5ff] space-y-1">
                <strong className="text-sm text-[#0754b9] block">3. ระบบ 3 ถังสะสม (5 Rank ย้อนหลัง)</strong>
                <p className="text-[#45668f] leading-relaxed">
                  Upgrade Rank Pool รวมยอด 5 Rank ล่าสุด, New Auto ID Pool รวม Rank 1–3 ที่พ้นกรอบ (ครบ 5 U แตก Auto ID), และ New Extra ID Pool รวม Rank 4–18 ที่พ้นกรอบ
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/85 border border-[#b8e5ff] space-y-1">
                <strong className="text-sm text-[#0754b9] block">4. กองทุน AllSell 4% (4 กอง)</strong>
                <p className="text-[#45668f] leading-relaxed">
                  R11 มีตรง 5 ID (R8-11) · R14 มีตรง 2 ID (R12-14) · R16 มีตรง 2 ID (R14-16) · R18 มีตรง 5 ID (R16-18) ตัดรอบโอนทุกวันที่ 1 และ 15
                </p>
              </div>
            </div>
          </section>
        )}

        {/* TAB: SETTINGS */}
        {bottomTab === 'settings' && (
          <section className="mx-1 p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] space-y-3 text-xs">
            <h2 className="text-base sm:text-lg font-black text-[#09265f]">⚙ ตั้งค่าระบบและกระเป๋า</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-white/90 border border-[#b8e5ff] space-y-2">
                <div className="font-bold text-[#0754b9] flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  <span>สถานะกระเป๋าและเครือข่าย</span>
                </div>
                <div className="font-mono text-[11px] text-[#45668f] space-y-1">
                  <div>Wallet: {account ? shortWallet : 'ยังไม่เชื่อมต่อ'}</div>
                  <div>
                    Chain ID: {chainId || '—'} ({isBscTestnet ? 'BSC Testnet ✓' : 'ไม่ใช่ BSC Testnet'})
                  </div>
                  <div>USDT Balance: {Number(usdtBalance || 0).toFixed(2)} U</div>
                  <div>BNB Balance: {Number(bnbBalance || 0).toFixed(4)} tBNB</div>
                </div>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {!account ? (
                    <button
                      type="button"
                      onClick={onConnectWallet}
                      className="px-3 py-1.5 rounded-xl bg-[#087cf4] text-white font-bold cursor-pointer"
                    >
                      เชื่อมต่อกระเป๋า
                    </button>
                  ) : !isBscTestnet ? (
                    <button
                      type="button"
                      onClick={onSwitchNetwork}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold cursor-pointer"
                    >
                      สลับไป BSC Testnet
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onOpenRegisterModal}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    + สมัครรหัสใหม่
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/90 border border-[#b8e5ff] space-y-2">
                <div className="font-bold text-[#0754b9] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>สัญญา Smart Contract & การแสดงผล</span>
                </div>
                <div className="font-mono text-[11px] text-[#45668f] break-all">
                  Contract: {contractAddress || CONTRACT_ADDRESS}
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={onOpenContractSwitcher}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#a9d7ff] text-[#0756bc] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>เปลี่ยนสัญญา</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleLanguage}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#a9d7ff] text-[#0756bc] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'ภาษา: TH' : 'Lang: EN'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#a9d7ff] text-[#0756bc] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    {theme === 'light' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Moon className="w-3.5 h-3.5" />
                    )}
                    <span>{theme === 'light' ? 'ธีมสว่าง' : 'ธีมมืด'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* STICKY BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[min(1080px,100%)] grid grid-cols-5 px-2 py-2 bg-white/95 backdrop-blur-md border border-[#c5e6ff] rounded-t-[24px] shadow-[0_-6px_22px_rgba(7,85,181,0.18)] z-40">
        {(
          [
            { key: 'home', icon: '⌂', label: 'หน้าหลัก' },
            { key: 'history', icon: '▥', label: 'ประวัติ' },
            { key: 'transactions', icon: '⇄', label: 'ธุรกรรม' },
            { key: 'help', icon: '◉', label: 'ช่วยเหลือ' },
            { key: 'settings', icon: '⚙', label: 'ตั้งค่า' },
          ] as const
        ).map((tab) => {
          const isActive = bottomTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setBottomTab(tab.key)}
              className={`text-center text-[11px] font-bold py-1.5 rounded-[16px] transition cursor-pointer ${
                isActive
                  ? 'text-white bg-gradient-to-br from-[#21bfff] to-[#0754d2] shadow-[0_4px_12px_rgba(5,119,223,0.47)]'
                  : 'text-[#42689c] hover:text-[#087cf4]'
              }`}
            >
              <b className="block text-[20px] leading-tight">{tab.icon}</b>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* INTERACTIVE MODALS FOR DASHBOARD 2 ACTIONS */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[24px] bg-gradient-to-br from-white to-[#e3f4ff] border-2 border-[#a9ddff] shadow-2xl p-4 sm:p-5 text-[#09265f] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#b8e5ff] pb-2.5">
              <h3 className="text-base sm:text-lg font-black">
                {activeModal === 'switch_id' && '⇄ สลับบัญชี / เลือกรหัสที่ต้องการดู'}
                {activeModal === 'members' && `👥 สมาชิก & สายงานของ ID #${displayId}`}
                {activeModal === 'upgrade' && `📈 อัปเกรด Rank สำหรับ ID #${displayId}`}
                {activeModal === 'wallet' && `▰ กระเป๋าเงินและรายได้ ID #${displayId}`}
                {activeModal === 'vault' && `▣ รายละเอียดถังสะสมเงิน (Vault) ID #${displayId}`}
                {activeModal === 'allsell' && `🎁 สิทธิ์กองทุน AllSell Pool 4% (ID #${displayId})`}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-xl bg-white hover:bg-blue-50 border border-[#b8e5ff] text-[#0756bc] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL: SWITCH ID */}
            {activeModal === 'switch_id' && (
              <div className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="พิมพ์เลข Main ID เช่น 1, 2, 3..."
                    value={customInspectInput}
                    onChange={(e) => setCustomInspectInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#a9d7ff] bg-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = parseInt(customInspectInput, 10);
                      if (num >= 1) {
                        onSelectMainId(String(num));
                        setActiveModal(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-br from-[#23caff] to-[#0755d7] text-white font-bold cursor-pointer"
                  >
                    เปิดดู ID
                  </button>
                </div>

                <div className="font-bold text-[#0754b9]">
                  รหัสหลักในกระเป๋า ({ownedWalletReports.length} IDs):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {ownedWalletReports.map((item) => {
                    const isSelected = item.id === displayId;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          onSelectMainId(String(item.mainIdToSelect));
                          setActiveModal(null);
                        }}
                        className={`p-3 rounded-xl text-left border transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#087cf4] to-[#0646b3] text-white border-[#5ddcff]'
                            : 'bg-white hover:bg-blue-50 border-[#b8e5ff]'
                        }`}
                      >
                        <div>
                          <div className="font-black text-sm">{item.label}</div>
                          <div
                            className={`text-[10px] font-mono ${
                              isSelected ? 'text-cyan-100' : 'text-[#55769b]'
                            }`}
                          >
                            Rank {item.rank} · ผู้แนะนำ #{item.directSponsorNodeId}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSelected
                              ? 'bg-[#ffdf6d] text-[#173b77]'
                              : 'bg-[#d7efff] text-[#0754b9]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {ownedExtraIds.length > 0 && (
                  <div className="pt-2 border-t border-[#b8e5ff] space-y-1.5">
                    <div className="font-bold text-[#5b21b6]">
                      Extra IDs ในกระเป๋า ({ownedExtraIds.length} IDs):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ownedExtraIds.map((ex: any) => (
                        <button
                          key={`ex-sw-${ex.rank}-${ex.id}`}
                          type="button"
                          onClick={() => {
                            setActiveModal(null);
                            onOpenMatrixTree(Number(ex.rank || 2));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-mono text-[11px] font-bold cursor-pointer hover:bg-rose-100"
                        >
                          {ex.label || `Extra R${ex.rank}-#${ex.id}`} (ผู้แนะนำ #{ex.directSponsorNodeId})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODAL: MEMBERS & DIRECT SPONSOR */}
            {activeModal === 'members' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">สมาชิกทั้งระบบ R1</div>
                    <strong className="text-lg font-black text-[#0754b9]">{totalMembersR1}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">ลูกตรง (Direct)</div>
                    <strong className="text-lg font-black text-emerald-700">
                      {directMainIdsList.length}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">Extra / Auto / โคลน</div>
                    <strong className="text-lg font-black text-purple-700">
                      {totalExtraIds} / {totalAutoIds} / {totalClones}
                    </strong>
                  </div>
                </div>

                <div className="font-bold text-[#0754b9]">รหัสหลักที่แนะนำตรงโดย ID #{displayId}:</div>
                {directMainIdsList.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-white/80 border border-[#b8e5ff] text-[#55769b]">
                    ยังไม่มีสมาชิกที่แนะนำตรงภายใต้ ID #{displayId}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {directMainIdsList.map((dm: any) => (
                      <div
                        key={`dm-${dm.id}`}
                        onClick={() => {
                          onSelectMainId(String(dm.id));
                          setActiveModal(null);
                        }}
                        className="p-2.5 rounded-xl bg-white border border-[#b8e5ff] hover:border-[#087cf4] cursor-pointer"
                      >
                        <div className="font-black text-sm text-[#09265f]">
                          {dm.isAutoId ? `Auto #${dm.id}` : `Main #${dm.id}`}
                        </div>
                        <div className="text-[11px] font-bold text-[#0756bc]">
                          Rank {dm.currentMaxRank}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(activeReport?.autoExtraIdsSpawned || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="font-bold text-rose-700">
                      Extra IDs ที่สร้างจาก ID #{displayId}:
                    </div>
                    <div className="space-y-1">
                      {activeReport.autoExtraIdsSpawned.map((ex: any) => (
                        <div
                          key={`m-ex-${ex.rank}-${ex.id}`}
                          className="p-2 rounded-xl bg-white border border-rose-200 flex items-center justify-between font-mono text-[11px]"
                        >
                          <span className="font-bold text-rose-700">
                            {ex.label || `Extra R${ex.rank}-#${ex.id}`}
                          </span>
                          <span>
                            อัพไลน์ #{ex.parentId} ({ex.side}) · ผู้แนะนำ #{ex.directSponsorNodeId}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODAL: UPGRADE RANK */}
            {activeModal === 'upgrade' && (
              <div className="space-y-3 text-xs">
                {currentRank >= 18 ? (
                  <div className="p-5 text-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                    ID #{displayId} ปลดล็อกถึงระดับสูงสุด Rank 18 แล้ว!
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 rounded-2xl bg-white border border-[#b8e5ff] space-y-2">
                      <div className="flex items-center justify-between">
                        <span>ระดับถัดไป:</span>
                        <strong className="text-base font-black text-[#0754b9]">
                          Rank {nextRank} ({nextRankPrice.toLocaleString()} USDT)
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>หักจาก Upgrade Rank Pool:</span>
                        <strong className="text-emerald-700 font-mono">
                          -{Math.min(nextRankPrice, vaultPools.upgradeRankPool).toFixed(2)} USDT
                        </strong>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#b8e5ff] pt-2">
                        <span>ยอดส่วนต่างที่ต้องชำระจาก Wallet:</span>
                        <strong className="text-base font-black text-amber-700 font-mono">
                          {walletNeededForNextRank.toFixed(2)} USDT
                        </strong>
                      </div>
                    </div>

                    {!account ? (
                      <button
                        type="button"
                        onClick={onConnectWallet}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#23caff] to-[#0755d7] text-white font-bold cursor-pointer"
                      >
                        เชื่อมต่อกระเป๋าเพื่ออัปเกรด
                      </button>
                    ) : !isOwnedByConnectedWallet ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                        กระเป๋าที่เชื่อมต่อปัจจุบันไม่ใช่เจ้าของ ID #{displayId} กรุณาสลับบัญชีหรือสลับกระเป๋า
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {needsUsdtApproval && walletNeededForNextRank > 0 && (
                          <button
                            type="button"
                            disabled={isLoadingTx}
                            onClick={() => onApproveUsdt(walletNeededForNextRank)}
                            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer disabled:opacity-50"
                          >
                            1. อนุมัติ USDT ({walletNeededForNextRank.toFixed(2)} U)
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isLoadingTx}
                          onClick={async () => {
                            await onUpgradeToRank(nextRank, displayId);
                            setActiveModal(null);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-[#23caff] to-[#0755d7] text-white font-black cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>อัปเกรดสู่ Rank {nextRank}</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* MODAL: WALLET */}
            {activeModal === 'wallet' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">30% ค่าแนะนำตรง</div>
                    <strong className="text-lg font-black text-emerald-700">
                      +{direct30Total.toFixed(2)} USDT
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">30% ค่าบริหารชั้น (15 ชั้น)</div>
                    <strong className="text-lg font-black text-cyan-700">
                      +{level30Total.toFixed(2)} USDT
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">USDT ในกระเป๋า</div>
                    <strong className="text-base font-black text-[#0754b9]">
                      {Number(usdtBalance || 0).toFixed(2)} U
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">BNB ค่า Gas</div>
                    <strong className="text-base font-black text-[#0754b9]">
                      {Number(bnbBalance || 0).toFixed(4)} tBNB
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setBottomTab('history');
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-br from-[#23caff] to-[#0755d7] text-white font-bold cursor-pointer"
                >
                  ดูประวัติรายได้ทั้งหมดของ ID #{displayId}
                </button>
              </div>
            )}

            {/* MODAL: VAULT LEDGER */}
            {activeModal === 'vault' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">สะสม Vault รวม</div>
                    <strong className="text-base font-black text-[#0754b9]">
                      {vaultPools.grossTotal.toFixed(2)} U
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">ถูกใช้ไปแล้ว</div>
                    <strong className="text-base font-black text-rose-600">
                      -{vaultPools.deductedTotal.toFixed(2)} U
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">คงเหลือ 3 ถัง</div>
                    <strong className="text-base font-black text-emerald-700">
                      {vaultPools.totalRemaining.toFixed(2)} U
                    </strong>
                  </div>
                </div>

                <div className="font-bold text-[#0754b9]">สมุดบัญชี Vault เข้า/ออก:</div>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {(activeReport?.vault35Ledger || []).length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-white/80 border border-[#b8e5ff] text-[#55769b]">
                      ยังไม่มีรายการเคลื่อนไหวในถัง Vault ของ ID #{displayId}
                    </div>
                  ) : (
                    (activeReport.vault35Ledger as any[]).map((item, idx) => (
                      <div
                        key={`vl-${idx}`}
                        className="p-2.5 rounded-xl bg-white border border-[#b8e5ff] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#09265f]">
                            {item.poolLabel || item.poolType} · R{item.rank}
                          </div>
                          <div className="text-[10.5px] text-[#55769b] truncate">{item.note}</div>
                        </div>
                        <strong
                          className={`font-mono font-black shrink-0 ${
                            item.direction === 'OUT' ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {item.direction === 'OUT' ? '-' : '+'}
                          {Number(item.amountUsdt || 0).toFixed(2)} U
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MODAL: ALLSELL 4 POOLS */}
            {activeModal === 'allsell' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-white border border-[#b8e5ff] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#0754b9]">กองทุน AllSell รวมทุกแรงค์ (4%)</div>
                    <div className="text-[11px] text-[#55769b]">
                      ประมาณการส่วนแบ่งของคุณ:{' '}
                      <strong className="text-emerald-700">
                        +{Number(activeReport?.allSellQualification?.estimatedAllSellShareUsdt || 0).toFixed(2)} U
                      </strong>
                    </div>
                  </div>
                  <strong className="text-lg font-black text-[#09265f] font-mono">
                    +{Number(systemPools?.allSellTotalUsdt || 0).toFixed(2)} U
                  </strong>
                </div>

                <div className="space-y-2">
                  {allSellPools.map((pool: any) => (
                    <div
                      key={pool.key}
                      className={`p-3 rounded-xl border ${
                        pool.isQualified
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-white border-[#b8e5ff]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{pool.titleTh}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            pool.isQualified
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {pool.isQualified ? 'ผ่านเกณฑ์รับสิทธิ์ ✓' : 'ยังไม่ผ่านเกณฑ์'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#45668f] flex items-center justify-between flex-wrap gap-1">
                        <span>
                          ตัวคุณอยู่ R{currentRank} ({pool.hasSelfRank ? '✓ ถึงเกณฑ์' : `ต้องถึง R${pool.requiredSelfRank}`}) · แนะนำตรง ({pool.allowedDirectRanksLabel}):{' '}
                          <strong>
                            {pool.qualifiedDirectCount}/{pool.requiredDirectCount} IDs
                          </strong>
                        </span>
                        <strong className="font-mono text-[#0754b9]">
                          ยอดกอง: {Number(pool.poolTotalUsdt || 0).toFixed(2)} U
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
