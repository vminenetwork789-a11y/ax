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
  Search,
  Calendar,
  Clock,
} from 'lucide-react';
import { Dashboard2MatrixPanel } from './Dashboard2MatrixPanel';

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

type BottomTabKey = 'home' | 'matrix' | 'history' | 'transactions' | 'help' | 'settings';
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

const isRealChainTxHash = (hash?: string): boolean => {
  if (!hash) return false;
  const h = String(hash).trim();
  return /^0x[0-9a-fA-F]{64}$/.test(h) && !/^0x(up|0{8,}|auto|extra|rew)/i.test(h);
};

const formatThaiDateTime = (ts?: string): string => {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
};

const toLocalDateTimeInput = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
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
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'direct' | 'level' | 'vault' | 'upgrade' | 'auto_id' | 'extra_id'
  >('all');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStartDateTime, setHistoryStartDateTime] = useState<string>('');
  const [historyEndDateTime, setHistoryEndDateTime] = useState<string>('');
  const [idSpecificUpgrades, setIdSpecificUpgrades] = useState<any[]>([]);
  const [vaultPoolTab, setVaultPoolTab] = useState<'all' | 'upgrade' | 'auto_id' | 'extra_id'>('all');
  const [vaultDirectionFilter, setVaultDirectionFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [matrixTargetRank, setMatrixTargetRank] = useState<number | undefined>(undefined);
  const [matrixTargetRootNodeId, setMatrixTargetRootNodeId] = useState<number | null>(null);
  const [membersData, setMembersData] = useState<any>(null);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);
  const [membersError, setMembersError] = useState<string>('');
  const [membersScope, setMembersScope] = useState<'all' | 'direct' | 'subtree'>('all');
  const [membersSelectedRank, setMembersSelectedRank] = useState<number | 'all'>('all');
  const [membersSearch, setMembersSearch] = useState<string>('');

  const openVaultModal = useCallback(
    (tab: 'all' | 'upgrade' | 'auto_id' | 'extra_id' = 'all') => {
      setVaultPoolTab(tab);
      setVaultDirectionFilter('ALL');
      setActiveModal('vault');
    },
    []
  );

  const openDashboard2Matrix = useCallback(
    (targetRank?: number, targetRootId?: number | null) => {
      setMatrixTargetRank(targetRank);
      setMatrixTargetRootNodeId(targetRootId ?? null);
      setActiveModal(null);
      setBottomTab('matrix');
    },
    []
  );

  const activeIdNum = Math.max(1, Number(selectedMainId || profile?.mainNodeIdRank1 || 1));

  const fetchDashboardData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [perIdRes, countsRes, txRes, upRes] = await Promise.all([
        fetch('/api/matrix/per-id-history', { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch('/api/matrix/rank-counts', { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch('/api/transactions?limit=500', { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch('/api/upgrades', { headers: { Accept: 'application/json' } }).catch(() => null),
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

  const fetchIdMembers = useCallback(async (targetId: number) => {
    setMembersLoading(true);
    setMembersError('');
    try {
      const res = await fetch(`/api/matrix/id-members/${targetId}`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'ไม่สามารถดึงข้อมูลสมาชิกของ ID นี้ได้');
      }
      setMembersData(json);
    } catch (err: any) {
      setMembersError(err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลสมาชิก');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeModal === 'members') {
      fetchIdMembers(displayId);
    }
  }, [activeModal, displayId, refreshTrigger, fetchIdMembers]);

  useEffect(() => {
    let cancelled = false;
    setIdSpecificUpgrades([]);
    fetch(`/api/upgrades?mainId=${displayId}`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const rows = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.upgrades)
          ? json.upgrades
          : [];
        setIdSpecificUpgrades(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [displayId, refreshTrigger, bottomTab]);

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
      const upgradesDeductedUsdt = Number(
        activeReport.vaultDeductedBreakdown?.upgradesTotalUsdt ?? 0
      );
      const autoIdsDeductedUsdt = Number(
        activeReport.vaultDeductedBreakdown?.autoIdsTotalUsdt ?? 0
      );
      const extraIdsDeductedUsdt = Number(
        activeReport.vaultDeductedBreakdown?.extraIdsTotalUsdt ??
          activeReport.extraIdDeductedTotalUsdt ??
          0
      );
      const newExtraIdPoolGross = Number(
        activeReport.newExtraIdPoolGross ?? newExtraIdPool + extraIdsDeductedUsdt
      );
      return {
        upgradeRankPool,
        newAutoIdPool,
        newExtraIdPool,
        upgradesDeductedUsdt,
        autoIdsDeductedUsdt,
        extraIdsDeductedUsdt,
        newExtraIdPoolGross,
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
      upgradesDeductedUsdt: 0,
      autoIdsDeductedUsdt: 0,
      extraIdsDeductedUsdt: 0,
      newExtraIdPoolGross: calc.newExtraIdPool,
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
  const autoIdsSpawnedList: any[] = activeReport?.autoIdsSpawned || [];
  const autoExtraIdsSpawnedList: any[] = activeReport?.autoExtraIdsSpawned || [];
  const totalAutoIds = Number(activeReport?.totalAutoIdCount ?? autoIdsSpawnedList.length ?? 0);
  const totalExtraIds = Number(
    activeReport?.totalExtraIdCount ?? autoExtraIdsSpawnedList.length ?? 0
  );
  const totalClones = Number(activeReport?.totalClonesCount ?? 0);

  const filteredVaultLedger = useMemo(() => {
    const raw: any[] = Array.isArray(activeReport?.vault35Ledger) ? activeReport.vault35Ledger : [];
    return raw.filter((item) => {
      if (vaultPoolTab === 'upgrade' && item.poolType !== 'UPGRADE_POOL') return false;
      if (vaultPoolTab === 'auto_id' && item.poolType !== 'AUTO_ID_POOL') return false;
      if (vaultPoolTab === 'extra_id' && item.poolType !== 'EXTRA_ID_POOL') return false;
      if (vaultDirectionFilter !== 'ALL' && item.direction !== vaultDirectionFilter) return false;
      return true;
    });
  }, [activeReport?.vault35Ledger, vaultPoolTab, vaultDirectionFilter]);

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

  type HistoryKind = 'direct' | 'level' | 'vault' | 'upgrade' | 'auto_id' | 'extra_id';
  type CombinedHistoryRow = {
    id: string;
    kind: HistoryKind;
    label: string;
    rank: number;
    fromRank?: number;
    toRank?: number;
    fromNodeId: number;
    parentId?: number;
    side?: string;
    amount: number;
    vaultDeducted?: number;
    isOutflow?: boolean;
    isClone?: boolean;
    isAdminFree?: boolean;
    note: string;
    timestamp: string;
    formattedDateTime: string;
    txHash?: string;
  };

  const combinedHistoryRows = useMemo<CombinedHistoryRow[]>(() => {
    if (!activeReport) return [];
    const rows: CombinedHistoryRow[] = [];

    const findMatchingTxHash = (
      kind: 'reg' | 'upgrade',
      nodeId: number,
      rank: number
    ): string | undefined => {
      const hit = recentTransactions.find((t: any) => {
        if (!isRealChainTxHash(t?.txHash)) return false;
        if (kind === 'reg') {
          return (
            t.id === `reg-r1-${nodeId}` ||
            (String(t.category || '').toUpperCase() === 'REGISTRATION' &&
              Number(t.mainNodeId) === nodeId &&
              Number(t.rank || 1) === rank)
          );
        }
        return (
          String(t.category || '').toUpperCase() === 'UPGRADE' &&
          Number(t.mainNodeId) === nodeId &&
          Number(t.rank) === rank
        );
      });
      return hit?.txHash;
    };

    (activeReport.direct30History || []).forEach((h: any, i: number) => {
      const ts = String(h.timestamp || '');
      rows.push({
        id: `d-${i}-${h.fromNodeId}-${h.rank}`,
        kind: 'direct',
        label: '30% แนะนำตรง',
        rank: Number(h.rank || 1),
        fromNodeId: Number(h.fromNodeId || 0),
        amount: Number(h.amountUsdt || 0),
        note: String(h.note || ''),
        timestamp: ts,
        formattedDateTime: formatThaiDateTime(ts),
        txHash: isRealChainTxHash(h.txHash) ? h.txHash : undefined,
      });
    });

    (activeReport.level30History || []).forEach((h: any, i: number) => {
      const ts = String(h.timestamp || '');
      rows.push({
        id: `l-${i}-${h.fromNodeId}-${h.rank}`,
        kind: 'level',
        label: h.tier ? `ค่าชั้น Lv.${h.tier}` : '30% ค่าชั้น',
        rank: Number(h.rank || 1),
        fromNodeId: Number(h.fromNodeId || 0),
        amount: Number(h.amountUsdt || 0),
        note: String(h.note || ''),
        timestamp: ts,
        formattedDateTime: formatThaiDateTime(ts),
        txHash: isRealChainTxHash(h.txHash) ? h.txHash : undefined,
      });
    });

    (activeReport.vault35History || []).forEach((h: any, i: number) => {
      const ts = String(h.timestamp || '');
      rows.push({
        id: `v-${i}-${h.fromNodeId}-${h.rank}`,
        kind: 'vault',
        label: '35% เข้า Vault',
        rank: Number(h.rank || 1),
        fromNodeId: Number(h.fromNodeId || 0),
        amount: Number(h.amountUsdt || 0),
        note: String(h.note || ''),
        timestamp: ts,
        formattedDateTime: formatThaiDateTime(ts),
        txHash: isRealChainTxHash(h.txHash) ? h.txHash : undefined,
      });
    });

    const mergedUpgradesMap = new Map<string, any>();
    [...recentUpgrades, ...idSpecificUpgrades].forEach((u: any) => {
      if (Number(u.mainNodeId) !== displayId) return;
      const key = `${u.toRank}-${u.newNodeId}-${u.isClone ? 'c' : 'm'}-${u.isExtraId ? 'e' : 'n'}`;
      mergedUpgradesMap.set(key, u);
    });
    const upgradeSource = Array.from(mergedUpgradesMap.values());

    upgradeSource.forEach((u: any, i: number) => {
      if (u.isExtraId) return;
      const fromRank = Number(u.fromRank || 1);
      const toRank = Number(u.toRank || 2);
      const nodeId = Number(u.newNodeId || u.mainNodeId || displayId);
      const rankPrice = Number(u.rankPriceUsdt || RANK_PRICES_USDT[toRank - 1] || 0);
      const vaultDeducted = Number(u.vaultDeductedUsdt || 0);
      const walletPaid = Number(u.walletPaidUsdt || 0);
      const isClone = Boolean(u.isClone);
      const isAdminFree = Boolean(u.isAdminFreeUpgrade);
      const ts = String(u.createdAt || u.timestamp || '');
      const realTx = isRealChainTxHash(u.txHash)
        ? u.txHash
        : findMatchingTxHash('upgrade', nodeId, toRank);
      const modeDesc = isClone
        ? 'โคลนนิ่งใน Rank'
        : isAdminFree
        ? 'Admin อัพฟรี (0 U)'
        : u.upgradeMode === 'AUTO_VAULT'
        ? 'Auto Upgrade จาก Vault'
        : `จ่าย Wallet ${walletPaid.toFixed(2)} U`;
      const parentSide = u.parentId
        ? ` · วางใต้ #${u.parentId} (${u.side === 'RIGHT' ? 'ขวา' : 'ซ้าย'})`
        : '';
      rows.push({
        id: `u-${u.id || i}-${toRank}-${nodeId}`,
        kind: 'upgrade',
        label: isClone ? 'อัพ Rank (โคลนนิ่ง)' : 'อัพเกรด Rank',
        rank: toRank,
        fromRank,
        toRank,
        fromNodeId: nodeId,
        parentId: u.parentId ? Number(u.parentId) : undefined,
        side: u.side,
        amount: isAdminFree ? 0 : rankPrice,
        vaultDeducted,
        isOutflow: !isAdminFree && !isClone,
        isClone,
        isAdminFree,
        note: `อัปเกรด R${fromRank} → R${toRank} · Node #${nodeId} (${modeDesc}${
          vaultDeducted > 0 ? ` · หัก Vault ${vaultDeducted.toFixed(2)} U` : ''
        })${parentSide}`,
        timestamp: ts,
        formattedDateTime: formatThaiDateTime(ts),
        txHash: realTx,
      });
    });

    (activeReport.autoIdsSpawned || []).forEach((a: any, i: number) => {
      const nodeId = Number(a.id || 0);
      const rank = Number(a.rank || 1);
      const ts = String(a.timestamp || '');
      const price = Number(RANK_PRICES_USDT[rank - 1] || 5);
      const sideTh = a.side === 'RIGHT' ? 'ขวา' : 'ซ้าย';
      rows.push({
        id: `auto-${i}-${nodeId}-${rank}`,
        kind: 'auto_id',
        label: 'สร้าง Auto ID',
        rank,
        fromNodeId: nodeId,
        parentId: Number(a.parentId || 0),
        side: String(a.side || ''),
        amount: price,
        isOutflow: true,
        note: `สร้าง ${a.label || `Auto ID #${nodeId}`} จาก Auto ID Pool · วางใต้ #${
          a.parentId || '-'
        } (ฝั่ง${sideTh})`,
        timestamp: ts,
        formattedDateTime: formatThaiDateTime(ts),
        txHash: findMatchingTxHash('reg', nodeId, rank),
      });
    });

    (activeReport.autoExtraIdsSpawned || []).forEach((ex: any, i: number) => {
      const nodeId = Number(ex.id || 0);
      const rank = Number(ex.rank || 2);
      const ts = String(ex.timestamp || '');
      const price = Number(RANK_PRICES_USDT[rank - 1] || 10);
      const sideTh = ex.side === 'RIGHT' ? 'ขวา' : 'ซ้าย';
      rows.push({
        id: `extra-${i}-${nodeId}-${rank}`,
        kind: 'extra_id',
        label: 'สร้าง Extra ID',
        rank,
        fromNodeId: nodeId,
        parentId: Number(ex.parentId || 0),
        side: String(ex.side || ''),
        amount: price,
        isOutflow: true,
        note: `สร้าง ${ex.label || `Extra R${rank}-#${nodeId}`} จาก Extra ID Pool · วางใต้ #${
          ex.parentId || '-'
        } (ฝั่ง${sideTh})`,
        timestamp: ts,
        formattedDateTime: formatThaiDateTime(ts),
        txHash: findMatchingTxHash('reg', nodeId, rank),
      });
    });

    return rows.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [activeReport, idSpecificUpgrades, recentUpgrades, recentTransactions, displayId]);

  const historyCounts = useMemo(() => {
    const counts = {
      all: combinedHistoryRows.length,
      direct: 0,
      level: 0,
      vault: 0,
      upgrade: 0,
      auto_id: 0,
      extra_id: 0,
    };
    const totals = {
      direct: 0,
      level: 0,
      vault: 0,
    };
    for (const r of combinedHistoryRows) {
      counts[r.kind] += 1;
      if (r.kind === 'direct') totals.direct += r.amount;
      if (r.kind === 'level') totals.level += r.amount;
      if (r.kind === 'vault') totals.vault += r.amount;
    }
    return { counts, totals };
  }, [combinedHistoryRows]);

  const filteredHistoryRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const startMs = historyStartDateTime ? new Date(historyStartDateTime).getTime() : null;
    const rawEndMs = historyEndDateTime ? new Date(historyEndDateTime).getTime() : null;
    const endMs =
      rawEndMs !== null && Number.isFinite(rawEndMs)
        ? historyEndDateTime.length === 16
          ? rawEndMs + 59999
          : rawEndMs
        : null;

    return combinedHistoryRows.filter((r) => {
      if (historyFilter !== 'all' && r.kind !== historyFilter) return false;

      if (startMs !== null && Number.isFinite(startMs)) {
        const ts = new Date(r.timestamp || 0).getTime();
        if (!Number.isFinite(ts) || ts < startMs) return false;
      }

      if (endMs !== null && Number.isFinite(endMs)) {
        const ts = new Date(r.timestamp || 0).getTime();
        if (!Number.isFinite(ts) || ts > endMs) return false;
      }

      if (q) {
        const haystack = [
          r.label,
          r.note,
          `r${r.rank}`,
          `rank ${r.rank}`,
          `#${r.fromNodeId}`,
          r.parentId ? `#${r.parentId}` : '',
          r.txHash || '',
          r.formattedDateTime,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    combinedHistoryRows,
    historyFilter,
    historySearch,
    historyStartDateTime,
    historyEndDateTime,
  ]);

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
        {bottomTab !== 'matrix' && (
          <>
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
                onClick={() => openDashboard2Matrix(currentRank)}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-cyan-300/40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title={language === 'th' ? 'เปิดหน้าผัง Matrix 15 ชั้น' : 'Open Matrix 15 Layers'}
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
          </>
        )}

        {/* TAB: MATRIX (15-LAYER BINARY MATRIX + SEARCH) */}
        {bottomTab === 'matrix' && (
          <Dashboard2MatrixPanel
            displayId={displayId}
            currentRank={currentRank}
            initialRank={matrixTargetRank ?? currentRank}
            initialRootNodeId={matrixTargetRootNodeId}
            rankCounts={rankCounts}
            contractAddress={contractAddress}
            refreshTrigger={refreshTrigger}
            onBackToHome={() => setBottomTab('home')}
            onSelectMainId={(idStr) => {
              onSelectMainId(idStr);
              setBottomTab('home');
            }}
            onOpenFullMatrixCanvas={(targetRank) => onOpenMatrixTree(targetRank)}
          />
        )}

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
                  onClick={() => openVaultModal('all')}
                  className="text-xs font-bold text-[#0756bc] hover:underline cursor-pointer"
                >
                  สมุดบัญชี Vault ›
                </button>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <article
                  onClick={() => openVaultModal('upgrade')}
                  className="p-3 sm:p-4 rounded-[20px] text-center bg-gradient-to-br from-[#f4fcff] to-[#cce8ff] border border-[#a8d9ff] shadow-[0_4px_13px_rgba(11,115,197,0.16)] cursor-pointer hover:scale-[1.01] transition flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[26px] sm:text-[29px]">🚀</div>
                    <h3 className="text-[12px] sm:text-[13px] font-bold leading-snug my-1 text-[#09265f]">
                      ถังอัปเกรดแรงก์
                      <br />
                      (Upgrade Rank Pool)
                    </h3>
                    <strong className="text-[20px] sm:text-[22px] font-black block text-[#09265f]">
                      {vaultPools.upgradeRankPool.toFixed(2)}
                    </strong>
                    <small className="text-[10px] font-bold text-[#0c559f] block">
                      {currentRank >= 18
                        ? 'USDT (Max R18)'
                        : `USDT / เป้า R${nextRank}: ${nextRankPrice} U`}
                    </small>
                    <div className="mt-2">
                      <SvgProgressBar percent={upgradePoolPct} variant="sky" heightClass="h-2" />
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#b5dcfa] flex items-center justify-between text-[10.5px] font-bold text-[#0754b9]">
                    <span>ใช้ไป {vaultPools.upgradesDeductedUsdt.toFixed(2)} U</span>
                    <span className="underline">ดูสมุดบัญชี ›</span>
                  </div>
                </article>

                <article
                  onClick={() => openVaultModal('auto_id')}
                  className="p-3 sm:p-4 rounded-[20px] text-center bg-gradient-to-br from-[#eafff4] to-[#bdf5dc] border border-[#9ce9c5] shadow-[0_4px_13px_rgba(11,115,197,0.16)] cursor-pointer hover:scale-[1.01] transition flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[26px] sm:text-[29px]">👤</div>
                    <h3 className="text-[12px] sm:text-[13px] font-bold leading-snug my-1 text-[#09265f]">
                      ถังสร้าง Main ID
                      <br />
                      (New Auto ID Pool)
                    </h3>
                    <strong className="text-[20px] sm:text-[22px] font-black block text-[#09265f]">
                      {vaultPools.newAutoIdPool.toFixed(2)}
                    </strong>
                    <small className="text-[10px] font-bold text-[#0f6b47] block">
                      USDT คงเหลือ (ครบ 5 U แตก 1 รหัส)
                    </small>
                    <div className="mt-2">
                      <SvgProgressBar
                        percent={autoPoolPct}
                        variant="emerald"
                        heightClass="h-2"
                        trackClass="bg-[#a7e6c9]"
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#97dfc0] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-black text-[#0a5c3c]">
                      <span>จำนวนรหัส: {totalAutoIds} รหัส</span>
                      <span>ใช้ {vaultPools.autoIdsDeductedUsdt.toFixed(2)} U</span>
                    </div>
                    <div className="text-[10.5px] font-bold text-[#0f6b47] underline">
                      คลิกดูรายชื่อ {totalAutoIds} รหัส Auto ID ›
                    </div>
                  </div>
                </article>

                <article
                  onClick={() => openVaultModal('extra_id')}
                  className="p-3 sm:p-4 rounded-[20px] text-center bg-gradient-to-br from-[#fbf5ff] to-[#e0ccff] border border-[#d4b8ff] shadow-[0_4px_13px_rgba(11,115,197,0.16)] cursor-pointer hover:scale-[1.01] transition flex flex-col justify-between"
                >
                  <div>
                    <div className="text-[26px] sm:text-[29px]">✦</div>
                    <h3 className="text-[12px] sm:text-[13px] font-bold leading-snug my-1 text-[#09265f]">
                      ถังสร้าง Extra ID
                      <br />
                      (New Extra ID Pool)
                    </h3>
                    <strong className="text-[20px] sm:text-[22px] font-black block text-[#09265f]">
                      {vaultPools.newExtraIdPool.toFixed(2)}
                    </strong>
                    <small className="text-[10px] font-bold text-[#5b21b6] block">
                      USDT คงเหลือ (สะสมรวม {vaultPools.newExtraIdPoolGross.toFixed(2)} U)
                    </small>
                    <div className="mt-2">
                      <SvgProgressBar
                        percent={extraPoolPct}
                        variant="purple"
                        heightClass="h-2"
                        trackClass="bg-[#ccb3f7]"
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#cbaef9] space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-black text-[#4c1d95]">
                      <span>จำนวนรหัส: {totalExtraIds} รหัส</span>
                      <span>ใช้ {vaultPools.extraIdsDeductedUsdt.toFixed(2)} U</span>
                    </div>
                    <div className="text-[10.5px] font-bold text-[#5b21b6] underline">
                      คลิกดูรายชื่อ {totalExtraIds} รหัส Extra ID ›
                    </div>
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
                      onClick={() => openDashboard2Matrix(n)}
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
                  <span>สมาชิก/ลูกตรง</span>
                </button>

                <button
                  type="button"
                  onClick={() => openDashboard2Matrix(currentRank)}
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

        {/* TAB: HISTORY (INCOME, UPGRADES, AUTO ID & EXTRA ID FOR SELECTED ID) */}
        {bottomTab === 'history' && (
          <section className="mx-1 p-4 rounded-[24px] bg-gradient-to-br from-white/95 to-[#dff4ff]/95 border-[1.5px] border-[#a9ddff] shadow-[0_8px_22px_rgba(0,72,190,0.23)] space-y-3">
            {/* Header + ID Switcher + Refresh */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#09265f]">
                  ▥ ประวัติรายได้ & กิจกรรมของ ID #{displayId}
                </h2>
                <p className="text-[11px] font-semibold text-[#3f6493]">
                  รวมรายได้ 30% แนะนำ · 30% ค่าชั้น · 35% Vault · อัพ Rank · สร้าง Auto ID และ Extra ID
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveModal('switch_id')}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-[#96d2ff] text-xs font-bold text-[#0756bc] hover:bg-[#eef8ff] cursor-pointer"
                >
                  ⇄ สลับ ID (#{displayId})
                </button>
                <button
                  type="button"
                  onClick={fetchDashboardData}
                  className="px-2.5 py-1.5 rounded-xl bg-[#087cf4] text-white text-xs font-bold hover:bg-[#0569d4] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  รีเฟรช
                </button>
              </div>
            </div>

            {/* Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-700">30% แนะนำตรง</div>
                <div className="text-sm font-black text-emerald-800 font-mono">
                  +{historyCounts.totals.direct.toFixed(2)} U
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">
                  {historyCounts.counts.direct} รายการ
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-50/90 border border-cyan-200">
                <div className="text-[10px] font-bold text-cyan-700">30% ค่าชั้น</div>
                <div className="text-sm font-black text-cyan-800 font-mono">
                  +{historyCounts.totals.level.toFixed(2)} U
                </div>
                <div className="text-[10px] text-cyan-600 font-semibold">
                  {historyCounts.counts.level} รายการ
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50/90 border border-indigo-200">
                <div className="text-[10px] font-bold text-indigo-700">35% เข้า Vault</div>
                <div className="text-sm font-black text-indigo-800 font-mono">
                  +{historyCounts.totals.vault.toFixed(2)} U
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold">
                  {historyCounts.counts.vault} รายการ
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-violet-50/90 border border-violet-200">
                <div className="text-[10px] font-bold text-violet-700">อัพ Rank / สร้าง ID</div>
                <div className="text-xs font-black text-violet-900 leading-snug mt-0.5">
                  อัพ {historyCounts.counts.upgrade} · Auto {historyCounts.counts.auto_id} · Extra{' '}
                  {historyCounts.counts.extra_id}
                </div>
                <div className="text-[10px] text-violet-600 font-semibold">
                  ทั้งหมด {historyCounts.counts.all} รายการ
                </div>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { key: 'all', label: 'ทั้งหมด' },
                  { key: 'direct', label: '30% แนะนำ' },
                  { key: 'level', label: '30% ค่าชั้น' },
                  { key: 'vault', label: '35% Vault' },
                  { key: 'upgrade', label: 'อัพ Rank' },
                  { key: 'auto_id', label: 'Auto ID' },
                  { key: 'extra_id', label: 'Extra ID' },
                ] as const
              ).map((item) => {
                const active = historyFilter === item.key;
                const count = historyCounts.counts[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setHistoryFilter(item.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                      active
                        ? 'bg-[#087cf4] text-white shadow-sm'
                        : 'bg-white text-[#0756bc] border border-[#a9ddff] hover:bg-[#eef8ff]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        active ? 'bg-white/25 text-white' : 'bg-[#e3f4ff] text-[#0756bc]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search & Date/Time Filter Box */}
            <div className="p-3 rounded-2xl bg-white/85 border border-[#b8e5ff] space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#54759c] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="ค้นหา Rank, #ID, Auto ID, Extra ID, โคลนนิ่ง, หมายเหตุ หรือ txHash..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#f5fbff] border border-[#bce4ff] text-xs font-semibold text-[#09265f] placeholder:text-[#6f8fb5] focus:outline-none focus:border-[#087cf4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold text-[#3f6493] inline-flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3" /> ตั้งแต่ (วัน-เวลา)
                  </span>
                  <input
                    type="datetime-local"
                    value={historyStartDateTime}
                    onChange={(e) => setHistoryStartDateTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#f5fbff] border border-[#bce4ff] text-xs font-semibold text-[#09265f] focus:outline-none focus:border-[#087cf4]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-[#3f6493] inline-flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3" /> ถึง (วัน-เวลา)
                  </span>
                  <input
                    type="datetime-local"
                    value={historyEndDateTime}
                    onChange={(e) => setHistoryEndDateTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[#f5fbff] border border-[#bce4ff] text-xs font-semibold text-[#09265f] focus:outline-none focus:border-[#087cf4]"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const startOfToday = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                        0,
                        0
                      );
                      setHistoryStartDateTime(toLocalDateTimeInput(startOfToday));
                      setHistoryEndDateTime(toLocalDateTimeInput(now));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#e6f5ff] border border-[#b4e2ff] text-[11px] font-bold text-[#0756bc] hover:bg-[#d7eeff] cursor-pointer"
                  >
                    วันนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      setHistoryStartDateTime(toLocalDateTimeInput(sevenDaysAgo));
                      setHistoryEndDateTime(toLocalDateTimeInput(now));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#e6f5ff] border border-[#b4e2ff] text-[11px] font-bold text-[#0756bc] hover:bg-[#d7eeff] cursor-pointer"
                  >
                    7 วันล่าสุด
                  </button>
                  {(historySearch ||
                    historyStartDateTime ||
                    historyEndDateTime ||
                    historyFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistorySearch('');
                        setHistoryStartDateTime('');
                        setHistoryEndDateTime('');
                        setHistoryFilter('all');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-600 hover:bg-rose-100 cursor-pointer"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
                <span className="text-[11px] font-bold text-[#3f6493]">
                  แสดง {filteredHistoryRows.length} จาก {combinedHistoryRows.length} รายการ
                </span>
              </div>
            </div>

            {filteredHistoryRows.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-white/70 border border-[#b8e5ff] text-xs font-semibold text-[#54759c]">
                ไม่พบรายการตามเงื่อนไขที่เลือกสำหรับ ID #{displayId}
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredHistoryRows.map((row) => {
                  const badgeStyle =
                    row.kind === 'direct'
                      ? 'bg-emerald-100 text-emerald-700'
                      : row.kind === 'level'
                      ? 'bg-cyan-100 text-cyan-700'
                      : row.kind === 'vault'
                      ? 'bg-indigo-100 text-indigo-700'
                      : row.kind === 'upgrade'
                      ? 'bg-amber-100 text-amber-800'
                      : row.kind === 'auto_id'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-fuchsia-100 text-fuchsia-700';

                  return (
                    <div
                      key={row.id}
                      className="p-3 rounded-xl bg-white/95 border border-[#b8e5ff] flex items-start justify-between gap-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${badgeStyle}`}>
                            {row.label}
                          </span>
                          {row.kind === 'upgrade' ? (
                            <span className="font-mono font-bold text-[#0754b9]">
                              R{row.fromRank} → R{row.toRank} · Node #{row.fromNodeId}
                            </span>
                          ) : row.kind === 'auto_id' ? (
                            <span className="font-mono font-bold text-violet-700">
                              Auto ID #{row.fromNodeId} · Rank {row.rank}
                            </span>
                          ) : row.kind === 'extra_id' ? (
                            <span className="font-mono font-bold text-fuchsia-700">
                              Extra R{row.rank}-#{row.fromNodeId}
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-[#0754b9]">
                              Rank {row.rank} · จาก #{row.fromNodeId}
                            </span>
                          )}
                          {row.isClone && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-bold">
                              โคลนนิ่ง
                            </span>
                          )}
                          {row.isAdminFree && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                              Admin อัพฟรี
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#35567e] leading-snug break-words">
                          {row.note}
                        </p>
                        <div className="text-[10px] font-mono text-[#6283aa] flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{row.formattedDateTime}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono space-y-0.5">
                        {row.kind === 'direct' || row.kind === 'level' || row.kind === 'vault' ? (
                          <strong className="text-sm font-black text-emerald-600 block">
                            +{row.amount.toFixed(2)} U
                          </strong>
                        ) : row.kind === 'upgrade' ? (
                          <>
                            <strong
                              className={`text-sm font-black block ${
                                row.isAdminFree
                                  ? 'text-slate-600'
                                  : row.isClone
                                  ? 'text-sky-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {row.isAdminFree
                                ? '0.00 U'
                                : row.isClone
                                ? `${row.amount.toFixed(2)} U`
                                : `-${row.amount.toFixed(2)} U`}
                            </strong>
                            {typeof row.vaultDeducted === 'number' && row.vaultDeducted > 0 && (
                              <span className="text-[10px] text-[#54759c] block">
                                หัก Vault {row.vaultDeducted.toFixed(2)} U
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <strong
                              className={`text-sm font-black block ${
                                row.kind === 'auto_id' ? 'text-violet-700' : 'text-fuchsia-700'
                              }`}
                            >
                              -{row.amount.toFixed(2)} U
                            </strong>
                            <span className="text-[10px] text-[#54759c] block">
                              {row.kind === 'auto_id' ? 'Pool Auto ID' : 'Pool Extra ID'}
                            </span>
                          </>
                        )}
                        {row.txHash && (
                          <a
                            href={`https://testnet.bscscan.com/tx/${row.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#087cf4] hover:underline inline-flex items-center gap-0.5 justify-end"
                          >
                            BscScan <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
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
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[min(1080px,100%)] grid grid-cols-6 px-1.5 py-2 bg-white/95 backdrop-blur-md border border-[#c5e6ff] rounded-t-[24px] shadow-[0_-6px_22px_rgba(7,85,181,0.18)] z-40">
        {(
          [
            { key: 'home', icon: '⌂', label: 'หน้าหลัก' },
            { key: 'matrix', icon: '⌘', label: 'Matrix' },
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
              onClick={() => {
                if (tab.key === 'matrix') {
                  openDashboard2Matrix(matrixTargetRank ?? currentRank, matrixTargetRootNodeId);
                } else {
                  setBottomTab(tab.key);
                }
              }}
              className={`text-center text-[10px] sm:text-[11px] font-bold py-1.5 rounded-[16px] transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-white bg-gradient-to-br from-[#21bfff] to-[#0754d2] shadow-[0_4px_12px_rgba(5,119,223,0.47)]'
                  : 'text-[#42689c] hover:text-[#087cf4]'
              }`}
            >
              <b className="block text-[18px] sm:text-[20px] leading-tight">{tab.icon}</b>
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
            className={`w-full ${
              activeModal === 'members'
                ? 'max-w-3xl'
                : activeModal === 'vault'
                ? 'max-w-2xl'
                : 'max-w-xl'
            } max-h-[88vh] overflow-y-auto rounded-[24px] bg-gradient-to-br from-white to-[#e3f4ff] border-2 border-[#a9ddff] shadow-2xl p-4 sm:p-5 text-[#09265f] space-y-3`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#b8e5ff] pb-2.5">
              <h3 className="text-base sm:text-lg font-black">
                {activeModal === 'switch_id' && '⇄ สลับบัญชี / เลือกรหัสที่ต้องการดู'}
                {activeModal === 'members' && `👥 สมาชิก & ลูกตรงทั้งหมดของ ID #${displayId} (แยกตาม Rank)`}
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
                            openDashboard2Matrix(Number(ex.rank || 2), Number(ex.id || 0));
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

            {/* MODAL: MEMBERS & DIRECT SPONSOR BY RANK */}
            {activeModal === 'members' && (() => {
              const rankList: any[] = Array.isArray(membersData?.ranks) ? membersData.ranks : [];
              const summary = membersData?.summary || {
                totalAllMembersAcrossRanks: 0,
                totalUniqueMemberMainIds: 0,
                totalDirectMainIds: directMainIdsList.length,
                totalDirectNodesAcrossRanks: 0,
                totalSubtreeNodesAcrossRanks: 0,
                totalAutoIds,
                totalExtraIds,
                totalClones,
                unlockedRanksCount: currentRank,
                ranksWithMembersCount: 0,
              };
              const searchTrim = membersSearch.trim().toLowerCase().replace(/^#/, '');

              const filteredRanks = rankList
                .map((rGroup) => {
                  const baseMembers: any[] = Array.isArray(rGroup.members) ? rGroup.members : [];
                  const scopedMembers = baseMembers.filter((m) => {
                    if (membersScope === 'direct' && !m.isDirect) return false;
                    if (membersScope === 'subtree' && !m.isInSubtree) return false;
                    if (searchTrim) {
                      const hay = `${m.nodeId} ${m.originMainId} ${m.label} ${m.owner} r${m.rank}`.toLowerCase();
                      if (!hay.includes(searchTrim)) return false;
                    }
                    return true;
                  });
                  return {
                    ...rGroup,
                    filteredMembers: scopedMembers,
                  };
                })
                .filter((rGroup) => {
                  if (membersSelectedRank !== 'all') {
                    return rGroup.rank === membersSelectedRank;
                  }
                  return rGroup.filteredMembers.length > 0 || rGroup.selfNodeId !== null;
                });

              return (
                <div className="space-y-3 text-xs">
                  {/* Top Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                      <div className="text-[10px] text-[#55769b]">สมาชิกของ ID #{displayId}</div>
                      <strong className="text-lg font-black text-[#0754b9] block">
                        {summary.totalAllMembersAcrossRanks}
                      </strong>
                      <span className="text-[10px] text-[#55769b]">
                        ({summary.totalUniqueMemberMainIds} Main IDs)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                      <div className="text-[10px] text-[#55769b]">ลูกตรง (Direct)</div>
                      <strong className="text-lg font-black text-emerald-700 block">
                        {summary.totalDirectMainIds} IDs
                      </strong>
                      <span className="text-[10px] text-emerald-700">
                        ({summary.totalDirectNodesAcrossRanks} โหนดในทุก Rank)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                      <div className="text-[10px] text-[#55769b]">สายงานใต้ผัง (Downline)</div>
                      <strong className="text-lg font-black text-[#087cf4] block">
                        {summary.totalSubtreeNodesAcrossRanks}
                      </strong>
                      <span className="text-[10px] text-[#55769b]">
                        Auto {summary.totalAutoIds} · Extra {summary.totalExtraIds} · โคลน {summary.totalClones}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                      <div className="text-[10px] text-[#55769b]">Rank ที่พบสมาชิก</div>
                      <strong className="text-lg font-black text-purple-700 block">
                        {summary.ranksWithMembersCount} / 18
                      </strong>
                      <span className="text-[10px] text-purple-700">
                        ปลดล็อกแล้ว {summary.unlockedRanksCount} Rank
                      </span>
                    </div>
                  </div>

                  {/* Scope Tabs + Search + Refresh */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 p-2 rounded-2xl border border-[#b8e5ff]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          { key: 'all', label: 'ทั้งหมด (สายงาน+ลูกตรง)' },
                          { key: 'direct', label: 'เฉพาะลูกตรง (Direct)' },
                          { key: 'subtree', label: 'เฉพาะใต้ผัง (Subtree)' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setMembersScope(tab.key)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                            membersScope === tab.key
                              ? 'bg-gradient-to-br from-[#23caff] to-[#0755d7] text-white shadow-xs'
                              : 'bg-[#f3faff] text-[#0756bc] border border-[#b8e5ff] hover:bg-blue-50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[180px]">
                      <input
                        type="text"
                        value={membersSearch}
                        onChange={(e) => setMembersSearch(e.target.value)}
                        placeholder="ค้นหา #ID หรือ 0x..."
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border border-[#a9d7ff] bg-white text-[11px] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => fetchIdMembers(displayId)}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-[#a9d7ff] text-[#0756bc] font-bold cursor-pointer hover:bg-blue-50 inline-flex items-center gap-1"
                        title="รีเฟรชข้อมูลสมาชิก"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${membersLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Rank Selector Pills (Rank 1 - 18) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setMembersSelectedRank('all')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                        membersSelectedRank === 'all'
                          ? 'bg-[#0754b9] text-white'
                          : 'bg-white border border-[#b8e5ff] text-[#0756bc] hover:bg-blue-50'
                      }`}
                    >
                      ทุก Rank ({summary.totalAllMembersAcrossRanks})
                    </button>
                    {rankList.map((rGroup) => {
                      const cnt =
                        membersScope === 'direct'
                          ? rGroup.directCountInRank
                          : membersScope === 'subtree'
                          ? rGroup.subtreeCountInRank
                          : rGroup.totalMembersInRank;
                      const isSel = membersSelectedRank === rGroup.rank;
                      return (
                        <button
                          key={`rk-pill-${rGroup.rank}`}
                          type="button"
                          onClick={() => setMembersSelectedRank(rGroup.rank)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                            isSel
                              ? 'bg-[#087cf4] text-white'
                              : cnt > 0
                              ? 'bg-white border border-[#6ec8ff] text-[#0754b9] hover:bg-blue-50'
                              : 'bg-white/60 border border-[#d6ecff] text-[#8ba5c4] hover:bg-white'
                          }`}
                        >
                          R{rGroup.rank} ({cnt})
                        </button>
                      );
                    })}
                  </div>

                  {/* Content Body */}
                  {membersLoading && !membersData ? (
                    <div className="p-8 text-center rounded-2xl bg-white/80 border border-[#b8e5ff] text-[#0756bc] font-bold">
                      กำลังดึงข้อมูลสมาชิกทั้งหมดของ ID #{displayId} แยกตาม Rank 1–18...
                    </div>
                  ) : membersError ? (
                    <div className="p-4 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                      {membersError}
                    </div>
                  ) : filteredRanks.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl bg-white/80 border border-[#b8e5ff] text-[#55769b]">
                      ไม่พบข้อมูลสมาชิกในตัวกรองที่เลือกสำหรับ ID #{displayId}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                      {filteredRanks.map((rGroup) => {
                        const list: any[] = rGroup.filteredMembers || [];
                        return (
                          <div
                            key={`rank-sec-${rGroup.rank}`}
                            className="rounded-2xl bg-white/90 border border-[#a9d7ff] overflow-hidden shadow-2xs"
                          >
                            {/* Rank Section Header */}
                            <div className="px-3 py-2 bg-gradient-to-r from-[#e8f5ff] to-[#d5eeff] border-b border-[#b8e5ff] flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-lg bg-[#0754b9] text-white font-black text-xs">
                                  RANK {rGroup.rank}
                                </span>
                                <span className="text-[11px] font-bold text-[#0754b9]">
                                  ({Number(rGroup.rankPriceUsdt || 5).toLocaleString()} U)
                                </span>
                                {rGroup.selfNodeId ? (
                                  <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    โหนดของคุณ: R{rGroup.rank}-#{rGroup.selfNodeId}
                                  </span>
                                ) : (
                                  <span className="text-[10.5px] text-[#6d89ab] bg-white/70 border border-[#d0e6f8] px-2 py-0.5 rounded-md">
                                    ยังไม่ปลดล็อก Rank นี้
                                  </span>
                                )}
                                {Array.isArray(rGroup.selfCloneIds) && rGroup.selfCloneIds.length > 0 && (
                                  <span className="text-[10.5px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                    โคลนของคุณ: {rGroup.selfCloneIds.map((c: number) => `#${c}`).join(', ')}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-[#09265f]">
                                  ตรง {rGroup.directCountInRank} · ใต้ผัง {rGroup.subtreeCountInRank} · แสดง {list.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    openDashboard2Matrix(rGroup.rank);
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-white border border-[#96ceff] text-[10.5px] font-bold text-[#0756bc] hover:bg-blue-50 cursor-pointer inline-flex items-center gap-0.5"
                                >
                                  <span>เปิดผัง R{rGroup.rank}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Members Grid for this Rank */}
                            {list.length === 0 ? (
                              <div className="p-3 text-center text-[11px] text-[#6d89ab]">
                                {rGroup.totalMembersInRank === 0
                                  ? `ยังไม่มีสมาชิกหรือลูกตรงใน Rank ${rGroup.rank}`
                                  : `ไม่มีสมาชิกใน Rank ${rGroup.rank} ที่ตรงกับตัวกรอง`}
                              </div>
                            ) : (
                              <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {list.map((m: any) => {
                                  const typeBadgeClass =
                                    m.memberType === 'AUTO_ID'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : m.memberType === 'EXTRA_ID'
                                      ? 'bg-rose-100 text-rose-700 border-rose-300'
                                      : m.memberType === 'CLONE_ID'
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                      : 'bg-blue-100 text-[#0754b9] border-blue-200';
                                  const canInspectMain = m.originMainId > 0 && m.memberType !== 'EXTRA_ID';
                                  return (
                                    <div
                                      key={`m-r${rGroup.rank}-n${m.nodeId}`}
                                      onClick={() => {
                                        if (canInspectMain) {
                                          onSelectMainId(String(m.originMainId));
                                        }
                                      }}
                                      className={`p-2.5 rounded-xl bg-white border border-[#c7e7ff] flex flex-col justify-between gap-1.5 transition ${
                                        canInspectMain
                                          ? 'hover:border-[#087cf4] hover:shadow-xs cursor-pointer'
                                          : ''
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-1.5">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <strong className="text-[13px] font-black text-[#09265f]">
                                              {m.label}
                                            </strong>
                                            <span
                                              className={`px-1.5 py-0.5 rounded-md border text-[9.5px] font-extrabold ${typeBadgeClass}`}
                                            >
                                              {m.memberType === 'AUTO_ID'
                                                ? 'AUTO'
                                                : m.memberType === 'EXTRA_ID'
                                                ? 'EXTRA'
                                                : m.memberType === 'CLONE_ID'
                                                ? 'CLONE'
                                                : 'MAIN'}
                                            </span>
                                          </div>
                                          <div className="text-[10.5px] font-mono text-[#45668f] mt-0.5">
                                            โหนด R{m.rank}-#{m.nodeId} · ใต้ #{m.parentId} (
                                            {m.side === 'LEFT' ? 'ซ้าย ↙' : m.side === 'RIGHT' ? 'ขวา ↘' : 'Root'})
                                          </div>
                                        </div>

                                        <span className="px-1.5 py-0.5 rounded-md bg-[#eef7ff] border border-[#bfe2ff] text-[10px] font-black text-[#0754b9] shrink-0">
                                          Max R{m.currentMaxRank}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-[#ebf5ff] text-[10px]">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {m.isDirect && (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                              ลูกตรง ✓
                                            </span>
                                          )}
                                          {m.tier !== null && (
                                            <span className="px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-800 font-bold">
                                              {m.viaCloneNodeId
                                                ? `ใต้โคลน #${m.viaCloneNodeId} · ชั้น ${m.tier}`
                                                : `ชั้นที่ ${m.tier}`}
                                            </span>
                                          )}
                                          <span className="text-[#55769b] font-mono">
                                            ผู้แนะนำ #{m.directSponsorNodeId}
                                          </span>
                                        </div>
                                        <span className="font-mono text-[#6a85a8]">
                                          {String(m.owner || '').slice(0, 6)}...{String(m.owner || '').slice(-4)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

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

            {/* MODAL: VAULT LEDGER & POOL DETAILS */}
            {activeModal === 'vault' && (
              <div className="space-y-3 text-xs">
                {/* 3 Overall Vault Summary Boxes */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">สะสม Vault รวม</div>
                    <strong className="text-base font-black text-[#0754b9] font-mono">
                      {vaultPools.grossTotal.toFixed(2)} U
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">ถูกใช้ไปแล้ว</div>
                    <strong className="text-base font-black text-rose-600 font-mono">
                      -{vaultPools.deductedTotal.toFixed(2)} U
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#b8e5ff]">
                    <div className="text-[10px] text-[#55769b]">คงเหลือ 3 ถัง</div>
                    <strong className="text-base font-black text-emerald-700 font-mono">
                      {vaultPools.totalRemaining.toFixed(2)} U
                    </strong>
                  </div>
                </div>

                {/* Interactive Pool Selector Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      {
                        key: 'all',
                        title: 'ทั้งหมด (3 ถัง)',
                        sub: `คงเหลือ ${vaultPools.totalRemaining.toFixed(2)} U`,
                        activeCls: 'bg-[#087cf4] text-white border-[#087cf4]',
                      },
                      {
                        key: 'upgrade',
                        title: '🚀 อัปเกรด Rank',
                        sub: `${vaultPools.upgradeRankPool.toFixed(2)} U`,
                        activeCls: 'bg-[#0284c7] text-white border-[#0284c7]',
                      },
                      {
                        key: 'auto_id',
                        title: `👤 Auto ID (${totalAutoIds})`,
                        sub: `${vaultPools.newAutoIdPool.toFixed(2)} U · ใช้ ${vaultPools.autoIdsDeductedUsdt.toFixed(0)} U`,
                        activeCls: 'bg-emerald-600 text-white border-emerald-600',
                      },
                      {
                        key: 'extra_id',
                        title: `✦ Extra ID (${totalExtraIds})`,
                        sub: `${vaultPools.newExtraIdPool.toFixed(2)} U · ใช้ ${vaultPools.extraIdsDeductedUsdt.toFixed(0)} U`,
                        activeCls: 'bg-violet-600 text-white border-violet-600',
                      },
                    ] as const
                  ).map((t) => {
                    const isActive = vaultPoolTab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setVaultPoolTab(t.key)}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          isActive
                            ? `${t.activeCls} shadow-sm`
                            : 'bg-white border-[#b8e5ff] text-[#09265f] hover:bg-[#eff8ff]'
                        }`}
                      >
                        <div className="font-black text-[11px] leading-tight">{t.title}</div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            isActive ? 'text-white/90' : 'text-[#4c6f97]'
                          }`}
                        >
                          {t.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Focused Pool Summary & Spawned IDs List */}
                {vaultPoolTab === 'upgrade' && (
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-[#f4fcff] to-[#d9eeff] border border-[#9fd4ff] space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-black text-[#09265f] text-sm">
                          🚀 ถังอัปเกรดแรงก์ (Upgrade Rank Pool)
                        </div>
                        <div className="text-[11px] text-[#3f6493]">
                          {currentRank >= 18
                            ? 'ถึง Rank สูงสุด (R18) แล้ว'
                            : `เป้าหมายอัปเกรดถัดไป: Rank ${nextRank} (ใช้ ${nextRankPrice} USDT)`}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-base font-black text-[#0754b9]">
                          {vaultPools.upgradeRankPool.toFixed(2)} U
                        </div>
                        <div className="text-[10px] font-bold text-rose-600">
                          ใช้อัปเกรดสะสม: -{vaultPools.upgradesDeductedUsdt.toFixed(2)} U
                        </div>
                      </div>
                    </div>
                    <SvgProgressBar percent={upgradePoolPct} variant="sky" heightClass="h-2.5" />
                  </div>
                )}

                {vaultPoolTab === 'auto_id' && (
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-[#ecfff5] to-[#ccf7e2] border border-[#92e6bf] space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-black text-[#064e3b] text-sm">
                          👤 ถังสร้าง Main ID ใหม่ (Auto ID Pool)
                        </div>
                        <div className="text-[11px] text-[#0f6b47] font-semibold">
                          สร้างแล้ว <strong>{totalAutoIds} รหัส</strong> · หักสร้างสะสม{' '}
                          <strong className="font-mono">
                            -{vaultPools.autoIdsDeductedUsdt.toFixed(2)} U
                          </strong>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-base font-black text-emerald-700">
                          {vaultPools.newAutoIdPool.toFixed(2)} / 5.00 U
                        </div>
                        <div className="text-[10px] font-bold text-[#0f6b47]">
                          ความคืบหน้าใบถัดไป ({autoPoolPct.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                    <SvgProgressBar
                      percent={autoPoolPct}
                      variant="emerald"
                      heightClass="h-2.5"
                      trackClass="bg-[#a7e6c9]"
                    />

                    <div className="pt-1 space-y-1.5">
                      <div className="font-black text-[#064e3b] text-[11px]">
                        รายชื่อรหัส Auto ID ที่สร้างจากถังนี้ ({autoIdsSpawnedList.length} รหัส):
                      </div>
                      {autoIdsSpawnedList.length === 0 ? (
                        <div className="p-3 text-center rounded-xl bg-white/80 border border-[#a7e6c9] text-[#45725e]">
                          ยังไม่มีการสร้าง Auto ID จากถังนี้ (สะสมครบ 5.00 U จะสร้างให้อัตโนมัติ)
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                          {autoIdsSpawnedList.map((a: any, idx: number) => {
                            const nodeId = Number(a.id || 0);
                            const rank = Number(a.rank || 1);
                            const price = Number(RANK_PRICES_USDT[rank - 1] || 5);
                            const sideTh = a.side === 'RIGHT' ? 'ฝั่งขวา' : 'ฝั่งซ้าย';
                            const txMatch = recentTransactions.find(
                              (t: any) =>
                                isRealChainTxHash(t?.txHash) &&
                                (t.id === `reg-r1-${nodeId}` ||
                                  (String(t.category || '').toUpperCase() === 'REGISTRATION' &&
                                    Number(t.mainNodeId) === nodeId))
                            );
                            return (
                              <div
                                key={`vault-auto-${nodeId}-${idx}`}
                                className="p-2.5 rounded-xl bg-white/95 border border-[#a7e6c9] flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px]">
                                      Auto ID #{nodeId}
                                    </span>
                                    <span className="font-mono font-bold text-[#09265f]">
                                      R{rank}-#{nodeId}
                                    </span>
                                    <span className="text-[10.5px] text-[#35567e]">
                                      · วางใต้ #{a.parentId || '-'} ({sideTh})
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-[#4f7464]">
                                    🕒 {formatThaiDateTime(a.timestamp)}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 space-y-1">
                                  <div className="font-mono font-black text-rose-600">
                                    -{price.toFixed(2)} U
                                  </div>
                                  <div className="flex items-center justify-end gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onSelectMainId(String(nodeId));
                                        setActiveModal(null);
                                      }}
                                      className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-300 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                    >
                                      ดู ID #{nodeId}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openDashboard2Matrix(rank, nodeId);
                                      }}
                                      className="px-2 py-0.5 rounded-md bg-[#e6f5ff] border border-[#9fd4ff] text-[10px] font-bold text-[#0756bc] hover:bg-[#d5eeff] cursor-pointer"
                                    >
                                      ผัง R{rank}
                                    </button>
                                    {txMatch?.txHash && (
                                      <a
                                        href={`https://testnet.bscscan.com/tx/${txMatch.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-[#087cf4] hover:underline inline-flex items-center gap-0.5"
                                      >
                                        TX <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {vaultPoolTab === 'extra_id' && (
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-[#faf5ff] to-[#e8d9ff] border border-[#cbaef9] space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-black text-[#4c1d95] text-sm">
                          ✦ ถังสร้าง Extra ID (New Extra ID Pool)
                        </div>
                        <div className="text-[11px] text-[#5b21b6] font-semibold">
                          สร้างแล้ว <strong>{totalExtraIds} รหัส</strong> · หักสร้างสะสม{' '}
                          <strong className="font-mono">
                            -{vaultPools.extraIdsDeductedUsdt.toFixed(2)} U
                          </strong>{' '}
                          (สะสมรวม {vaultPools.newExtraIdPoolGross.toFixed(2)} U)
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-base font-black text-violet-800">
                          {vaultPools.newExtraIdPool.toFixed(2)} U
                        </div>
                        <div className="text-[10px] font-bold text-[#5b21b6]">
                          คงเหลือพร้อมใช้ ({extraPoolPct.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                    <SvgProgressBar
                      percent={extraPoolPct}
                      variant="purple"
                      heightClass="h-2.5"
                      trackClass="bg-[#ccb3f7]"
                    />

                    <div className="pt-1 space-y-1.5">
                      <div className="font-black text-[#4c1d95] text-[11px]">
                        รายชื่อรหัส Extra ID ที่สร้างจากถังนี้ ({autoExtraIdsSpawnedList.length}{' '}
                        รหัส):
                      </div>
                      {autoExtraIdsSpawnedList.length === 0 ? (
                        <div className="p-3 text-center rounded-xl bg-white/80 border border-[#d6c2fa] text-[#5b21b6]">
                          ยังไม่มีการสร้าง Extra ID จากถังนี้
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                          {autoExtraIdsSpawnedList.map((ex: any, idx: number) => {
                            const nodeId = Number(ex.id || 0);
                            const rank = Number(ex.rank || 2);
                            const price = Number(RANK_PRICES_USDT[rank - 1] || 10);
                            const sideTh = ex.side === 'RIGHT' ? 'ฝั่งขวา' : 'ฝั่งซ้าย';
                            return (
                              <div
                                key={`vault-extra-${rank}-${nodeId}-${idx}`}
                                className="p-2.5 rounded-xl bg-white/95 border border-[#d6c2fa] flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 font-black text-[10px]">
                                      Extra R{rank}-#{nodeId}
                                    </span>
                                    <span className="font-mono font-bold text-[#09265f]">
                                      Rank {rank}
                                    </span>
                                    <span className="text-[10.5px] text-[#35567e]">
                                      · วางใต้ #{ex.parentId || '-'} ({sideTh})
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-[#6b4d9e]">
                                    🕒 {formatThaiDateTime(ex.timestamp)}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 space-y-1">
                                  <div className="font-mono font-black text-rose-600">
                                    -{price.toFixed(2)} U
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openDashboard2Matrix(rank, nodeId);
                                    }}
                                    className="px-2 py-0.5 rounded-md bg-violet-50 border border-violet-300 text-[10px] font-bold text-violet-700 hover:bg-violet-100 cursor-pointer"
                                  >
                                    ดูผัง Rank {rank}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vault Ledger Header & IN/OUT Filter */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="font-bold text-[#0754b9]">
                    สมุดบัญชี Vault เข้า/ออก{' '}
                    {vaultPoolTab === 'upgrade'
                      ? '(ถังอัปเกรด)'
                      : vaultPoolTab === 'auto_id'
                      ? '(ถัง Auto ID)'
                      : vaultPoolTab === 'extra_id'
                      ? '(ถัง Extra ID)'
                      : '(ทุกถัง)'}{' '}
                    ({filteredVaultLedger.length}):
                  </div>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { k: 'ALL', label: 'ทั้งหมด' },
                        { k: 'IN', label: 'เข้า (+)' },
                        { k: 'OUT', label: 'ออก (-)' },
                      ] as const
                    ).map((df) => (
                      <button
                        key={df.k}
                        type="button"
                        onClick={() => setVaultDirectionFilter(df.k)}
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border cursor-pointer ${
                          vaultDirectionFilter === df.k
                            ? 'bg-[#087cf4] text-white border-[#087cf4]'
                            : 'bg-white text-[#0756bc] border-[#b8e5ff]'
                        }`}
                      >
                        {df.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {filteredVaultLedger.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-white/80 border border-[#b8e5ff] text-[#55769b]">
                      ไม่มีรายการเคลื่อนไหวในหมวดที่เลือกสำหรับ ID #{displayId}
                    </div>
                  ) : (
                    filteredVaultLedger.map((item: any, idx: number) => (
                      <div
                        key={`vl-${item.id || idx}`}
                        className="p-2.5 rounded-xl bg-white border border-[#b8e5ff] flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${
                                item.direction === 'OUT'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {item.direction === 'OUT' ? 'OUT' : 'IN'}
                            </span>
                            <span className="font-bold text-[#09265f]">
                              {item.actionLabelTh || item.poolLabelTh || item.poolType} · R
                              {item.rank}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-[#45668f] leading-snug break-words">
                            {item.descriptionTh || item.note}
                          </div>
                          <div className="text-[9.5px] font-mono text-[#6b8cb3]">
                            🕒 {formatThaiDateTime(item.timestamp)}
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono">
                          <strong
                            className={`font-black block ${
                              item.direction === 'OUT' ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {item.direction === 'OUT' ? '-' : '+'}
                            {Number(item.amountUsdt || 0).toFixed(2)} U
                          </strong>
                          {typeof item.balanceAfterUsdt === 'number' && (
                            <span className="text-[9.5px] text-[#55769b] block">
                              คงเหลือ {Number(item.balanceAfterUsdt).toFixed(2)} U
                            </span>
                          )}
                        </div>
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
