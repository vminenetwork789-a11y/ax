import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  Coins,
  Dna,
  ExternalLink,
  GitBranch,
  PanelRightClose,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Vault,
  X,
  Zap,
} from 'lucide-react';

export interface ActivityFeedNodeRef {
  id: number;
  rank: number;
  parentId: number;
  leftChild: number;
  rightChild: number;
  owner: string;
  originMainId: number;
  r1MainId?: number;
  directUplineNodeId?: number;
  isClone?: boolean;
  isExtraId?: boolean;
  isAutoMainId?: boolean;
  isLeft?: boolean;
  createdAt?: string;
}

export interface ScopedAlertFeedItem {
  key: string;
  title: string;
  subtitle: string;
  rank: number;
  nodeId: number;
  category: 'NEW_NODE' | 'AUTO_ID' | 'EXTRA_ID' | 'POOL_READY';
  timestamp: string;
}

export interface MatrixActivityFeedProps {
  language: 'th' | 'en';
  selectedId: number;
  selectedLabel: string;
  selectedCategory?: 'MAIN' | 'AUTO' | 'EXTRA' | 'CLONE';
  selectedSwitchRank?: number;
  originMainId: number;
  selectedRank: number;
  isStrictIdLocked: boolean;
  ownedRankNodesList?: Array<{ rank: number; nodeId: number }>;
  wsConnected: boolean;
  wsTransport: string;
  wsLastSyncedAt: string | null;
  wsTransactions: any[];
  wsRewardLogs: any[];
  wsUpgradeLogs: any[];
  perIdReport: any | null;
  selectedIdAlertsFeed: ScopedAlertFeedItem[];
  activeNodesMap: Map<number, ActivityFeedNodeRef>;
  refreshTrigger?: any;
  onFocusNode?: (nodeId: number, rank?: number) => void;
  onRefreshData?: () => Promise<void> | void;
  onToggleCollapse?: () => void;
}

type FeedCategory = 'INCOME' | 'UPGRADE_VAULT' | 'NODE_SPAWN';
type FilterTab = 'ALL' | FeedCategory;

interface NormalizedActivityItem {
  id: string;
  category: FeedCategory;
  subType: string;
  title: string;
  subtitle: string;
  rank: number;
  focusNodeId?: number;
  amountUsdt?: number;
  amountDirection?: 'IN' | 'OUT' | 'INFO';
  timestamp: string;
  timestampMs: number;
  txHash?: string;
  sourceLabel: string;
}

function isValidTxHash(hash?: string | null): hash is string {
  return Boolean(hash && /^0x[a-fA-F0-9]{64}$/.test(hash.trim()));
}

function parseTimestampMs(raw?: string | number | null): number {
  if (!raw) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatShortTime(isoOrStr: string, language: 'th' | 'en'): string {
  if (!isoOrStr) return '--:--';
  const d = new Date(isoOrStr);
  if (isNaN(d.getTime())) return isoOrStr;
  return d.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function shortenWallet(addr?: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const MatrixActivityFeed: React.FC<MatrixActivityFeedProps> = ({
  language,
  selectedId,
  selectedLabel,
  selectedCategory = 'MAIN',
  selectedSwitchRank = 1,
  originMainId,
  selectedRank,
  isStrictIdLocked,
  ownedRankNodesList,
  wsConnected,
  wsTransport,
  wsLastSyncedAt,
  wsTransactions,
  wsRewardLogs,
  wsUpgradeLogs,
  perIdReport,
  selectedIdAlertsFeed,
  activeNodesMap,
  refreshTrigger,
  onFocusNode,
  onRefreshData,
  onToggleCollapse,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [apiTransactions, setApiTransactions] = useState<any[]>([]);
  const [apiRewardLogs, setApiRewardLogs] = useState<any[]>([]);
  const [apiUpgradeLogs, setApiUpgradeLogs] = useState<any[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const fetchFeedEndpoints = useCallback(async (forceSync = false) => {
    if (isFetchingRef.current && !forceSync) return;
    isFetchingRef.current = true;
    if (forceSync) setIsManualRefreshing(true);

    try {
      const qs = forceSync ? '?forceSync=1' : '';
      const [txRes, rewRes] = await Promise.all([
        fetch(`/api/transactions${qs}`, { headers: { Accept: 'application/json' } }).catch(() => null),
        fetch(`/api/rewards${qs}`, { headers: { Accept: 'application/json' } }).catch(() => null),
      ]);

      if (txRes && txRes.ok) {
        const txJson = await txRes.json();
        if (txJson?.success && Array.isArray(txJson.data)) {
          setApiTransactions(txJson.data);
        }
      }
      if (rewRes && rewRes.ok) {
        const rewJson = await rewRes.json();
        if (rewJson?.success) {
          if (Array.isArray(rewJson.data)) setApiRewardLogs(rewJson.data);
          if (Array.isArray(rewJson.upgradeLogs)) setApiUpgradeLogs(rewJson.upgradeLogs);
        }
      }
      setLastFetchedAt(new Date().toISOString());
    } finally {
      isFetchingRef.current = false;
      setIsLoadingInitial(false);
      setIsManualRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedEndpoints(false);
  }, [fetchFeedEndpoints, selectedId, originMainId, selectedRank, refreshTrigger, wsLastSyncedAt]);

  const handleRefreshAll = async () => {
    await Promise.all([
      fetchFeedEndpoints(true),
      onRefreshData ? Promise.resolve(onRefreshData()) : Promise.resolve(),
    ]);
  };

  // Compute rank-scoped (rank, nodeId) keys belonging to or directly under the selected Switch ID
  const scopedNodeContext = useMemo(() => {
    const isSpecificSubNode = selectedCategory === 'EXTRA' || selectedCategory === 'CLONE';
    const effectiveSwitchRank = Math.max(1, Number(selectedSwitchRank || 1));
    const ownedRankNodeKeys = new Set<string>();
    const ownedNodeIdsInActiveRank = new Set<number>();

    if (selectedId > 0) {
      ownedRankNodeKeys.add(`${effectiveSwitchRank}-${selectedId}`);
    }

    if (!isSpecificSubNode) {
      if (originMainId > 0) ownedRankNodeKeys.add(`1-${originMainId}`);
      if (selectedId > 0) ownedRankNodeKeys.add(`1-${selectedId}`);

      if (Array.isArray(perIdReport?.rankNodesList)) {
        for (const rn of perIdReport.rankNodesList) {
          const rNum = Number(rn?.rank || 0);
          const nid = Number(rn?.nodeId || 0);
          if (rNum > 0 && nid > 0) {
            ownedRankNodeKeys.add(`${rNum}-${nid}`);
          }
        }
      }

      if (Array.isArray(ownedRankNodesList)) {
        for (const rn of ownedRankNodesList) {
          if (rn.rank > 0 && rn.nodeId > 0) {
            ownedRankNodeKeys.add(`${rn.rank}-${rn.nodeId}`);
          }
        }
      }
    }

    // Resolve the exact node ID representing the selected Switch ID inside activeNodesMap (current selectedRank)
    let activeRankRootId: number | null = null;
    if (activeNodesMap.size > 0) {
      if (isSpecificSubNode) {
        if (selectedRank === effectiveSwitchRank && activeNodesMap.has(selectedId)) {
          const candidate = activeNodesMap.get(selectedId)!;
          const matchesCat =
            (selectedCategory === 'CLONE' && Boolean(candidate.isClone)) ||
            (selectedCategory === 'EXTRA' && Boolean(candidate.isExtraId));
          if (matchesCat) {
            activeRankRootId = candidate.id;
            ownedNodeIdsInActiveRank.add(candidate.id);
          }
        }
      } else {
        for (const n of activeNodesMap.values()) {
          if (
            ownedRankNodeKeys.has(`${n.rank || selectedRank}-${n.id}`) ||
            (!n.isClone &&
              !n.isExtraId &&
              (n.r1MainId === originMainId || n.originMainId === originMainId || (selectedRank === 1 && n.id === selectedId)))
          ) {
            ownedRankNodeKeys.add(`${n.rank || selectedRank}-${n.id}`);
            ownedNodeIdsInActiveRank.add(n.id);
            if (activeRankRootId === null) activeRankRootId = n.id;
          }
        }
      }
    }

    // Collect downline subtree under activeRankRootId in activeNodesMap (strictly scoped to selectedRank)
    const downlineNodeIds = new Set<number>();
    const downlineRankNodeKeys = new Set<string>();
    const directChildIds = new Set<number>();
    const queue: number[] = [];

    if (activeRankRootId !== null) {
      queue.push(activeRankRootId);
    }

    const visited = new Set<number>();
    while (queue.length > 0 && visited.size < 400) {
      const currId = queue.shift()!;
      if (visited.has(currId)) continue;
      visited.add(currId);
      const node = activeNodesMap.get(currId);
      if (!node) continue;
      const nodeRank = Number(node.rank || selectedRank || 1);
      if (node.leftChild > 0) {
        if (currId === activeRankRootId || ownedNodeIdsInActiveRank.has(currId)) {
          directChildIds.add(node.leftChild);
        }
        downlineNodeIds.add(node.leftChild);
        downlineRankNodeKeys.add(`${nodeRank}-${node.leftChild}`);
        queue.push(node.leftChild);
      }
      if (node.rightChild > 0) {
        if (currId === activeRankRootId || ownedNodeIdsInActiveRank.has(currId)) {
          directChildIds.add(node.rightChild);
        }
        downlineNodeIds.add(node.rightChild);
        downlineRankNodeKeys.add(`${nodeRank}-${node.rightChild}`);
        queue.push(node.rightChild);
      }
    }

    // Also include direct sponsored / placed nodes in active rank under activeRankRootId
    if (activeRankRootId !== null) {
      for (const n of activeNodesMap.values()) {
        if (n.id === activeRankRootId) continue;
        const nRank = Number(n.rank || selectedRank || 1);
        if (
          ownedNodeIdsInActiveRank.has(Number(n.directUplineNodeId || 0)) ||
          ownedNodeIdsInActiveRank.has(Number(n.parentId || 0))
        ) {
          downlineNodeIds.add(n.id);
          downlineRankNodeKeys.add(`${nRank}-${n.id}`);
        }
      }
    }

    return {
      ownedRankNodeKeys,
      ownedNodeIdsInActiveRank,
      activeRankRootId,
      downlineNodeIds,
      downlineRankNodeKeys,
      directChildIds,
      isSpecificSubNode,
      effectiveSwitchRank,
    };
  }, [
    selectedId,
    originMainId,
    selectedCategory,
    selectedSwitchRank,
    selectedRank,
    perIdReport,
    ownedRankNodesList,
    activeNodesMap,
  ]);

  // Merge and normalize all real-time + historical events filtered strictly for the selected Switch ID
  const activityItems = useMemo<NormalizedActivityItem[]>(() => {
    const itemsMap = new Map<string, NormalizedActivityItem>();
    const {
      ownedRankNodeKeys,
      ownedNodeIdsInActiveRank,
      activeRankRootId,
      downlineNodeIds,
      downlineRankNodeKeys,
      isSpecificSubNode,
    } = scopedNodeContext;

    const addItem = (item: NormalizedActivityItem) => {
      const existing = itemsMap.get(item.id);
      if (!existing || (!existing.txHash && item.txHash) || item.timestampMs > existing.timestampMs) {
        itemsMap.set(item.id, item);
      }
    };

    const matchesRankNode = (rankNum: number, nodeIdNum: number) => {
      if (nodeIdNum <= 0 || rankNum <= 0) return false;
      return ownedRankNodeKeys.has(`${rankNum}-${nodeIdNum}`);
    };

    // 1. Live & Historical Reward Logs (wsRewardLogs + apiRewardLogs)
    const combinedRewards = [...(wsRewardLogs || []), ...(apiRewardLogs || [])];
    for (const r of combinedRewards) {
      const toId = Number(r.toNodeId || 0);
      const fromId = Number(r.fromNodeId || 0);
      const rankNum = Number(r.rank || 1);
      const rType = String(r.rewardType || 'DIRECT').toUpperCase();
      const amountNum = Number(parseFloat(String(r.amount || '0')) || 0);
      const isRecipient = matchesRankNode(rankNum, toId);
      const isSenderVault = rType.includes('VAULT') && matchesRankNode(rankNum, fromId);

      if (!isRecipient && !isSenderVault) continue;
      if (rType === 'UNPAID_LEVEL_FAMILY_POOL' && toId === 0) continue;

      const ts = String(r.createdAt || r.timestamp || wsLastSyncedAt || '');
      const tsMs = parseTimestampMs(ts);
      const key = `rew-${rType}-${rankNum}-${fromId}-${toId}-${amountNum.toFixed(2)}-${r.blockNumber || ''}`;

      const isVault = rType.includes('VAULT');
      const isDirect = rType.includes('DIRECT');
      const isLevel = rType.includes('LEVEL');

      const title = isDirect
        ? language === 'th'
          ? `รับค่าแนะนำตรง 30% จาก #${fromId}`
          : `Direct 30% Bonus from #${fromId}`
        : isLevel
        ? language === 'th'
          ? `รับค่าชั้น Unilevel จาก #${fromId}`
          : `Unilevel Commission from #${fromId}`
        : isVault
        ? language === 'th'
          ? `สะสมเข้าคลัง Vault 35% (จาก #${fromId})`
          : `Vault 35% Accumulation (from #${fromId})`
        : language === 'th'
        ? `รับโบนัส ${rType} จาก #${fromId}`
        : `${rType} Payout from #${fromId}`;

      const subtitle =
        language === 'th'
          ? `Rank ${rankNum} · ผู้ส่ง #${fromId} → #${toId}${r.blockNumber ? ` · Block ${r.blockNumber}` : ''}`
          : `Rank ${rankNum} · From #${fromId} → #${toId}${r.blockNumber ? ` · Block ${r.blockNumber}` : ''}`;

      addItem({
        id: key,
        category: isVault ? 'UPGRADE_VAULT' : 'INCOME',
        subType: rType,
        title,
        subtitle,
        rank: rankNum,
        focusNodeId: fromId > 0 ? fromId : toId,
        amountUsdt: amountNum,
        amountDirection: 'IN',
        timestamp: ts,
        timestampMs: tsMs,
        txHash: isValidTxHash(r.txHash) ? r.txHash : undefined,
        sourceLabel: wsRewardLogs.includes(r) ? 'LIVE' : 'LOG',
      });
    }

    // 2. Per-ID Detailed Report (direct30History, level30History, vault35Ledger/History, spawns)
    if (perIdReport && !isSpecificSubNode) {
      const dHist = Array.isArray(perIdReport.direct30History) ? perIdReport.direct30History : [];
      for (const d of dHist) {
        const fromId = Number(d.fromNodeId || d.fromMainId || 0);
        const toId = Number(d.toNodeId || selectedId);
        const rankNum = Number(d.rank || 1);
        const amt = Number(d.amountUsdt || 0);
        const ts = String(d.timestamp || '');
        const key = `rew-DIRECT-${rankNum}-${fromId}-${toId}-${amt.toFixed(2)}-`;
        if (!itemsMap.has(key)) {
          addItem({
            id: `perid-dir-${rankNum}-${fromId}-${toId}-${amt.toFixed(2)}`,
            category: 'INCOME',
            subType: 'DIRECT',
            title:
              language === 'th'
                ? `ค่าแนะนำตรง 30% จาก #${fromId}`
                : `Direct 30% Bonus from #${fromId}`,
            subtitle:
              d.note ||
              (language === 'th'
                ? `Rank ${rankNum} · จาก Main #${d.fromMainId || fromId} → #${toId}`
                : `Rank ${rankNum} · Main #${d.fromMainId || fromId} → #${toId}`),
            rank: rankNum,
            focusNodeId: fromId > 0 ? fromId : toId,
            amountUsdt: amt,
            amountDirection: 'IN',
            timestamp: ts,
            timestampMs: parseTimestampMs(ts),
            sourceLabel: 'LEDGER',
          });
        }
      }

      const lHist = Array.isArray(perIdReport.level30History) ? perIdReport.level30History : [];
      for (const l of lHist) {
        const fromId = Number(l.fromNodeId || l.fromMainId || 0);
        const toId = Number(l.toNodeId || selectedId);
        const rankNum = Number(l.rank || 1);
        const amt = Number(l.amountUsdt || 0);
        const tierNum = l.tier ? ` · ชั้น ${l.tier}` : '';
        const ts = String(l.timestamp || '');
        addItem({
          id: `perid-lvl-${rankNum}-${fromId}-${toId}-${l.tier || 0}-${amt.toFixed(2)}`,
          category: 'INCOME',
          subType: 'LEVEL',
          title:
            language === 'th'
              ? `ค่าชั้น 2% จากโหนดฝั่งซ้าย #${fromId}`
              : `2% Tier Bonus from Left Node #${fromId}`,
          subtitle:
            l.note ||
            (language === 'th'
              ? `Rank ${rankNum}${tierNum} · เข้า #${toId}`
              : `Rank ${rankNum}${l.tier ? ` · Tier ${l.tier}` : ''} · To #${toId}`),
          rank: rankNum,
          focusNodeId: fromId > 0 ? fromId : toId,
          amountUsdt: amt,
          amountDirection: 'IN',
          timestamp: ts,
          timestampMs: parseTimestampMs(ts),
          sourceLabel: 'LEDGER',
        });
      }

      const vLedger = Array.isArray(perIdReport.vault35Ledger)
        ? perIdReport.vault35Ledger
        : Array.isArray(perIdReport.vault35History)
        ? perIdReport.vault35History
        : [];
      for (const v of vLedger) {
        const isOut = String(v.direction || '').toUpperCase() === 'OUT';
        const rankNum = Number(v.rank || 1);
        const amt = Number(v.amountUsdt || 0);
        const ts = String(v.timestamp || '');
        const vId = String(
          v.id || `v-${rankNum}-${v.actionType || 'RECEIVE'}-${v.fromNodeId || 0}-${amt.toFixed(2)}-${ts}`
        );
        addItem({
          id: `perid-vault-${vId}`,
          category: 'UPGRADE_VAULT',
          subType: String(v.actionType || 'VAULT'),
          title:
            v.actionLabelTh ||
            (isOut
              ? language === 'th'
                ? `หักเงินคลัง Vault (${v.poolLabelTh || 'Pool'})`
                : `Vault Deduction (${v.poolLabelTh || 'Pool'})`
              : language === 'th'
              ? `เข้าคลัง Vault 35% (จาก #${v.fromNodeId || selectedId})`
              : `Vault 35% Deposit`),
          subtitle:
            v.descriptionTh ||
            v.note ||
            `Rank ${rankNum} · ${v.poolLabelTh || 'Vault 35%'}`,
          rank: rankNum,
          focusNodeId: Number(v.fromNodeId || selectedId),
          amountUsdt: amt,
          amountDirection: isOut ? 'OUT' : 'IN',
          timestamp: ts,
          timestampMs: parseTimestampMs(ts),
          sourceLabel: 'VAULT',
        });
      }

      const autoSpawns = Array.isArray(perIdReport.autoIdsSpawned) ? perIdReport.autoIdsSpawned : [];
      for (const sp of autoSpawns) {
        const ts = String(sp.timestamp || '');
        addItem({
          id: `spawn-auto-${sp.rank || 1}-${sp.id}`,
          category: 'NODE_SPAWN',
          subType: 'AUTO_ID',
          title:
            language === 'th'
              ? `สร้าง Auto ID ใหม่ #${sp.id}`
              : `Spawned Auto ID #${sp.id}`,
          subtitle:
            language === 'th'
              ? `Rank ${sp.rank || 1} · ต่อใต้อัพไลน์ #${sp.parentId} (${sp.side === 'LEFT' ? 'ซ้าย' : sp.side === 'RIGHT' ? 'ขวา' : 'Root'})`
              : `Rank ${sp.rank || 1} · Under #${sp.parentId} (${sp.side})`,
          rank: Number(sp.rank || 1),
          focusNodeId: Number(sp.id),
          amountDirection: 'INFO',
          timestamp: ts,
          timestampMs: parseTimestampMs(ts),
          sourceLabel: 'AUTO',
        });
      }

      const extraSpawns = Array.isArray(perIdReport.autoExtraIdsSpawned)
        ? perIdReport.autoExtraIdsSpawned
        : [];
      for (const sp of extraSpawns) {
        const ts = String(sp.timestamp || '');
        addItem({
          id: `spawn-extra-${sp.rank || 4}-${sp.id}`,
          category: 'NODE_SPAWN',
          subType: 'EXTRA_ID',
          title:
            language === 'th'
              ? `สร้าง Extra ID ใหม่ R${sp.rank}-#${sp.id}`
              : `Spawned Extra ID R${sp.rank}-#${sp.id}`,
          subtitle:
            language === 'th'
              ? `Rank ${sp.rank} · ต่อใต้อัพไลน์ #${sp.parentId} (${sp.side === 'LEFT' ? 'ซ้าย' : sp.side === 'RIGHT' ? 'ขวา' : 'Root'})`
              : `Rank ${sp.rank} · Under #${sp.parentId} (${sp.side})`,
          rank: Number(sp.rank || 4),
          focusNodeId: Number(sp.id),
          amountDirection: 'INFO',
          timestamp: ts,
          timestampMs: parseTimestampMs(ts),
          sourceLabel: 'EXTRA',
        });
      }

      const cloneSpawns = Array.isArray(perIdReport.clonesSpawned) ? perIdReport.clonesSpawned : [];
      for (const sp of cloneSpawns) {
        const ts = String(sp.timestamp || '');
        addItem({
          id: `spawn-clone-${sp.rank || 1}-${sp.id}`,
          category: 'NODE_SPAWN',
          subType: 'CLONE_ID',
          title:
            language === 'th'
              ? `เกิดรหัสโคลนนิ่ง R${sp.rank || 1}-#${sp.id}`
              : `Spawned Clone R${sp.rank || 1}-#${sp.id}`,
          subtitle:
            language === 'th'
              ? `Rank ${sp.rank || 1} · รอบที่ ${sp.cloneRound || 1} · อัพไลน์ #${sp.parentId}`
              : `Rank ${sp.rank || 1} · Round ${sp.cloneRound || 1} · Under #${sp.parentId}`,
          rank: Number(sp.rank || 1),
          focusNodeId: Number(sp.id),
          amountDirection: 'INFO',
          timestamp: ts,
          timestampMs: parseTimestampMs(ts),
          sourceLabel: 'CLONE',
        });
      }
    }

    // 3. Upgrade Logs (wsUpgradeLogs + apiUpgradeLogs)
    const combinedUpgrades = [...(wsUpgradeLogs || []), ...(apiUpgradeLogs || [])];
    for (const u of combinedUpgrades) {
      const mId = Number(u.mainNodeId || 0);
      const newNid = Number(u.newNodeId || 0);
      const toRank = Number(u.toRank || 2);
      const matchesUpgrade =
        (!isSpecificSubNode && mId > 0 && mId === originMainId) ||
        matchesRankNode(toRank, newNid);
      if (!matchesUpgrade) continue;

      const fromRank = Number(u.fromRank || Math.max(1, toRank - 1));
      const cost = parseFloat(String(u.rankPriceUsdt || u.costUsdt || '0')) || 0;
      const ts = String(u.createdAt || u.timestamp || '');
      const isFree = Boolean(u.isAdminFreeUpgrade);

      addItem({
        id: `upg-${mId}-${toRank}`,
        category: 'UPGRADE_VAULT',
        subType: isFree ? 'ADMIN_UPGRADE' : 'UPGRADE',
        title:
          language === 'th'
            ? `อัพเกรด Rank ${fromRank} → Rank ${toRank}${isFree ? ' (Admin)' : ''}`
            : `Rank Upgrade R${fromRank} → R${toRank}${isFree ? ' (Admin)' : ''}`,
        subtitle:
          language === 'th'
            ? `Main #${mId} · โหนดในผัง R${toRank}: #${newNid || mId}${u.isAutoPoolUpgrade ? ' · หักจาก Upgrade Pool' : ''}`
            : `Main #${mId} · R${toRank} Node #${newNid || mId}${u.isAutoPoolUpgrade ? ' · Upgrade Pool' : ''}`,
        rank: toRank,
        focusNodeId: newNid > 0 ? newNid : mId,
        amountUsdt: isFree ? 0 : cost,
        amountDirection: isFree ? 'INFO' : 'OUT',
        timestamp: ts,
        timestampMs: parseTimestampMs(ts),
        txHash: isValidTxHash(u.txHash) ? u.txHash : undefined,
        sourceLabel: isFree ? 'ADMIN' : 'UPGRADE',
      });
    }

    // 4. Unified /api/transactions + wsTransactions matching this ID or downline
    const combinedTxs = [...(wsTransactions || []), ...(apiTransactions || [])];
    for (const tx of combinedTxs) {
      const cat = String(tx.category || '').toUpperCase();
      const txMainId = Number(tx.mainNodeId || 0);
      const txRank = Number(tx.rank || 1);
      const regNodeMatch = String(tx.id || '').match(/^reg-r(\d+)-(\d+)$/);
      const effectiveRank = regNodeMatch ? Number(regNodeMatch[1]) : txRank;
      const txNodeId = regNodeMatch ? Number(regNodeMatch[2]) : txMainId;

      const isSelfTx =
        cat === 'PAYOUT'
          ? matchesRankNode(effectiveRank, txNodeId)
          : cat === 'UPGRADE'
          ? (!isSpecificSubNode && txMainId > 0 && txMainId === originMainId) ||
            matchesRankNode(effectiveRank, txNodeId)
          : matchesRankNode(effectiveRank, txNodeId) ||
            (!isSpecificSubNode && txMainId > 0 && txMainId === originMainId);

      const isDownlineReg =
        cat === 'REGISTRATION' &&
        (downlineRankNodeKeys.has(`${effectiveRank}-${txNodeId}`) ||
          (activeRankRootId !== null &&
            effectiveRank === selectedRank &&
            (String(tx.detailsEn || '').includes(`Parent #${activeRankRootId}`) ||
              String(tx.detailsTh || '').includes(`#${activeRankRootId} (`))));

      if (!isSelfTx && !isDownlineReg) continue;
      // Avoid duplicating payouts/upgrades already normalized above unless they carry a real txHash
      if (cat === 'PAYOUT' && !isValidTxHash(tx.txHash)) continue;
      if (cat === 'UPGRADE') {
        const upgKey = `upg-${txMainId}-${txRank}`;
        if (itemsMap.has(upgKey)) {
          if (isValidTxHash(tx.txHash)) {
            const ex = itemsMap.get(upgKey)!;
            if (!ex.txHash) itemsMap.set(upgKey, { ...ex, txHash: tx.txHash });
          }
          continue;
        }
      }

      const ts = String(tx.timestamp || '');
      addItem({
        id: `tx-${tx.id || `${cat}-${effectiveRank}-${txNodeId}`}`,
        category: cat === 'PAYOUT' ? 'INCOME' : cat === 'UPGRADE' ? 'UPGRADE_VAULT' : 'NODE_SPAWN',
        subType: cat || 'TX',
        title:
          language === 'th'
            ? isDownlineReg && !isSelfTx
              ? `ลูกทีมใหม่เข้าสายงาน #${txNodeId}`
              : tx.titleTh || tx.titleEn || `ธุรกรรม #${txNodeId}`
            : isDownlineReg && !isSelfTx
            ? `New Downline Joined #${txNodeId}`
            : tx.titleEn || tx.titleTh || `Transaction #${txNodeId}`,
        subtitle:
          (language === 'th' ? tx.detailsTh : tx.detailsEn) ||
          `Rank ${effectiveRank} · ${shortenWallet(tx.userAddress)}`,
        rank: effectiveRank,
        focusNodeId: txNodeId > 0 ? txNodeId : undefined,
        amountUsdt: Number(tx.amountUsdt || 0) || undefined,
        amountDirection: cat === 'PAYOUT' ? 'IN' : cat === 'UPGRADE' ? 'OUT' : 'INFO',
        timestamp: ts,
        timestampMs: parseTimestampMs(ts),
        txHash: isValidTxHash(tx.txHash) ? tx.txHash : undefined,
        sourceLabel: isDownlineReg && !isSelfTx ? 'DOWNLINE' : 'ON-CHAIN',
      });
    }

    // 5. Real-time tree arrival / pool alerts scoped to selected ID
    for (const al of selectedIdAlertsFeed || []) {
      const ts = String(al.timestamp || '');
      addItem({
        id: `alert-${al.key}`,
        category: al.category === 'POOL_READY' ? 'UPGRADE_VAULT' : 'NODE_SPAWN',
        subType: al.category,
        title: al.title,
        subtitle: al.subtitle,
        rank: Number(al.rank || selectedRank || 1),
        focusNodeId: Number(al.nodeId || selectedId),
        amountDirection: 'INFO',
        timestamp: ts,
        timestampMs: parseTimestampMs(ts) || Date.now(),
        sourceLabel: 'ALERT',
      });
    }

    // 6. Live direct/subtree nodes in activeNodesMap for current rank (strictly under activeRankRootId)
    for (const n of activeNodesMap.values()) {
      if (ownedNodeIdsInActiveRank.has(n.id) || n.id === activeRankRootId) continue;
      if (!downlineRankNodeKeys.has(`${n.rank || selectedRank}-${n.id}`)) continue;
      const existingRegId = `tx-reg-r${n.rank || 1}-${n.id}`;
      const existingLiveId = `node-downline-${n.rank}-${n.id}`;
      if (itemsMap.has(existingRegId)) continue;

      const isDirectChild =
        activeRankRootId !== null &&
        (n.parentId === activeRankRootId ||
          n.directUplineNodeId === activeRankRootId ||
          ownedNodeIdsInActiveRank.has(n.parentId) ||
          ownedNodeIdsInActiveRank.has(Number(n.directUplineNodeId || 0)));
      if (!isDirectChild && downlineNodeIds.size > 25) continue; // Keep feed focused on direct / recent subtree when huge

      const ts = String(n.createdAt || '');
      addItem({
        id: existingLiveId,
        category: 'NODE_SPAWN',
        subType: n.isClone ? 'CLONE_ID' : n.isExtraId ? 'EXTRA_ID' : n.isAutoMainId ? 'AUTO_ID' : 'DOWNLINE',
        title:
          language === 'th'
            ? `${n.isClone ? 'โคลน' : n.isExtraId ? 'Extra' : n.isAutoMainId ? 'Auto' : 'ลูกทีม'} #${n.id} อยู่ในสายงาน`
            : `${n.isClone ? 'Clone' : n.isExtraId ? 'Extra' : n.isAutoMainId ? 'Auto' : 'Downline'} #${n.id} in Tree`,
        subtitle:
          language === 'th'
            ? `Rank ${n.rank} · ใต้ #${n.parentId} (${n.isLeft ? 'ซ้าย' : 'ขวา'}) · ผู้แนะนำ #${n.directUplineNodeId || 1}`
            : `Rank ${n.rank} · Under #${n.parentId} (${n.isLeft ? 'Left' : 'Right'}) · Sponsor #${n.directUplineNodeId || 1}`,
        rank: n.rank,
        focusNodeId: n.id,
        amountDirection: 'INFO',
        timestamp: ts,
        timestampMs: parseTimestampMs(ts),
        sourceLabel: isDirectChild ? 'DIRECT' : 'TREE',
      });
    }

    return Array.from(itemsMap.values()).sort((a, b) => {
      if (b.timestampMs !== a.timestampMs) return b.timestampMs - a.timestampMs;
      return (b.focusNodeId || 0) - (a.focusNodeId || 0);
    });
  }, [
    scopedNodeContext,
    wsRewardLogs,
    apiRewardLogs,
    perIdReport,
    wsUpgradeLogs,
    apiUpgradeLogs,
    wsTransactions,
    apiTransactions,
    selectedIdAlertsFeed,
    activeNodesMap,
    selectedId,
    originMainId,
    selectedRank,
    wsLastSyncedAt,
    language,
  ]);

  const categoryCounts = useMemo(() => {
    let income = 0;
    let upgradeVault = 0;
    let nodeSpawn = 0;
    let totalInUsdt = 0;
    for (const item of activityItems) {
      if (item.category === 'INCOME') {
        income++;
        if (item.amountDirection === 'IN' && item.amountUsdt) totalInUsdt += item.amountUsdt;
      } else if (item.category === 'UPGRADE_VAULT') {
        upgradeVault++;
        if (item.amountDirection === 'IN' && item.amountUsdt) totalInUsdt += item.amountUsdt;
      } else {
        nodeSpawn++;
      }
    }
    return {
      all: activityItems.length,
      income,
      upgradeVault,
      nodeSpawn,
      totalInUsdt,
    };
  }, [activityItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activityItems.filter((item) => {
      if (filterTab !== 'ALL' && item.category !== filterTab) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.subType.toLowerCase().includes(q) ||
        (item.focusNodeId ? `#${item.focusNodeId}`.includes(q) : false) ||
        (item.txHash ? item.txHash.toLowerCase().includes(q) : false)
      );
    });
  }, [activityItems, filterTab, searchQuery]);

  const renderCategoryIcon = (item: NormalizedActivityItem) => {
    if (item.subType === 'AUTO_ID') return <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    if (item.subType === 'EXTRA_ID') return <Zap className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    if (item.subType === 'CLONE_ID') return <Dna className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    if (item.category === 'INCOME') return <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    if (item.subType.includes('UPGRADE')) return <TrendingUp className="w-4 h-4 text-blue-600 dark:text-sky-400" />;
    if (item.category === 'UPGRADE_VAULT') return <Vault className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    if (item.subType === 'POOL_READY') return <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    if (item.subType === 'DOWNLINE') return <GitBranch className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
    return <UserPlus className="w-4 h-4 text-blue-600 dark:text-cyan-400" />;
  };

  return (
    <aside
      aria-label="Matrix Activity Feed"
      className="flex flex-col rounded-xl sm:rounded-2xl bg-white dark:bg-[#0b1020] border border-slate-200/80 dark:border-slate-800/90 overflow-hidden h-[520px] xl:h-[76vh] xl:min-h-[420px] xl:max-h-[820px]"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-3 border-b border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2563EB] dark:text-cyan-400 shrink-0" />
            <h3 className="text-sm font-extrabold tracking-tight text-[#0F172A] dark:text-white truncate">
              {language === 'th' ? 'Matrix Activity Feed' : 'Matrix Activity Feed'}
            </h3>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[#64748B] dark:text-slate-400 truncate">
            <span className="font-bold text-[#2563EB] dark:text-cyan-300">
              {selectedLabel}
            </span>
            <span>·</span>
            <span>
              {isStrictIdLocked
                ? language === 'th'
                  ? 'อ้างอิงปุ่มสลับ ID'
                  : 'Switch ID Locked'
                : `Main #${originMainId}`}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
              <span>{wsConnected ? wsTransport.toUpperCase() : 'SYNC'}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isManualRefreshing}
            className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[#334155] dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
            title={language === 'th' ? 'รีเฟรชกิจกรรมล่าสุด' : 'Refresh activity feed'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualRefreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              title={language === 'th' ? 'ซ่อนแผง Activity Feed' : 'Hide Activity Feed'}
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Compact Real Computed Summary Strip (Flat Dividers, Tabular Figures) */}
      <div className="grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-slate-800/90 border-b border-slate-200/80 dark:border-slate-800/90 bg-[#F8FAFC]/70 dark:bg-slate-950/50 shrink-0">
        <div className="px-3 py-2">
          <div className="text-[10px] font-medium text-[#64748B] dark:text-slate-400">
            {language === 'th' ? 'รายการทั้งหมด' : 'Events'}
          </div>
          <div className="text-sm font-extrabold font-mono tabular-nums text-[#0F172A] dark:text-white">
            {categoryCounts.all}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] font-medium text-[#64748B] dark:text-slate-400">
            {language === 'th' ? 'กระแสรับ (Feed)' : 'Inflow'}
          </div>
          <div className="text-sm font-extrabold font-mono tabular-nums text-[#16A34A] dark:text-emerald-400">
            +{categoryCounts.totalInUsdt.toFixed(2)}U
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] font-medium text-[#64748B] dark:text-slate-400">
            {language === 'th' ? 'โหนดสายงาน' : 'Downlines'}
          </div>
          <div className="text-sm font-extrabold font-mono tabular-nums text-[#2563EB] dark:text-cyan-300">
            {scopedNodeContext.downlineNodeIds.size}
          </div>
        </div>
      </div>

      {/* Filter Segmented Tabs & Search Input */}
      <div className="p-2.5 border-b border-slate-200/80 dark:border-slate-800/90 space-y-2 shrink-0">
        <div className="grid grid-cols-4 gap-1 bg-[#F8FAFC] dark:bg-slate-950 p-1 rounded-lg border border-slate-200/80 dark:border-slate-800">
          {(
            [
              { key: 'ALL', label: language === 'th' ? 'ทั้งหมด' : 'All', count: categoryCounts.all },
              { key: 'INCOME', label: language === 'th' ? 'รายรับ' : 'Income', count: categoryCounts.income },
              {
                key: 'UPGRADE_VAULT',
                label: language === 'th' ? 'อัพ/Vault' : 'Vault',
                count: categoryCounts.upgradeVault,
              },
              {
                key: 'NODE_SPAWN',
                label: language === 'th' ? 'โหนด' : 'Nodes',
                count: categoryCounts.nodeSpawn,
              },
            ] as const
          ).map((tab) => {
            const active = filterTab === tab.key;
            return (
              <button
                key={`feed-tab-${tab.key}`}
                type="button"
                onClick={() => setFilterTab(tab.key)}
                className={`px-1.5 py-1 rounded-md text-[10.5px] font-bold transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                  active
                    ? 'bg-[#2563EB] text-white dark:bg-cyan-500 dark:text-slate-950'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono tabular-nums text-[9.5px] opacity-85">{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'th'
                ? `ค้นหาในกิจกรรมของ #${selectedId} (เช่น #ID, Rank, Direct, Tx)`
                : `Filter #${selectedId} activity (#ID, Rank, Tx)`
            }
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs text-[#0F172A] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] dark:focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Feed Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll-container divide-y divide-slate-200/70 dark:divide-slate-800/80">
        {isLoadingInitial && activityItems.length === 0 ? (
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {[1, 2, 3, 4, 5].map((skeletonIdx) => (
              <div key={`feed-skel-${skeletonIdx}`} className="px-3.5 py-3 flex items-start gap-2.5 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-900" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 text-center flex flex-col items-center justify-center gap-2.5 min-h-[220px]">
            <Bell className="w-7 h-7 text-slate-400 dark:text-slate-600" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                {language === 'th'
                  ? `ยังไม่มีบันทึกกิจกรรมที่ตรงเงื่อนไขสำหรับ #${selectedId}`
                  : `No matching activity logs for #${selectedId} yet`}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400 max-w-[260px]">
                {language === 'th'
                  ? 'เมื่อมีการสมัครต่อสาย รายได้เข้าคลัง หรืออัพแรงค์ของ ID นี้ รายการจะอัปเดตแบบเรียลไทม์ทันที'
                  : 'Registrations, payouts, rank upgrades, and spawns for this ID will stream here in real time.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {(filterTab !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterTab('ALL');
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[11px] font-bold text-[#334155] dark:text-slate-200 cursor-pointer"
                >
                  {language === 'th' ? 'ล้างตัวกรอง' : 'Reset Filters'}
                </button>
              )}
              <button
                type="button"
                onClick={handleRefreshAll}
                className="px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{language === 'th' ? 'ดึงข้อมูลล่าสุด' : 'Sync Latest'}</span>
              </button>
            </div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const canFocus = Boolean(onFocusNode && item.focusNodeId && item.focusNodeId > 0);
            const hasAmount = typeof item.amountUsdt === 'number' && item.amountUsdt > 0;

            return (
              <div
                key={item.id}
                className="px-3.5 py-2.5 hover:bg-slate-50/90 dark:hover:bg-slate-900/60 transition flex items-start gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  {renderCategoryIcon(item)}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 leading-snug">
                      {item.title}
                    </p>
                    {hasAmount && (
                      <span
                        className={`font-mono tabular-nums text-xs font-extrabold shrink-0 ${
                          item.amountDirection === 'IN'
                            ? 'text-[#16A34A] dark:text-emerald-400'
                            : item.amountDirection === 'OUT'
                            ? 'text-[#D97706] dark:text-amber-400'
                            : 'text-[#334155] dark:text-slate-300'
                        }`}
                      >
                        {item.amountDirection === 'IN' ? '+' : item.amountDirection === 'OUT' ? '-' : ''}
                        {item.amountUsdt!.toFixed(2)}U
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-snug break-words">
                    {item.subtitle}
                  </p>

                  <div className="pt-0.5 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono tabular-nums text-[#64748B] dark:text-slate-500">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{formatShortTime(item.timestamp, language)}</span>
                      <span>·</span>
                      <span className="font-semibold text-[#475569] dark:text-slate-400">
                        {item.sourceLabel}
                      </span>
                      {item.txHash && (
                        <>
                          <span>·</span>
                          <a
                            href={`https://testnet.bscscan.com/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[#2563EB] dark:text-cyan-400 hover:underline"
                            title={item.txHash}
                          >
                            <span>Tx</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </div>

                    {canFocus && (
                      <button
                        type="button"
                        onClick={() => onFocusNode?.(item.focusNodeId!, item.rank)}
                        className="inline-flex items-center gap-0.5 text-[#2563EB] dark:text-cyan-300 hover:underline font-bold cursor-pointer"
                        title={
                          language === 'th'
                            ? `โฟกัสโหนด #${item.focusNodeId} ในผัง R${item.rank}`
                            : `Focus #${item.focusNodeId} on Rank ${item.rank}`
                        }
                      >
                        <span>#{item.focusNodeId}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Timestamp */}
      <div className="px-3.5 py-2 border-t border-slate-200/80 dark:border-slate-800/90 bg-[#F8FAFC]/60 dark:bg-slate-950/60 flex items-center justify-between text-[10px] font-mono tabular-nums text-[#64748B] dark:text-slate-500 shrink-0">
        <span>
          {language === 'th'
            ? `ผัง R${selectedRank} · เฉพาะ ${selectedLabel}`
            : `Rank ${selectedRank} · ${selectedLabel}`}
        </span>
        <span>
          {wsLastSyncedAt || lastFetchedAt
            ? formatShortTime(wsLastSyncedAt || lastFetchedAt || '', language)
            : '--:--'}
        </span>
      </div>
    </aside>
  );
};
