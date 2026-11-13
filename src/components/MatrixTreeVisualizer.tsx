import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { ethers } from 'ethers';
import {
  CONTRACT_ADDRESS,
  BSC_TESTNET_RPC,
  BSC_TESTNET_PARAMS,
  MATRIX_ABI,
  RANK_PRICES_USDT,
  isAuthorizedAdminWallet,
} from '../contracts/config';
import { calculateMainIdVaultPools } from '../utils/vaultPools';
import { useMatrixAutoReconnect } from '../hooks/useMatrixAutoReconnect';
import { useMatrixWebSocket } from '../hooks/useMatrixWebSocket';
import {
  RefreshCw,
  Search,
  Copy,
  Check,
  Sparkles,
  Trash2,
  RotateCcw,
  User,
  ZoomIn,
  ZoomOut,
  Dna,
  Layers,
  Eye,
  Coins,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  Hand,
  X,
  Maximize2,
  Shield,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Bell,
  Clock,
  Calculator,
  Link2,
  Share2,
  Move,
  Minimize2,
  ArrowDownLeft,
  ArrowDownRight,
  Info,
  Bot,
  Zap,
  Crown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emitTransactionToast } from './TransactionToast';
import { ExtraIdPathCalculator, SimRawNode } from './ExtraIdPathCalculator';
import {
  getActiveReferralSponsorId,
  setActiveReferralSponsorId,
  buildReferralLink,
} from '../utils/referralLink';

export interface EnrichedBinaryNode {
  id: number;
  rank: number;
  level: number;
  parentId: number;
  isLeft: boolean;
  owner: string;
  directSponsor: string;
  leftChild: number;
  rightChild: number;
  isClone: boolean;
  isExtraId: boolean;
  isAutoMainId: boolean;
  isAdminFreeUpgrade?: boolean;
  // Clone & Lineage Metadata
  originMainId: number; // รหัสหลัก (Primary Main ID of this owner/lineage, e.g. #1, #2, #7)
  spawnedFromNodeId: number; // Exact node whose Right child triggered this clone
  cloneRound: number; // รอบโคลน (รอบ 1 = ติดตัวผู้แนะนำ, รอบ 2 = ผังรวม BFS)
  cloneSequence?: number; // ลำดับใบโคลนของรหัสหลักนี้ (ใบที่ 1, 2, 3...)
  subCloneDepth: number; // #0 if spawned from primary ID, >=1 if spawned from a clone
  spawnedCloneIds: Array<{ cloneNodeId: number; round: number; sequence?: number }>; // Clones spawned by this node
  directUplineNodeId: number; // ผู้แนะนำ (Sponsor's primary node ID, #0 for Root)
  levelSummary?: {
    maxLevels: number;
    receivedLevelsCount: number;
    remainingLevelsCount: number;
    ratePerNodeUsdt: number;
    thisNodeLevelTotalUsdt: number;
    clonesLevelTotalUsdt: number;
    combinedLevelTotalUsdt: number;
    tiersBreakdown: Array<{
      tier: number;
      maxCapacity: number;
      totalNodesInTier: number;
      leftPayingNodesCount: number;
      rightRebirthNodesCount: number;
      ratePerNodeUsdt: number;
      amountUsdt: number;
      allNodeIds: number[];
      leftNodeIds: number[];
      rightNodeIds: number[];
    }>;
  };
  // Per-Node Benefits (ผลประโยชน์เฉพาะผังนี้)
  directRewardThisNode: number; // 30% ค่าแนะนำเฉพาะผังนี้
  unilevelRewardThisNode: number; // ยูนิเลเวล 15 ชั้นเฉพาะผังนี้ (2% ต่อชั้น)
  // Cumulative Benefits Across All Nodes of this Owner/ID (ผลประโยชน์สะสมรวมทุกผัง)
  directRewardAllNodes: number; // 30% ค่าแนะนำ (ทุกผัง)
  unilevelRewardAllNodes: number; // ยูนิเลเวล 15 ชั้น (ทุกผัง)
  upgradeRankPool: number; // Upgrade Rank Pool
  newAutoIdPool: number; // New Auto ID Pool (Vault 1-4)
  newExtraIdPool: number; // New Extra ID Pool (Vault 5-18)
  totalClonesCount: number; // จำนวนโคลนนิ่งทั้งหมด
  totalAutoIdCount: number; // จำนวน New Auto ID ทั้งหมด
  totalExtraIdCount: number; // จำนวน New Extra ID ทั้งหมด
  spawnedAutoIds?: number[]; // รายการรหัส Auto ID ที่แตกตัวจากรหัสหลักนี้ (เช่น [11])
  spawnedByMainId?: number; // รหัสหลักต้นทางที่สร้าง Auto ID นี้ (เช่น 1)
  vaultBalance: number;
  nextRankPrice: number;
  familyPoolDirectFromLineage?: number; // 30% จากโคลน #1 ลงซ้ายที่ถูกส่งเข้า Family Pool
  grossVaultFromLineage?: number; // ยอดสะสม Vault รวมก่อนหักออก Auto ID / อัปเกรด
  grossVault1To4FromLineage?: number; // ยอดสะสม Vault รวมทั้ง R1-R4 ก่อนหักออก Auto ID
  thisRankRemainingVault?: number; // ยอดคงเหลือจริงใน nodeUpgradeVault ของ Rank ปัจจุบัน
  vault1To4BreakdownText?: string; // รายละเอียดการสะสมและหัก Auto ID ข้าม Rank 1-3
  vault4To27BreakdownText?: string; // รายละเอียดการสะสมและหัก Extra ID ข้าม Rank 4-18
  targetMainIdCurrentRank?: number; // สถานะ rank ปัจจุบันของ idหลักนั้น
  window5Start?: number; // Rank เริ่มต้นของ 5 rank ย้อนหลัง
  window5End?: number; // Rank สิ้นสุดของ 5 rank ย้อนหลัง
  window5DescriptionTh?: string; // ข้อความอธิบายช่วง 5 rank ย้อนหลัง
  r1MainId?: number; // รหัสหลักต้นสังกัดใน Rank 1 (เฉพาะโหนดที่มาจาก Rank 1 เท่านั้น)
  isExtraLineage?: boolean; // เป็นรหัสหลักอิสระประเภท Extra ID (หรือโคลนที่เกิดจาก Extra ID) ใน Rank 2..18
  extraMainLabel?: string; // ชื่อรหัสหลักอิสระของ Extra ID เช่น "Extra R2-#3" (ไม่ซ้ำกับ Main # ใน Rank 1)
}

interface ConnectorLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isLeft: boolean;
  isFilled: boolean;
}

interface MatrixTreeVisualizerProps {
  language: 'th' | 'en';
  theme?: 'light' | 'dark';
  userAddress: string | null;
  chainId?: number | null;
  isBscTestnet?: boolean;
  usdtBalance?: string;
  allowance?: string;
  onConnectWallet?: () => void;
  onSwitchNetwork?: () => void;
  onApproveUsdt?: (amountUsdt?: number) => Promise<any>;
  onRegisterWithSponsor?: (
    sponsorNodeId: number,
    autoOptions?: {
      targetParentId?: number | string;
      isLeft?: boolean;
      count?: number;
      owner?: string;
    }
  ) => Promise<any>;
  onUpgradeToRank?: (targetRank: number, targetMainId?: number | string) => Promise<any>;
  onAdminUpgrade?: (targetUserOrId: string, targetRank: number) => Promise<any>;
  onOpenRegisterModal?: () => void;
  lastTxSuccess?: string | null;
  refreshTrigger?: any;
  contractAddress?: string;
  currentUserRank?: number;
}

const RPC_ENDPOINTS = [
  BSC_TESTNET_RPC,
  ...BSC_TESTNET_PARAMS.rpcUrls.filter((u) => u !== BSC_TESTNET_RPC),
];

function shortenWallet(addr?: string): string {
  if (!addr || addr === ethers.ZeroAddress) return '0x0000...';
  return `${addr.slice(0, 6)}...`;
}

// Build preview dataset matching all screenshots (including #1..#10 with #7 (7) and Clone #7 #10 #0 รอบ 1)
function buildScreenshotPreviewNodes(rank: number): Map<number, EnrichedBinaryNode> {
  const unitPrice = RANK_PRICES_USDT[rank - 1] || 5;
  const nextPrice = rank < 18 ? RANK_PRICES_USDT[rank] : unitPrice * 2;
  const scale = unitPrice / 5;

  const rawList: EnrichedBinaryNode[] = [
    {
      id: 1,
      rank,
      level: 1,
      parentId: 0,
      isLeft: true,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: ethers.ZeroAddress,
      leftChild: 2,
      rightChild: 3,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 1,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [{ cloneNodeId: 4, round: 1 }],
      directUplineNodeId: 0,
      directRewardThisNode: 3.0 * scale,
      unilevelRewardThisNode: 0.6 * scale,
      directRewardAllNodes: 6.0 * scale,
      unilevelRewardAllNodes: 0.7 * scale,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 2,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 2,
      rank,
      level: 2,
      parentId: 1,
      isLeft: true,
      owner: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 4,
      rightChild: 5,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 2,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [{ cloneNodeId: 6, round: 1 }],
      directUplineNodeId: 1,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.3 * scale,
      directRewardAllNodes: 1.5 * scale,
      unilevelRewardAllNodes: 0.4 * scale,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 1,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 3,
      rank,
      level: 2,
      parentId: 1,
      isLeft: false,
      owner: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 10,
      rightChild: 13,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 3,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 1,
      directRewardThisNode: 1.5 * scale,
      unilevelRewardThisNode: 0.2 * scale,
      directRewardAllNodes: 1.5 * scale,
      unilevelRewardAllNodes: 0.2 * scale,
      upgradeRankPool: 1.75 * scale,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 1.75 * scale,
      nextRankPrice: nextPrice,
    },
    {
      id: 4,
      rank,
      level: 3,
      parentId: 2,
      isLeft: true,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 6,
      rightChild: 0,
      isClone: true,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 1,
      spawnedFromNodeId: 1,
      cloneRound: 1,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 0,
      directRewardThisNode: 1.5 * scale,
      unilevelRewardThisNode: 0.1 * scale,
      directRewardAllNodes: 6.0 * scale,
      unilevelRewardAllNodes: 0.7 * scale,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 2,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 5,
      rank,
      level: 3,
      parentId: 2,
      isLeft: false,
      owner: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      directSponsor: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      leftChild: 0,
      rightChild: 0,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 5,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 2,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 0.0,
      unilevelRewardAllNodes: 0.0,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 6,
      rank,
      level: 4,
      parentId: 4,
      isLeft: true,
      owner: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 0,
      rightChild: 0,
      isClone: true,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 2,
      spawnedFromNodeId: 2,
      cloneRound: 1,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 1,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 1.5 * scale,
      unilevelRewardAllNodes: 0.4 * scale,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 1,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 7,
      rank,
      level: 3,
      parentId: 3,
      isLeft: true,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      leftChild: 8,
      rightChild: 9,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 7,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [{ cloneNodeId: 10, round: 1 }],
      directUplineNodeId: 3,
      directRewardThisNode: 1.5 * scale,
      unilevelRewardThisNode: 0.1 * scale,
      directRewardAllNodes: 1.5 * scale,
      unilevelRewardAllNodes: 0.1 * scale,
      upgradeRankPool: 1.75 * scale,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 1,
      totalAutoIdCount: 1,
      totalExtraIdCount: 0,
      vaultBalance: 1.75 * scale,
      nextRankPrice: nextPrice,
    },
    {
      id: 8,
      rank,
      level: 4,
      parentId: 7,
      isLeft: true,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 0,
      rightChild: 0,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 8,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 7,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 0.0,
      unilevelRewardAllNodes: 0.0,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 9,
      rank,
      level: 4,
      parentId: 7,
      isLeft: false,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 0,
      rightChild: 0,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 9,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 7,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 0.0,
      unilevelRewardAllNodes: 0.0,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 10,
      rank,
      level: 3,
      parentId: 3,
      isLeft: true,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0xd350758257Bee9AdB111944b1737d257620e80CE',
      leftChild: 11,
      rightChild: 12,
      isClone: true,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 1,
      spawnedFromNodeId: 7,
      cloneRound: 1,
      subCloneDepth: 2,
      spawnedCloneIds: [],
      directUplineNodeId: 3,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 1.5 * scale,
      unilevelRewardAllNodes: 0.1 * scale,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 1,
      totalAutoIdCount: 1,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 11,
      rank,
      level: 4,
      parentId: 10,
      isLeft: true,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 0,
      rightChild: 0,
      isClone: false,
      isExtraId: false,
      isAutoMainId: true,
      originMainId: 11,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 10,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 0.0,
      unilevelRewardAllNodes: 0.0,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 12,
      rank,
      level: 4,
      parentId: 10,
      isLeft: false,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 0,
      rightChild: 0,
      isClone: false,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 12,
      spawnedFromNodeId: 0,
      cloneRound: 0,
      subCloneDepth: 0,
      spawnedCloneIds: [],
      directUplineNodeId: 10,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 0.0,
      unilevelRewardAllNodes: 0.0,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
    {
      id: 13,
      rank,
      level: 3,
      parentId: 3,
      isLeft: false,
      owner: '0x5b0791A0bc71900238de668C848D700D',
      directSponsor: '0x5b0791A0bc71900238de668C848D700D',
      leftChild: 0,
      rightChild: 0,
      isClone: true,
      isExtraId: false,
      isAutoMainId: false,
      originMainId: 1,
      spawnedFromNodeId: 10,
      cloneRound: 2,
      subCloneDepth: 3,
      spawnedCloneIds: [],
      directUplineNodeId: 3,
      directRewardThisNode: 0.0,
      unilevelRewardThisNode: 0.0,
      directRewardAllNodes: 0.0,
      unilevelRewardAllNodes: 0.0,
      upgradeRankPool: 0.0,
      newAutoIdPool: 0.0,
      newExtraIdPool: 0.0,
      totalClonesCount: 0,
      totalAutoIdCount: 0,
      totalExtraIdCount: 0,
      vaultBalance: 0.0,
      nextRankPrice: nextPrice,
    },
  ];

  const map = new Map<number, EnrichedBinaryNode>();
  for (const item of rawList) {
    map.set(item.id, item);
  }
  return map;
}

export const MatrixTreeVisualizer: React.FC<MatrixTreeVisualizerProps> = ({
  language,
  userAddress,
  isBscTestnet = false,
  usdtBalance = '0.00',
  allowance = '0.00',
  onApproveUsdt,
  onRegisterWithSponsor,
  onUpgradeToRank,
  onAdminUpgrade,
  onOpenRegisterModal,
  lastTxSuccess,
  refreshTrigger,
  contractAddress,
  currentUserRank = 1,
}) => {
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const {
    isConnected: isWsConnected,
    retryCount: wsRetryCount,
    nextRetryInSeconds: wsNextRetrySec,
    manualReconnect: wsManualReconnect,
  } = useMatrixWebSocket(selectedRank);
  const [rankNodeCounts, setRankNodeCounts] = useState<Record<number, number>>({});
  const [focusRootId, setFocusRootId] = useState<number>(1);
  const [navigationHistory, setNavigationHistory] = useState<number[]>([1]);
  const [searchInput, setSearchInput] = useState<string>('1');
  const [zoomScale, setZoomScale] = useState<number>(0.55);
  const [viewMode, setViewMode] = useState<'onchain' | 'demoCloneTree'>('onchain');
  const [justUpdatedBadge, setJustUpdatedBadge] = useState<boolean>(false);
  // ค่าเริ่มต้นเพดานความลึกของผัง 15 ชั้น และค่าเริ่มต้นการแสดงชั้นแบบขยาย 4 ชั้น
  const MAX_TREE_DEPTH = 15;
  const DEFAULT_EXPANDED_DEPTH = 4;
  const [maxRenderDepth, setMaxRenderDepth] = useState<number>(15);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<number>>(new Set());
  const hasUserInteractedCollapseRef = useRef<boolean>(false);
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<number | null>(null);
  const [highlightedStatusFilter, setHighlightedStatusFilter] = useState<'all' | 'main' | 'auto' | 'extra' | 'clone'>('all');
  const [isDraggingTree, setIsDraggingTree] = useState<boolean>(false);

  // Real-Time Auto Sync State (Default: 15 seconds for smooth, stable automatic tree extension)
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(true);
  const [realtimeInterval, setRealtimeInterval] = useState<number>(15); // 15 seconds
  const [realtimeCountdown, setRealtimeCountdown] = useState<number>(15);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [isLiveSyncing, setIsLiveSyncing] = useState<boolean>(false);
  const isTreeSyncInFlightRef = useRef<boolean>(false);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);

  // Track newly arrived nodes to highlight & auto-extend in the Binary Tree
  const knownNodeIdsByRankRef = useRef<Map<number, Set<number>>>(new Map());
  const [newlyAddedNodeIds, setNewlyAddedNodeIds] = useState<Set<number>>(new Set());
  const [autoFollowNewNodes, setAutoFollowNewNodes] = useState<boolean>(true);
  const [latestNewNodeAlert, setLatestNewNodeAlert] = useState<{
    id: number;
    originMainId: number;
    parentId: number;
    isLeft: boolean;
    level: number;
    isClone: boolean;
    addedCount: number;
    timestamp: string;
  } | null>(null);

  // Registration Popup Modal State & Referral Link State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [regSponsorId, setRegSponsorId] = useState<number>(() => getActiveReferralSponsorId() || 1);
  const [selectedReferralNodeId, setSelectedReferralNodeId] = useState<number>(() => getActiveReferralSponsorId() || 1);
  const [copiedReferralKey, setCopiedReferralKey] = useState<string | null>(null);
  const [regTargetParentId, setRegTargetParentId] = useState<number | string | undefined>(undefined);
  const [regIsLeft, setRegIsLeft] = useState<boolean | undefined>(undefined);
  const [regNodeCount, setRegNodeCount] = useState<number>(1);
  const [regIsApproving, setRegIsApproving] = useState<boolean>(false);
  const [regIsSubmitting, setRegIsSubmitting] = useState<boolean>(false);
  const [regTxMessage, setRegTxMessage] = useState<string | null>(null);
  const [regTxError, setRegTxError] = useState<string | null>(null);

  const openRegisterModal = (sponsorId: number, parentId?: number | string, isLeft?: boolean) => {
    const resolvedSponsor = sponsorId || getActiveReferralSponsorId() || 1;
    setRegSponsorId(resolvedSponsor);
    setActiveReferralSponsorId(resolvedSponsor);
    setRegTargetParentId(parentId);
    setRegIsLeft(isLeft);
    setRegNodeCount(1);
    setRegTxError(null);
    setRegTxMessage(null);
    setIsRegisterModalOpen(true);
  };

  const copyReferralLink = (nodeId: number | string, key?: string) => {
    const cleanId = Math.max(1, parseInt(String(nodeId).replace(/[^0-9]/g, ''), 10) || 1);
    const link = buildReferralLink(cleanId);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    const statusKey = key || `ref-${cleanId}`;
    setCopiedReferralKey(statusKey);
    setTimeout(() => {
      setCopiedReferralKey((prev) => (prev === statusKey ? null : prev));
    }, 2200);
    emitTransactionToast({
      id: `copy-ref-${Date.now()}`,
      status: 'confirmed',
      step:
        language === 'th'
          ? `🔗 คัดลอกลิ้งผู้แนะนำ รหัส #${cleanId} สำเร็จ!`
          : `🔗 Copied Referral Link for Node #${cleanId}!`,
      message: link,
    });
  };

  const shareReferralLink = async (nodeId: number | string) => {
    const cleanId = Math.max(1, parseInt(String(nodeId).replace(/[^0-9]/g, ''), 10) || 1);
    const link = buildReferralLink(cleanId);
    const shareTitle = `FractalFlowMatrix27 — ลิ้งผู้แนะนำรหัส #${cleanId}`;
    const shareText = `สมัครสมาชิก FractalFlowMatrix27 ต่อสายผู้แนะนำตรง รหัส #${cleanId} ผ่านลิ้งนี้: ${link}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: link,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    copyReferralLink(cleanId, `share-${cleanId}`);
  };

  const formatModalRowTime = useCallback(
    (isoOrTime?: string) => {
      if (!isoOrTime) return lastSyncTime || '-';
      try {
        const d = new Date(isoOrTime);
        if (isNaN(d.getTime())) return isoOrTime;
        return d.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
          timeZone: 'Asia/Bangkok',
          hour12: false,
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        return isoOrTime;
      }
    },
    [language, lastSyncTime]
  );

  const handleModalApproveUsdt = async () => {
    if (!onApproveUsdt) return;
    setRegIsApproving(true);
    setRegTxError(null);
    const toastId = `modal-approve-${Date.now()}`;
    emitTransactionToast({
      id: toastId,
      status: 'pending',
      step: language === 'th' ? 'กำลังอนุมัติวงเงิน USDT บนบล็อกเชน...' : 'Approving USDT on Blockchain...',
      message: `${regNodeCount * (RANK_PRICES_USDT[0] || 5)} USDT`,
    });
    try {
      await onApproveUsdt(regNodeCount * (RANK_PRICES_USDT[0] || 5));
      const msg = language === 'th' ? 'อนุมัติ USDT บนบล็อกเชนสำเร็จเรียบร้อย!' : 'USDT Approved successfully!';
      setRegTxMessage(msg);
      emitTransactionToast({
        id: toastId,
        status: 'confirmed',
        step: language === 'th' ? 'อนุมัติ USDT สำเร็จ (Confirmed)' : 'USDT Approval Confirmed',
        message: msg,
      });
    } catch (err: any) {
      const errMsg = err?.message || 'Approve failed';
      setRegTxError(errMsg);
      emitTransactionToast({
        id: toastId,
        status: 'error',
        step: language === 'th' ? 'การอนุมัติ USDT ล้มเหลว' : 'USDT Approval Failed',
        message: errMsg,
      });
    } finally {
      setRegIsApproving(false);
    }
  };

  const handleModalSubmitRegister = async () => {
    if (!onRegisterWithSponsor) return;
    setRegIsSubmitting(true);
    setRegTxError(null);
    const pendingMsg =
      language === 'th'
        ? 'กำลังส่งคำสั่งลงทะเบียนรหัสสมาชิก...'
        : 'Submitting registration...';
    setRegTxMessage(pendingMsg);
    const toastId = `modal-register-${Date.now()}`;
    emitTransactionToast({
      id: toastId,
      status: 'pending',
      step: pendingMsg,
      message:
        language === 'th'
          ? `ผู้แนะนำ #${regSponsorId}${regTargetParentId ? ` • วางใต้ #${regTargetParentId}` : ''} (${regNodeCount} รหัส)`
          : `Sponsor #${regSponsorId} (${regNodeCount} ID)`,
    });
    try {
      await onRegisterWithSponsor(regSponsorId, {
        targetParentId: regTargetParentId,
        isLeft: regIsLeft,
        count: regNodeCount,
        owner: userAddress || undefined,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrix:tree:refresh'));
      }
      const okMsg =
        language === 'th' ? 'สมัครสมาชิกสำเร็จเรียบร้อยแล้ว!' : 'Registration confirmed!';
      setRegTxMessage(okMsg);
      emitTransactionToast({
        id: toastId,
        status: 'confirmed',
        step: language === 'th' ? 'ยืนยันการสมัครสมาชิกสำเร็จ!' : 'Registration Confirmed!',
        message: okMsg,
      });
      setTimeout(() => {
        setIsRegisterModalOpen(false);
      }, 1200);
    } catch (err: any) {
      const errMsg = err?.message || 'Registration failed';
      setRegTxError(errMsg);
      emitTransactionToast({
        id: toastId,
        status: 'error',
        step: language === 'th' ? 'การสมัครสมาชิกไม่สำเร็จ' : 'Registration Failed',
        message: errMsg,
      });
    } finally {
      setRegIsSubmitting(false);
    }
  };

  // Track which Node ID currently has its "รายละเอียดผลประโยชน์" (Benefit Details) popup modal open
  const [expandedBenefitNodeId, setExpandedBenefitNodeId] = useState<number | null>(null);
  const [benefitModalTab, setBenefitModalTab] = useState<
    'all' | 'direct30' | 'level30' | 'vault35' | 'auto_extra'
  >('all');
  const [modalSectionPages, setModalSectionPages] = useState<Record<string, number>>({});
  const [perIdReportsMap, setPerIdReportsMap] = useState<Map<number, any>>(new Map());
  const [systemPoolsData, setSystemPoolsData] = useState<any>(null);
  const [isSystemPoolsModalOpen, setIsSystemPoolsModalOpen] = useState<boolean>(false);
  const [systemPoolsModalTab, setSystemPoolsModalTab] = useState<'all' | 'allsell' | 'family'>('all');
  const [isRunningAllSellAuto, setIsRunningAllSellAuto] = useState<boolean>(false);
  const [allSellAutoMsg, setAllSellAutoMsg] = useState<string | null>(null);
  const [isAutoExtraAlertModalOpen, setIsAutoExtraAlertModalOpen] = useState<boolean>(false);
  const [autoExtraAlertTab, setAutoExtraAlertTab] = useState<
    'all' | 'auto' | 'extra' | 'pool' | 'mine'
  >('all');
  const [autoExtraSearchQuery, setAutoExtraSearchQuery] = useState<string>('');
  const [isAutoExtraPopupEnabled, setIsAutoExtraPopupEnabled] = useState<boolean>(false);
  const [unreadAutoExtraCount, setUnreadAutoExtraCount] = useState<number>(0);
  const [liveAutoExtraToast, setLiveAutoExtraToast] = useState<{
    id: number;
    rank: number;
    category: 'AUTO_ID' | 'EXTRA_ID' | 'POOL_READY';
    title: string;
    subtitle: string;
    sourceMainId: number;
    parentId: number;
    side: 'LEFT' | 'RIGHT' | 'ROOT';
    owner: string;
    amountUsdt: number;
    timestamp: string;
  } | null>(null);
  const knownAutoExtraKeysRef = useRef<Set<string>>(new Set());
  const hasInitAutoExtraKeysRef = useRef<boolean>(false);
  const [modalUpgradeTargetRank, setModalUpgradeTargetRank] = useState<number>(2);
  const [isModalUpgrading, setIsModalUpgrading] = useState<boolean>(false);
  const [modalUpgradeMessage, setModalUpgradeMessage] = useState<string | null>(null);
  const [modalUpgradeError, setModalUpgradeError] = useState<string | null>(null);
  const [isWalletIdsModalOpen, setIsWalletIdsModalOpen] = useState<boolean>(false);
  const [selectedInspectWallet, setSelectedInspectWallet] = useState<string>('');
  const [walletIdsStatusFilter, setWalletIdsStatusFilter] = useState<'all' | 'main' | 'auto' | 'extra' | 'clone'>('all');
  const [vaultLedgerFilter, setVaultLedgerFilter] = useState<'all' | 'in' | 'out'>('all');

  // Compact 3-Level "ผังต้นไม้ (Matrix Tree View • 3 ชั้น)" state (alongside the full Binary Tree)
  const buildInitial3LevelMatrixNodes = () => [
    { id: 1, parentId: 0, isLeft: true, isClone: false, originMainId: 1, r1MainId: 1, cloneRound: 0, owner: '0x7B900000000000000000000000000000000042A1', leftChild: 2, rightChild: 3 },
    { id: 2, parentId: 1, isLeft: true, isClone: false, originMainId: 2, r1MainId: 2, cloneRound: 0, owner: '0x31A00000000000000000000000000000000088F4', leftChild: 4, rightChild: 5 },
    { id: 3, parentId: 1, isLeft: false, isClone: true, originMainId: 1, r1MainId: 1, cloneRound: 1, owner: '0x7B900000000000000000000000000000000042A1', leftChild: 6, rightChild: 0 },
    { id: 4, parentId: 2, isLeft: true, isClone: false, originMainId: 4, r1MainId: 4, cloneRound: 0, owner: '0x14C00000000000000000000000000000000090B1', leftChild: 0, rightChild: 0 },
    { id: 5, parentId: 2, isLeft: false, isClone: false, originMainId: 5, r1MainId: 5, cloneRound: 0, owner: '0x88E00000000000000000000000000000000021A3', leftChild: 0, rightChild: 0 },
    { id: 6, parentId: 3, isLeft: true, isClone: true, originMainId: 1, r1MainId: 1, cloneRound: 1, owner: '0x7B900000000000000000000000000000000042A1', leftChild: 0, rightChild: 0 },
  ];

  const [compactTreeMode, setCompactTreeMode] = useState<'demo' | 'live'>('demo');
  const [compactTreeRootId, setCompactTreeRootId] = useState<number>(1);
  const [compactTreeZoom, setCompactTreeZoom] = useState<number>(0.95);
  const [compactMaxDisplayLevels, setCompactMaxDisplayLevels] = useState<number>(3);
  const [compactSimNodes, setCompactSimNodes] = useState<
    Array<{
      id: number;
      parentId: number;
      isLeft: boolean;
      isClone: boolean;
      originMainId: number;
      r1MainId?: number;
      cloneRound?: number;
      isAutoMainId?: boolean;
      isExtraId?: boolean;
      isExtraLineage?: boolean;
      extraMainLabel?: string;
      owner: string;
      leftChild: number;
      rightChild: number;
    }>
  >(() => buildInitial3LevelMatrixNodes());

  const handleSimulateAddCompactNode = (specificParentId?: number, specificIsLeft?: boolean) => {
    setCompactSimNodes((prev) => {
      const nextList = prev.map((n) => ({ ...n }));
      const map = new Map<number, (typeof nextList)[0]>();
      nextList.forEach((n) => map.set(n.id, n));

      const nextId = nextList.reduce((max, n) => Math.max(max, n.id), 0) + 1;
      const demoWallets = [
        '0x9F200000000000000000000000000000000055C8',
        '0x4D800000000000000000000000000000000071E9',
        '0x6A100000000000000000000000000000000039B2',
        '0x2C700000000000000000000000000000000084D0',
        '0x5E300000000000000000000000000000000012F6',
      ];

      let targetParent: (typeof nextList)[0] | undefined;
      let placeLeft = true;

      if (specificParentId && map.has(specificParentId)) {
        const p = map.get(specificParentId)!;
        if (specificIsLeft && p.leftChild === 0) {
          targetParent = p;
          placeLeft = true;
        } else if (!specificIsLeft && p.rightChild === 0) {
          targetParent = p;
          placeLeft = false;
        }
      }

      if (!targetParent) {
        // BFS from current compactTreeRootId first, fallback to 1
        const queue: Array<{ id: number; depth: number }> = [
          { id: compactTreeRootId, depth: 1 },
          { id: 1, depth: 1 },
        ];
        const visited = new Set<number>();
        while (queue.length > 0) {
          const item = queue.shift()!;
          if (visited.has(item.id)) continue;
          visited.add(item.id);
          const curr = map.get(item.id);
          if (!curr) continue;
          if (item.depth < 15) {
            if (curr.leftChild === 0) {
              targetParent = curr;
              placeLeft = true;
              break;
            }
            if (curr.rightChild === 0) {
              targetParent = curr;
              placeLeft = false;
              break;
            }
            queue.push(
              { id: curr.leftChild, depth: item.depth + 1 },
              { id: curr.rightChild, depth: item.depth + 1 }
            );
          }
        }
      }

      if (!targetParent) return prev;

      const isCloneSpawn = !placeLeft;
      const newOwner = isCloneSpawn
        ? targetParent.owner
        : demoWallets[(nextId + demoWallets.length) % demoWallets.length];
      const newOriginMainId = isCloneSpawn
        ? targetParent.originMainId || targetParent.id
        : nextId;

      const newNode = {
        id: nextId,
        parentId: targetParent.id,
        isLeft: placeLeft,
        isClone: isCloneSpawn,
        originMainId: newOriginMainId,
        r1MainId: newOriginMainId,
        cloneRound: isCloneSpawn ? (targetParent.cloneRound || 0) + 1 : 0,
        owner: newOwner,
        leftChild: 0,
        rightChild: 0,
      };

      if (placeLeft) {
        targetParent.leftChild = nextId;
      } else {
        targetParent.rightChild = nextId;
      }

      nextList.push(newNode);
      return nextList;
    });
  };

  const fetchPerIdHistoryForModal = useCallback(async () => {
    try {
      const res = await fetch('/api/matrix/per-id-history');
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          if (Array.isArray(data.reports)) {
            const map = new Map<number, any>();
            for (const rep of data.reports) {
              map.set(Number(rep.id), rep);
            }
            setPerIdReportsMap(map);
          }
          if (data.systemPools) {
            setSystemPoolsData(data.systemPools);
          }
        }
      } else {
        throw new Error(`HTTP ${res.status} on /api/matrix/per-id-history`);
      }
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('matrix:network:error', {
            detail: { error: err, source: 'per-id-history-refresh' },
          })
        );
      }
    }
  }, []);

  useEffect(() => {
    if (userAddress) {
      setSelectedInspectWallet(userAddress);
    }
    fetchPerIdHistoryForModal();
  }, [fetchPerIdHistoryForModal, selectedRank, refreshTrigger, lastTxSuccess, userAddress]);

  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(true);
  const [hasInitialTreeLoaded, setHasInitialTreeLoaded] = useState<boolean>(false);
  const [totalNodesInRank, setTotalNodesInRank] = useState<number>(1);
  const [onChainNodesMap, setOnChainNodesMap] = useState<Map<number, EnrichedBinaryNode>>(new Map());
  const [multiRankSnapshotsState, setMultiRankSnapshotsState] = useState<Map<number, Map<number, SimRawNode>>>(
    new Map()
  );
  const [isPathCalculatorOpen, setIsPathCalculatorOpen] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isSecondaryWidgetsCollapsed, setIsSecondaryWidgetsCollapsed] = useState<boolean>(false);
  const [secondaryWidgetsTab, setSecondaryWidgetsTab] = useState<'pools' | 'calculator' | 'alerts'>('pools');
  const [isConnectionAlertDismissed, setIsConnectionAlertDismissed] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeLocks, setActiveLocks] = useState<
    Array<{ parentId: string; isLeft: boolean; owner: string }>
  >([]);

  useEffect(() => {
    const fetchLocks = async () => {
      try {
        const res = await fetch('/api/queue/status');
        if (res.ok) {
          const data = await res.json();
          if (data.activeReservations && Array.isArray(data.activeReservations)) {
            const now = Date.now();
            const locks: Array<{ parentId: string; isLeft: boolean; owner: string }> = [];
            for (const r of data.activeReservations) {
              if (r.status === 'RESERVED' && now <= r.expiresAt && r.rank === selectedRank) {
                for (const b of r.batchDetails) {
                  locks.push({
                    parentId: String(b.targetParentId),
                    isLeft: Boolean(b.isLeft),
                    owner: b.owner,
                  });
                }
              }
            }
            setActiveLocks((prev) => {
              if (prev.length === 0 && locks.length === 0) return prev;
              if (
                prev.length === locks.length &&
                prev.every(
                  (p, idx) =>
                    p.parentId === locks[idx].parentId &&
                    p.isLeft === locks[idx].isLeft &&
                    p.owner === locks[idx].owner
                )
              ) {
                return prev;
              }
              return locks;
            });
          }
        } else {
          throw new Error(`HTTP ${res.status} on /api/queue/status`);
        }
      } catch (err) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('matrix:network:error', {
              detail: { error: err, source: 'queue-status-refresh' },
            })
          );
        }
      }
    };

    fetchLocks();
    const interval = setInterval(fetchLocks, 8000);
    return () => clearInterval(interval);
  }, [selectedRank]);

  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const treeContentRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    hasMoved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    hasMoved: false,
  });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(0.55);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState<boolean>(false);
  const [scrollProgressPercent, setScrollProgressPercent] = useState<number>(50);
  const [isTouchScrolling, setIsTouchScrolling] = useState<boolean>(false);
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);
  const [isCloneStatusPopupOpen, setIsCloneStatusPopupOpen] = useState<boolean>(false);
  const [isLevelSummaryPopupOpen, setIsLevelSummaryPopupOpen] = useState<boolean>(false);
  const cachedRpcProviderRef = useRef<ethers.JsonRpcProvider | null>(null);

  // Mouse drag-to-pan across the Interactive Binary Tree viewport
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.active) return;
      const viewportEl = scrollViewportRef.current;
      if (!viewportEl) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      if (!dragStateRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragStateRef.current.hasMoved = true;
        setIsDraggingTree(true);
      }
      if (dragStateRef.current.hasMoved) {
        viewportEl.scrollLeft = dragStateRef.current.scrollLeft - dx;
        viewportEl.scrollTop = dragStateRef.current.scrollTop - dy;
      }
    };

    const handleWindowMouseUp = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      setIsDraggingTree(false);
      setTimeout(() => {
        dragStateRef.current.hasMoved = false;
      }, 30);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  // Ctrl/Cmd + Mouse Wheel zoom inside the tree viewport
  useEffect(() => {
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    const handleWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoomScale((z) => Math.max(0.25, Math.min(1.5, Number((z + delta).toFixed(2)))));
    };
    viewportEl.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      viewportEl.removeEventListener('wheel', handleWheelZoom);
    };
  }, [hasInitialTreeLoaded]);

  useEffect(() => {
    hasUserInteractedCollapseRef.current = false;
  }, [selectedRank, viewMode, focusRootId]);

  useEffect(() => {
    setSelectedTreeNodeId(null);
  }, [selectedRank, viewMode]);

  const getWorkingProvider = useCallback(async (): Promise<ethers.Provider> => {
    if (typeof window !== 'undefined' && window.ethereum && isBscTestnet) {
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        await browserProvider.getBlockNumber();
        return browserProvider;
      } catch {
        // Fallback to RPC
      }
    }

    if (cachedRpcProviderRef.current) {
      return cachedRpcProviderRef.current;
    }

    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        const rpcProvider = new ethers.JsonRpcProvider(
          rpcUrl,
          { chainId: 97, name: 'bnbt' },
          { staticNetwork: true, polling: false, batchMaxCount: 1 }
        );
        rpcProvider.on('error', () => {});
        await rpcProvider.getBlockNumber();
        cachedRpcProviderRef.current = rpcProvider;
        return rpcProvider;
      } catch {
        continue;
      }
    }

    const fallbackProvider = new ethers.JsonRpcProvider(
      BSC_TESTNET_RPC,
      { chainId: 97, name: 'bnbt' },
      { staticNetwork: true, polling: false, batchMaxCount: 1 }
    );
    fallbackProvider.on('error', () => {});
    cachedRpcProviderRef.current = fallbackProvider;
    return fallbackProvider;
  }, [isBscTestnet]);

  // Load all nodes in the selected rank from Smart Contract / Database & compute Clone Lineage + Benefit Breakdown
  const loadOnChainTree = useCallback(
    async (
      targetRankParam?: number,
      options?: { silent?: boolean; forceSync?: boolean }
    ) => {
      const activeRank = targetRankParam !== undefined ? targetRankParam : selectedRank;
      const isSilent = Boolean(options?.silent);
      const forceSync = Boolean(options?.forceSync);

      if (isTreeSyncInFlightRef.current && isSilent && !forceSync) {
        return;
      }
      isTreeSyncInFlightRef.current = true;

      if (!isSilent) {
        setIsLoadingTree(true);
      } else {
        setIsLiveSyncing(true);
      }

      try {
        const activeContract = contractAddress || CONTRACT_ADDRESS;
        let lazyContract: ethers.Contract | null = null;
        const getFallbackContract = async (): Promise<ethers.Contract> => {
          if (!lazyContract) {
            const provider = await getWorkingProvider();
            lazyContract = new ethers.Contract(activeContract, MATRIX_ABI, provider);
          }
          return lazyContract;
        };

        const unitPrice = RANK_PRICES_USDT[activeRank - 1] || 5;
        const nextPrice = activeRank < 18 ? RANK_PRICES_USDT[activeRank] : unitPrice * 2;
        const directBonusUnit = unitPrice * 0.3; // 30%
        const unilevelBonusUnit = unitPrice * 0.02; // 2% per level (15 levels)
        const vaultUnit = unitPrice * 0.35; // 35%

        let totalNodes = 1;
        let loadedFromApi = false;

        const rawNodes = new Map<
          number,
          {
            id: number;
            owner: string;
            directSponsor: string;
            parentId: number;
            leftChild: number;
            rightChild: number;
            isClone: boolean;
            isExtraId: boolean;
            isAdminFreeUpgrade?: boolean;
          }
        >();
        const onChainOriginMap = new Map<number, number>();
        const onChainNodeVaultMap = new Map<number, number>();
        const onChainSponsorNodeMap = new Map<number, number>();
        const onChainCloneRoundMap = new Map<number, number>();
        const onChainOriginTypeMap = new Map<number, string>();

        let fetchedRankCounts: Record<number, number> = {};

        // 1. First attempt: High-speed Database + incremental chain sync endpoint & rank counts in parallel
        try {
          const [res, countsRes] = await Promise.all([
            fetch(
              `/api/matrix/tree-nodes?rank=${activeRank}&contract=${activeContract}${
                forceSync ? '&forceSync=1' : ''
              }`
            ),
            fetch(
              `/api/matrix/rank-counts?contract=${activeContract}${forceSync ? '&forceSync=1' : ''}`
            ).catch(() => null),
          ]);

          if (countsRes && countsRes.ok) {
            const countsData = await countsRes.json().catch(() => null);
            if (countsData?.success && countsData.counts) {
              fetchedRankCounts = countsData.counts;
              setRankNodeCounts((prev) => ({ ...prev, ...countsData.counts }));
            }
          }

          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.nodes) && data.nodes.length > 0) {
              totalNodes = Number(data.totalNodes || data.nodes.length);
              setTotalNodesInRank(totalNodes);
              fetchedRankCounts[activeRank] = totalNodes;
              setRankNodeCounts((prev) => ({ ...prev, [activeRank]: totalNodes }));
              for (const item of data.nodes) {
                const nid = Number(item.id);
                if (nid > 0) {
                  rawNodes.set(nid, {
                    id: nid,
                    owner: String(item.owner || ethers.ZeroAddress),
                    directSponsor: String(item.directSponsor || ethers.ZeroAddress),
                    parentId: Number(item.parentId || 0),
                    leftChild: Number(item.leftChild || 0),
                    rightChild: Number(item.rightChild || 0),
                    isClone: Boolean(item.isClone),
                    isExtraId: Boolean(item.isExtraId) && !Boolean(item.isClone),
                    isAdminFreeUpgrade: Boolean(item.isAdminFreeUpgrade),
                  });
                  if (Number(item.originMainId) > 0) {
                    onChainOriginMap.set(nid, Number(item.originMainId));
                  }
                  if (Number(item.directSponsorNodeId) > 0) {
                    onChainSponsorNodeMap.set(nid, Number(item.directSponsorNodeId));
                  }
                  if (Number(item.cloneRound) > 0) {
                    onChainCloneRoundMap.set(nid, Number(item.cloneRound));
                  }
                  if (item.originType) {
                    onChainOriginTypeMap.set(nid, String(item.originType));
                  }
                  onChainNodeVaultMap.set(nid, Number(item.nodeVault || 0));
                }
              }
              loadedFromApi = true;
            }
          } else {
            throw new Error(`Backend API returned status ${res.status}`);
          }
        } catch (apiErr) {
          // Notify auto-reconnect hook when a network error occurs during the Matrix refresh interval
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('matrix:network:error', {
                detail: { error: apiErr, source: 'matrix-tree-nodes-refresh' },
              })
            );
          }
          // Fallback to RPC below
        }

        // 2. Fallback: Chunked direct RPC calls (only used if backend Database API is unreachable)
        if (!loadedFromApi) {
          const contract = await getFallbackContract();
          try {
            const totalBn: bigint = await contract.totalNodesInRank(activeRank);
            totalNodes = Number(totalBn);
          } catch {
            totalNodes = 1;
          }
          setTotalNodesInRank(totalNodes);

          try {
            const countsResults = await Promise.all(
              Array.from({ length: 18 }, (_, i) =>
                contract
                  .totalNodesInRank(i + 1)
                  .then((v: bigint) => Number(v))
                  .catch(() => 0)
              )
            );
            const countsMap: Record<number, number> = {};
            countsResults.forEach((c, idx) => {
              countsMap[idx + 1] = c;
            });
            countsMap[activeRank] = totalNodes;
            fetchedRankCounts = countsMap;
            setRankNodeCounts((prev) => ({ ...prev, ...countsMap }));
          } catch {
            // Ignore count fallback error
          }

          const maxFetch = Math.min(Math.max(totalNodes, 1), 300);
          const idsToFetch = Array.from({ length: maxFetch }, (_, idx) => idx + 1);
          const CHUNK_SIZE = 6;

          for (let i = 0; i < idsToFetch.length; i += CHUNK_SIZE) {
            const chunk = idsToFetch.slice(i, i + CHUNK_SIZE);
            await Promise.all(
              chunk.map(async (nodeId) => {
                try {
                  const [raw, origBn, vaultBn, sponsorNodeBn, cloneRoundBn] = await Promise.all([
                    contract.rankNodes(activeRank, nodeId),
                    contract.nodeOriginMainId(activeRank, nodeId).catch(() => 0n),
                    contract.nodeUpgradeVault(activeRank, nodeId).catch(() => 0n),
                    contract.nodeDirectSponsorNodeId(activeRank, nodeId).catch(() => 0n),
                    contract.nodeCloneRound(activeRank, nodeId).catch(() => 0n),
                  ]);
                  const fetchedId = Number(raw.id ?? raw[0] ?? 0);
                  if (fetchedId > 0) {
                    rawNodes.set(fetchedId, {
                      id: fetchedId,
                      owner: String(raw.owner ?? raw[1] ?? ethers.ZeroAddress),
                      directSponsor: String(raw.directSponsor ?? raw[2] ?? ethers.ZeroAddress),
                      parentId: Number(raw.parentId ?? raw[3] ?? 0),
                      leftChild: Number(raw.leftChild ?? raw[4] ?? 0),
                      rightChild: Number(raw.rightChild ?? raw[5] ?? 0),
                      isClone: Boolean(raw.isClone ?? raw[6] ?? false),
                      isExtraId: Boolean(raw.isExtraId ?? raw[7] ?? false),
                    });
                    if (Number(origBn) > 0) {
                      onChainOriginMap.set(fetchedId, Number(origBn));
                    }
                    if (Number(sponsorNodeBn) > 0) {
                      onChainSponsorNodeMap.set(fetchedId, Number(sponsorNodeBn));
                    }
                    if (Number(cloneRoundBn) > 0) {
                      onChainCloneRoundMap.set(fetchedId, Number(cloneRoundBn));
                    }
                    const dec = vaultBn >= 100000000000000n ? 18 : 6;
                    onChainNodeVaultMap.set(fetchedId, Number(ethers.formatUnits(vaultBn, dec)));
                  }
                } catch {
                  // Ignore individual slot read error
                }
              })
            );
          }
        }

        // Guarantee Root Node #1 is always present for Ranks 1..18
        if (!rawNodes.has(1)) {
          let fallbackRootOwner = '0x622E20082e63c7220c5AF0A77Cbc437a98505311';
          if (!loadedFromApi) {
            try {
              const contract = await getFallbackContract();
              const r1Root = await contract.rankNodes(1, 1);
              const r1Owner = String(r1Root.owner ?? r1Root[1] ?? '');
              if (r1Owner && r1Owner !== ethers.ZeroAddress) {
                fallbackRootOwner = r1Owner;
              }
            } catch {
              // Use default root owner
            }
          }
          rawNodes.set(1, {
            id: 1,
            owner: fallbackRootOwner,
            directSponsor: ethers.ZeroAddress,
            parentId: 0,
            leftChild: 0,
            rightChild: 0,
            isClone: false,
            isExtraId: false,
          });
        }

        // Self-healing Canonical Parent-Child Linker:
        // Group all children by parentId, sort by clone round (Round 1 strictly on Left, Round 2 on Right) or ID ascending,
        // and assign leftChild = child[0], rightChild = child[1].
        const rawSortedIds = Array.from(rawNodes.keys()).sort((a, b) => a - b);
        const childrenByParent = new Map<number, number[]>();
        for (const cid of rawSortedIds) {
          if (cid <= 1) continue;
          const childObj = rawNodes.get(cid);
          if (!childObj || childObj.parentId <= 0) continue;
          if (!rawNodes.has(childObj.parentId)) continue;
          const list = childrenByParent.get(childObj.parentId) || [];
          list.push(cid);
          childrenByParent.set(childObj.parentId, list);
        }

        for (const [pId, childIds] of childrenByParent.entries()) {
          const parentObj = rawNodes.get(pId);
          if (!parentObj) continue;
          childIds.sort((a, b) => a - b);
          parentObj.leftChild = childIds[0] || 0;
          parentObj.rightChild = childIds[1] || 0;
        }

        for (const pObj of rawNodes.values()) {
          if (!childrenByParent.has(pObj.id)) {
            if (pObj.leftChild > 0 && !rawNodes.has(pObj.leftChild)) pObj.leftChild = 0;
            if (pObj.rightChild > 0 && !rawNodes.has(pObj.rightChild)) pObj.rightChild = 0;
          } else {
            const cList = childrenByParent.get(pObj.id)!;
            if (cList.length < 2) pObj.rightChild = 0;
          }
        }

      // Fetch cross-rank snapshots for Ranks 1..7 (for Vault pools R1-3 & R4-18), all populated ranks (count > 1), and activeRank / activeRank + 1
      const ranksToSnapshot = new Set<number>([1, 2, 3, 4, 5, 6, 7]);
      ranksToSnapshot.add(activeRank);
      if (activeRank < 18) {
        ranksToSnapshot.add(activeRank + 1);
      }
      Object.entries({ ...rankNodeCounts, ...fetchedRankCounts }).forEach(([rKey, countVal]) => {
        const rNum = Number(rKey);
        if (rNum >= 1 && rNum <= 18 && Number(countVal) > 1) {
          ranksToSnapshot.add(rNum);
        }
      });

      interface RankNodeSnapshot {
        id: number;
        owner: string;
        directSponsor: string;
        parentId: number;
        leftChild: number;
        rightChild: number;
        isClone: boolean;
        isExtraId: boolean;
        isAdminFreeUpgrade?: boolean;
        originMainId: number;
        directSponsorNodeId: number;
        nodeVault: number;
        originType?: string;
      }

      const multiRankSnapshots = new Map<number, Map<number, RankNodeSnapshot>>();
      let snapshotNodesByRank: Record<number, any[]> | null = null;
      try {
        const snapRes = await fetch('/api/db/snapshot');
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData?.success && snapData.nodesByRank) {
            snapshotNodesByRank = snapData.nodesByRank;
            for (const [rKey, rArr] of Object.entries(snapData.nodesByRank)) {
              const rNum = Number(rKey);
              if (rNum >= 1 && rNum <= 18 && Array.isArray(rArr) && rArr.length > 0) {
                ranksToSnapshot.add(rNum);
              }
            }
          }
        }
      } catch {
        // Fallback to per-rank fetch below
      }

      await Promise.all(
        Array.from(ranksToSnapshot).map(async (r) => {
          if (r === activeRank) {
            const selfSnap = new Map<number, RankNodeSnapshot>();
            for (const [id, n] of rawNodes.entries()) {
              selfSnap.set(id, {
                ...n,
                isExtraId: Boolean(n.isExtraId) && !Boolean(n.isClone),
                originMainId: onChainOriginMap.get(id) || id,
                directSponsorNodeId: onChainSponsorNodeMap.get(id) || 0,
                nodeVault: onChainNodeVaultMap.get(id) ?? 0,
                originType: onChainOriginTypeMap.get(id),
              });
            }
            multiRankSnapshots.set(r, selfSnap);
            return;
          }
          const rMap = new Map<number, RankNodeSnapshot>();
          let rLoadedFromApi = false;

          if (snapshotNodesByRank && Array.isArray(snapshotNodesByRank[r]) && snapshotNodesByRank[r].length > 0) {
            for (const item of snapshotNodesByRank[r]) {
              const nid = Number(item.id);
              if (nid > 0) {
                rMap.set(nid, {
                  id: nid,
                  owner: String(item.owner || ethers.ZeroAddress),
                  directSponsor: String(item.directSponsor || ethers.ZeroAddress),
                  parentId: Number(item.parentId || 0),
                  leftChild: Number(item.leftChild || 0),
                  rightChild: Number(item.rightChild || 0),
                  isClone: Boolean(item.isClone),
                  isExtraId: Boolean(item.isExtraId) && !Boolean(item.isClone),
                  isAdminFreeUpgrade: Boolean(item.isAdminFreeUpgrade),
                  originMainId: Number(item.originMainId) > 0 ? Number(item.originMainId) : nid,
                  directSponsorNodeId: Number(item.directSponsorNodeId || 0),
                  nodeVault: Number(item.nodeVault ?? 0),
                  originType: item.originType ? String(item.originType) : undefined,
                });
              }
            }
            rLoadedFromApi = rMap.size > 0;
          }

          if (!rLoadedFromApi) {
            try {
              const res = await fetch(`/api/matrix/tree-nodes?rank=${r}&contract=${activeContract}`);
              if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.nodes) && data.nodes.length > 0) {
                  for (const item of data.nodes) {
                    const nid = Number(item.id);
                    if (nid > 0) {
                      rMap.set(nid, {
                        id: nid,
                        owner: String(item.owner || ethers.ZeroAddress),
                        directSponsor: String(item.directSponsor || ethers.ZeroAddress),
                        parentId: Number(item.parentId || 0),
                        leftChild: Number(item.leftChild || 0),
                        rightChild: Number(item.rightChild || 0),
                        isClone: Boolean(item.isClone),
                        isExtraId: Boolean(item.isExtraId) && !Boolean(item.isClone),
                        isAdminFreeUpgrade: Boolean(item.isAdminFreeUpgrade),
                        originMainId: Number(item.originMainId) > 0 ? Number(item.originMainId) : nid,
                        directSponsorNodeId: Number(item.directSponsorNodeId || 0),
                        nodeVault: Number(item.nodeVault ?? 0),
                        originType: item.originType ? String(item.originType) : undefined,
                      });
                    }
                  }
                  rLoadedFromApi = true;
                }
              }
            } catch {
              // Fallback to RPC below
            }
          }

          if (!rLoadedFromApi) {
            try {
              const contract = await getFallbackContract();
              const totalInR = Math.min(Number(await contract.totalNodesInRank(r)), 60);
              const rIds = Array.from({ length: Math.max(totalInR, 1) }, (_, idx) => idx + 1);
              const CHUNK_SIZE = 8;
              for (let i = 0; i < rIds.length; i += CHUNK_SIZE) {
                const chunk = rIds.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                  chunk.map(async (nid) => {
                    try {
                      const [raw, origBn, vaultBn, sponsorNodeBn] = await Promise.all([
                        contract.rankNodes(r, nid),
                        contract.nodeOriginMainId(r, nid).catch(() => 0n),
                        contract.nodeUpgradeVault(r, nid).catch(() => 0n),
                        contract.nodeDirectSponsorNodeId(r, nid).catch(() => 0n),
                      ]);
                      const fid = Number(raw.id ?? raw[0] ?? 0);
                      if (fid > 0) {
                        rMap.set(fid, {
                          id: fid,
                          owner: String(raw.owner ?? raw[1] ?? ethers.ZeroAddress),
                          directSponsor: String(raw.directSponsor ?? raw[2] ?? ethers.ZeroAddress),
                          parentId: Number(raw.parentId ?? raw[3] ?? 0),
                          leftChild: Number(raw.leftChild ?? raw[4] ?? 0),
                          rightChild: Number(raw.rightChild ?? raw[5] ?? 0),
                          isClone: Boolean(raw.isClone ?? raw[6] ?? false),
                          isExtraId: Boolean(raw.isExtraId ?? raw[7] ?? false),
                          originMainId: Number(origBn) > 0 ? Number(origBn) : fid,
                          directSponsorNodeId: Number(sponsorNodeBn || 0n),
                          nodeVault: Number(ethers.formatUnits(vaultBn, vaultBn >= 100000000000000n ? 18 : 6)),
                        });
                      }
                    } catch {
                      // Ignore
                    }
                  })
                );
              }
            } catch {
              // Ignore
            }
          }
          multiRankSnapshots.set(r, rMap);
        })
      );

      // สำหรับการวางตำแหน่ง Rank 2-18:
      // ตรวจสอบว่าผู้แนะนำตรง (Direct Sponsor ID เช่น ID #5) มีโหนดอยู่ใน Rank นั้นหรือยัง
      // หากผู้แนะนำยังไม่ได้อัปเกรดขึ้นมาถึง Rank นั้น ให้หาตำแหน่งว่างชั้นตื้นลงมาจากซ้ายไปขวา (BFS จาก Root #1)
      const snapR1ForPlacement = multiRankSnapshots.get(1);
      const snapR9ForPlacement = multiRankSnapshots.get(9);
      const snapR4ForPlacement = multiRankSnapshots.get(4);

      for (const [rNum, sMap] of multiRankSnapshots.entries()) {
        if (rNum < 1 || sMap.size <= 1) continue;
        const sIds = Array.from(sMap.keys()).sort((a, b) => a - b);

        // 1. Resolve directSponsorNodeId for Extra IDs and Main IDs in Rank 2..18 from Rank 1 before checking tree placement
        if (rNum > 1 && snapR1ForPlacement && snapR1ForPlacement.size > 0) {
          const r1List = Array.from(snapR1ForPlacement.values()).sort((a, b) => a.id - b.id);
          for (const nid of sIds) {
            const node = sMap.get(nid)!;
            if (node.isExtraId && !node.isClone) {
              const ok = (node.owner || '').toLowerCase();
              const ownerMainsR1 = r1List.filter(
                (m) => !m.isClone && !m.isExtraId && (m.owner || '').toLowerCase() === ok
              );
              if (ownerMainsR1.length === 1) {
                node.directSponsorNodeId = ownerMainsR1[0].id;
                node.directSponsor = ownerMainsR1[0].owner;
              } else if (ownerMainsR1.length > 1) {
                const eligibleMain =
                  ownerMainsR1.find(
                    (m) =>
                      m.id === 1 ||
                      (snapR9ForPlacement &&
                        Array.from(snapR9ForPlacement.values()).some(
                          (x) => !x.isClone && !x.isExtraId && x.originMainId === m.id
                        ))
                  ) ||
                  ownerMainsR1.find(
                    (m) =>
                      m.id === 1 ||
                      (snapR4ForPlacement &&
                        Array.from(snapR4ForPlacement.values()).some(
                          (x) => !x.isClone && !x.isExtraId && x.originMainId === m.id
                        ))
                  ) ||
                  ownerMainsR1[0];
                node.directSponsorNodeId = eligibleMain.id;
                node.directSponsor = eligibleMain.owner;
              }
              if (rNum === activeRank && node.directSponsorNodeId > 0) {
                onChainSponsorNodeMap.set(node.id, node.directSponsorNodeId);
              }
            } else if (!node.isClone && !node.isExtraId && node.id > 1) {
              const origR1 =
                node.originMainId > 1
                  ? snapR1ForPlacement.get(node.originMainId)
                  : r1List.find(
                      (x) =>
                        x.id > 1 &&
                        !x.isClone &&
                        !x.isExtraId &&
                        (x.owner || '').toLowerCase() === (node.owner || '').toLowerCase()
                    );
              if (origR1 && !origR1.isClone && !origR1.isExtraId) {
                node.originMainId = origR1.id;
                node.directSponsorNodeId = origR1.directSponsorNodeId || 1;
                node.directSponsor = origR1.directSponsor || node.directSponsor;
                if (rNum === activeRank) {
                  onChainOriginMap.set(node.id, node.originMainId);
                  onChainSponsorNodeMap.set(node.id, node.directSponsorNodeId);
                }
              }
            }
          }
        }

        // 2. Check if any node in Rank 1..18 is actually orphaned (missing parent link on-chain)
        // Authentic on-chain parentId / leftChild / rightChild placements are always preserved.
        let needsReplay = false;
        const cloneSeqByOrig = new Map<number, number>();
        for (const nid of sIds) {
          const node = sMap.get(nid)!;
          if (node.isClone) {
            const origKey = node.originMainId || node.id;
            const nextSeq = (cloneSeqByOrig.get(origKey) || 0) + 1;
            cloneSeqByOrig.set(origKey, nextSeq);
          }
          if (nid <= 1) continue;
          const p = sMap.get(node.parentId);
          if (!p || (p.leftChild !== node.id && p.rightChild !== node.id)) {
            needsReplay = true;
            break;
          }
        }

        const leftCountBeforeByMain = new Map<number, number>();
        for (const m of sMap.values()) {
          if (m.isClone || m.isExtraId) continue;
          let lc = 0;
          const mOrig = m.originMainId || m.id;
          for (const cand of sMap.values()) {
            const cOrig = cand.originMainId || cand.id;
            if (
              (cand.id === m.id || (cand.isClone && (cOrig === m.id || cOrig === mOrig))) &&
              cand.leftChild > 0 &&
              sMap.has(cand.leftChild)
            ) {
              lc++;
            }
          }
          leftCountBeforeByMain.set(m.id, lc);
        }

        // 3. Chronological replay of Rank 1..18 placements and right-child Rebirth Clone triggers (only if orphaned)
        if (needsReplay) {
          const allSnaps = Array.from(sMap.values()).sort((a, b) => a.id - b.id);
          const rootSnap = sMap.get(1) || allSnaps[0];
          const nonCloneSnaps = allSnaps.filter((sn) => sn.id !== rootSnap.id && !sn.isClone);
          const cloneSnapIds = allSnaps
            .filter((sn) => sn.id !== rootSnap.id && sn.isClone)
            .map((sn) => sn.id);
          const cloneSnapTemplates = new Map<number, RankNodeSnapshot>();
          for (const sn of allSnaps) {
            if (sn.isClone) cloneSnapTemplates.set(sn.id, sn);
          }

          rootSnap.parentId = 0;
          rootSnap.leftChild = 0;
          rootSnap.rightChild = 0;

          const placedMap = new Map<number, RankNodeSnapshot>();
          placedMap.set(rootSnap.id, rootSnap);
          let cloneCursor = 0;

          const findBfsSlot = (startId: number = 1): { parentId: number; isLeft: boolean } => {
            const q = [placedMap.has(startId) ? startId : rootSnap.id];
            const vis = new Set<number>();
            while (q.length > 0) {
              const curId = q.shift()!;
              if (vis.has(curId)) continue;
              vis.add(curId);
              const cur = placedMap.get(curId);
              if (!cur) continue;
              if (!cur.leftChild || !placedMap.has(cur.leftChild)) {
                return { parentId: cur.id, isLeft: true };
              }
              if (!cur.rightChild || !placedMap.has(cur.rightChild)) {
                return { parentId: cur.id, isLeft: false };
              }
              q.push(cur.leftChild, cur.rightChild);
            }
            return { parentId: rootSnap.id, isLeft: true };
          };

          const findSponsorSlot = (spInRankId: number): { parentId: number; isLeft: boolean } => {
            if (!spInRankId || !placedMap.has(spInRankId)) {
              return findBfsSlot(1);
            }
            const spMain = placedMap.get(spInRankId)!;
            if (!spMain.leftChild || !placedMap.has(spMain.leftChild)) {
              return { parentId: spMain.id, isLeft: true };
            }
            if (!spMain.rightChild || !placedMap.has(spMain.rightChild)) {
              return { parentId: spMain.id, isLeft: false };
            }
            const spOrigTag = spMain.originMainId || spMain.id;
            const placedSorted = Array.from(placedMap.values()).sort((a, b) => a.id - b.id);
            for (const cand of placedSorted) {
              if (!cand.isClone) continue;
              const cOrig = cand.originMainId || cand.id;
              if (cOrig !== spMain.id && cOrig !== spOrigTag) continue;
              if (!cand.leftChild || !placedMap.has(cand.leftChild)) {
                return { parentId: cand.id, isLeft: true };
              }
              if (!cand.rightChild || !placedMap.has(cand.rightChild)) {
                return { parentId: cand.id, isLeft: false };
              }
            }
            return findBfsSlot(spMain.id);
          };

          const spawnTriggeredSnapClones = (initialParent: RankNodeSnapshot) => {
            const rightQueue: RankNodeSnapshot[] = [initialParent];
            let guard = 0;
            while (rightQueue.length > 0 && guard < 100) {
              guard++;
              const trigParent = rightQueue.shift()!;
              const placedArr = Array.from(placedMap.values());
              const trigOriginNode = !trigParent.isClone
                ? trigParent
                : placedArr.find(
                    (p) =>
                      !p.isClone &&
                      (p.id === trigParent.originMainId ||
                        p.originMainId === trigParent.originMainId)
                  ) || trigParent;

              const cloneOrigMainId = trigOriginNode.isExtraId
                ? trigOriginNode.id
                : trigOriginNode.originMainId || trigOriginNode.id;

              const existingClonesForOrig = placedArr.filter(
                (p) => p.isClone && (p.originMainId || p.id) === cloneOrigMainId
              ).length;
              const roundIdx = existingClonesForOrig % 2;

              let savedSponsorId = trigOriginNode.directSponsorNodeId || 1;
              let sponsorNodeInRankId = 0;
              if (cloneOrigMainId === 1 || trigOriginNode.id === 1) {
                savedSponsorId = 1;
                sponsorNodeInRankId = 1;
              } else {
                const spNodeInR = placedArr.find(
                  (p) =>
                    !p.isClone &&
                    !p.isExtraId &&
                    (savedSponsorId === 1
                      ? p.id === 1
                      : p.id === savedSponsorId || p.originMainId === savedSponsorId)
                );
                sponsorNodeInRankId = spNodeInR ? spNodeInR.id : 0;
              }

              const cSlot =
                roundIdx === 0 && sponsorNodeInRankId > 0
                  ? findSponsorSlot(sponsorNodeInRankId)
                  : findBfsSlot(1);

              const assignedCloneId =
                cloneCursor < cloneSnapIds.length
                  ? cloneSnapIds[cloneCursor++]
                  : Math.max(
                      ...Array.from(placedMap.keys()),
                      ...nonCloneSnaps.map((x) => x.id),
                      0
                    ) + 1;

              const template = cloneSnapTemplates.get(assignedCloneId);
              const cloneSnap: RankNodeSnapshot = {
                ...(template || {}),
                id: assignedCloneId,
                owner: trigOriginNode.owner,
                directSponsor: trigOriginNode.directSponsor || rootSnap.owner,
                parentId: cSlot.parentId,
                leftChild: 0,
                rightChild: 0,
                isClone: true,
                isExtraId: false,
                originMainId: cloneOrigMainId,
                directSponsorNodeId: savedSponsorId,
                nodeVault: 0,
                originType: 'CLONE',
              };

              const cParent = placedMap.get(cSlot.parentId);
              placedMap.set(cloneSnap.id, cloneSnap);
              if (cParent) {
                const placeLeft = !cParent.leftChild || !placedMap.has(cParent.leftChild) || cSlot.isLeft;
                if (placeLeft) {
                  cParent.leftChild = cloneSnap.id;
                } else {
                  cParent.rightChild = cloneSnap.id;
                  rightQueue.push(cParent);
                }
              }
            }
          };

          for (const sn of nonCloneSnaps) {
            sn.leftChild = 0;
            sn.rightChild = 0;
            const spMainId = sn.directSponsorNodeId > 0 ? sn.directSponsorNodeId : 1;
            const spNodeInRank = Array.from(placedMap.values()).find(
              (p) =>
                !p.isClone &&
                !p.isExtraId &&
                (spMainId === 1 ? p.id === 1 : p.id === spMainId || p.originMainId === spMainId)
            );
            const slot = spNodeInRank ? findSponsorSlot(spNodeInRank.id) : findBfsSlot(1);
            const targetParent = placedMap.get(slot.parentId) || rootSnap;
            sn.parentId = targetParent.id;
            placedMap.set(sn.id, sn);
            const placeLeft = !targetParent.leftChild || !placedMap.has(targetParent.leftChild) || slot.isLeft;
            if (placeLeft) {
              targetParent.leftChild = sn.id;
            } else {
              targetParent.rightChild = sn.id;
              spawnTriggeredSnapClones(targetParent);
            }
          }

          sMap.clear();
          const finalSnaps = Array.from(placedMap.values()).sort((a, b) => a.id - b.id);
          for (const fs of finalSnaps) {
            sMap.set(fs.id, fs);
          }

          if (rNum === activeRank) {
            rawNodes.clear();
            const cloneRoundTracker = new Map<number, number>();
            for (const fs of finalSnaps) {
              rawNodes.set(fs.id, {
                id: fs.id,
                owner: fs.owner,
                directSponsor: fs.directSponsor,
                parentId: fs.parentId,
                leftChild: fs.leftChild,
                rightChild: fs.rightChild,
                isClone: fs.isClone,
                isExtraId: fs.isExtraId,
                isAdminFreeUpgrade: fs.isAdminFreeUpgrade,
              });
              onChainOriginMap.set(fs.id, fs.originMainId || fs.id);
              onChainSponsorNodeMap.set(fs.id, fs.directSponsorNodeId || 1);
              if (fs.isClone) {
                const origKey = fs.originMainId || fs.id;
                const nextCnt = (cloneRoundTracker.get(origKey) || 0) + 1;
                cloneRoundTracker.set(origKey, nextCnt);
                onChainCloneRoundMap.set(fs.id, ((nextCnt - 1) % 2) + 1);
              }
            }
          }
        }
      }

      // Auto-detect on-chain Admin Free Rank Upgrades (adminUpgradeRankForMainId / adminUpgradeRank) from Rank 18 down to Rank 2
      const r1RootSnap = multiRankSnapshots.get(1)?.get(1);
      const r1RootVaultVal = Number(r1RootSnap?.nodeVault ?? 0);
      for (let r = 18; r >= 2; r--) {
        const sMap = multiRankSnapshots.get(r);
        if (!sMap || sMap.size <= 1) continue;
        for (const mNode of sMap.values()) {
          if (mNode.isClone || mNode.isExtraId) continue;
          const mR1Id = mNode.id === 1 ? 1 : mNode.originMainId || mNode.id;
          const rawV = Number(mNode.nodeVault ?? 0);
          if (rawV > 1e-6) continue;

          let vaultNeverSpentInR = false;
          if (mR1Id === 1) {
            if (r <= 3) {
              const r2RootSnap = multiRankSnapshots.get(2)?.get(1);
              const r2RootVaultVal = Number(r2RootSnap?.nodeVault ?? 0);
              if (r === 2 && r1RootVaultVal > 1e-6) vaultNeverSpentInR = true;
              if (r === 3 && (r1RootVaultVal > 1e-6 || r2RootVaultVal > 1e-6)) vaultNeverSpentInR = true;
            } else {
              let anyExtra = false;
              for (const snap of multiRankSnapshots.values()) {
                for (const x of snap.values()) {
                  if (x.isExtraId && !x.isClone) {
                    anyExtra = true;
                    break;
                  }
                }
                if (anyExtra) break;
              }
              if (!anyExtra) vaultNeverSpentInR = true;
            }
          } else {
            const nextSMap = multiRankSnapshots.get(r + 1);
            const nodeInNextR = nextSMap
              ? Array.from(nextSMap.values()).find(
                  (x) => !x.isClone && !x.isExtraId && x.originMainId === mR1Id
                )
              : undefined;
            if (!nodeInNextR || nodeInNextR.isAdminFreeUpgrade) {
              vaultNeverSpentInR = true;
            }
          }

          if (vaultNeverSpentInR) {
            for (const sn of sMap.values()) {
              const snOrig = sn.originMainId || sn.id;
              const isSameMain =
                sn.id === mNode.id ||
                (sn.isClone && !sn.isExtraId && (snOrig === mNode.id || snOrig === mR1Id));
              if (isSameMain && sn.leftChild > 0) {
                const lcNode = sMap.get(sn.leftChild);
                if (lcNode) {
                  lcNode.isAdminFreeUpgrade = true;
                  if (r === activeRank && rawNodes.has(lcNode.id)) {
                    rawNodes.get(lcNode.id)!.isAdminFreeUpgrade = true;
                  }
                  if (lcNode.isClone) {
                    const trigNode = sMap.get(lcNode.id - 1);
                    if (trigNode && !trigNode.isClone && trigNode.parentId > 0) {
                      const trigParent = sMap.get(trigNode.parentId);
                      if (trigParent && trigParent.rightChild === trigNode.id) {
                        trigNode.isAdminFreeUpgrade = true;
                        if (r === activeRank && rawNodes.has(trigNode.id)) {
                          rawNodes.get(trigNode.id)!.isAdminFreeUpgrade = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Authentic on-chain Extra IDs and Clones are already created by the Smart Contract.
      const hasOnChainExtraNodes = true;
      const snapR1Init = multiRankSnapshots.get(1);
      if (!hasOnChainExtraNodes && snapR1Init && snapR1Init.size > 0) {
        const initMainsByRank = new Map<number, Map<string, number[]>>();
        for (const [rNum, sMap] of multiRankSnapshots.entries()) {
          const mMap = new Map<string, number[]>();
          const sIds = Array.from(sMap.keys()).sort((a, b) => a - b);
          for (const sid of sIds) {
            const sn = sMap.get(sid)!;
            if (!sn.isClone && !sn.isExtraId) {
              const ok = sn.owner.toLowerCase();
              const arr = mMap.get(ok) || [];
              arr.push(sn.id);
              mMap.set(ok, arr);
            }
          }
          initMainsByRank.set(rNum, mMap);
        }

        const getCorrespInit = (r1Id: number, _ownerAddr: string, targetR: number): number => {
          if (targetR === 1) return r1Id;
          if (r1Id === 1) return 1;
          const targetSnapMap = multiRankSnapshots.get(targetR);
          if (!targetSnapMap) return 0;
          const matched = Array.from(targetSnapMap.values()).find(
            (sn) => !sn.isClone && !sn.isExtraId && sn.originMainId === r1Id
          );
          return matched ? matched.id : 0;
        };

        const r1SortedIds = Array.from(snapR1Init.keys()).sort((a, b) => a - b);
        for (const r1Id of r1SortedIds) {
          const r1Node = snapR1Init.get(r1Id)!;
          if (r1Node.isClone || r1Node.isExtraId) continue;

          let curRank = r1Id === 1 ? 18 : 1;
          if (r1Id !== 1) {
            for (let r = 18; r >= 1; r--) {
              const cid = getCorrespInit(r1Id, r1Node.owner, r);
              if (cid > 0 && multiRankSnapshots.get(r)?.has(cid)) {
                curRank = r;
                break;
              }
            }
          }
          const win5Start = Math.max(1, curRank - 4);
          const eligibleSnaps: Array<{ rank: number; snapNode: RankNodeSnapshot }> = [];
          for (let r = 4; r <= 18; r++) {
            if (curRank === 18 || r < win5Start) {
              const cid = getCorrespInit(r1Id, r1Node.owner, r);
              const sn = cid > 0 ? multiRankSnapshots.get(r)?.get(cid) : undefined;
              if (sn) eligibleSnaps.push({ rank: r, snapNode: sn });
            }
          }
          if (eligibleSnaps.length === 0) continue;

          // เงื่อนไข Auto Extra ID: นำยอด New Extra ID Pool (รวมยอดเก่าคงเหลือสะสมใน R4-R27 ที่พ้นกรอบ 5 แรงค์ด้วยก่อนสร้าง Extra ID) มาลูปหาราคาแต่ละ Rank จาก Rank 18 ลงมาถึง Rank 2
          const minR2Price = RANK_PRICES_USDT[1] || 10;
          let spawnedExtraInPass = true;
          let guard = 0;
          while (spawnedExtraInPass && guard < 50) {
            spawnedExtraInPass = false;
            guard++;

            for (let targetR = 18; targetR >= 2; targetR--) {
              const r4To27Avail = eligibleSnaps.reduce((s, item) => s + Number(item.snapNode.nodeVault || 0), 0);
              const availPool = Number(r4To27Avail.toFixed(4));
              if (availPool + 1e-6 < minR2Price) break;

              const tPrice = RANK_PRICES_USDT[targetR - 1] || 10;
              if (availPool + 1e-6 < tPrice) continue;

              const correspTargetId = getCorrespInit(r1Id, r1Node.owner, targetR);
              const targetSnapMap = multiRankSnapshots.get(targetR);
              const targetMainSnap = correspTargetId > 0 ? targetSnapMap?.get(correspTargetId) : undefined;
              if (!targetSnapMap || !targetMainSnap) continue;

              let remDeduct = tPrice;
              // หักจากยอดเก่าสะสมใน R4-R27 ตามลำดับแรงค์เก่าไปแรงค์ใหม่
              for (const item of eligibleSnaps) {
                if (remDeduct <= 1e-6) break;
                const v = Number(item.snapNode.nodeVault || 0);
                if (v <= 1e-6) continue;
                const d = Math.min(v, remDeduct);
                item.snapNode.nodeVault = Number(Math.max(0, v - d).toFixed(4));
                remDeduct = Number(Math.max(0, remDeduct - d).toFixed(4));
                if (item.rank === activeRank) {
                  onChainNodeVaultMap.set(item.snapNode.id, item.snapNode.nodeVault);
                }
              }

              const findBfsFromRoot = (
                sMap: Map<number, RankNodeSnapshot>
              ): { parentId: number; isLeft: boolean } => {
                const q = [1];
                const vis = new Set<number>();
                while (q.length > 0) {
                  const cur = q.shift()!;
                  if (vis.has(cur)) continue;
                  vis.add(cur);
                  const cn = sMap.get(cur);
                  if (!cn) continue;
                  if (!cn.leftChild || !sMap.has(cn.leftChild)) {
                    return { parentId: cn.id, isLeft: true };
                  }
                  if (!cn.rightChild || !sMap.has(cn.rightChild)) {
                    return { parentId: cn.id, isLeft: false };
                  }
                  q.push(cn.leftChild, cn.rightChild);
                }
                return { parentId: 1, isLeft: true };
              };

              const findSnapSlotUnderMain = (
                sMap: Map<number, RankNodeSnapshot>,
                sponsorNodeInRankId: number
              ): { parentId: number; isLeft: boolean } => {
                if (!sponsorNodeInRankId || sponsorNodeInRankId <= 0 || !sMap.has(sponsorNodeInRankId)) {
                  return findBfsFromRoot(sMap);
                }
                const mSnap = sMap.get(sponsorNodeInRankId)!;
                if (!mSnap.leftChild || !sMap.has(mSnap.leftChild)) {
                  return { parentId: mSnap.id, isLeft: true };
                }
                if (!mSnap.rightChild || !sMap.has(mSnap.rightChild)) {
                  return { parentId: mSnap.id, isLeft: false };
                }
                const mOriginTag = mSnap.originMainId || mSnap.id;
                const sArr = Array.from(sMap.values()).sort((a, b) => a.id - b.id);
                for (const cand of sArr) {
                  if (!cand.isClone) continue;
                  const cOrig = cand.originMainId || cand.id;
                  if (cOrig !== mSnap.id && cOrig !== mOriginTag) continue;
                  if (!cand.leftChild || !sMap.has(cand.leftChild)) {
                    return { parentId: cand.id, isLeft: true };
                  }
                  if (!cand.rightChild || !sMap.has(cand.rightChild)) {
                    return { parentId: cand.id, isLeft: false };
                  }
                }
                const q = [mSnap.id];
                const vis = new Set<number>();
                while (q.length > 0) {
                  const cur = q.shift()!;
                  if (vis.has(cur)) continue;
                  vis.add(cur);
                  const cn = sMap.get(cur);
                  if (!cn) continue;
                  if (!cn.leftChild || !sMap.has(cn.leftChild)) {
                    return { parentId: cn.id, isLeft: true };
                  }
                  if (!cn.rightChild || !sMap.has(cn.rightChild)) {
                    return { parentId: cn.id, isLeft: false };
                  }
                  q.push(cn.leftChild, cn.rightChild);
                }
                return { parentId: mSnap.id, isLeft: true };
              };

              // ตรวจสอบว่า Direct Sponsor ID มีโหนดอยู่ใน targetR หรือยัง
              const r1SponsorId = r1Node.directSponsorNodeId > 0 ? r1Node.directSponsorNodeId : 1;
              const sponsorNodeInTarget = getCorrespInit(r1SponsorId, r1Node.directSponsor, targetR);
              const extraSlot =
                sponsorNodeInTarget > 0
                  ? findSnapSlotUnderMain(targetSnapMap, sponsorNodeInTarget)
                  : findBfsFromRoot(targetSnapMap);
              const pId = extraSlot.parentId;
              const isLeftSlot = extraSlot.isLeft;

              const findSnapClonePlacement = (
                sMap: Map<number, RankNodeSnapshot>,
                trigParent: RankNodeSnapshot
              ): {
                parentId: number;
                isLeft: boolean;
                cloneOriginMainId: number;
                targetSponsorNodeId: number;
              } => {
                const cloneOriginMainId =
                  trigParent.originMainId && trigParent.originMainId > 0
                    ? trigParent.originMainId
                    : trigParent.id;
                const existingClonesCount = Array.from(sMap.values()).filter(
                  (sn) => sn.isClone && (sn.originMainId || sn.id) === cloneOriginMainId
                ).length;
                const roundIndex = existingClonesCount % 2;
                const origSnap =
                  Array.from(sMap.values()).find(
                    (sn) =>
                      !sn.isClone &&
                      !sn.isExtraId &&
                      (cloneOriginMainId === 1 ? sn.id === 1 : sn.originMainId === cloneOriginMainId)
                  ) ||
                  sMap.get(cloneOriginMainId) ||
                  trigParent;

                let savedDirectSponsorId = origSnap.directSponsorNodeId || 1;
                let sponsorNodeInRankId = 0;

                if (cloneOriginMainId === 1 || origSnap.id === 1) {
                  savedDirectSponsorId = 1;
                  sponsorNodeInRankId = 1;
                } else {
                  savedDirectSponsorId = origSnap.directSponsorNodeId || 1;
                  const spNodeInR = Array.from(sMap.values()).find(
                    (sn) =>
                      !sn.isClone &&
                      !sn.isExtraId &&
                      (savedDirectSponsorId === 1
                        ? sn.id === 1
                        : sn.originMainId === savedDirectSponsorId)
                  );
                  sponsorNodeInRankId = spNodeInR ? spNodeInR.id : 0;
                }

                if (roundIndex === 0 && sponsorNodeInRankId > 0 && sMap.has(sponsorNodeInRankId)) {
                  const slot = findSnapSlotUnderMain(sMap, sponsorNodeInRankId);
                  return {
                    parentId: slot.parentId,
                    isLeft: slot.isLeft,
                    cloneOriginMainId,
                    targetSponsorNodeId: savedDirectSponsorId,
                  };
                }

                const bfsSlot = findBfsFromRoot(sMap);
                return {
                  parentId: bfsSlot.parentId,
                  isLeft: bfsSlot.isLeft,
                  cloneOriginMainId,
                  targetSponsorNodeId: savedDirectSponsorId,
                };
              };

              const maxNid = Array.from(targetSnapMap.keys()).reduce((m, k) => Math.max(m, k), 0);
              const newExtraId = maxNid + 1;
              const newSnap: RankNodeSnapshot = {
                id: newExtraId,
                owner: r1Node.owner,
                directSponsor: r1Node.directSponsor || r1Node.owner,
                parentId: pId,
                leftChild: 0,
                rightChild: 0,
                isClone: false,
                isExtraId: true,
                originMainId: newExtraId,
                directSponsorNodeId: r1SponsorId,
                nodeVault: 0,
              };
              targetSnapMap.set(newExtraId, newSnap);
              const pSnap = targetSnapMap.get(pId);
              const rightTriggerQueue: RankNodeSnapshot[] = [];

              if (pSnap) {
                if (isLeftSlot) {
                  pSnap.leftChild = newExtraId;
                  const pMainId =
                    pSnap.originMainId && pSnap.originMainId > 0 ? pSnap.originMainId : pSnap.id;
                  const pMainSnap = targetSnapMap.get(pMainId) || pSnap;
                  const addV = Number((tPrice * 0.35).toFixed(4));
                  pMainSnap.nodeVault = Number(((pMainSnap.nodeVault || 0) + addV).toFixed(4));
                  if (targetR === activeRank) {
                    onChainNodeVaultMap.set(pMainSnap.id, pMainSnap.nodeVault);
                  }
                } else {
                  pSnap.rightChild = newExtraId;
                  rightTriggerQueue.push(pSnap);
                }
              }

              if (targetR === activeRank) {
                rawNodes.set(newExtraId, {
                  id: newExtraId,
                  owner: newSnap.owner,
                  directSponsor: newSnap.directSponsor,
                  parentId: pId,
                  leftChild: 0,
                  rightChild: 0,
                  isClone: false,
                  isExtraId: true,
                });
                const rawParent = rawNodes.get(pId);
                if (rawParent) {
                  if (isLeftSlot) rawParent.leftChild = newExtraId;
                  else rawParent.rightChild = newExtraId;
                }
                onChainOriginMap.set(newExtraId, newExtraId);
                onChainSponsorNodeMap.set(newExtraId, targetMainSnap.id);
                onChainNodeVaultMap.set(newExtraId, 0);
              }

              let cloneGuard = 0;
              while (rightTriggerQueue.length > 0 && cloneGuard < 25) {
                cloneGuard++;
                const trigParent = rightTriggerQueue.shift()!;
                const cPlace = findSnapClonePlacement(targetSnapMap, trigParent);
                const nextCloneId =
                  Array.from(targetSnapMap.keys()).reduce((m, k) => Math.max(m, k), 0) + 1;
                const origSnap = targetSnapMap.get(cPlace.cloneOriginMainId) || trigParent;
                const newCloneSnap: RankNodeSnapshot = {
                  id: nextCloneId,
                  owner: trigParent.owner,
                  directSponsor:
                    origSnap.directSponsor || trigParent.directSponsor || trigParent.owner,
                  parentId: cPlace.parentId,
                  leftChild: 0,
                  rightChild: 0,
                  isClone: true,
                  isExtraId: false,
                  originMainId: cPlace.cloneOriginMainId,
                  directSponsorNodeId: cPlace.targetSponsorNodeId,
                  nodeVault: 0,
                };
                targetSnapMap.set(nextCloneId, newCloneSnap);
                const cpSnap = targetSnapMap.get(cPlace.parentId);
                if (cpSnap) {
                  if (cPlace.isLeft) {
                    cpSnap.leftChild = nextCloneId;
                    const cpMainId =
                      cpSnap.originMainId && cpSnap.originMainId > 0
                        ? cpSnap.originMainId
                        : cpSnap.id;
                    const cpMainSnap = targetSnapMap.get(cpMainId) || cpSnap;
                    const addV = Number((tPrice * 0.35).toFixed(4));
                    cpMainSnap.nodeVault = Number(((cpMainSnap.nodeVault || 0) + addV).toFixed(4));
                    if (targetR === activeRank) {
                      onChainNodeVaultMap.set(cpMainSnap.id, cpMainSnap.nodeVault);
                    }
                  } else {
                    cpSnap.rightChild = nextCloneId;
                    rightTriggerQueue.push(cpSnap);
                  }
                }

                if (targetR === activeRank) {
                  rawNodes.set(nextCloneId, {
                    id: nextCloneId,
                    owner: newCloneSnap.owner,
                    directSponsor: newCloneSnap.directSponsor,
                    parentId: cPlace.parentId,
                    leftChild: 0,
                    rightChild: 0,
                    isClone: true,
                    isExtraId: false,
                  });
                  const rawCloneParent = rawNodes.get(cPlace.parentId);
                  if (rawCloneParent) {
                    if (cPlace.isLeft) rawCloneParent.leftChild = nextCloneId;
                    else rawCloneParent.rightChild = nextCloneId;
                  }
                  onChainOriginMap.set(nextCloneId, cPlace.cloneOriginMainId);
                  onChainSponsorNodeMap.set(nextCloneId, cPlace.targetSponsorNodeId);
                  onChainNodeVaultMap.set(nextCloneId, 0);
                }
              }

              spawnedExtraInPass = true;
            }
          }
        }
      }

      const ownerPrimaryNodeMap = new Map<string, number>();
      const ownerAllMainNodesMap = new Map<string, number[]>();
      const nodeCloneRoundCount = new Map<number, number>();
      const nodeSpawnedClones = new Map<number, Array<{ cloneNodeId: number; round: number; sequence?: number }>>();
      const nodeDirectBonusMap = new Map<number, number>();
      const nodeUnilevelBonusMap = new Map<number, number>();
      const autoMainNodeIds = new Set<number>();
      const autoIdSourceMainMap = new Map<number, number>();
      const extraIdSourceMainMap = new Map<number, number>();
      const mainNodeAutoIdSpawnCount = new Map<number, number>();
      const lineageExtraIdSpawnCount = new Map<number, number>();
      const lineageUpgradeVault = new Map<number, number>();
      const lineageAutoIdVault = new Map<number, number>();
      const lineageExtraIdVault = new Map<number, number>();
      const lineageGrossVaultMap = new Map<number, number>();
      const lineageFamilyPoolDirectMap = new Map<number, number>();
      const lineageHasUpgraded = new Map<number, boolean>();

      const snap1 = multiRankSnapshots.get(1);
      const sortedIds = Array.from(rawNodes.keys()).sort((a, b) => a - b);
      const rootOwnerKey = (rawNodes.get(1)?.owner || '').toLowerCase();

      // Helper to check if candidateAncestorId is an ancestor of targetId in the binary tree
      const isAncestorOf = (candidateAncestorId: number, targetId: number): boolean => {
        if (candidateAncestorId <= 0 || targetId <= 0) return false;
        let curr = targetId;
        const guard = new Set<number>();
        while (curr > 0 && !guard.has(curr)) {
          if (curr === candidateAncestorId) return true;
          guard.add(curr);
          const p = rawNodes.get(curr);
          curr = p ? p.parentId : 0;
        }
        return false;
      };

      // Pass 1: Build Clone Lineage (originMainId, spawnedFromNodeId, cloneRound, cloneSequence, subCloneDepth) first
      const originMainIdMap = new Map<number, number>();
      const spawnedFromMap = new Map<number, number>();
      const cloneRoundMap = new Map<number, number>();
      const cloneSequenceMap = new Map<number, number>();
      const subCloneDepthMap = new Map<number, number>();
      const matchedRightTriggers = new Set<number>();

      for (const id of sortedIds) {
        const n = rawNodes.get(id)!;
        const ownerKey = n.owner.toLowerCase();
        nodeSpawnedClones.set(id, []);
        nodeDirectBonusMap.set(id, 0);
        nodeUnilevelBonusMap.set(id, 0);

        if (!n.isClone && !n.isExtraId) {
          if (!ownerPrimaryNodeMap.has(ownerKey)) {
            ownerPrimaryNodeMap.set(ownerKey, n.id);
          }
          const existingMains = ownerAllMainNodesMap.get(ownerKey) || [];
          existingMains.push(n.id);
          ownerAllMainNodesMap.set(ownerKey, existingMains);

          originMainIdMap.set(n.id, n.id);
          spawnedFromMap.set(n.id, 0);
          cloneRoundMap.set(n.id, 0);
          cloneSequenceMap.set(n.id, 0);
          subCloneDepthMap.set(n.id, 0);
        } else if (n.isClone) {
          const walletFirstId = ownerPrimaryNodeMap.get(ownerKey) || n.id;
          const rawOnChainOrigin = onChainOriginMap.get(n.id) || 0;
          let onChainOrigin = 0;

          if (activeRank > 1) {
            if (rawOnChainOrigin === 1) {
              onChainOrigin = 1;
            } else if (rawOnChainOrigin > 1) {
              const ownerMains = ownerAllMainNodesMap.get(ownerKey) || [];
              const matchedByR1Id = ownerMains.find(
                (mId) => (onChainOriginMap.get(mId) || 0) === rawOnChainOrigin
              );
              const matchedByLocalId = ownerMains.find((mId) => mId === rawOnChainOrigin);
              const matchedLocalMain = matchedByR1Id || matchedByLocalId;
              if (matchedLocalMain) {
                onChainOrigin = matchedLocalMain;
              }
            }
          } else {
            onChainOrigin =
              rawOnChainOrigin === n.id || rawNodes.get(rawOnChainOrigin)?.isClone
                ? 0
                : rawOnChainOrigin;
          }

          let spawnedFromNodeId = 0;

          // 1. Primary pass: find unmatched right-child Rebirth trigger matching onChainOrigin (or any if onChainOrigin === 0)
          for (let lookback = id - 1; lookback >= 1; lookback--) {
            const candidateRightChild = rawNodes.get(lookback);
            if (!candidateRightChild || candidateRightChild.parentId <= 0) continue;
            const triggerParent = rawNodes.get(candidateRightChild.parentId);
            if (
              triggerParent &&
              triggerParent.rightChild === candidateRightChild.id &&
              triggerParent.owner.toLowerCase() === ownerKey &&
              !matchedRightTriggers.has(triggerParent.id) &&
              (onChainOrigin === 0 ||
                onChainOrigin === walletFirstId ||
                (originMainIdMap.get(triggerParent.id) || triggerParent.id) === onChainOrigin)
            ) {
              spawnedFromNodeId = triggerParent.id;
              matchedRightTriggers.add(triggerParent.id);
              break;
            }
          }

          // 2. Fallback pass: if still 0, check any unmatched right-child Rebirth trigger of the same owner
          if (spawnedFromNodeId === 0) {
            for (let lookback = id - 1; lookback >= 1; lookback--) {
              const candidateRightChild = rawNodes.get(lookback);
              if (!candidateRightChild || candidateRightChild.parentId <= 0) continue;
              const triggerParent = rawNodes.get(candidateRightChild.parentId);
              if (
                triggerParent &&
                triggerParent.rightChild === candidateRightChild.id &&
                triggerParent.owner.toLowerCase() === ownerKey &&
                !matchedRightTriggers.has(triggerParent.id)
              ) {
                spawnedFromNodeId = triggerParent.id;
                matchedRightTriggers.add(triggerParent.id);
                break;
              }
            }
          }

          if (spawnedFromNodeId === 0) {
            if (onChainOrigin > 0) {
              spawnedFromNodeId = onChainOrigin;
            } else {
              const ownerMains = ownerAllMainNodesMap.get(ownerKey) || [];
              const matchingSubtreeMain = [...ownerMains]
                .reverse()
                .find((mId) => mId < id && isAncestorOf(mId, id));
              spawnedFromNodeId = matchingSubtreeMain || walletFirstId;
            }
          }

          const triggerIsClone = Boolean(rawNodes.get(spawnedFromNodeId)?.isClone);
          const triggerResolvedMainId = triggerIsClone
            ? originMainIdMap.get(spawnedFromNodeId) || walletFirstId
            : spawnedFromNodeId;
          const originMainId =
            spawnedFromNodeId > 0 &&
            (onChainOrigin === 0 || onChainOrigin === walletFirstId)
              ? triggerResolvedMainId
              : onChainOrigin > 0
              ? onChainOrigin
              : triggerResolvedMainId;
          const subCloneDepth = triggerIsClone
            ? (subCloneDepthMap.get(spawnedFromNodeId) || 0) + 1
            : 0;

          const prevCount = nodeCloneRoundCount.get(originMainId) || 0;
          const currentCount = prevCount + 1;
          nodeCloneRoundCount.set(originMainId, currentCount);

          // การนับรอบโคลน (Clone Round): นับแยกตามรหัสหลักต้นสังกัด (originMainId) ในแต่ละ Rank
          // โคลนตัวที่ 1 ของรหัสหลักนั้น = รอบ 1, ตัวที่ 2 = รอบ 2, ตัวที่ 3 = รอบ 1 สลับกันไป (1 -> 2 -> 1 -> 2)
          const cloneRound = ((currentCount - 1) % 2) + 1;

          originMainIdMap.set(n.id, originMainId);
          spawnedFromMap.set(n.id, spawnedFromNodeId);
          cloneRoundMap.set(n.id, cloneRound);
          cloneSequenceMap.set(n.id, currentCount);
          subCloneDepthMap.set(n.id, subCloneDepth);

          const list = nodeSpawnedClones.get(spawnedFromNodeId) || [];
          list.push({ cloneNodeId: n.id, round: cloneRound, sequence: currentCount });
          nodeSpawnedClones.set(spawnedFromNodeId, list);
        } else {
          // Auto Extra ID ทำงานเหมือน Auto ID: เป็นรหัสหลักใหม่ของตัวเอง (originMainId = n.id) โดยมีผู้แนะนำคือรหัสหลักต้นทางที่สร้างมัน
          const walletFirstId = ownerPrimaryNodeMap.get(ownerKey) || 1;
          const sourceSponsorMainId = onChainSponsorNodeMap.get(n.id) || walletFirstId;
          originMainIdMap.set(n.id, n.id);
          extraIdSourceMainMap.set(n.id, sourceSponsorMainId);
          spawnedFromMap.set(n.id, 0);
          cloneRoundMap.set(n.id, 0);
          cloneSequenceMap.set(n.id, 0);
          subCloneDepthMap.set(n.id, 0);
        }
      }

      // Compute cross-rank Vault stats per Main ID and determine which Main IDs unlocked nextRank
      const buildOwnerMainNodesInRank = (r: number): Map<string, number[]> => {
        const snap = multiRankSnapshots.get(r);
        const map = new Map<string, number[]>();
        if (!snap) return map;
        const sIds = Array.from(snap.keys()).sort((a, b) => a - b);
        for (const sid of sIds) {
          const sn = snap.get(sid)!;
          if (!sn.isClone && !sn.isExtraId) {
            const oKey = sn.owner.toLowerCase();
            const list = map.get(oKey) || [];
            list.push(sn.id);
            map.set(oKey, list);
          }
        }
        return map;
      };

      const ownerMainsByRank = new Map<number, Map<string, number[]>>();
      for (const r of Array.from(ranksToSnapshot)) {
        ownerMainsByRank.set(r, buildOwnerMainNodesInRank(r));
      }

      // Map a Main ID in `sourceRank` to its corresponding Main ID in target rank `targetR`
      const getCorrespondingMainIdInRank = (
        sourceRank: number,
        sourceMainId: number,
        _ownerAddr: string,
        targetR: number
      ): number => {
        if (sourceRank === targetR) return sourceMainId;
        if (sourceMainId === 1) return 1;

        let r1Id = sourceMainId;
        if (sourceRank > 1) {
          const srcNode = multiRankSnapshots.get(sourceRank)?.get(sourceMainId);
          if (srcNode && srcNode.originMainId > 0) {
            r1Id = srcNode.originMainId;
          } else if (sourceRank === activeRank && onChainOriginMap.has(sourceMainId)) {
            r1Id = onChainOriginMap.get(sourceMainId)!;
          }
        }

        if (targetR === 1) return r1Id;

        const targetSnap = multiRankSnapshots.get(targetR);
        if (!targetSnap) return 0;
        const matched = Array.from(targetSnap.values()).find(
          (sn) => !sn.isClone && !sn.isExtraId && sn.originMainId === r1Id
        );
        return matched ? matched.id : 0;
      };

      // Check if a specific Main ID in rank `r` has unlocked `r + 1`
      const hasMainIdUnlockedNextRankIn = (r: number, mainIdInR: number, ownerAddr: string): boolean => {
        if (mainIdInR === 1) return true;
        return getCorrespondingMainIdInRank(r, mainIdInR, ownerAddr, r + 1) > 0;
      };

      // คำนวณสถานะ Rank ปัจจุบันของ Idหลักนั้นๆ (โดยอ้างอิงจาก Rank 1 Main ID `r1MainId` เท่านั้น แยกอิสระรายรหัสหลัก)
      const getMainIdCurrentRank = (r1MainId: number, ownerAddr: string): number => {
        if (r1MainId === 1) return 18;
        let maxR = 1;
        for (let r = 18; r >= 1; r--) {
          const snap = multiRankSnapshots.get(r);
          if (snap) {
            const corresp = getCorrespondingMainIdInRank(1, r1MainId, ownerAddr, r);
            if (corresp > 0 && snap.has(corresp)) {
              maxR = Math.max(maxR, r);
              break;
            }
          }
        }
        return maxR;
      };

      // คำนวณจุดเริ่มต้นของ 5 rank ย้อนหลัง (สถานะ rank ปัจจุบันของ idหลักนั้น ถอยหลัง 5 rank)
      // เช่น อยู่ Rank 1..5 -> window5Start = 1 (แปลว่า Rank 1-3 อยู่ในกรอบ 5 rank ย้อนหลังทั้งหมด ยังไม่เกิด New Auto ID Pool)
      // อยู่ Rank 6 -> window5Start = 2 (เฉพาะ Rank 1 ที่หลุดกรอบ 5 rank ย้อนหลัง เข้าสู่ New Auto ID Pool)
      const getMainIdWindow5Start = (r1MainId: number, ownerAddr: string): number => {
        const curRank = getMainIdCurrentRank(r1MainId, ownerAddr);
        return Math.max(1, curRank - 4);
      };

      // Pre-calculate cross-rank Vault 1-3 gross & remaining balances keyed by Rank 1 Main ID (`r1MainId`)
      // เฉพาะ Rank 1 ถึง 3 ที่พ้นกรอบ 5 rank ย้อนหลังของรหัสหลักนั้น (r < window5Start)
      const crossRankGrossVault1To4 = new Map<number, number>();
      const crossRankRemVault1To4 = new Map<number, number>();
      const crossRankAutoIdCount = new Map<number, number>();
      const crossRankBreakdownText = new Map<number, string>();
      const extraVaultFromRanks2To4 = new Map<number, number>();
      const extraVaultMinR1IdFromRanks2To4 = new Map<number, number>();
      const crossRankExtraIdCount = new Map<number, number>();
      const crossRankExtraCostMap = new Map<number, number>();
      const crossRankExtraRanksMap = new Map<number, string[]>();
      const crossRankExtraBreakdownText = new Map<number, string>();
      const crossRankExtraLeftVaultMap = new Map<number, number>();
      const crossRankExtraLeftVaultGrossMap = new Map<number, number>();
      const crossRankExtraLeftDirectBonusMap = new Map<number, number>();
      const crossRankExtraLeftLevelBonusMap = new Map<number, number>();

      const snap1ForExtra = multiRankSnapshots.get(1);
      const snap4ForExtra = multiRankSnapshots.get(4);
      const resolveExtraSpawnerInR1 = (rankNum: number, extraNode: any): number => {
        if (snap1ForExtra) {
          const extraOwner = (extraNode.owner || '').toLowerCase();
          const ownerMains = Array.from(snap1ForExtra.values()).filter(
            (m) => !m.isClone && !m.isExtraId && (m.owner || '').toLowerCase() === extraOwner
          );
          if (ownerMains.length === 1) return ownerMains[0].id;
          if (ownerMains.length > 1) {
            const rank9Main = ownerMains.find(
              (m) => m.id === 1 || getMainIdCurrentRank(m.id, m.owner) >= 9
            );
            if (rank9Main) return rank9Main.id;
            const eligibleMain = ownerMains.find(
              (m) =>
                m.id === 1 ||
                (snap4ForExtra &&
                  Array.from(snap4ForExtra.values()).some(
                    (x) => !x.isClone && !x.isExtraId && x.originMainId === m.id
                  ))
            );
            if (eligibleMain) return eligibleMain.id;
            return ownerMains[0].id;
          }
        }
        const sourceMainInR =
          extraNode.directSponsorNodeId && extraNode.directSponsorNodeId > 0
            ? extraNode.directSponsorNodeId
            : extraNode.originMainId > 0 && extraNode.originMainId !== extraNode.id
            ? extraNode.originMainId
            : 1;
        return rankNum === 1
          ? sourceMainInR
          : getCorrespondingMainIdInRank(rankNum, sourceMainInR, extraNode.owner, 1) || sourceMainInR;
      };

      // Update extraIdSourceMainMap in activeRank so every Extra ID points to the exact Rank 1 Main ID that spawned it (e.g. #2 for Extra R2-#6)
      for (const n of rawNodes.values()) {
        if (n.isExtraId && !n.isClone) {
          extraIdSourceMainMap.set(n.id, resolveExtraSpawnerInR1(activeRank, n));
        }
      }

      // Count actual spawned Auto Extra IDs (!isClone && isExtraId) from Rank 18 down to Rank 1 per Rank 1 Main ID (`r1MainId`)
      // and accumulate any left-child rewards from EXTRA IDs back to their directSponsor
      for (let r = 18; r >= 1; r--) {
        const snapR = multiRankSnapshots.get(r);
        if (!snapR) continue;
        const rPrice = RANK_PRICES_USDT[r - 1] || 10;
        for (const sn of snapR.values()) {
          if (sn.isExtraId && !sn.isClone) {
            const r1Main = resolveExtraSpawnerInR1(r, sn);
            crossRankExtraIdCount.set(r1Main, (crossRankExtraIdCount.get(r1Main) || 0) + 1);
            crossRankExtraCostMap.set(
              r1Main,
              Number(((crossRankExtraCostMap.get(r1Main) || 0) + rPrice).toFixed(4))
            );
            const list = crossRankExtraRanksMap.get(r1Main) || [];
            list.push(`R${r}`);
            crossRankExtraRanksMap.set(r1Main, list);
          }

          // กรณี EXTRA ID (หรือโคลนของ EXTRA ID) มีเม็ดซ้าย (leftChild > 0):
          // - 30% ค่าแนะนำ ส่งกลับไปให้ directSponsor (รหัสหลักต้นทางที่สร้าง Extra ID นั้น เช่น Main #2)
          // - 30% ค่าชั้น ส่งกลับไปให้ directSponsor
          // - Vault (35%) ส่งกลับที่ New Extra ID Pool ของ directSponsor
          const snOrigin = !sn.isClone
            ? sn
            : Array.from(snapR.values()).find(
                (x) =>
                  !x.isClone &&
                  x.owner.toLowerCase() === sn.owner.toLowerCase() &&
                  (x.originMainId === sn.originMainId || x.id === sn.originMainId)
              ) || sn;
          const isSnExtraLineage = !sn.isClone
            ? Boolean(sn.isExtraId)
            : Boolean(sn.isExtraId || snOrigin.isExtraId);
          if (isSnExtraLineage && sn.leftChild > 0) {
            const r1SponsorMain = resolveExtraSpawnerInR1(r, snOrigin);
            const lcNode = snapR.get(sn.leftChild);
            if (lcNode?.isAdminFreeUpgrade) continue;
            const lcOrigMain = lcNode
              ? lcNode.originMainId > 0 && lcNode.originMainId < 1_000_000
                ? lcNode.originMainId
                : getCorrespondingMainIdInRank(r, lcNode.id, lcNode.owner, 1)
              : 0;
            const isLcRoot1Clone = Boolean(lcNode?.isClone && (lcOrigMain === 1 || sn.id === 1));
            if (!isLcRoot1Clone) {
              const snap1Lookup = multiRankSnapshots.get(1);
              let lcR1DirectSponsor = r1SponsorMain;
              if (lcNode && !lcNode.isExtraId && lcOrigMain > 1 && snap1Lookup) {
                const origR1Node = snap1Lookup.get(lcOrigMain);
                if (origR1Node && origR1Node.directSponsorNodeId > 0) {
                  lcR1DirectSponsor = origR1Node.directSponsorNodeId;
                }
              }
              crossRankExtraLeftDirectBonusMap.set(
                lcR1DirectSponsor,
                Number(((crossRankExtraLeftDirectBonusMap.get(lcR1DirectSponsor) || 0) + rPrice * 0.3).toFixed(4))
              );
            }
            crossRankExtraLeftLevelBonusMap.set(
              r1SponsorMain,
              Number(((crossRankExtraLeftLevelBonusMap.get(r1SponsorMain) || 0) + rPrice * 0.3).toFixed(4))
            );
            const nextLeftVaultGross = Number(
              ((crossRankExtraLeftVaultGrossMap.get(r1SponsorMain) || 0) + rPrice * 0.35).toFixed(4)
            );
            crossRankExtraLeftVaultGrossMap.set(r1SponsorMain, nextLeftVaultGross);
            crossRankExtraLeftVaultMap.set(r1SponsorMain, nextLeftVaultGross);
          }
        }
      }

      const snap1ForMains = multiRankSnapshots.get(1);
      if (snap1ForMains) {
        const s1Ids = Array.from(snap1ForMains.keys()).sort((a, b) => a - b);
        for (const r1Id of s1Ids) {
          const n1 = snap1ForMains.get(r1Id)!;
          if (n1.isClone || n1.isExtraId) continue;

          const curRank = getMainIdCurrentRank(r1Id, n1.owner);
          const window5Start = getMainIdWindow5Start(r1Id, n1.owner);

          let totalGross1To3 = 0;
          let totalRem1To3 = 0;
          let extraR2To3 = 0;
          let extraR2To3Rem = 0;
          let extraMinR1Id = r1Id;
          const grossParts: string[] = [];
          const remParts: string[] = [];

          for (let r = 1; r <= 3; r++) {
            // กฎเหล็ก Pool 2 (New Auto ID Pool): ยอดสะสม Vault (35%) ใน Rank 1 ถึง 3 ลบด้วย 5 rank ย้อนหลัง
            // ดังนั้นหาก r >= window5Start แปลว่า Rank r ยังอยู่ในกรอบ 5 rank ย้อนหลัง (Upgrade Rank Pool) จะไม่ถูกนำมาคิดใน New Auto ID Pool
            if (r >= window5Start) continue;

            const snapR = multiRankSnapshots.get(r);
            if (!snapR) continue;
            const correspId = getCorrespondingMainIdInRank(1, r1Id, n1.owner, r);
            if (correspId <= 0 || !snapR.has(correspId)) continue;

            const rUnitVault = (RANK_PRICES_USDT[r - 1] || 5) * 0.35;
            let leftCountInR = 0;
            for (const sn of snapR.values()) {
              const isSnSameMain =
                sn.id === correspId ||
                (sn.isClone && (sn.originMainId === correspId || sn.originMainId === r1Id));
              if (isSnSameMain && sn.leftChild > 0) {
                const lcNode = snapR.get(sn.leftChild);
                if (lcNode?.isAdminFreeUpgrade) continue;
                leftCountInR++;
                if (r > 1) {
                  if (lcNode && !lcNode.isClone && !lcNode.isExtraId) {
                    const r1Orig =
                      lcNode.originMainId > 0 && lcNode.originMainId < 1_000_000
                        ? lcNode.originMainId
                        : getCorrespondingMainIdInRank(r, lcNode.id, lcNode.owner, 1);
                    if (
                      r1Orig > r1Id &&
                      r1Orig < 1_000_000 &&
                      (extraMinR1Id === r1Id || r1Orig < extraMinR1Id)
                    ) {
                      extraMinR1Id = r1Orig;
                    }
                  }
                }
              }
            }

            const grossR = Number((leftCountInR * rUnitVault).toFixed(4));
            const remR = Number((snapR.get(correspId)?.nodeVault ?? 0).toFixed(4));

            if (grossR > 0 || remR > 0) {
              totalGross1To3 = Number((totalGross1To3 + grossR).toFixed(4));
              totalRem1To3 = Number((totalRem1To3 + remR).toFixed(4));
              if (r > 1) {
                extraR2To3 = Number((extraR2To3 + grossR).toFixed(4));
                extraR2To3Rem = Number((extraR2To3Rem + remR).toFixed(4));
              }
              grossParts.push(`R${r}: ${grossR.toFixed(2)}`);
              remParts.push(`R${r}: ${remR.toFixed(2)}`);
            }
          }

          const deducted = Math.max(0, Number((totalGross1To3 - totalRem1To3).toFixed(4)));
          const r1EntryPrice = RANK_PRICES_USDT[0] || 5;
          const r1UnitVault = Number((r1EntryPrice * 0.35).toFixed(4));
          const maxPossibleSpawns =
            window5Start > 1 ? Math.floor((deducted + 1e-4) / r1EntryPrice) : 0;
          let taggedAutoCountForMain = 0;
          for (const sn of snap1ForMains.values()) {
            if (
              sn.id > r1Id &&
              !sn.isClone &&
              !sn.isExtraId &&
              sn.originType === 'AUTO_NEW_MAIN' &&
              (sn.owner || '').toLowerCase() === (n1.owner || '').toLowerCase() &&
              (sn.directSponsorNodeId === r1Id || (r1Id === 1 && sn.directSponsorNodeId <= 1))
            ) {
              taggedAutoCountForMain++;
            }
          }
          const repForR1 = perIdReportsMap.get(r1Id);
          const repAutoCount = Array.isArray(repForR1?.autoIdsSpawned)
            ? repForR1.autoIdsSpawned.length
            : Number(repForR1?.totalAutoIdCount || 0);
          let spawnedCount = 0;
          if (r1Id === 1) {
            spawnedCount = Math.max(maxPossibleSpawns, taggedAutoCountForMain, repAutoCount);
          } else if (perIdReportsMap.has(r1Id) || taggedAutoCountForMain > 0) {
            spawnedCount = Math.max(repAutoCount, taggedAutoCountForMain);
          } else if (maxPossibleSpawns > 0) {
            // สำหรับ Main ID > 1 ที่ไม่ได้ใช้ยอดอัปเกรด
            for (let c = maxPossibleSpawns; c >= 1; c--) {
              const pool2GrossNeeded = Number((totalRem1To3 + c * r1EntryPrice).toFixed(4));
              const unitsVault = pool2GrossNeeded / r1UnitVault;
              if (
                pool2GrossNeeded <= totalGross1To3 + 0.01 &&
                Math.abs(unitsVault - Math.round(unitsVault)) < 0.01
              ) {
                spawnedCount = c;
                break;
              }
            }
          }

          crossRankGrossVault1To4.set(r1Id, totalGross1To3);
          crossRankRemVault1To4.set(r1Id, totalRem1To3);
          const effectiveExtraR2To3 = Math.max(0, Number((extraR2To3 - extraR2To3Rem).toFixed(4)));
          extraVaultFromRanks2To4.set(r1Id, spawnedCount > 0 ? extraR2To3 : effectiveExtraR2To3);
          extraVaultMinR1IdFromRanks2To4.set(r1Id, extraMinR1Id);
          crossRankAutoIdCount.set(r1Id, spawnedCount);

          if (grossParts.length > 1 && spawnedCount > 0) {
            crossRankBreakdownText.set(
              r1Id,
              `สะสม R1-R3: ${totalGross1To3.toFixed(2)} U (${grossParts.join(' + ')}) • ออก Auto ID -${(
                spawnedCount * r1EntryPrice
              ).toFixed(2)} U • คงเหลือ ${remParts.join(', ')} U`
            );
          } else if (spawnedCount > 0) {
            crossRankBreakdownText.set(
              r1Id,
              `สะสม ${totalGross1To3.toFixed(2)} U • ออก Auto ID -${(spawnedCount * r1EntryPrice).toFixed(2)} U`
            );
          }

          // Pre-calculate Pool 3 (New Extra ID Pool: รวมยอดเก่าคงเหลือ + Ranks 4..18 + เม็ดซ้าย Extra ก่อนสร้าง Extra ID) breakdown per Rank 1 Main ID (`r1Id`)
          let totalGross4To27 = 0;
          let totalRem4To27 = 0;
          const extraGrossParts: string[] = [];
          const extraRemParts: string[] = [];

          for (let r = 4; r <= 18; r++) {
            if (curRank < 18 && r >= window5Start) continue;
            const snapR = multiRankSnapshots.get(r);
            if (!snapR) continue;
            const correspId = getCorrespondingMainIdInRank(1, r1Id, n1.owner, r);
            if (correspId <= 0 || !snapR.has(correspId)) continue;

            const rUnitVault = (RANK_PRICES_USDT[r - 1] || 30) * 0.35;
            let leftCountInR = 0;
            for (const sn of snapR.values()) {
              const isSnSameMain =
                sn.id === correspId ||
                (sn.isClone && (sn.originMainId === correspId || sn.originMainId === r1Id));
              if (isSnSameMain && sn.leftChild > 0) {
                const lcNode = snapR.get(sn.leftChild);
                if (!lcNode?.isAdminFreeUpgrade) {
                  leftCountInR++;
                }
              }
            }

            const grossR = Number((leftCountInR * rUnitVault).toFixed(4));
            const remR = Number((snapR.get(correspId)?.nodeVault ?? 0).toFixed(4));

            if (grossR > 0 || remR > 0) {
              totalGross4To27 = Number((totalGross4To27 + grossR).toFixed(4));
              totalRem4To27 = Number((totalRem4To27 + remR).toFixed(4));
              extraGrossParts.push(`R${r}: ${grossR.toFixed(2)}`);
              if (remR > 0) {
                extraRemParts.push(`ยอดเก่า R${r}: ${remR.toFixed(2)}`);
              }
            }
          }

          const extraLeftVaultBonusGross = crossRankExtraLeftVaultGrossMap.get(r1Id) || 0;
          const totalExtraCostForMain = crossRankExtraCostMap.get(r1Id) || 0;
          const repExtraBonus = perIdReportsMap.get(r1Id)?.extraLeftVaultBonus;

          let remainingExtraLeftBonus = 0;
          if (typeof repExtraBonus === 'number') {
            remainingExtraLeftBonus = repExtraBonus;
          } else {
            // Smart Contract & Database rules: Extra ID costs are absorbed by R4..18 vaults first
            const deductedFromR4To27 = Math.max(0, Number((totalGross4To27 - totalRem4To27).toFixed(4)));
            const remainingCostForBonus = Math.max(0, Number((totalExtraCostForMain - deductedFromR4To27).toFixed(4)));
            const deductedFromExtraLeftBonus = Math.min(extraLeftVaultBonusGross, remainingCostForBonus);
            remainingExtraLeftBonus = Math.max(
              0,
              Number((extraLeftVaultBonusGross - deductedFromExtraLeftBonus).toFixed(4))
            );
          }
          crossRankExtraLeftVaultMap.set(r1Id, remainingExtraLeftBonus);

          if (extraLeftVaultBonusGross > 0) {
            totalGross4To27 = Number((totalGross4To27 + extraLeftVaultBonusGross).toFixed(4));
            totalRem4To27 = Number((totalRem4To27 + remainingExtraLeftBonus).toFixed(4));
            extraGrossParts.push(`เม็ดซ้าย Extra: +${extraLeftVaultBonusGross.toFixed(2)}`);
            if (remainingExtraLeftBonus > 0) {
              extraRemParts.push(`เม็ดซ้าย Extra: ${remainingExtraLeftBonus.toFixed(2)}`);
            }
          }

          const extraDeducted = Math.max(0, Number((totalGross4To27 - totalRem4To27).toFixed(4)));
          const extraSpawned = crossRankExtraIdCount.get(r1Id) || 0;
          const spawnedRanks = crossRankExtraRanksMap.get(r1Id) || [];
          const spawnedRanksLabel = spawnedRanks.length > 0 ? ` (${spawnedRanks.join(', ')})` : '';
          if (extraGrossParts.length > 0 && (extraDeducted > 0 || extraSpawned > 0)) {
            crossRankExtraBreakdownText.set(
              r1Id,
              `รวมยอดเก่า+ยอดใหม่ก่อนสร้าง Extra ID: ${totalGross4To27.toFixed(2)} U (${extraGrossParts.join(' + ')}) • ลูป R27→R2 ออก Extra ID${spawnedRanksLabel} -${extraDeducted.toFixed(
                2
              )} U${extraRemParts.length > 0 ? ` • คงเหลือสะสมรวมยอดเก่า ${totalRem4To27.toFixed(2)} U (${extraRemParts.join(', ')})` : ''}`
            );
          } else if (extraRemParts.length > 0) {
            crossRankExtraBreakdownText.set(
              r1Id,
              `รวมยอดเก่าคงเหลือสะสม ${totalRem4To27.toFixed(2)} U (${extraRemParts.join(' + ')}) ก่อนสร้าง Extra ID`
            );
          }
        }
      }

      // Helper to resolve the exact Sponsor Main Node ID using Clone Lineage (originMainIdMap)
      const resolveSponsorNodeIdForNode = (nodeId: number, sponsorAddr: string): number => {
        const snap1 = multiRankSnapshots.get(1);
        if (autoIdSourceMainMap.has(nodeId)) {
          return autoIdSourceMainMap.get(nodeId)!;
        }
        if (extraIdSourceMainMap.has(nodeId)) {
          return extraIdSourceMainMap.get(nodeId)!;
        }
        const n = rawNodes.get(nodeId);

        // If nodeId is a clone, it ALWAYS inherits the sponsor of its originMainId (never originMainId itself, except Root #1)
        if (n && n.isClone) {
          const originMain = originMainIdMap.get(nodeId) || nodeId;
          if (activeRank > 1) {
            const r1OriginMain =
              onChainOriginMap.get(nodeId) ||
              onChainOriginMap.get(originMain) ||
              getCorrespondingMainIdInRank(activeRank, originMain, n.owner, 1);
            if (r1OriginMain === 1) {
              return 1;
            }
            if (r1OriginMain > 1 && snap1) {
              const origR1Node = snap1.get(r1OriginMain);
              if (origR1Node && origR1Node.directSponsorNodeId > 0) {
                return origR1Node.directSponsorNodeId;
              }
            }
            const explicitCloneSp =
              onChainSponsorNodeMap.get(nodeId) || onChainSponsorNodeMap.get(originMain) || 0;
            if (explicitCloneSp > 0) {
              return explicitCloneSp;
            }
          }
          if (originMain !== nodeId) {
            if (originMain === 1) {
              return 1;
            }
            if (autoIdSourceMainMap.has(originMain)) {
              return autoIdSourceMainMap.get(originMain)!;
            }
            if (extraIdSourceMainMap.has(originMain)) {
              return extraIdSourceMainMap.get(originMain)!;
            }
            const onChainOriginSponsor = onChainSponsorNodeMap.get(originMain) || 0;
            if (onChainOriginSponsor > 0) {
              return onChainOriginSponsor;
            }
            const originNode = rawNodes.get(originMain);
            const effectiveSponsorAddr =
              originNode &&
              originNode.directSponsor &&
              originNode.directSponsor !== ethers.ZeroAddress
                ? originNode.directSponsor
                : sponsorAddr;
            return resolveSponsorNodeIdForNode(originMain, effectiveSponsorAddr);
          }
        }

        // ผู้แนะนำใน Rank 2-18 ห้ามเปลี่ยน! ต้องยึดตามผู้แนะนำเดิมของรหัสหลักนั้นจาก Rank 1 (snap1) เสมอ
        if (activeRank > 1 && snap1) {
          if (n) {
            const localOrigin = originMainIdMap.get(nodeId) || nodeId;
            const r1MainId =
              onChainOriginMap.get(nodeId) ||
              onChainOriginMap.get(localOrigin) ||
              getCorrespondingMainIdInRank(activeRank, localOrigin, n.owner, 1);
            const exactUserR1 = r1MainId > 0 ? snap1.get(r1MainId) : undefined;
            if (exactUserR1) {
              if (exactUserR1.directSponsorNodeId && exactUserR1.directSponsorNodeId > 0) {
                return exactUserR1.directSponsorNodeId;
              }
              if (exactUserR1.directSponsor && exactUserR1.directSponsor !== ethers.ZeroAddress) {
                const spNodeInR1 = Array.from(snap1.values()).find(
                  (sn) =>
                    sn.owner.toLowerCase() === exactUserR1.directSponsor.toLowerCase() &&
                    !sn.isClone &&
                    !sn.isExtraId
                );
                if (spNodeInR1) return spNodeInR1.id;
              }
            }
            const explicitOnChainSp =
              onChainSponsorNodeMap.get(nodeId) || onChainSponsorNodeMap.get(localOrigin) || 0;
            if (explicitOnChainSp > 0) {
              return explicitOnChainSp;
            }
            const fallbackUserR1 = Array.from(snap1.values()).find(
              (sn) => sn.owner.toLowerCase() === n.owner.toLowerCase() && !sn.isClone && !sn.isExtraId
            );
            if (fallbackUserR1) {
              const spR1Id = fallbackUserR1.directSponsorNodeId;
              if (spR1Id && spR1Id > 0) return spR1Id;
              if (fallbackUserR1.directSponsor && fallbackUserR1.directSponsor !== ethers.ZeroAddress) {
                const spNodeInR1 = Array.from(snap1.values()).find(
                  (sn) =>
                    sn.owner.toLowerCase() === fallbackUserR1.directSponsor.toLowerCase() &&
                    !sn.isClone &&
                    !sn.isExtraId
                );
                if (spNodeInR1) return spNodeInR1.id;
              }
            }
          }
          if (sponsorAddr && sponsorAddr !== ethers.ZeroAddress) {
            const spNodeInR1 = Array.from(snap1.values()).find(
              (sn) => sn.owner.toLowerCase() === sponsorAddr.toLowerCase() && !sn.isClone && !sn.isExtraId
            );
            if (spNodeInR1) return spNodeInR1.id;
          }
        }

        const directOnChainSponsor = onChainSponsorNodeMap.get(nodeId) || 0;
        if (directOnChainSponsor > 0) {
          return directOnChainSponsor;
        }

        if (!sponsorAddr || sponsorAddr === ethers.ZeroAddress) return 0;
        const sponsorKey = sponsorAddr.toLowerCase();

        if (snap1) {
          const spNodeInR1 = Array.from(snap1.values()).find(
            (sn) => sn.owner.toLowerCase() === sponsorKey && !sn.isClone && !sn.isExtraId
          );
          if (spNodeInR1) return spNodeInR1.id;
        }

        const candidateMainIds = (ownerAllMainNodesMap.get(sponsorKey) || []).filter(
          (mId) => mId < nodeId
        );
        if (candidateMainIds.length === 0) {
          return ownerPrimaryNodeMap.get(sponsorKey) || 1;
        }
        if (candidateMainIds.length === 1) {
          return candidateMainIds[0];
        }

        // Walk up ancestors from nodeId.parentId; if any ancestor (Main ID or Clone) belongs to sponsorAddr, return its originMainId
        let curr = n?.parentId || 0;
        const visitedAnc = new Set<number>();
        while (curr > 0 && !visitedAnc.has(curr)) {
          visitedAnc.add(curr);
          const anc = rawNodes.get(curr);
          if (!anc) break;
          if (anc.owner.toLowerCase() === sponsorKey) {
            const ancOriginMain = originMainIdMap.get(anc.id) || anc.id;
            if (ancOriginMain < nodeId) {
              return ancOriginMain;
            }
          }
          curr = anc.parentId;
        }

        return candidateMainIds[0];
      };

      // Pass 2: Chronological simulation of Auto New Main IDs, Left-Child Direct (30%), Unilevel (15 tiers x 2%), and Vault Pools (35%)
      const rank1EntryPrice = RANK_PRICES_USDT[0] || 5;
      const usedExtraR2To4ForMain = new Set<number>();
      const nodeSpawnedAutoIds = new Map<number, number[]>();

      const isPlacedUnderMainOrClonesActive = (mId: number, targetId: number): boolean => {
        if (targetId <= mId) return false;
        if (mId === 1) return true;
        let curr = rawNodes.get(targetId)?.parentId || 0;
        const visited = new Set<number>();
        while (curr > 0 && !visited.has(curr)) {
          visited.add(curr);
          if (curr === mId) return true;
          const pNode = rawNodes.get(curr);
          if (!pNode) break;
          if (pNode.isClone && (originMainIdMap.get(curr) || pNode.id) === mId) {
            return true;
          }
          curr = pNode.parentId;
        }
        return false;
      };

      for (const id of sortedIds) {
        const n = rawNodes.get(id)!;
        const ownerKey = n.owner.toLowerCase();
        const firstMainOfOwner = ownerPrimaryNodeMap.get(ownerKey) || n.id;

        // 1. Check if this node was spawned as an Auto New Main ID from Pool 2 (Rank 1..3 Vault >= 10 USDT)
        if (!n.isClone && !n.isExtraId && n.id > firstMainOfOwner) {
          const explicitSponsorId = onChainSponsorNodeMap.get(n.id) || 0;
          const isBackendTaggedAuto =
            onChainOriginTypeMap.get(n.id) === 'AUTO_NEW_MAIN' ||
            Boolean((n as any).isSyntheticAutoMain);
          const priorMains = (ownerAllMainNodesMap.get(ownerKey) || []).filter((mId) => {
            if (mId >= n.id) return false;
            if (getMainIdWindow5Start(mId, n.owner) <= 1) return false;
            const maxAllowedSpawns = crossRankAutoIdCount.get(mId) || 0;
            const currentSpawns = mainNodeAutoIdSpawnCount.get(mId) || 0;
            if (currentSpawns >= maxAllowedSpawns) return false;
            // กฎเหล็กการจัดวางบนสัญญา (_findPlacementSpot): Auto ID ที่เกิดจาก mId จะต้องวางอยู่ใต้สายงาน/โคลนของ mId เท่านั้น
            // ดังนั้น R1-#3 (ซึ่งวางอยู่ใต้ #1 ฝั่งขวา ไม่ได้อยู่ใต้ #2) จะไม่มีวันถูกมองเป็น Auto ID ของ #2 เด็ดขาด
            if (!isPlacedUnderMainOrClonesActive(mId, n.id)) return false;
            const mSpId = onChainSponsorNodeMap.get(mId) || 1;
            return (
              explicitSponsorId === 0 ||
              mId === explicitSponsorId ||
              explicitSponsorId === mSpId
            );
          });

          let sourceMain = priorMains.find(
            (mId) => (lineageAutoIdVault.get(mId) || 0) + 1e-9 >= rank1EntryPrice
          );
          if (sourceMain === undefined && activeRank === 1) {
            sourceMain = priorMains.find((mId) => {
              if (usedExtraR2To4ForMain.has(mId)) return false;
              const minReqR1Id = extraVaultMinR1IdFromRanks2To4.get(mId) || mId;
              if (n.id <= minReqR1Id) return false;
              const r1Bal = lineageAutoIdVault.get(mId) || 0;
              const extraBal = extraVaultFromRanks2To4.get(mId) || 0;
              return r1Bal + extraBal + 1e-9 >= rank1EntryPrice;
            });
            if (sourceMain !== undefined) {
              usedExtraR2To4ForMain.add(sourceMain);
              const r1Bal = lineageAutoIdVault.get(sourceMain) || 0;
              const extraBal = extraVaultFromRanks2To4.get(sourceMain) || 0;
              lineageAutoIdVault.set(sourceMain, Number((r1Bal + extraBal).toFixed(4)));
            }
          }
          if (sourceMain === undefined && isBackendTaggedAuto) {
            if (priorMains.length > 0) {
              sourceMain =
                explicitSponsorId > 0 && priorMains.includes(explicitSponsorId)
                  ? explicitSponsorId
                  : priorMains[0];
            } else {
              sourceMain = explicitSponsorId > 0 ? explicitSponsorId : firstMainOfOwner;
            }
          }

          if (sourceMain !== undefined) {
            autoMainNodeIds.add(n.id);
            autoIdSourceMainMap.set(n.id, sourceMain);
            mainNodeAutoIdSpawnCount.set(
              sourceMain,
              (mainNodeAutoIdSpawnCount.get(sourceMain) || 0) + 1
            );
            const spawnedList = nodeSpawnedAutoIds.get(sourceMain) || [];
            if (!spawnedList.includes(n.id)) {
              spawnedList.push(n.id);
              nodeSpawnedAutoIds.set(sourceMain, spawnedList);
            }
            const currentAutoVault = lineageAutoIdVault.get(sourceMain) || 0;
            lineageAutoIdVault.set(
              sourceMain,
              Math.max(0, Number((currentAutoVault - rank1EntryPrice).toFixed(4)))
            );
          }
        }

        if (n.isExtraId && !n.isClone) {
          const sourceMain = extraIdSourceMainMap.get(n.id) || firstMainOfOwner;
          lineageExtraIdSpawnCount.set(
            sourceMain,
            (lineageExtraIdSpawnCount.get(sourceMain) || 0) + 1
          );
          const currentExtraVault = lineageExtraIdVault.get(sourceMain) || 0;
          if (currentExtraVault >= unitPrice) {
            lineageExtraIdVault.set(
              sourceMain,
              Math.max(0, Number((currentExtraVault - unitPrice).toFixed(4)))
            );
          }
        }

        // 2. If this node is placed as a Left Child, distribute rewards (skip when isAdminFreeUpgrade)
        if (n.parentId > 0 && !n.isAdminFreeUpgrade) {
          const parent = rawNodes.get(n.parentId);
          if (parent && parent.leftChild === n.id) {
            const parentMainId = originMainIdMap.get(parent.id) || parent.id;
            const parentMainNode = rawNodes.get(parentMainId);
            const isParentExtraLineage = !parent.isClone
              ? Boolean(parent.isExtraId)
              : Boolean(parent.isExtraId || parentMainNode?.isExtraId);

            // กฎหลัก Rank 2-18: ห้ามเปลี่ยนข้อมูล ผู้แนะนำตรง (Direct Sponsor)
            // 30% ค่าแนะนำตรง (Direct Sponsor) ต้องจ่ายให้ ผู้แนะนำตรงของโหนดที่วาง (อ้างอิงที่ Rank 1 เสมอ)
            const isId1Clone =
              n.isClone &&
              (originMainIdMap.get(n.id) === 1 || onChainOriginMap.get(n.id) === 1);
            const hasSponsor = Boolean(
              n.directSponsor && n.directSponsor !== ethers.ZeroAddress
            );

            if (isId1Clone || !hasSponsor) {
              const targetLineage = originMainIdMap.get(n.id) || 1;
              lineageFamilyPoolDirectMap.set(
                targetLineage,
                Number(((lineageFamilyPoolDirectMap.get(targetLineage) || 0) + directBonusUnit).toFixed(4))
              );
            } else {
              const sponsorNodeId = resolveSponsorNodeIdForNode(n.id, n.directSponsor);
              const targetSponsorNodeInActiveRank =
                activeRank === 1
                  ? sponsorNodeId
                  : getCorrespondingMainIdInRank(1, sponsorNodeId, n.directSponsor, activeRank);
              if (targetSponsorNodeInActiveRank > 0) {
                nodeDirectBonusMap.set(
                  targetSponsorNodeInActiveRank,
                  Number(
                    ((nodeDirectBonusMap.get(targetSponsorNodeInActiveRank) || 0) + directBonusUnit).toFixed(4)
                  )
                );
              }
            }

            if (isParentExtraLineage) {
              const extraSponsorR1MainId =
                extraIdSourceMainMap.get(parentMainId) ||
                resolveExtraSpawnerInR1(activeRank, parentMainNode || parent) ||
                1;
              const extraSponsorLocalMainId =
                activeRank === 1
                  ? extraSponsorR1MainId
                  : getCorrespondingMainIdInRank(
                      1,
                      extraSponsorR1MainId,
                      (parentMainNode || parent).owner,
                      activeRank
                    );
              const fullLevelBonusUnit = Number((unitPrice * 0.3).toFixed(4));

              if (extraSponsorLocalMainId > 0) {
                // 2. 30% ค่าชั้น -> ส่งกลับไปให้เจ้าของรหัสหลักที่สร้าง Extra ID
                nodeUnilevelBonusMap.set(
                  extraSponsorLocalMainId,
                  Number(((nodeUnilevelBonusMap.get(extraSponsorLocalMainId) || 0) + fullLevelBonusUnit).toFixed(4))
                );

                // 3. Vault (35%) -> ส่งกลับที่ New Extra ID Pool ของเจ้าของรหัสหลักที่สร้าง Extra ID
                lineageExtraIdVault.set(
                  extraSponsorLocalMainId,
                  Number(((lineageExtraIdVault.get(extraSponsorLocalMainId) || 0) + vaultUnit).toFixed(4))
                );
                lineageGrossVaultMap.set(
                  extraSponsorLocalMainId,
                  Number(((lineageGrossVaultMap.get(extraSponsorLocalMainId) || 0) + vaultUnit).toFixed(4))
                );
              }
            } else {

              // B. 15-Level Unilevel (2% per tier)
              let currUplineId = n.parentId;
              for (let tier = 1; tier <= 15 && currUplineId > 0; tier++) {
                const upNode = rawNodes.get(currUplineId);
                if (!upNode?.isAdminFreeUpgrade) {
                  nodeUnilevelBonusMap.set(
                    currUplineId,
                    Number(((nodeUnilevelBonusMap.get(currUplineId) || 0) + unilevelBonusUnit).toFixed(4))
                  );
                }
                currUplineId = upNode ? upNode.parentId : 0;
              }

              // C. 35% Left-Child Upgrade Vault (per Main ID — เงินแยกของใครของมัน)
              lineageGrossVaultMap.set(
                parentMainId,
                Number(((lineageGrossVaultMap.get(parentMainId) || 0) + vaultUnit).toFixed(4))
              );

              const parentR1Main =
                activeRank === 1
                  ? parentMainId
                  : getCorrespondingMainIdInRank(activeRank, parentMainId, parent.owner, 1) ||
                    parentMainId;
              const parentWindow5Start = getMainIdWindow5Start(parentR1Main, parent.owner);
              const parentCurRank = getMainIdCurrentRank(parentR1Main, parent.owner);

              if (activeRank <= 3 && activeRank < parentWindow5Start) {
                // พ้นกรอบ 5 rank ย้อนหลังใน Rank 1-3 -> เข้า New Auto ID Pool
                lineageAutoIdVault.set(
                  parentMainId,
                  Number(((lineageAutoIdVault.get(parentMainId) || 0) + vaultUnit).toFixed(4))
                );
              } else if (
                activeRank >= 4 &&
                (parentCurRank >= 18 || activeRank < parentWindow5Start)
              ) {
                // พ้นกรอบ 5 rank ย้อนหลังใน Rank 4-18 (หรืออยู่ Rank 18) -> เข้า New Extra ID Pool
                lineageExtraIdVault.set(
                  parentMainId,
                  Number(((lineageExtraIdVault.get(parentMainId) || 0) + vaultUnit).toFixed(4))
                );
              } else {
                // อยู่ในกรอบ 5 rank ย้อนหลัง -> เข้า Upgrade Rank Pool
                const updatedUpgradeVault = Number(
                  ((lineageUpgradeVault.get(parentMainId) || 0) + vaultUnit).toFixed(4)
                );
                if (updatedUpgradeVault >= nextPrice) {
                  lineageHasUpgraded.set(parentMainId, true);
                  lineageUpgradeVault.set(parentMainId, 0);
                } else {
                  lineageUpgradeVault.set(parentMainId, updatedUpgradeVault);
                }
              }
            }
          }
        }
      }

      // Compute unified cross-rank summary keyed by Rank 1 Main ID (`r1MainId`)
      // so Box 2 (`สะสมรหัสหลัก (#...) แยกเงิน`) displays the exact same cumulative data in Rank 1 (where each Main ID originates) across all Ranks 1-27
      interface UnifiedMainIdSummary {
        directRewardAllNodes: number;
        unilevelRewardAllNodes: number;
        totalClonesCount: number;
        totalAutoIdCount: number;
        totalExtraIdCount: number;
        familyPoolDirectFromLineage: number;
        grossVaultFromLineage: number;
      }

      const unifiedSummaryByR1Main = new Map<number, UnifiedMainIdSummary>();
      const s1AutoIdSourceMap = new Map<number, number>();
      const s1SpawnedAutoIdsByMain = new Map<number, number[]>();
      if (snap1 && snap1.size > 0) {
        const s1Ids = Array.from(snap1.keys()).sort((a, b) => a - b);
        const s1OwnerPrimary = new Map<string, number>();
        const s1OwnerAllMains = new Map<string, number[]>();
        const s1OriginMainMap = new Map<number, number>();
        const s1MatchedRight = new Set<number>();
        const s1CloneCountByMain = new Map<number, number>();
        const s1ExtraCountByMain = new Map<number, number>();
        const s1AutoIdCountByMain = new Map<number, number>();
        const s1DirectMap = new Map<number, number>();
        const s1UnilevelMap = new Map<number, number>();
        const s1FamilyDirectMap = new Map<number, number>();
        const s1GrossVaultMap = new Map<number, number>();
        const s1AutoVaultSim = new Map<number, number>();
        const s1UsedExtraR2To3 = new Set<number>();

        const isAnc1 = (cand: number, targ: number): boolean => {
          if (cand <= 0 || targ <= 0) return false;
          let c = targ;
          const g = new Set<number>();
          while (c > 0 && !g.has(c)) {
            if (c === cand) return true;
            g.add(c);
            const p = snap1.get(c);
            c = p ? p.parentId : 0;
          }
          return false;
        };

        for (const id1 of s1Ids) {
          const sn = snap1.get(id1)!;
          const oKey = sn.owner.toLowerCase();
          s1DirectMap.set(id1, 0);
          s1UnilevelMap.set(id1, 0);

          if (!sn.isClone && !sn.isExtraId) {
            if (!s1OwnerPrimary.has(oKey)) s1OwnerPrimary.set(oKey, id1);
            const list = s1OwnerAllMains.get(oKey) || [];
            list.push(id1);
            s1OwnerAllMains.set(oKey, list);
            s1OriginMainMap.set(id1, id1);
          } else if (sn.isClone) {
            const firstId = s1OwnerPrimary.get(oKey) || id1;
            const onChainOrig = sn.originMainId > 0 && sn.originMainId !== id1 ? sn.originMainId : 0;
            let spawnedFrom = 0;
            for (let lb = id1 - 1; lb >= 1; lb--) {
              const rc = snap1.get(lb);
              if (!rc || rc.parentId <= 0) continue;
              const tp = snap1.get(rc.parentId);
              if (
                tp &&
                tp.rightChild === rc.id &&
                tp.owner.toLowerCase() === oKey &&
                !s1MatchedRight.has(tp.id) &&
                (onChainOrig === 0 || (s1OriginMainMap.get(tp.id) || tp.id) === onChainOrig)
              ) {
                spawnedFrom = tp.id;
                s1MatchedRight.add(tp.id);
                break;
              }
            }
            if (spawnedFrom === 0) {
              if (onChainOrig > 0) {
                spawnedFrom = onChainOrig;
              } else {
                const mains = s1OwnerAllMains.get(oKey) || [];
                const match = [...mains].reverse().find((m) => m < id1 && isAnc1(m, id1));
                spawnedFrom = match || firstId;
              }
            }
            const trigIsClone = Boolean(snap1.get(spawnedFrom)?.isClone);
            const origMain =
              onChainOrig > 0
                ? onChainOrig
                : trigIsClone
                ? s1OriginMainMap.get(spawnedFrom) || firstId
                : spawnedFrom;
            s1OriginMainMap.set(id1, origMain);
            s1CloneCountByMain.set(origMain, (s1CloneCountByMain.get(origMain) || 0) + 1);
          } else {
            const firstId = s1OwnerPrimary.get(oKey) || id1;
            const origMain = sn.originMainId > 0 ? sn.originMainId : firstId;
            s1OriginMainMap.set(id1, origMain);
            s1ExtraCountByMain.set(origMain, (s1ExtraCountByMain.get(origMain) || 0) + 1);
          }
        }

        const resolveSponsor1 = (nodeId: number, sponsorAddr: string): number => {
          if (s1AutoIdSourceMap.has(nodeId)) return s1AutoIdSourceMap.get(nodeId)!;
          const sn = snap1.get(nodeId);
          if (sn && sn.isClone) {
            const orig = s1OriginMainMap.get(nodeId) || nodeId;
            if (orig !== nodeId) {
              if (orig === 1) return 1;
              if (s1AutoIdSourceMap.has(orig)) return s1AutoIdSourceMap.get(orig)!;
              const origNode = snap1.get(orig);
              if (origNode && origNode.directSponsorNodeId > 0) {
                return origNode.directSponsorNodeId;
              }
              const effSponsor =
                origNode && origNode.directSponsor && origNode.directSponsor !== ethers.ZeroAddress
                  ? origNode.directSponsor
                  : sponsorAddr;
              return resolveSponsor1(orig, effSponsor);
            }
          }
          if (sn && sn.directSponsorNodeId > 0) {
            return sn.directSponsorNodeId;
          }
          if (!sponsorAddr || sponsorAddr === ethers.ZeroAddress) return 0;
          const sKey = sponsorAddr.toLowerCase();
          const cands = (s1OwnerAllMains.get(sKey) || []).filter((m) => m < nodeId);
          if (cands.length === 0) return s1OwnerPrimary.get(sKey) || 1;
          if (cands.length === 1) return cands[0];
          let curr = sn?.parentId || 0;
          const vis = new Set<number>();
          while (curr > 0 && !vis.has(curr)) {
            vis.add(curr);
            const anc = snap1.get(curr);
            if (!anc) break;
            if (anc.owner.toLowerCase() === sKey) {
              const ancOrig = s1OriginMainMap.get(anc.id) || anc.id;
              if (ancOrig < nodeId) return ancOrig;
            }
            curr = anc.parentId;
          }
          return cands[0];
        };

        const r1Price = RANK_PRICES_USDT[0] || 5;
        const r1DirectUnit = r1Price * 0.3;
        const r1UnilevelUnit = r1Price * 0.02;
        const r1VaultUnit = r1Price * 0.35;

        const isPlacedUnderMainOrClones1 = (mId: number, targetId: number): boolean => {
          if (targetId <= mId) return false;
          if (mId === 1) return true;
          let curr = snap1.get(targetId)?.parentId || 0;
          const visited = new Set<number>();
          while (curr > 0 && !visited.has(curr)) {
            visited.add(curr);
            if (curr === mId) return true;
            const pNode = snap1.get(curr);
            if (!pNode) break;
            if (pNode.isClone && (s1OriginMainMap.get(curr) || pNode.id) === mId) {
              return true;
            }
            curr = pNode.parentId;
          }
          return false;
        };

        for (const id1 of s1Ids) {
          const sn = snap1.get(id1)!;
          const oKey = sn.owner.toLowerCase();
          const firstMain = s1OwnerPrimary.get(oKey) || id1;

          if (!sn.isClone && !sn.isExtraId && id1 > firstMain) {
            const explicitSpId = sn.directSponsorNodeId || 0;
            const isSnapTaggedAuto = sn.originType === 'AUTO_NEW_MAIN';
            // กฎเหล็ก Pool 2: รหัสหลักต้นทาง (m) จะสร้าง New Auto ID ได้ก็ต่อเมื่อพ้นกรอบ 5 rank ย้อนหลังแล้วเท่านั้น (window5Start > 1 คืออยู่ตั้งแต่ Rank 6 ขึ้นไป หรือเป็น Root #1)
            const priorMains = (s1OwnerAllMains.get(oKey) || []).filter((m) => {
              if (m >= id1) return false;
              if (getMainIdWindow5Start(m, sn.owner) <= 1) return false;
              const maxAllowed = crossRankAutoIdCount.get(m) || 0;
              const curSpawns = s1AutoIdCountByMain.get(m) || 0;
              if (curSpawns >= maxAllowed) return false;
              // กฎเหล็กการจัดวางบนสัญญา (_findPlacementSpot): Auto ID ที่เกิดจาก m จะต้องวางอยู่ใต้สายงาน/โคลนของ m เท่านั้น
              if (!isPlacedUnderMainOrClones1(m, id1)) return false;
              const mSpId = snap1.get(m)?.directSponsorNodeId || 1;
              return explicitSpId === 0 || m === explicitSpId || explicitSpId === mSpId;
            });
            let sourceMain = priorMains.find(
              (m) => (s1AutoVaultSim.get(m) || 0) + 1e-9 >= r1Price
            );
            if (sourceMain === undefined) {
              sourceMain = priorMains.find((m) => {
                if (s1UsedExtraR2To3.has(m)) return false;
                const minReqR1Id = extraVaultMinR1IdFromRanks2To4.get(m) || m;
                if (id1 <= minReqR1Id) return false;
                const r1Bal = s1AutoVaultSim.get(m) || 0;
                const extraBal = extraVaultFromRanks2To4.get(m) || 0;
                return r1Bal + extraBal + 1e-9 >= r1Price;
              });
              if (sourceMain !== undefined) {
                s1UsedExtraR2To3.add(sourceMain);
                s1AutoVaultSim.set(
                  sourceMain,
                  Number(
                    ((s1AutoVaultSim.get(sourceMain) || 0) + (extraVaultFromRanks2To4.get(sourceMain) || 0)).toFixed(4)
                  )
                );
              }
            }
            if (sourceMain === undefined && isSnapTaggedAuto) {
              if (priorMains.length > 0) {
                sourceMain =
                  explicitSpId > 0 && priorMains.includes(explicitSpId)
                    ? explicitSpId
                    : priorMains[0];
              } else {
                sourceMain = explicitSpId > 0 ? explicitSpId : firstMain;
              }
            }
            if (sourceMain !== undefined) {
              s1AutoIdSourceMap.set(id1, sourceMain);
              s1AutoIdCountByMain.set(sourceMain, (s1AutoIdCountByMain.get(sourceMain) || 0) + 1);
              const spList = s1SpawnedAutoIdsByMain.get(sourceMain) || [];
              if (!spList.includes(id1)) {
                spList.push(id1);
                s1SpawnedAutoIdsByMain.set(sourceMain, spList);
              }
              s1AutoVaultSim.set(
                sourceMain,
                Math.max(0, Number(((s1AutoVaultSim.get(sourceMain) || 0) - r1Price).toFixed(4)))
              );
            }
          }

          if (sn.parentId > 0 && !sn.isAdminFreeUpgrade) {
            const p = snap1.get(sn.parentId);
            if (p && p.leftChild === id1) {
              const isId1Clone = sn.isClone && s1OriginMainMap.get(id1) === 1;
              const hasSponsor = Boolean(sn.directSponsor && sn.directSponsor !== ethers.ZeroAddress);
              if (isId1Clone || !hasSponsor) {
                const tLin = s1OriginMainMap.get(id1) || 1;
                s1FamilyDirectMap.set(tLin, Number(((s1FamilyDirectMap.get(tLin) || 0) + r1DirectUnit).toFixed(4)));
              } else {
                const spNodeId = resolveSponsor1(id1, sn.directSponsor);
                if (spNodeId > 0) {
                  s1DirectMap.set(spNodeId, Number(((s1DirectMap.get(spNodeId) || 0) + r1DirectUnit).toFixed(4)));
                }
              }

              let upId = sn.parentId;
              for (let t = 1; t <= 15 && upId > 0; t++) {
                s1UnilevelMap.set(upId, Number(((s1UnilevelMap.get(upId) || 0) + r1UnilevelUnit).toFixed(4)));
                const upNode = snap1.get(upId);
                upId = upNode ? upNode.parentId : 0;
              }

              const pMain = s1OriginMainMap.get(p.id) || p.id;
              s1GrossVaultMap.set(pMain, Number(((s1GrossVaultMap.get(pMain) || 0) + r1VaultUnit).toFixed(4)));
              // เฉพาะรหัสหลักที่ Rank 1 พ้นกรอบ 5 rank ย้อนหลังแล้วเท่านั้น (1 < window5Start) จึงจะสะสมเข้า New Auto ID Pool
              const pMainWindow5Start = getMainIdWindow5Start(pMain, p.owner);
              if (!sn.isExtraId && 1 < pMainWindow5Start) {
                s1AutoVaultSim.set(pMain, Number(((s1AutoVaultSim.get(pMain) || 0) + r1VaultUnit).toFixed(4)));
              }
            }
          }
        }

        for (const id1 of s1Ids) {
          const sn = snap1.get(id1)!;
          if (sn.isClone || sn.isExtraId) continue;
          let sumDir = 0;
          let sumUni = 0;
          for (const otherId of s1Ids) {
            if ((s1OriginMainMap.get(otherId) || otherId) === id1) {
              sumDir += s1DirectMap.get(otherId) || 0;
              sumUni += s1UnilevelMap.get(otherId) || 0;
            }
          }
          const crossSpawn = crossRankAutoIdCount.get(id1);
          const autoCount =
            crossSpawn !== undefined && crossSpawn > 0
              ? crossSpawn
              : s1AutoIdCountByMain.get(id1) || 0;

          const crossExtra = crossRankExtraIdCount.get(id1);
          const extraCount =
            crossExtra !== undefined
              ? crossExtra
              : s1ExtraCountByMain.get(id1) || 0;

          const extraLeftDirect = crossRankExtraLeftDirectBonusMap.get(id1) || 0;
          const extraLeftLevel = crossRankExtraLeftLevelBonusMap.get(id1) || 0;
          const extraLeftVault = crossRankExtraLeftVaultGrossMap.get(id1) || 0;
          const repForMain = perIdReportsMap.get(id1);

          unifiedSummaryByR1Main.set(id1, {
            directRewardAllNodes:
              typeof repForMain?.direct30TotalUsdt === 'number'
                ? repForMain.direct30TotalUsdt
                : Number((sumDir + extraLeftDirect).toFixed(4)),
            unilevelRewardAllNodes:
              typeof repForMain?.level30TotalUsdt === 'number'
                ? repForMain.level30TotalUsdt
                : Number((sumUni + extraLeftLevel).toFixed(4)),
            totalClonesCount: s1CloneCountByMain.get(id1) || 0,
            totalAutoIdCount: autoCount,
            totalExtraIdCount: extraCount,
            familyPoolDirectFromLineage: s1FamilyDirectMap.get(id1) || 0,
            grossVaultFromLineage:
              typeof repForMain?.vault35GrossTotalUsdt === 'number'
                ? repForMain.vault35GrossTotalUsdt
                : Number(((s1GrossVaultMap.get(id1) || 0) + extraLeftVault).toFixed(4)),
          });
        }
      }

      // Pass 3: Build EnrichedBinaryNode map
      const enrichedMap = new Map<number, EnrichedBinaryNode>();
      for (const id of sortedIds) {
        const n = rawNodes.get(id)!;
        const originMainId = originMainIdMap.get(n.id) || n.id;
        const spawnedFromNodeId = spawnedFromMap.get(n.id) || 0;
        const cloneRound = cloneRoundMap.get(n.id) || 0;
        const cloneSequence = cloneSequenceMap.get(n.id) || 0;
        const subCloneDepth = subCloneDepthMap.get(n.id) || 0;

        let depth = 1;
        let currP = n.parentId;
        const visited = new Set<number>();
        while (currP > 0 && !visited.has(currP)) {
          visited.add(currP);
          depth++;
          const pObj = rawNodes.get(currP);
          currP = pObj ? pObj.parentId : 0;
        }

        let isLeft = true;
        if (n.parentId > 0) {
          const pObj = rawNodes.get(n.parentId);
          if (pObj && pObj.rightChild === n.id) {
            isLeft = false;
          }
        }

        // Map local `originMainId` in `activeRank` to its primary Rank 1 Main ID (`r1MainId`) first
        const originNodeInActive = rawNodes.get(originMainId);
        const isExtraOrigin = !n.isClone
          ? Boolean(n.isExtraId)
          : Boolean(n.isExtraId || originNodeInActive?.isExtraId);
        const extraMainLabel = isExtraOrigin
          ? `Extra R${activeRank}-#${originMainId}`
          : undefined;
        let r1MainId: number | undefined = isExtraOrigin ? undefined : originMainId;
        if (activeRank > 1 && !isExtraOrigin) {
          if (originMainId === 1) {
            r1MainId = 1;
          } else {
            const directOnChainR1 = onChainOriginMap.get(originMainId) || onChainOriginMap.get(n.id) || 0;
            if (directOnChainR1 > 0) {
              r1MainId = directOnChainR1;
            } else {
              const mappedR1 = getCorrespondingMainIdInRank(activeRank, originMainId, n.owner, 1);
              if (mappedR1 > 0) {
                r1MainId = mappedR1;
              }
            }
          }
        }

        let directUplineNodeId = 0;
        const isRootMainItself = n.id === 1 && !n.isClone && !n.isExtraId;
        const isRootClone =
          n.isClone && !isExtraOrigin && (r1MainId === 1 || originMainId === 1);

        if (isRootMainItself || isRootClone) {
          directUplineNodeId = 0;
        } else if (activeRank > 1 && !isExtraOrigin) {
          // กฎหลัก Rank 2-18: ห้ามเปลี่ยนข้อมูล ผู้แนะนำตรง (Direct Sponsor) ต้องอ้างอิงที่ Rank 1 เสมอ (ทั้ง Main ID และ Clone)
          let r1FoundSponsor = 0;
          if (snap1) {
            const userR1 =
              (r1MainId ? snap1.get(r1MainId) : undefined) ||
              Array.from(snap1.values()).find(
                (sn) =>
                  sn.owner.toLowerCase() === n.owner.toLowerCase() &&
                  !sn.isClone &&
                  !sn.isExtraId &&
                  (n.id === 1 || sn.id > 1)
              );
            if (userR1) {
              if (userR1.directSponsorNodeId && userR1.directSponsorNodeId > 0) {
                const spNodeR1 = snap1.get(userR1.directSponsorNodeId);
                r1FoundSponsor =
                  spNodeR1 && spNodeR1.isClone && spNodeR1.originMainId > 0
                    ? spNodeR1.originMainId
                    : userR1.directSponsorNodeId;
              } else if (userR1.directSponsor && userR1.directSponsor !== ethers.ZeroAddress) {
                const spR1 = Array.from(snap1.values()).find(
                  (sn) =>
                    sn.owner.toLowerCase() === userR1.directSponsor.toLowerCase() &&
                    !sn.isClone &&
                    !sn.isExtraId
                );
                if (spR1) r1FoundSponsor = spR1.id;
              }
            }
          }
          if (r1FoundSponsor > 0) {
            directUplineNodeId = r1FoundSponsor;
          } else {
            directUplineNodeId = resolveSponsorNodeIdForNode(n.id, n.directSponsor);
          }
        } else if (autoIdSourceMainMap.has(n.id)) {
          directUplineNodeId = autoIdSourceMainMap.get(n.id)!;
        } else if (n.isExtraId || extraIdSourceMainMap.has(n.id)) {
          const extraSpR1 =
            extraIdSourceMainMap.get(n.id) ||
            resolveExtraSpawnerInR1(activeRank, n) ||
            1;
          directUplineNodeId = extraSpR1 > 0 ? extraSpR1 : 1;
        } else if (n.isClone) {
          const originEnriched = enrichedMap.get(originMainId);
          if (originEnriched && originEnriched.directUplineNodeId > 0) {
            directUplineNodeId = originEnriched.directUplineNodeId;
          } else if (autoIdSourceMainMap.has(originMainId)) {
            directUplineNodeId = autoIdSourceMainMap.get(originMainId)!;
          } else if (extraIdSourceMainMap.has(originMainId)) {
            const extraSpR1 = extraIdSourceMainMap.get(originMainId)!;
            directUplineNodeId = extraSpR1 > 0 ? extraSpR1 : 1;
          } else {
            directUplineNodeId = resolveSponsorNodeIdForNode(n.id, n.directSponsor);
          }
        } else if (n.directSponsor && n.directSponsor !== ethers.ZeroAddress) {
          directUplineNodeId = resolveSponsorNodeIdForNode(n.id, n.directSponsor);
        }

        const leftChildNodeObj = n.leftChild > 0 ? rawNodes.get(n.leftChild) : undefined;
        const hasLeftChild = n.leftChild > 0 && !leftChildNodeObj?.isAdminFreeUpgrade;
        const vaultBalance = hasLeftChild ? vaultUnit : 0;

        // สถานะรหัสหลัก (MANUAL ID vs AUTO ID) ต้องยึดตามรหัสหลักใน Rank 1 (`r1MainId`) เสมอ ไม่ใช่เลขลำดับโหนดใน Rank 2-18 (`n.id`)
        const effectiveR1MainId = isExtraOrigin
          ? 0
          : r1MainId || (activeRank === 1 ? n.id : originMainId);

        enrichedMap.set(n.id, {
          id: n.id,
          rank: activeRank,
          level: depth,
          parentId: n.parentId,
          isLeft,
          owner: n.owner,
          directSponsor: n.directSponsor,
          leftChild: n.leftChild,
          rightChild: n.rightChild,
          isClone: n.isClone,
          isExtraId: n.isExtraId,
          isAutoMainId:
            !n.isClone &&
            !n.isExtraId &&
            effectiveR1MainId > 1 &&
            (s1AutoIdSourceMap.has(effectiveR1MainId) ||
              onChainOriginTypeMap.get(effectiveR1MainId) === 'AUTO_NEW_MAIN' ||
              snap1?.get(effectiveR1MainId)?.originType === 'AUTO_NEW_MAIN' ||
              perIdReportsMap.get(effectiveR1MainId)?.nodeType === 'AUTO_ID' ||
              (activeRank === 1 && autoMainNodeIds.has(n.id))),
          originMainId,
          r1MainId,
          isExtraLineage: isExtraOrigin,
          extraMainLabel,
          spawnedFromNodeId,
          cloneRound,
          cloneSequence,
          subCloneDepth,
          spawnedCloneIds: nodeSpawnedClones.get(n.id) || [],
          spawnedAutoIds:
            s1SpawnedAutoIdsByMain.get(effectiveR1MainId) ||
            nodeSpawnedAutoIds.get(originMainId) ||
            [],
          spawnedByMainId:
            s1AutoIdSourceMap.get(effectiveR1MainId) ||
            autoIdSourceMainMap.get(n.id) ||
            undefined,
          directUplineNodeId,
          isAdminFreeUpgrade: Boolean(n.isAdminFreeUpgrade),
          directRewardThisNode: nodeDirectBonusMap.get(n.id) || 0,
          unilevelRewardThisNode: n.isAdminFreeUpgrade ? 0 : (nodeUnilevelBonusMap.get(n.id) || 0),
          directRewardAllNodes: 0,
          unilevelRewardAllNodes: 0,
          upgradeRankPool: 0,
          newAutoIdPool: 0,
          newExtraIdPool: 0,
          totalClonesCount: 0,
          totalAutoIdCount: 0,
          totalExtraIdCount: 0,
          vaultBalance,
          nextRankPrice: nextPrice,
          familyPoolDirectFromLineage: 0,
          grossVaultFromLineage: 0,
        });
      }

      // เงินแยกของใครของมัน: ข้อมูลสะสมรหัสหลัก (Box 2) คำนวณแยกอิสระรายรหัสหลัก (ทั้ง Manual ID, Auto ID และ Extra ID)
      for (const node of enrichedMap.values()) {
        const isExtraLineage = Boolean(node.isExtraLineage || node.isExtraId);
        const targetMainId = isExtraLineage
          ? node.originMainId
          : node.r1MainId || node.originMainId;
        const unified = isExtraLineage ? undefined : unifiedSummaryByR1Main.get(targetMainId);

        if (unified) {
          node.directRewardAllNodes = unified.directRewardAllNodes;
          node.unilevelRewardAllNodes = unified.unilevelRewardAllNodes;
          node.totalClonesCount = nodeCloneRoundCount.get(node.originMainId) || 0;
          const spawnedAutos =
            s1SpawnedAutoIdsByMain.get(targetMainId) ||
            nodeSpawnedAutoIds.get(node.originMainId) ||
            [];
          node.spawnedAutoIds = spawnedAutos;
          node.totalAutoIdCount = Math.max(
            unified.totalAutoIdCount,
            spawnedAutos.length,
            crossRankAutoIdCount.get(targetMainId) || 0
          );
          node.totalExtraIdCount =
            crossRankExtraIdCount.get(targetMainId) ?? unified.totalExtraIdCount;
          node.familyPoolDirectFromLineage = unified.familyPoolDirectFromLineage;
          node.grossVaultFromLineage = unified.grossVaultFromLineage;
        } else {
          let sumDirect = 0;
          let sumUnilevel = 0;
          for (const other of enrichedMap.values()) {
            const otherIsExtra = Boolean(other.isExtraLineage || other.isExtraId);
            const otherMainId = otherIsExtra
              ? other.originMainId
              : other.r1MainId || other.originMainId;
            if (otherIsExtra === isExtraLineage && otherMainId === targetMainId) {
              sumDirect += other.directRewardThisNode;
              sumUnilevel += other.unilevelRewardThisNode;
            }
          }
          node.directRewardAllNodes = Number(sumDirect.toFixed(4));
          node.unilevelRewardAllNodes = Number(sumUnilevel.toFixed(4));
          node.totalClonesCount = nodeCloneRoundCount.get(node.originMainId) || 0;
          const spawnedAutos = isExtraLineage
            ? []
            : s1SpawnedAutoIdsByMain.get(targetMainId) ||
              nodeSpawnedAutoIds.get(node.originMainId) ||
              [];
          node.spawnedAutoIds = spawnedAutos;
          node.totalAutoIdCount = isExtraLineage
            ? 0
            : Math.max(
                mainNodeAutoIdSpawnCount.get(node.originMainId) || 0,
                spawnedAutos.length,
                crossRankAutoIdCount.get(targetMainId) || 0
              );
          node.totalExtraIdCount = isExtraLineage
            ? lineageExtraIdSpawnCount.get(node.originMainId) || 0
            : crossRankExtraIdCount.get(targetMainId) ??
              (lineageExtraIdSpawnCount.get(node.originMainId) || 0);
          node.familyPoolDirectFromLineage = lineageFamilyPoolDirectMap.get(node.originMainId) || 0;
          node.grossVaultFromLineage = lineageGrossVaultMap.get(node.originMainId) || 0;
        }

        // คำนวณสถานะ Rank ปัจจุบันของ Idหลักนั้นๆ (Extra ID แยกสถานะ Rank และกระเป๋า Vault ของตัวเองอิสระเหมือน Auto ID)
        const mainIdCurrentRank = isExtraLineage
          ? activeRank
          : getMainIdCurrentRank(targetMainId, node.owner);

        // รวบรวมยอดสะสม Vault (35%) ในแต่ละ Rank สำหรับ Idหลักนั้นๆ
        const mainVaultByRank: Record<number, number> = {};
        if (!isExtraLineage) {
          for (let r = 1; r <= 18; r++) {
            const snap = multiRankSnapshots.get(r);
            if (snap) {
              const corresp = getCorrespondingMainIdInRank(1, targetMainId, node.owner, r);
              if (corresp > 0 && snap.has(corresp)) {
                mainVaultByRank[r] = snap.get(corresp)?.nodeVault ?? 0;
              }
            }
          }
        }

        // คำนวณ 3 Pools (รวมยอดเก่าคงเหลือด้วยก่อนสร้าง Extra ID และกรณี EXTRA ID มีเม็ดซ้าย: Vault 35% ส่งกลับไปที่ New Extra ID Pool ของ directSponsor):
        const poolMainKey = isExtraLineage
          ? activeRank * 1000000 + node.originMainId
          : targetMainId;
        const extraLeftVaultForSponsor = isExtraLineage
          ? 0
          : crossRankExtraLeftVaultMap.get(targetMainId) || 0;
        const pools = calculateMainIdVaultPools(
          poolMainKey,
          mainIdCurrentRank,
          mainVaultByRank,
          extraLeftVaultForSponsor
        );

        const repSummary = isExtraLineage ? undefined : perIdReportsMap.get(targetMainId);
        node.upgradeRankPool = isExtraLineage
          ? 0
          : repSummary?.upgradeRankPool !== undefined
          ? Number(repSummary.upgradeRankPool)
          : pools.upgradeRankPool;
        node.newAutoIdPool = isExtraLineage
          ? 0
          : repSummary?.newAutoIdPool !== undefined
          ? Number(repSummary.newAutoIdPool)
          : pools.newAutoIdPool;
        node.newExtraIdPool = isExtraLineage
          ? 0
          : repSummary?.newExtraIdPool !== undefined
          ? Number(repSummary.newExtraIdPool)
          : pools.newExtraIdPool;
        node.targetMainIdCurrentRank = pools.currentRank;
        node.nextRankPrice = isExtraLineage
          ? nextPrice
          : pools.currentRank < 18
          ? RANK_PRICES_USDT[pools.currentRank] || nextPrice
          : RANK_PRICES_USDT[17] || nextPrice;
        node.window5Start = pools.window5Start;
        node.window5End = pools.window5End;
        node.window5DescriptionTh = pools.windowDescriptionTh;

        node.grossVault1To4FromLineage = isExtraLineage
          ? node.grossVaultFromLineage
          : crossRankGrossVault1To4.get(targetMainId) || node.grossVaultFromLineage;
        node.thisRankRemainingVault = mainVaultByRank[activeRank] ?? node.newAutoIdPool;
        node.vault1To4BreakdownText = isExtraLineage
          ? undefined
          : crossRankBreakdownText.get(targetMainId);
        node.vault4To27BreakdownText = isExtraLineage
          ? undefined
          : crossRankExtraBreakdownText.get(targetMainId);

        // คำนวณรายละเอียดค่าชั้น 15 ชั้น (รับไปแล้วกี่ชั้น ชั้นละเท่าไร เหลืออีกกี่ชั้น) ของโหนดนี้
        const ratePerNode = Number((unitPrice * 0.02).toFixed(2));
        if (node.isAdminFreeUpgrade) {
          // เงื่อนไข Admin อัพ Rank ฟรี: ค่าชั้นที่แสดงให้เป็น 0
          node.unilevelRewardThisNode = 0;
          node.levelSummary = {
            maxLevels: 15,
            receivedLevelsCount: 0,
            remainingLevelsCount: 15,
            ratePerNodeUsdt: ratePerNode,
            thisNodeLevelTotalUsdt: 0,
            clonesLevelTotalUsdt: 0,
            combinedLevelTotalUsdt: 0,
            tiersBreakdown: [],
          };
        } else {
          const tiersBreakdown: NonNullable<EnrichedBinaryNode['levelSummary']>['tiersBreakdown'] = [];
          let currentFrontier: number[] = [node.id];
          const visitedSub = new Set<number>([node.id]);
          let thisNodeLvlTotal = 0;

          for (let tier = 1; tier <= 15; tier++) {
            const nextFrontier: number[] = [];
            const leftNodeIds: number[] = [];
            const rightNodeIds: number[] = [];
            for (const pId of currentFrontier) {
              const pObj = rawNodes.get(pId);
              if (!pObj) continue;
              if (pObj.leftChild > 0 && rawNodes.has(pObj.leftChild) && !visitedSub.has(pObj.leftChild)) {
                const lcObj = rawNodes.get(pObj.leftChild);
                visitedSub.add(pObj.leftChild);
                nextFrontier.push(pObj.leftChild);
                if (!lcObj?.isAdminFreeUpgrade) {
                  leftNodeIds.push(pObj.leftChild);
                }
              }
              if (pObj.rightChild > 0 && rawNodes.has(pObj.rightChild) && !visitedSub.has(pObj.rightChild)) {
                visitedSub.add(pObj.rightChild);
                nextFrontier.push(pObj.rightChild);
                rightNodeIds.push(pObj.rightChild);
              }
            }
            if (nextFrontier.length === 0) break;
            if (leftNodeIds.length > 0) {
              const tierAmt = Number((leftNodeIds.length * ratePerNode).toFixed(2));
              thisNodeLvlTotal = Number((thisNodeLvlTotal + tierAmt).toFixed(2));
              tiersBreakdown.push({
                tier,
                maxCapacity: Math.pow(2, tier),
                totalNodesInTier: nextFrontier.length,
                leftPayingNodesCount: leftNodeIds.length,
                rightRebirthNodesCount: rightNodeIds.length,
                ratePerNodeUsdt: ratePerNode,
                amountUsdt: tierAmt,
                allNodeIds: nextFrontier,
                leftNodeIds,
                rightNodeIds,
              });
            }
            currentFrontier = nextFrontier;
          }

          const receivedLevelsCount = tiersBreakdown.length;
          const remainingLevelsCount = Math.max(0, 15 - receivedLevelsCount);
          const clonesLvlTotal = !node.isClone
            ? Number(Math.max(0, node.unilevelRewardAllNodes - thisNodeLvlTotal).toFixed(2))
            : 0;
          node.levelSummary = {
            maxLevels: 15,
            receivedLevelsCount,
            remainingLevelsCount,
            ratePerNodeUsdt: ratePerNode,
            thisNodeLevelTotalUsdt: thisNodeLvlTotal,
            clonesLevelTotalUsdt: clonesLvlTotal,
            combinedLevelTotalUsdt: !node.isClone
              ? Number(node.unilevelRewardAllNodes.toFixed(2))
              : thisNodeLvlTotal,
            tiersBreakdown,
          };
        }
      }

        // Detect newly arrived node IDs in this rank (e.g. when ID #6+ joins) so we can highlight & auto-extend the tree
        const prevKnownSet = knownNodeIdsByRankRef.current.get(activeRank);
        const currentIdsSet = new Set<number>(enrichedMap.keys());

        if (prevKnownSet && prevKnownSet.size > 0) {
          const newIds = Array.from(currentIdsSet)
            .filter((nid) => !prevKnownSet.has(nid))
            .sort((a, b) => a - b);

          if (newIds.length > 0) {
            setNewlyAddedNodeIds((prev) => {
              const next = new Set(prev);
              newIds.forEach((id) => next.add(id));
              return next;
            });

            const newestId = newIds[newIds.length - 1];
            const newestNode = enrichedMap.get(newestId);
            if (newestNode) {
              setLatestNewNodeAlert({
                id: newestNode.id,
                originMainId: newestNode.r1MainId || newestNode.originMainId,
                parentId: newestNode.parentId,
                isLeft: newestNode.isLeft,
                level: newestNode.level,
                isClone: newestNode.isClone,
                addedCount: newIds.length,
                timestamp: new Date().toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              });
              setJustUpdatedBadge(true);
              setTimeout(() => setJustUpdatedBadge(false), 8000);
            }
          }
        }

        if (!isSilent) {
          await fetchPerIdHistoryForModal();
        }

        knownNodeIdsByRankRef.current.set(activeRank, currentIdsSet);
        setMultiRankSnapshotsState(new Map(multiRankSnapshots as unknown as Map<number, Map<number, SimRawNode>>));
        setOnChainNodesMap(enrichedMap);
        setLastSyncTime(
          new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } catch (err) {
        console.error('Error loading on-chain binary tree:', err);
        cachedRpcProviderRef.current = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('matrix:network:error', {
              detail: { error: err, source: 'loadOnChainTree' },
            })
          );
        }
      } finally {
        isTreeSyncInFlightRef.current = false;
        setIsLoadingTree(false);
        setIsLiveSyncing(false);
        setHasInitialTreeLoaded(true);
      }
    },
    [getWorkingProvider, selectedRank, contractAddress, fetchPerIdHistoryForModal]
  );

  // Automatic WebSocket / Backend API Reconnection Hook when network error is detected during Matrix refresh interval
  const {
    connectionStatus,
    isReconnecting,
    isOffline,
    retryCount,
    nextRetryInSeconds,
    reportConnectionSuccess,
    triggerReconnectNow,
  } = useMatrixAutoReconnect({
    enabled: isRealtimeActive && viewMode === 'onchain',
    healthEndpoint: '/api/health',
    onReconnect: useCallback(async () => {
      setRealtimeCountdown(realtimeInterval);
      await Promise.all([
        loadOnChainTree(selectedRank, { silent: true, forceSync: true }),
        fetchPerIdHistoryForModal(),
      ]);
    }, [loadOnChainTree, fetchPerIdHistoryForModal, selectedRank, realtimeInterval]),
  });

  useEffect(() => {
    if (hasInitialTreeLoaded && onChainNodesMap.size > 0 && !isReconnecting && !isOffline) {
      reportConnectionSuccess();
    }
  }, [hasInitialTreeLoaded, onChainNodesMap.size, isReconnecting, isOffline, reportConnectionSuccess]);

  useEffect(() => {
    loadOnChainTree(selectedRank);
  }, [loadOnChainTree, selectedRank]);

  // Real-Time Polling Effect (Runs silent sync every realtimeInterval seconds)
  useEffect(() => {
    if (!isRealtimeActive || viewMode !== 'onchain') return;
    setRealtimeCountdown(realtimeInterval);

    const timer = setInterval(() => {
      setRealtimeCountdown(realtimeInterval);
      loadOnChainTree(selectedRank, { silent: true });
    }, Math.max(5, realtimeInterval) * 1000);

    const countdownTick = setInterval(() => {
      setRealtimeCountdown((prev) => (prev > 1 ? prev - 1 : realtimeInterval));
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(countdownTick);
    };
  }, [isRealtimeActive, realtimeInterval, viewMode, selectedRank, loadOnChainTree]);

  // 1. Auto-refresh tree when registration or batch registration succeeds
  useEffect(() => {
    if (lastTxSuccess || refreshTrigger) {
      loadOnChainTree(selectedRank, { silent: onChainNodesMap.size > 0, forceSync: true });
      setViewMode('onchain');
      setJustUpdatedBadge(true);
      const timer = setTimeout(() => setJustUpdatedBadge(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [lastTxSuccess, refreshTrigger, selectedRank, onChainNodesMap.size, loadOnChainTree]);

  // 2. Global event listener dispatched whenever user registers, upgrades, or activates nodes
  useEffect(() => {
    const handleGlobalTreeRefresh = () => {
      loadOnChainTree(selectedRank, { silent: true, forceSync: true });
      fetchPerIdHistoryForModal();
      setViewMode('onchain');
      setJustUpdatedBadge(true);
      setTimeout(() => setJustUpdatedBadge(false), 6000);
    };

    window.addEventListener('matrix:tree:refresh', handleGlobalTreeRefresh);
    return () => {
      window.removeEventListener('matrix:tree:refresh', handleGlobalTreeRefresh);
    };
  }, [loadOnChainTree, fetchPerIdHistoryForModal, selectedRank]);

  // Active nodes map based on viewMode ('onchain' or 'demoCloneTree')
  const activeNodesMap = useMemo(() => {
    if (viewMode === 'demoCloneTree') {
      return buildScreenshotPreviewNodes(selectedRank);
    }
    // In onchain mode, return real on-chain nodes (never glitch or replace with mock demo nodes)
    return onChainNodesMap;
  }, [viewMode, onChainNodesMap, selectedRank]);

  // Identify the highest/latest Node in the current rank and the deepest level in the tree
  const { latestNodeInRank, maxTreeLevelInRank } = useMemo(() => {
    let maxId = 0;
    let maxLvl = 1;
    let latestNode: EnrichedBinaryNode | null = null;
    for (const n of activeNodesMap.values()) {
      if (n.id > maxId) {
        maxId = n.id;
        latestNode = n;
      }
      if (n.level > maxLvl) {
        maxLvl = n.level;
      }
    }
    return { latestNodeInRank: latestNode, maxTreeLevelInRank: maxLvl };
  }, [activeNodesMap]);

  // Compute AllSell (4%) & Family Pool for the active rank view (works for both On-Chain and Demo Clone Tree)
  const activeRankPoolsSummary = useMemo(() => {
    const unitPrice = RANK_PRICES_USDT[selectedRank - 1] || 5;
    const allSellUnit = Number((unitPrice * 0.04).toFixed(4));
    const directUnit = Number((unitPrice * 0.3).toFixed(4));
    const levelUnit = Number((unitPrice * 0.02).toFixed(4));

    let rankAllSell = 0;
    let rankFamilyUnpaidLevel = 0;
    let rankFamilyRootCloneDirect = 0;
    const rankAllSellHistory: any[] = [];
    const rankFamilyHistory: any[] = [];

    const sortedNodes = Array.from(activeNodesMap.values()).sort((a, b) => a.id - b.id);
    for (const child of sortedNodes) {
      if (child.id <= 1 || !child.isLeft) continue;
      if ((child as any).isAdminFreeUpgrade) continue;
      const parent = activeNodesMap.get(child.parentId);
      if (!parent || parent.leftChild !== child.id) continue;

      const mainLabel = child.r1MainId || child.originMainId || child.id;
      const childLabel = child.isExtraId
        ? `Extra R${selectedRank}-#${child.id}`
        : child.isClone
        ? `โคลน R${selectedRank}-#${child.id} (ของ Main #${mainLabel})`
        : child.isAutoMainId
        ? `Auto ID #${mainLabel} (R${selectedRank}-#${child.id})`
        : `Main #${mainLabel} (R${selectedRank}-#${child.id})`;

      rankAllSell = Number((rankAllSell + allSellUnit).toFixed(4));
      rankAllSellHistory.push({
        rank: selectedRank,
        fromNodeId: child.id,
        fromMainId: mainLabel,
        fromNodeType: childLabel,
        parentId: parent.id,
        amountUsdt: Number(allSellUnit.toFixed(2)),
        note: `4% AllSell จาก ${childLabel} (วางซ้ายใต้ R${selectedRank}-#${parent.id})`,
      });

      const isId1Clone = child.isClone && (mainLabel === 1 || parent.id === 1);
      if (isId1Clone) {
        rankFamilyRootCloneDirect = Number((rankFamilyRootCloneDirect + directUnit).toFixed(4));
        rankFamilyHistory.push({
          rank: selectedRank,
          fromNodeId: child.id,
          fromMainId: mainLabel,
          fromNodeType: childLabel,
          parentId: parent.id,
          subType: 'ROOT_CLONE_DIRECT',
          amountUsdt: Number(directUnit.toFixed(2)),
          note: `30% ค่าแนะนำจากโคลนรหัส #1 (${childLabel} วางซ้ายใต้ R${selectedRank}-#${parent.id}) เข้า Family Pool`,
        });
      }

      if (parent.isExtraLineage) continue;

      let currUp = child.parentId;
      let paidTiers = 0;
      const guard = new Set<number>();
      for (let t = 1; t <= 15; t++) {
        if (currUp <= 0 || guard.has(currUp)) break;
        guard.add(currUp);
        const upNode = activeNodesMap.get(currUp);
        if (!upNode) break;
        paidTiers++;
        currUp = upNode.parentId;
      }
      const unpaidTiers = Math.max(0, 15 - paidTiers);
      if (unpaidTiers > 0) {
        const unpaidAmt = Number((unpaidTiers * levelUnit).toFixed(4));
        rankFamilyUnpaidLevel = Number((rankFamilyUnpaidLevel + unpaidAmt).toFixed(4));
        rankFamilyHistory.push({
          rank: selectedRank,
          fromNodeId: child.id,
          fromMainId: mainLabel,
          fromNodeType: childLabel,
          parentId: parent.id,
          subType: 'UNPAID_LEVEL',
          paidTiers,
          unpaidTiers,
          amountUsdt: Number(unpaidAmt.toFixed(2)),
          note: `ค่าชั้นส่วนที่เหลือ ${unpaidTiers} ชั้น (${unpaidTiers * 2}%) จาก ${childLabel} (จ่ายอัพไลน์ ${paidTiers}/15 ชั้น) เข้า Family Pool`,
        });
      }
    }

    return {
      rankAllSellUsdt: Number(rankAllSell.toFixed(2)),
      rankFamilyTotalUsdt: Number((rankFamilyUnpaidLevel + rankFamilyRootCloneDirect).toFixed(2)),
      rankFamilyUnpaidLevelUsdt: Number(rankFamilyUnpaidLevel.toFixed(2)),
      rankFamilyRootCloneDirectUsdt: Number(rankFamilyRootCloneDirect.toFixed(2)),
      rankAllSellHistory,
      rankFamilyHistory,
    };
  }, [activeNodesMap, selectedRank]);

  // Compute comprehensive Auto ID & Extra ID notifications (Spawned Auto IDs, Spawned Extra IDs, and Ready/Accumulating Pools)
  const autoExtraNotificationsData = useMemo(() => {
    const userLower = (userAddress || '').toLowerCase();

    interface AutoExtraSpawnNotification {
      key: string;
      category: 'AUTO_ID' | 'EXTRA_ID';
      id: number;
      rank: number;
      label: string;
      sourceMainId: number;
      parentId: number;
      side: 'LEFT' | 'RIGHT' | 'ROOT';
      owner: string;
      costUsdt: number;
      isMyWallet: boolean;
      noteTh: string;
    }

    interface PoolQueueNotification {
      key: string;
      category: 'AUTO_POOL' | 'EXTRA_POOL';
      mainId: number;
      rank: number;
      currentRank: number;
      owner: string;
      poolBalanceUsdt: number;
      targetCostUsdt: number;
      remainingUsdt: number;
      progressPct: number;
      isReady: boolean;
      isMyWallet: boolean;
      noteTh: string;
    }

    const autoMap = new Map<string, AutoExtraSpawnNotification>();
    const extraMap = new Map<string, AutoExtraSpawnNotification>();
    const poolAlerts: PoolQueueNotification[] = [];
    const seenPoolKeys = new Set<string>();

    // 1. Gather from perIdReportsMap (covers all Ranks 1..18 from backend database)
    for (const rep of perIdReportsMap.values()) {
      const repMainId = Number(rep.id || 0);
      if (repMainId <= 0) continue;

      if (Array.isArray(rep.autoIdsSpawned)) {
        for (const item of rep.autoIdsSpawned) {
          const aid = Number(item.id || 0);
          if (aid <= 1) continue;
          const k = `auto-1-${aid}`;
          const ownerStr = String(item.owner || rep.owner || '');
          const sideVal: 'LEFT' | 'RIGHT' | 'ROOT' =
            item.side === 'RIGHT' ? 'RIGHT' : item.side === 'ROOT' ? 'ROOT' : 'LEFT';
          const spMain = Number(item.directSponsorNodeId || repMainId || 1);
          autoMap.set(k, {
            key: k,
            category: 'AUTO_ID',
            id: aid,
            rank: 1,
            label: `Auto ID #${aid} (R1-#${aid})`,
            sourceMainId: spMain,
            parentId: Number(item.parentId || 1),
            side: sideVal,
            owner: ownerStr,
            costUsdt: RANK_PRICES_USDT[0] || 5,
            isMyWallet: Boolean(userLower && ownerStr.toLowerCase() === userLower),
            noteTh: `แตกตัวอัตโนมัติจากกระปุก New Auto ID Pool (${RANK_PRICES_USDT[0] || 5} USDT) ของ Main ID #${spMain} → วางต่อสายใต้ #${item.parentId || 1} (${sideVal === 'LEFT' ? '↙ ขาซ้าย' : '↘ ขาขวา'})`,
          });
        }
      }

      if (Array.isArray(rep.autoExtraIdsSpawned)) {
        for (const item of rep.autoExtraIdsSpawned) {
          const eid = Number(item.id || 0);
          const erank = Number(item.rank || 2);
          if (eid <= 1 || erank < 2) continue;
          const k = `extra-${erank}-${eid}`;
          const ownerStr = String(item.owner || rep.owner || '');
          const sideVal: 'LEFT' | 'RIGHT' | 'ROOT' =
            item.side === 'RIGHT' ? 'RIGHT' : item.side === 'ROOT' ? 'ROOT' : 'LEFT';
          const spMain = Number(item.directSponsorNodeId || repMainId || 1);
          const cost = RANK_PRICES_USDT[erank - 1] || 10;
          extraMap.set(k, {
            key: k,
            category: 'EXTRA_ID',
            id: eid,
            rank: erank,
            label: `Extra R${erank}-#${eid}`,
            sourceMainId: spMain,
            parentId: Number(item.parentId || 1),
            side: sideVal,
            owner: ownerStr,
            costUsdt: cost,
            isMyWallet: Boolean(userLower && ownerStr.toLowerCase() === userLower),
            noteTh: `แตกตัวอัตโนมัติจากกระปุก New Extra ID Pool (${cost} USDT) ของ Main ID #${spMain} ในผัง Rank ${erank} → วางต่อสายใต้ R${erank}-#${item.parentId || 1} (${sideVal === 'LEFT' ? '↙ ขาซ้าย' : '↘ ขาขวา'})`,
          });
        }
      }

      // Check Ready / Accumulating Pools on non-clone Main IDs
      if (!rep.isClone && !rep.isExtraId) {
        const autoBal = Number(rep.newAutoIdPool ?? rep.pools?.newAutoIdPool ?? 0);
        const extraBal = Number(rep.newExtraIdPool ?? rep.pools?.newExtraIdPool ?? 0);
        const ownerStr = String(rep.owner || '');
        const isMine = Boolean(userLower && ownerStr.toLowerCase() === userLower);
        const curRank = Number(rep.currentMaxRank || 1);

        if (autoBal > 0.001) {
          const pk = `pool-auto-${repMainId}`;
          seenPoolKeys.add(pk);
          const autoTargetCost = RANK_PRICES_USDT[0] || 5;
          const isReady = autoBal + 1e-6 >= autoTargetCost;
          const rem = Math.max(0, Number((autoTargetCost - autoBal).toFixed(2)));
          const pct = Math.min(100, Math.round((autoBal / autoTargetCost) * 100));
          poolAlerts.push({
            key: pk,
            category: 'AUTO_POOL',
            mainId: repMainId,
            rank: 1,
            currentRank: curRank,
            owner: ownerStr,
            poolBalanceUsdt: Number(autoBal.toFixed(2)),
            targetCostUsdt: autoTargetCost,
            remainingUsdt: rem,
            progressPct: pct,
            isReady,
            isMyWallet: isMine,
            noteTh: isReady
              ? `🚨 พร้อมออก Auto ID ทันที! Main ID #${repMainId} มีสะสมครบ ${autoBal.toFixed(2)} / ${autoTargetCost.toFixed(2)} USDT`
              : `⏳ กำลังสะสม Auto ID Pool: Main ID #${repMainId} สะสมแล้ว ${autoBal.toFixed(2)} / ${autoTargetCost.toFixed(2)} USDT (ขาดอีก ${rem.toFixed(2)} USDT)`,
          });
        }

        if (extraBal > 0.001) {
          const pk = `pool-extra-${repMainId}`;
          seenPoolKeys.add(pk);
          const minExtraCost = RANK_PRICES_USDT[1] || 10;
          const isReady = curRank >= 2 && extraBal + 1e-6 >= minExtraCost;
          const rem = Math.max(0, Number((minExtraCost - extraBal).toFixed(2)));
          const pct = Math.min(100, Math.round((extraBal / minExtraCost) * 100));
          const oldR4To27 = Number(rep.r4To27OutsideWindowVault || 0);
          const extraLeftB = Number(rep.extraLeftVaultBonus || 0);
          const grossBeforeDeduct = Number(rep.newExtraIdPoolGross || extraBal);
          const oldParts: string[] = [];
          if (oldR4To27 > 0) oldParts.push(`ยอดเก่าสะสม R4-18: ${oldR4To27.toFixed(2)}U`);
          if (extraLeftB > 0) oldParts.push(`เม็ดซ้าย Extra: ${extraLeftB.toFixed(2)}U`);
          const oldDetailStr = oldParts.length > 0 ? ` [รวมยอดเก่า: ${oldParts.join(' + ')}]` : '';

          poolAlerts.push({
            key: pk,
            category: 'EXTRA_POOL',
            mainId: repMainId,
            rank: 2,
            currentRank: curRank,
            owner: ownerStr,
            poolBalanceUsdt: Number(extraBal.toFixed(2)),
            targetCostUsdt: minExtraCost,
            remainingUsdt: rem,
            progressPct: pct,
            isReady,
            isMyWallet: isMine,
            noteTh: isReady
              ? `🚨 พร้อมออก Extra ID ทันที! Main ID #${repMainId} รวมยอดเก่า+ยอดใหม่ครบ ${extraBal.toFixed(2)} USDT${oldDetailStr} (สะสมรวมก่อนหัก: ${grossBeforeDeduct.toFixed(2)} U)`
              : `⏳ กำลังสะสม New Extra ID Pool (รวมยอดเก่าก่อนสร้าง Extra ID): Main ID #${repMainId} มี ${extraBal.toFixed(2)} / ${minExtraCost.toFixed(2)} USDT${oldDetailStr} (ขาดอีก ${rem.toFixed(2)} USDT)`,
          });
        }
      }
    }

    // 2. Also merge from activeNodesMap (live tree view for selectedRank)
    for (const n of activeNodesMap.values()) {
      if (n.id <= 1) continue;
      const sideVal: 'LEFT' | 'RIGHT' | 'ROOT' =
        n.parentId === 0 ? 'ROOT' : n.isLeft ? 'LEFT' : 'RIGHT';
      const isMine = Boolean(userLower && n.owner.toLowerCase() === userLower);

      if (n.isAutoMainId && !n.isClone && selectedRank === 1) {
        const k = `auto-1-${n.id}`;
        if (!autoMap.has(k)) {
          const spMain = n.directUplineNodeId || n.parentId || 1;
          autoMap.set(k, {
            key: k,
            category: 'AUTO_ID',
            id: n.id,
            rank: 1,
            label: `Auto ID #${n.id} (R1-#${n.id})`,
            sourceMainId: spMain,
            parentId: n.parentId,
            side: sideVal,
            owner: n.owner,
            costUsdt: RANK_PRICES_USDT[0] || 5,
            isMyWallet: isMine,
            noteTh: `แตกตัวอัตโนมัติจากกระปุก New Auto ID Pool (${RANK_PRICES_USDT[0] || 5} USDT) ของ Main ID #${spMain} → วางต่อสายใต้ #${n.parentId} (${sideVal === 'LEFT' ? '↙ ขาซ้าย' : '↘ ขาขวา'})`,
          });
        }
      }

      if (n.isExtraId && !n.isClone && selectedRank >= 2) {
        const k = `extra-${selectedRank}-${n.id}`;
        if (!extraMap.has(k)) {
          const spMain = n.directUplineNodeId || n.originMainId || 1;
          const cost = RANK_PRICES_USDT[selectedRank - 1] || 10;
          extraMap.set(k, {
            key: k,
            category: 'EXTRA_ID',
            id: n.id,
            rank: selectedRank,
            label: `Extra R${selectedRank}-#${n.id}`,
            sourceMainId: spMain,
            parentId: n.parentId,
            side: sideVal,
            owner: n.owner,
            costUsdt: cost,
            isMyWallet: isMine,
            noteTh: `แตกตัวอัตโนมัติจากกระปุก New Extra ID Pool (${cost} USDT) ของ Main ID #${spMain} ในผัง Rank ${selectedRank} → วางต่อสายใต้ R${selectedRank}-#${n.parentId} (${sideVal === 'LEFT' ? '↙ ขาซ้าย' : '↘ ขาขวา'})`,
          });
        }
      }

      if (!n.isClone && !n.isExtraId) {
        const mId = n.r1MainId || n.originMainId || n.id;
        const autoBal = Number(n.newAutoIdPool || 0);
        const extraBal = Number(n.newExtraIdPool || 0);
        const autoTargetCost = RANK_PRICES_USDT[0] || 5;
        const minExtraCost = RANK_PRICES_USDT[1] || 10;
        const nodeCurRank = n.targetMainIdCurrentRank || selectedRank;
        if (autoBal > 0.001 && !seenPoolKeys.has(`pool-auto-${mId}`)) {
          seenPoolKeys.add(`pool-auto-${mId}`);
          const isReady = autoBal + 1e-6 >= autoTargetCost;
          const rem = Math.max(0, Number((autoTargetCost - autoBal).toFixed(2)));
          poolAlerts.push({
            key: `pool-auto-${mId}`,
            category: 'AUTO_POOL',
            mainId: mId,
            rank: 1,
            currentRank: nodeCurRank,
            owner: n.owner,
            poolBalanceUsdt: Number(autoBal.toFixed(2)),
            targetCostUsdt: autoTargetCost,
            remainingUsdt: rem,
            progressPct: Math.min(100, Math.round((autoBal / autoTargetCost) * 100)),
            isReady,
            isMyWallet: isMine,
            noteTh: isReady
              ? `🚨 พร้อมออก Auto ID ทันที! Main ID #${mId} มีสะสมครบ ${autoBal.toFixed(2)} / ${autoTargetCost.toFixed(2)} USDT`
              : `⏳ กำลังสะสม Auto ID Pool: Main ID #${mId} สะสมแล้ว ${autoBal.toFixed(2)} / ${autoTargetCost.toFixed(2)} USDT (ขาดอีก ${rem.toFixed(2)} USDT)`,
          });
        }
        if (extraBal > 0.001 && !seenPoolKeys.has(`pool-extra-${mId}`)) {
          seenPoolKeys.add(`pool-extra-${mId}`);
          const isReady = nodeCurRank >= 2 && extraBal + 1e-6 >= minExtraCost;
          const rem = Math.max(0, Number((minExtraCost - extraBal).toFixed(2)));
          poolAlerts.push({
            key: `pool-extra-${mId}`,
            category: 'EXTRA_POOL',
            mainId: mId,
            rank: 2,
            currentRank: nodeCurRank,
            owner: n.owner,
            poolBalanceUsdt: Number(extraBal.toFixed(2)),
            targetCostUsdt: minExtraCost,
            remainingUsdt: rem,
            progressPct: Math.min(100, Math.round((extraBal / minExtraCost) * 100)),
            isReady,
            isMyWallet: isMine,
            noteTh: isReady
              ? `🚨 พร้อมออก Extra ID ทันที! Main ID #${mId} มีสะสมครบ ${extraBal.toFixed(2)} USDT`
              : `⏳ กำลังสะสม Extra ID Pool: Main ID #${mId} สะสมแล้ว ${extraBal.toFixed(2)} / ${minExtraCost.toFixed(2)} USDT (ขาดอีก ${rem.toFixed(2)} USDT)`,
          });
        }
      }
    }

    const spawnedAutoIds = Array.from(autoMap.values()).sort((a, b) => b.id - a.id);
    const spawnedExtraIds = Array.from(extraMap.values()).sort(
      (a, b) => b.rank - a.rank || b.id - a.id
    );
    poolAlerts.sort((a, b) => {
      if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
      return b.progressPct - a.progressPct || a.mainId - b.mainId;
    });

    const autoPoolsList = poolAlerts.filter((p) => p.category === 'AUTO_POOL');
    const extraPoolsList = poolAlerts.filter((p) => p.category === 'EXTRA_POOL');

    const readyAutoPoolsCount = autoPoolsList.filter((p) => p.isReady).length;
    const readyExtraPoolsCount = extraPoolsList.filter((p) => p.isReady).length;

    const myAutoSpawnedCount = spawnedAutoIds.filter((x) => x.isMyWallet).length;
    const myExtraSpawnedCount = spawnedExtraIds.filter((x) => x.isMyWallet).length;
    const myPoolAlertsCount = poolAlerts.filter((x) => x.isMyWallet).length;

    return {
      spawnedAutoIds,
      spawnedExtraIds,
      poolAlerts,
      autoPoolsList,
      extraPoolsList,
      readyAutoPoolsCount,
      readyExtraPoolsCount,
      myAutoSpawnedCount,
      myExtraSpawnedCount,
      myPoolAlertsCount,
      totalNotificationsCount:
        spawnedAutoIds.length + spawnedExtraIds.length + poolAlerts.length,
    };
  }, [perIdReportsMap, activeNodesMap, selectedRank, userAddress]);

  // Detect new Auto ID / Extra ID arrivals in real-time and trigger floating popup toast
  useEffect(() => {
    const { spawnedAutoIds, spawnedExtraIds, poolAlerts } = autoExtraNotificationsData;
    if (spawnedAutoIds.length === 0 && spawnedExtraIds.length === 0 && poolAlerts.length === 0) {
      return;
    }

    const currentKeys = new Set<string>();
    spawnedAutoIds.forEach((a) => currentKeys.add(a.key));
    spawnedExtraIds.forEach((e) => currentKeys.add(e.key));
    poolAlerts.filter((p) => p.isReady).forEach((p) => currentKeys.add(`ready-${p.key}`));

    if (!hasInitAutoExtraKeysRef.current) {
      knownAutoExtraKeysRef.current = currentKeys;
      hasInitAutoExtraKeysRef.current = true;
      return;
    }

    const prevKeys = knownAutoExtraKeysRef.current;
    const newAuto = spawnedAutoIds.find((a) => !prevKeys.has(a.key));
    const newExtra = spawnedExtraIds.find((e) => !prevKeys.has(e.key));
    const newReadyPool = poolAlerts.find((p) => p.isReady && !prevKeys.has(`ready-${p.key}`));

    let newCount = 0;
    currentKeys.forEach((k) => {
      if (!prevKeys.has(k)) newCount++;
    });

    if (isAutoExtraPopupEnabled && newCount > 0) {
      setUnreadAutoExtraCount((prev) => prev + newCount);
      const nowTime = new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (isAutoExtraPopupEnabled) {
        if (newExtra) {
          setLiveAutoExtraToast({
            id: newExtra.id,
            rank: newExtra.rank,
            category: 'EXTRA_ID',
            title: `🔴 แจ้งเตือน Extra ID ใหม่! (${newExtra.label})`,
            subtitle: newExtra.noteTh,
            sourceMainId: newExtra.sourceMainId,
            parentId: newExtra.parentId,
            side: newExtra.side,
            owner: newExtra.owner,
            amountUsdt: newExtra.costUsdt,
            timestamp: nowTime,
          });
        } else if (newAuto) {
          setLiveAutoExtraToast({
            id: newAuto.id,
            rank: 1,
            category: 'AUTO_ID',
            title: `🟡 แจ้งเตือน Auto ID ใหม่! (${newAuto.label})`,
            subtitle: newAuto.noteTh,
            sourceMainId: newAuto.sourceMainId,
            parentId: newAuto.parentId,
            side: newAuto.side,
            owner: newAuto.owner,
            amountUsdt: 10,
            timestamp: nowTime,
          });
        } else if (newReadyPool) {
          setLiveAutoExtraToast({
            id: newReadyPool.mainId,
            rank: newReadyPool.rank,
            category: 'POOL_READY',
            title:
              newReadyPool.category === 'AUTO_POOL'
                ? `⚡ กระปุก Auto ID ครบ ${RANK_PRICES_USDT[0] || 5} USDT! (Main #${newReadyPool.mainId})`
                : `⚡ กระปุก Extra ID พร้อมออกรหัส! (Main #${newReadyPool.mainId})`,
            subtitle: newReadyPool.noteTh,
            sourceMainId: newReadyPool.mainId,
            parentId: newReadyPool.mainId,
            side: 'LEFT',
            owner: newReadyPool.owner,
            amountUsdt: newReadyPool.poolBalanceUsdt,
            timestamp: nowTime,
          });
        }
      }
    }

    knownAutoExtraKeysRef.current = currentKeys;
  }, [autoExtraNotificationsData, isAutoExtraPopupEnabled]);

  // If autoFollowNewNodes is enabled and a new node arrives that is NOT inside the currently focused subtree, ensure focusRootId shows it
  useEffect(() => {
    if (!autoFollowNewNodes || !latestNewNodeAlert || viewMode !== 'onchain') return;
    const newId = latestNewNodeAlert.id;
    if (!activeNodesMap.has(newId)) return;

    // Check if newId is a descendant of current focusRootId
    let curr = newId;
    let isDescendantOfFocus = false;
    const guard = new Set<number>();
    while (curr > 0 && !guard.has(curr)) {
      if (curr === focusRootId) {
        isDescendantOfFocus = true;
        break;
      }
      guard.add(curr);
      const p = activeNodesMap.get(curr);
      curr = p ? p.parentId : 0;
    }

    if (!isDescendantOfFocus) {
      setFocusRootId(1);
      setNavigationHistory([1]);
      setSearchInput('1');
    }
  }, [latestNewNodeAlert, autoFollowNewNodes, viewMode, activeNodesMap, focusRootId]);

  // Recalculate exact SVG connector lines between every Parent and its Left/Right children
  const recalculateTreeConnectors = useCallback(() => {
    const containerEl = treeContentRef.current;
    if (!containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const scale = zoomScale || 1;

    const newLines: ConnectorLine[] = [];
    const parentEls = containerEl.querySelectorAll<HTMLElement>('[data-node-anchor]');

    parentEls.forEach((parentEl) => {
      const parentIdStr = parentEl.getAttribute('data-node-anchor');
      if (!parentIdStr) return;
      const parentId = Number(parentIdStr);
      const parentNode = activeNodesMap.get(parentId);
      if (!parentNode) return;

      const pRect = parentEl.getBoundingClientRect();
      const x1 = (pRect.left - containerRect.left + pRect.width / 2) / scale;
      const y1 = (pRect.bottom - containerRect.top) / scale;

      const leftTargetEl =
        parentNode.leftChild > 0
          ? containerEl.querySelector<HTMLElement>(`[data-node-card="${parentNode.leftChild}"]`)
          : containerEl.querySelector<HTMLElement>(`[data-empty-slot="${parentId}-left"]`);

      if (leftTargetEl) {
        const lRect = leftTargetEl.getBoundingClientRect();
        const x2 = (lRect.left - containerRect.left + lRect.width / 2) / scale;
        const y2 = (lRect.top - containerRect.top) / scale;
        newLines.push({
          key: `line-${parentId}-left`,
          x1,
          y1,
          x2,
          y2,
          isLeft: true,
          isFilled: parentNode.leftChild > 0,
        });
      }

      const rightTargetEl =
        parentNode.rightChild > 0
          ? containerEl.querySelector<HTMLElement>(`[data-node-card="${parentNode.rightChild}"]`)
          : containerEl.querySelector<HTMLElement>(`[data-empty-slot="${parentId}-right"]`);

      if (rightTargetEl) {
        const rRect = rightTargetEl.getBoundingClientRect();
        const x2 = (rRect.left - containerRect.left + rRect.width / 2) / scale;
        const y2 = (rRect.top - containerRect.top) / scale;
        newLines.push({
          key: `line-${parentId}-right`,
          x1,
          y1,
          x2,
          y2,
          isLeft: false,
          isFilled: parentNode.rightChild > 0,
        });
      }
    });

    setConnectorLines((prev) => {
      if (
        prev.length === newLines.length &&
        prev.every(
          (l, idx) =>
            l.key === newLines[idx].key &&
            l.isLeft === newLines[idx].isLeft &&
            l.isFilled === newLines[idx].isFilled &&
            Math.abs(l.x1 - newLines[idx].x1) < 0.5 &&
            Math.abs(l.y1 - newLines[idx].y1) < 0.5 &&
            Math.abs(l.x2 - newLines[idx].x2) < 0.5 &&
            Math.abs(l.y2 - newLines[idx].y2) < 0.5
        )
      ) {
        return prev;
      }
      return newLines;
    });
  }, [activeNodesMap, zoomScale]);

  const updateHorizontalScrollIndicators = useCallback(() => {
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    const maxScrollLeft = Math.max(0, viewportEl.scrollWidth - viewportEl.clientWidth);
    const currentScrollLeft = Math.max(0, viewportEl.scrollLeft);
    const isOverflowing = maxScrollLeft > 8;
    setHasHorizontalOverflow(isOverflowing);
    setCanScrollLeft(isOverflowing && currentScrollLeft > 8);
    setCanScrollRight(isOverflowing && currentScrollLeft < maxScrollLeft - 8);
    setScrollProgressPercent(
      isOverflowing ? Math.min(100, Math.max(0, Math.round((currentScrollLeft / maxScrollLeft) * 100))) : 50
    );

    const maxScrollTop = Math.max(0, viewportEl.scrollHeight - viewportEl.clientHeight);
    const currentScrollTop = Math.max(0, viewportEl.scrollTop);
    const isVerticalOverflowing = maxScrollTop > 8;
    setCanScrollUp(isVerticalOverflowing && currentScrollTop > 8);
    setCanScrollDown(isVerticalOverflowing && currentScrollTop < maxScrollTop - 8);
  }, []);

  const scrollTreeHorizontallyBy = useCallback((deltaPx: number) => {
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    viewportEl.scrollBy({ left: deltaPx, behavior: 'smooth' });
  }, []);

  const scrollTreeVerticallyBy = useCallback((deltaPx: number) => {
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    viewportEl.scrollBy({ top: deltaPx, behavior: 'smooth' });
  }, []);

  const scrollTreeToCenter = useCallback(() => {
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    const maxScrollLeft = Math.max(0, viewportEl.scrollWidth - viewportEl.clientWidth);
    viewportEl.scrollTo({
      left: maxScrollLeft > 0 ? Math.floor(maxScrollLeft / 2) : 0,
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  // Reset horizontal scroll position to center Root Node whenever rank, viewMode, or focusRootId changes
  useLayoutEffect(() => {
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    const centerScroll = () => {
      const maxScrollLeft = Math.max(0, viewportEl.scrollWidth - viewportEl.clientWidth);
      viewportEl.scrollLeft = maxScrollLeft > 0 ? Math.floor(maxScrollLeft / 2) : 0;
      viewportEl.scrollTop = 0;
      updateHorizontalScrollIndicators();
    };
    centerScroll();
    const timer = setTimeout(centerScroll, 50);
    return () => clearTimeout(timer);
  }, [selectedRank, viewMode, focusRootId, updateHorizontalScrollIndicators]);

  useLayoutEffect(() => {
    recalculateTreeConnectors();
    updateHorizontalScrollIndicators();
    const timer = setTimeout(() => {
      recalculateTreeConnectors();
      updateHorizontalScrollIndicators();
    }, 60);
    return () => clearTimeout(timer);
  }, [
    recalculateTreeConnectors,
    updateHorizontalScrollIndicators,
    focusRootId,
    expandedBenefitNodeId,
    viewMode,
    selectedRank,
    zoomScale,
    activeNodesMap.size,
    maxRenderDepth,
    collapsedNodeIds,
    selectedTreeNodeId,
  ]);

  useEffect(() => {
    const containerEl = treeContentRef.current;
    if (!containerEl || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      recalculateTreeConnectors();
      updateHorizontalScrollIndicators();
    });
    observer.observe(containerEl);
    const handleWindowResize = () => {
      recalculateTreeConnectors();
      updateHorizontalScrollIndicators();
    };
    window.addEventListener('resize', handleWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [recalculateTreeConnectors, updateHorizontalScrollIndicators]);

  const handleAutoFitScreen = useCallback(() => {
    const viewportEl = scrollViewportRef.current;
    const contentEl = treeContentRef.current;
    if (!viewportEl || !contentEl) return;

    const availableWidth = viewportEl.clientWidth - 24;
    const naturalWidth = contentEl.scrollWidth || 1;
    if (naturalWidth <= availableWidth) {
      setZoomScale(1);
    } else {
      const ratio = Math.max(0.25, Math.min(1.25, Number((availableWidth / naturalWidth).toFixed(2))));
      setZoomScale(ratio);
    }
  }, []);

  // Precompute descendant counts per node for Collapse/Expand labels
  const descendantCountsMap = useMemo(() => {
    const counts = new Map<number, { total: number; leftCount: number; rightCount: number }>();
    const visiting = new Set<number>();

    const countSubtree = (id: number): number => {
      if (!id || id <= 0 || !activeNodesMap.has(id)) return 0;
      const cached = counts.get(id);
      if (cached) return cached.total + 1;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const node = activeNodesMap.get(id)!;
      const leftTotal = node.leftChild > 0 ? countSubtree(node.leftChild) : 0;
      const rightTotal = node.rightChild > 0 ? countSubtree(node.rightChild) : 0;
      visiting.delete(id);
      counts.set(id, {
        total: leftTotal + rightTotal,
        leftCount: leftTotal,
        rightCount: rightTotal,
      });
      return leftTotal + rightTotal + 1;
    };

    for (const id of activeNodesMap.keys()) {
      countSubtree(id);
    }
    return counts;
  }, [activeNodesMap]);

  const statusCountsInRank = useMemo(() => {
    let main = 0;
    let auto = 0;
    let extra = 0;
    let clone = 0;
    for (const node of activeNodesMap.values()) {
      if (node.isClone) clone++;
      else if (node.isExtraId) extra++;
      else if (node.isAutoMainId) auto++;
      else main++;
    }
    return {
      total: activeNodesMap.size,
      main,
      auto,
      extra,
      clone,
    };
  }, [activeNodesMap]);

  const getNodeStatusMeta = (node: EnrichedBinaryNode) => {
    if (node.isClone) {
      return {
        key: 'clone' as const,
        tagText: `CLONE ID • รอบ ${node.cloneRound || 1}`,
        compactTagText: `โคลน R${node.cloneRound || 1}`,
        thaiLabel: 'โคลนนิ่ง (Cloning ID)',
        floatingBadgeClass:
          'bg-[#15803D] text-white border-emerald-400 dark:bg-gradient-to-r dark:from-emerald-400 dark:to-teal-300 dark:text-slate-950 dark:border-emerald-200',
        inlineBadgeClass:
          'bg-[#DCFCE7] text-[#15803D] border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/50',
        dotClass: 'bg-emerald-500',
        Icon: Dna,
      };
    }
    if (node.isExtraId) {
      return {
        key: 'extra' as const,
        tagText: 'EXTRA ID',
        compactTagText: 'EXTRA',
        thaiLabel: 'Extra ID (รหัสเสริม)',
        floatingBadgeClass:
          'bg-rose-600 text-white border-rose-400 dark:bg-gradient-to-r dark:from-red-500 dark:to-rose-500 dark:text-white dark:border-rose-300',
        inlineBadgeClass:
          'bg-[#FEE2E2] text-[#BE123C] border-rose-300 dark:bg-rose-500/25 dark:text-rose-200 dark:border-rose-400/50',
        dotClass: 'bg-rose-500',
        Icon: Zap,
      };
    }
    if (node.isAutoMainId) {
      return {
        key: 'auto' as const,
        tagText: 'AUTO ID',
        compactTagText: 'AUTO',
        thaiLabel: 'Auto ID (รหัสอัตโนมัติ)',
        floatingBadgeClass:
          'bg-amber-500 text-slate-950 border-amber-300 dark:bg-gradient-to-r dark:from-amber-400 dark:via-yellow-300 dark:to-amber-400 dark:text-slate-950 dark:border-amber-200',
        inlineBadgeClass:
          'bg-[#FEF3C7] text-[#B45309] border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/50',
        dotClass: 'bg-amber-400',
        Icon: Bot,
      };
    }
    return {
      key: 'main' as const,
      tagText: 'MAIN ID',
      compactTagText: 'MAIN',
      thaiLabel: 'Main ID (รหัสหลัก)',
      floatingBadgeClass:
        'bg-[#2563EB] text-white border-blue-400 dark:bg-sky-400 dark:text-slate-950 dark:border-sky-200',
      inlineBadgeClass:
        'bg-[#EFF6FF] text-[#1D4ED8] border-blue-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/45',
      dotClass: 'bg-blue-500',
      Icon: Crown,
    };
  };

  const buildCollapsedAtDepth = useCallback(
    (expandedDepth: number) => {
      const toCollapse = new Set<number>();
      const queue: Array<{ id: number; depth: number }> = [{ id: focusRootId, depth: 1 }];
      const visited = new Set<number>();
      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id) || depth > MAX_TREE_DEPTH) continue;
        visited.add(id);
        const node = activeNodesMap.get(id);
        if (!node) continue;
        const hasLeftChild = node.leftChild > 0 && activeNodesMap.has(node.leftChild);
        const hasRightChild = node.rightChild > 0 && activeNodesMap.has(node.rightChild);
        if (depth === expandedDepth && (hasLeftChild || hasRightChild)) {
          toCollapse.add(id);
          continue;
        }
        if (hasLeftChild) {
          queue.push({ id: node.leftChild, depth: depth + 1 });
        }
        if (hasRightChild) {
          queue.push({ id: node.rightChild, depth: depth + 1 });
        }
      }
      return toCollapse;
    },
    [activeNodesMap, focusRootId]
  );

  useEffect(() => {
    if (hasUserInteractedCollapseRef.current) return;
    if (activeNodesMap.size === 0 || !activeNodesMap.has(focusRootId)) return;
    setCollapsedNodeIds(buildCollapsedAtDepth(DEFAULT_EXPANDED_DEPTH));
  }, [activeNodesMap, focusRootId, selectedRank, viewMode, buildCollapsedAtDepth]);

  const toggleCollapseNode = useCallback((nodeId: number) => {
    hasUserInteractedCollapseRef.current = true;
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleExpandAllNodes = useCallback(() => {
    hasUserInteractedCollapseRef.current = true;
    setCollapsedNodeIds(new Set());
  }, []);

  const handleCollapseSubtrees = useCallback(() => {
    hasUserInteractedCollapseRef.current = true;
    const toCollapse = new Set<number>();
    const queue: Array<{ id: number; depth: number }> = [{ id: focusRootId, depth: 1 }];
    const visited = new Set<number>();
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > MAX_TREE_DEPTH) continue;
      visited.add(id);
      const node = activeNodesMap.get(id);
      if (!node) continue;
      if (depth >= 2 && (node.leftChild > 0 || node.rightChild > 0)) {
        toCollapse.add(id);
      }
      if (node.leftChild > 0 && activeNodesMap.has(node.leftChild)) {
        queue.push({ id: node.leftChild, depth: depth + 1 });
      }
      if (node.rightChild > 0 && activeNodesMap.has(node.rightChild)) {
        queue.push({ id: node.rightChild, depth: depth + 1 });
      }
    }
    setCollapsedNodeIds(toCollapse);
  }, [activeNodesMap, focusRootId]);

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('button, a, input, select, textarea')) return;
    const viewportEl = scrollViewportRef.current;
    if (!viewportEl) return;
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop,
      hasMoved: false,
    };
  };

  const navigateToNode = (targetId: number) => {
    let resolvedNodeId = targetId;
    if (!activeNodesMap.has(resolvedNodeId)) {
      const foundByMain = Array.from(activeNodesMap.values()).find(
        (n) => (!n.isExtraLineage && n.r1MainId === targetId) || n.originMainId === targetId
      );
      if (foundByMain) {
        resolvedNodeId = foundByMain.id;
      } else {
        return;
      }
    }
    setFocusRootId(resolvedNodeId);
    setSearchInput(String(targetId));
    setNavigationHistory((prev) => {
      if (prev[prev.length - 1] === resolvedNodeId) return prev;
      return [...prev, resolvedNodeId];
    });
  };

  const handleGoBack = () => {
    if (navigationHistory.length > 1) {
      const nextHist = navigationHistory.slice(0, -1);
      const prevId = nextHist[nextHist.length - 1];
      setNavigationHistory(nextHist);
      setFocusRootId(prevId);
      setSearchInput(String(prevId));
    } else {
      const currentRoot = activeNodesMap.get(focusRootId);
      if (currentRoot && currentRoot.parentId > 0) {
        navigateToNode(currentRoot.parentId);
      } else {
        navigateToNode(1);
      }
    }
  };

  const breadcrumbPath = useMemo(() => {
    const path: number[] = [];
    let curr = focusRootId;
    const visited = new Set<number>();
    while (curr > 0 && !visited.has(curr)) {
      visited.add(curr);
      path.unshift(curr);
      const node = activeNodesMap.get(curr);
      if (!node || node.parentId === 0) break;
      curr = node.parentId;
    }
    return path.length > 0 ? path : [1];
  }, [focusRootId, activeNodesMap]);

  const copyAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  // Render an Empty Slot card (ว่าง (ซ้าย) / ว่าง (ขวา))
  const renderEmptySlotCard = (parentNode: EnrichedBinaryNode, isLeftSlot: boolean) => {
    const sponsorIdToUse = parentNode.originMainId || parentNode.id || 1;
    const slotKey = `${parentNode.id}-${isLeftSlot ? 'left' : 'right'}`;

    return (
      <div
        data-empty-slot={slotKey}
        className="w-[100px] sm:w-[118px] h-auto rounded-xl border border-dashed border-slate-300 dark:border-purple-500/45 bg-white/95 dark:bg-[#121629]/95 p-1.5 sm:p-2 flex flex-col items-center justify-center gap-1 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] dark:shadow-lg relative z-10"
      >
        <span className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
          {isLeftSlot
            ? language === 'th'
              ? 'ว่าง (ซ้าย)'
              : 'Empty (Left)'
            : language === 'th'
            ? 'ว่าง (ขวา)'
            : 'Empty (Right)'}
        </span>
        <button
          type="button"
          onClick={() => openRegisterModal(sponsorIdToUse, parentNode.id, isLeftSlot)}
          className={`w-full py-1 px-1.5 rounded-lg font-bold text-[9px] text-white shadow-xs transition flex items-center justify-center gap-1 cursor-pointer ${
            isLeftSlot
              ? 'bg-[#15803D] hover:bg-emerald-800 dark:bg-gradient-to-r dark:from-emerald-500 dark:to-teal-500 dark:hover:from-emerald-400 dark:hover:to-teal-400'
              : 'bg-[#2563EB] hover:bg-blue-700 dark:bg-gradient-to-r dark:from-purple-600 dark:to-fuchsia-600 dark:hover:from-purple-500 dark:hover:to-fuchsia-500'
          }`}
        >
          <Sparkles className="w-2.5 h-2.5 shrink-0" />
          <span>
            {isLeftSlot
              ? language === 'th'
                ? '+ ลงรหัสซ้าย'
                : '+ Place Left'
              : language === 'th'
              ? '+ ลงรหัสขวา'
              : '+ Place Right'}
          </span>
        </button>
      </div>
    );
  };

  // Render a single Node Card matching the exact Normal ID & Clone ID layouts
  const renderNodeCard = (node: EnrichedBinaryNode) => {
    const leftChildNode = node.leftChild > 0 ? activeNodesMap.get(node.leftChild) : undefined;
    const rightChildNode = node.rightChild > 0 ? activeNodesMap.get(node.rightChild) : undefined;
    const isMyNode =
      Boolean(userAddress) && node.owner.toLowerCase() === userAddress!.toLowerCase();
    const isBenefitOpen = expandedBenefitNodeId === node.id;
    const isNewlyAppended = newlyAddedNodeIds.has(node.id);
    const isLatestInRank = Boolean(latestNodeInRank && node.id > 1 && node.id === latestNodeInRank.id);

    const formatChildLabel = (child?: EnrichedBinaryNode, fallbackId?: number) => {
      if (!child && (!fallbackId || fallbackId === 0)) return '';
      if (!child) return `#${fallbackId}(#${fallbackId})`;
      if (child.isExtraId) {
        return `Extra#${child.id}(R${child.rank}-#${child.id})`;
      }
      if (child.isClone && child.isExtraLineage) {
        return `Extra#${child.originMainId}(โคลน#${child.id})`;
      }
      const mainLabel = child.r1MainId || child.originMainId;
      if (child.isClone) {
        return `#${mainLabel}(โคลน#${child.id})`;
      }
      if (child.isAutoMainId) {
        return `Auto#${mainLabel}(#${child.id})`;
      }
      return `#${mainLabel}(#${child.id})`;
    };

    const isNewOrLatest = isNewlyAppended || isLatestInRank;

    // สีกรอบสถานะใหม่หรือล่าสุด และสีกรอบตามประเภท ID:
    // - โคลนนิ่ง (isClone) -> กรอบสีเขียว
    // - Extra ID (isExtraId) -> กรอบสีแดง
    // - Auto ID (isAutoMainId) -> กรอบสีทอง
    // - Main ID (รหัสหลักปกติ) -> กรอบสีน้ำเงิน/ขาว
    const borderStyle = node.isClone
      ? isNewOrLatest
        ? 'border-emerald-500 dark:border-emerald-400 shadow-[0_4px_20px_-2px_rgba(16,185,129,0.28)] dark:shadow-[0_0_24px_rgba(16,185,129,0.9),0_0_12px_rgba(52,211,153,0.95)] ring-2 ring-emerald-400/85'
        : 'border-emerald-500/80 dark:border-emerald-400/95 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] dark:shadow-[0_0_16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/40'
      : node.isExtraId
      ? isNewOrLatest
        ? 'border-red-500 shadow-[0_4px_20px_-2px_rgba(239,68,68,0.28)] dark:shadow-[0_0_24px_rgba(239,68,68,0.9),0_0_12px_rgba(248,113,113,0.95)] ring-2 ring-red-500/85'
        : 'border-red-500/85 dark:border-red-500/95 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] dark:shadow-[0_0_16px_rgba(239,68,68,0.4)] ring-1 ring-red-500/45'
      : node.isAutoMainId
      ? isNewOrLatest
        ? 'border-amber-500 dark:border-amber-400 shadow-[0_4px_20px_-2px_rgba(245,158,11,0.28)] dark:shadow-[0_0_24px_rgba(245,158,11,0.9),0_0_12px_rgba(251,191,36,0.95)] ring-2 ring-amber-400/85'
        : 'border-amber-500/85 dark:border-amber-400/95 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] dark:shadow-[0_0_16px_rgba(245,158,11,0.4)] ring-1 ring-amber-400/45'
      : isNewOrLatest
      ? 'border-[#2563EB] dark:border-white shadow-[0_4px_20px_-2px_rgba(37,99,235,0.25)] dark:shadow-[0_0_24px_rgba(255,255,255,0.95),0_0_12px_rgba(248,250,252,0.95)] ring-2 ring-blue-500/60 dark:ring-white/85'
      : 'border-slate-300 dark:border-white/95 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] dark:shadow-[0_0_15px_rgba(255,255,255,0.3)] ring-1 ring-slate-200/80 dark:ring-white/40';

    const latestPillStyle = node.isClone
      ? 'bg-[#DCFCE7] text-[#15803D] border-emerald-300 dark:bg-gradient-to-r dark:from-emerald-400 dark:to-teal-300 dark:text-slate-950 dark:border-emerald-100 shadow-xs'
      : node.isExtraId
      ? 'bg-[#FEE2E2] text-[#BE123C] border-rose-300 dark:bg-gradient-to-r dark:from-red-500 dark:to-rose-500 dark:text-white dark:border-red-200 shadow-xs'
      : node.isAutoMainId
      ? 'bg-[#FEF3C7] text-[#B45309] border-amber-300 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-300 dark:text-slate-950 dark:border-amber-100 shadow-xs'
      : 'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200 dark:bg-white dark:text-slate-950 dark:border-white shadow-xs';

    const latestDotIcon = node.isClone
      ? '🟢'
      : node.isExtraId
      ? '🔴'
      : node.isAutoMainId
      ? '🟡'
      : '⚪';

    const statusMeta = getNodeStatusMeta(node);
    const StatusIcon = statusMeta.Icon;
    const isDimmedByStatusFilter =
      highlightedStatusFilter !== 'all' && highlightedStatusFilter !== statusMeta.key;

    const isNodeSelected = selectedTreeNodeId === node.id;
    const isNodeCollapsed = collapsedNodeIds.has(node.id);
    const hasAnyChildNode = node.leftChild > 0 || node.rightChild > 0;
    const descCountInfo = descendantCountsMap.get(node.id);

    return (
      <div
        data-node-anchor={node.id}
        className="flex flex-col items-center h-auto w-auto relative z-10"
      >
        {/* Main Node Card - Uniform Fixed Height across all ID types (Pure White #FFFFFF in Light Mode, #131829 in Dark Mode) */}
        <div
          data-node-card={node.id}
          onClick={(e) => {
            if (dragStateRef.current.hasMoved) return;
            const targetEl = e.target as HTMLElement | null;
            if (targetEl?.closest('button, a, input, select, textarea')) return;
            setSelectedTreeNodeId((prev) => (prev === node.id ? null : node.id));
          }}
          title={
            language === 'th'
              ? 'คลิกเพื่อเลือกดูข้อมูลสมาชิกหรือต่อสายงานซ้าย (L) / ขวา (R)'
              : 'Click to inspect member or place Left (L) / Right (R)'
          }
          className={`relative w-[168px] sm:w-[180px] md:w-[188px] h-[324px] sm:h-[330px] flex flex-col justify-between gap-1 rounded-xl bg-white dark:bg-[#131829] border-2 ${borderStyle} ${
            isNodeSelected
              ? 'ring-4 ring-blue-500/75 dark:ring-cyan-400/85 scale-[1.02]'
              : 'hover:ring-2 hover:ring-blue-400/50 dark:hover:ring-cyan-400/40'
          } ${
            isDimmedByStatusFilter
              ? 'opacity-30 grayscale-[35%] scale-[0.98]'
              : highlightedStatusFilter !== 'all'
              ? 'ring-2 ring-offset-1 ring-offset-slate-950/30'
              : ''
          } p-1.5 sm:p-2 text-left transition-all duration-200 select-none cursor-pointer`}
        >
          {/* Top-Left Floating Badges: ✨ มาใหม่ & ล่าสุด (สีตามประเภท ID) */}
          <div className="absolute -top-2.5 left-1.5 flex items-center gap-1 z-20">
            {isNewlyAppended && (
              <div
                className={`px-1.5 py-0.2 rounded-full font-bold text-[8.5px] border flex items-center gap-0.5 shrink-0 ${latestPillStyle}`}
              >
                <Sparkles className="w-2.5 h-2.5 shrink-0" />
                <span>✨ มาใหม่</span>
              </div>
            )}

            {isLatestInRank && (
              <div
                className={`px-1.5 py-0.2 rounded-full font-black text-[8.5px] border flex items-center gap-0.5 shrink-0 ${latestPillStyle}`}
              >
                <span>{latestDotIcon} ล่าสุด</span>
              </div>
            )}
          </div>

          {/* Top-Right Floating Status Badge (Main ID / Auto ID / Extra ID / Cloning ID) */}
          <div
            className={`absolute -top-2.5 right-1.5 px-1.5 py-0.2 rounded-full border text-[8.5px] font-black shadow-sm flex items-center gap-1 z-20 ${statusMeta.floatingBadgeClass}`}
          >
            <StatusIcon className="w-2.5 h-2.5 shrink-0" />
            <span>{statusMeta.tagText}</span>
          </div>

          {/* 1. Header Section (Fixed Uniform Height) */}
          {node.isClone ? (
            <div className="h-[38px] shrink-0 flex items-center justify-between gap-1 pb-1 border-b border-slate-200/80 dark:border-slate-800/90 pt-0.5 overflow-hidden">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => navigateToNode(node.id)}
                  className="px-1.5 py-0.2 rounded bg-[#DCFCE7]/70 dark:bg-[#0d2324] border border-emerald-300 dark:border-emerald-500/50 font-mono font-extrabold text-[9.5px] leading-tight hover:border-emerald-500 dark:hover:border-emerald-300 transition cursor-pointer text-left truncate max-w-full"
                  title={
                    node.isExtraLineage
                      ? `รหัสหลักอิสระ ${node.extraMainLabel} (โคลนโหนด #${node.id} ใน Rank ${node.rank} • รอบที่ ${node.cloneRound || 1})`
                      : `รหัสหลัก #${node.r1MainId || node.originMainId} (โคลนโหนด #${node.id} ใน Rank ${node.rank} • รอบที่ ${node.cloneRound || 1})`
                  }
                >
                  <span className={node.isExtraLineage ? 'text-cyan-700 dark:text-cyan-300 font-black' : 'text-[#0F172A] dark:text-amber-400 font-black'}>
                    {node.isExtraLineage
                      ? node.extraMainLabel || `Extra R${node.rank}-#${node.originMainId}`
                      : `Main #${node.r1MainId || node.originMainId}`}
                  </span>{' '}
                  <span className="text-[#15803D] dark:text-emerald-300 font-bold">
                    (โคลน #{node.id})
                  </span>
                </button>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={`px-1 py-0.2 rounded border font-mono font-black text-[8px] leading-none inline-flex items-center gap-0.5 shrink-0 ${statusMeta.inlineBadgeClass}`}
                  >
                    <StatusIcon className="w-2 h-2 shrink-0" />
                    <span>{statusMeta.compactTagText}</span>
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#FEF3C7] dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-[#B45309] dark:text-amber-400 font-mono font-bold text-[8px] leading-none shrink-0">
                    R{node.rank}
                  </span>
                </div>
              </div>

              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[9px] text-[#334155] dark:text-slate-200 font-semibold shrink-0">
                ชั้น {node.level}
              </span>
            </div>
          ) : (
            <div className="h-[38px] shrink-0 flex items-center justify-between gap-1 pb-1 border-b border-slate-200/80 dark:border-slate-800/90 pt-0.5 overflow-hidden">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => navigateToNode(node.id)}
                  className="px-1.5 py-0.2 rounded bg-[#EFF6FF] dark:bg-slate-900 border border-blue-200/80 dark:border-slate-700/90 font-mono font-extrabold text-[9.5px] leading-tight hover:border-[#2563EB] dark:hover:border-amber-400 transition cursor-pointer text-left truncate max-w-full"
                  title={
                    node.isExtraId
                      ? `รหัสหลักอิสระ ${node.extraMainLabel || `Extra R${node.rank}-#${node.id}`} (แยกอิสระ ไม่ซ้ำกับ Rank 1)`
                      : node.rank > 1 && node.r1MainId
                      ? `รหัสหลักใน Rank 1 คือ #${node.r1MainId} (ลำดับโหนดใน Rank ${node.rank} คือ #${node.id})`
                      : `รหัสหลัก #${node.originMainId}`
                  }
                >
                  {node.isExtraId ? (
                    <>
                      <span className="text-[#BE123C] dark:text-red-400 font-black">
                        {node.extraMainLabel || `Extra R${node.rank}-#${node.id}`}
                      </span>{' '}
                      <span className="text-[#334155] dark:text-slate-300 font-semibold">
                        (R{node.rank}-#{node.id})
                      </span>
                    </>
                  ) : node.isAutoMainId ? (
                    <>
                      <span className="text-[#B45309] dark:text-amber-300 font-black">
                        Auto #{node.r1MainId || node.originMainId}
                      </span>{' '}
                      <span className="text-[#334155] dark:text-slate-300 font-semibold">
                        (R{node.rank}-#{node.id})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#0F172A] dark:text-white font-black">
                        Main #{node.r1MainId || node.originMainId}
                      </span>{' '}
                      <span className="text-[#334155] dark:text-slate-300 font-semibold">
                        (R{node.rank}-#{node.id})
                      </span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={`px-1 py-0.2 rounded border font-mono font-black text-[8px] leading-none inline-flex items-center gap-0.5 shrink-0 ${statusMeta.inlineBadgeClass}`}
                  >
                    <StatusIcon className="w-2 h-2 shrink-0" />
                    <span>{statusMeta.compactTagText}</span>
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#FEF3C7] dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-[#B45309] dark:text-amber-400 font-mono font-bold text-[8px] leading-none shrink-0">
                    R{node.isExtraId ? node.rank : node.targetMainIdCurrentRank || node.rank}
                  </span>
                </div>
              </div>

              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[9px] text-[#334155] dark:text-slate-200 font-semibold shrink-0">
                ชั้น {node.level}
              </span>
            </div>
          )}

          {/* 2. Wallet Row (Fixed Height) */}
          <div className="h-[18px] shrink-0 flex items-center justify-between text-[9.5px] text-[#0F172A] dark:text-white font-mono px-0.5 overflow-hidden">
            <div className="flex items-center gap-1 min-w-0 truncate">
              <User className="w-2.5 h-2.5 text-[#64748B] dark:text-slate-400 shrink-0" />
              <span className="font-bold truncate">Wallet {shortenWallet(node.owner)}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {isMyNode && (
                <span className="text-[7.5px] px-1 py-0.2 rounded bg-[#DCFCE7] text-[#15803D] dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                  คุณ
                </span>
              )}
              <button
                type="button"
                onClick={() => copyAddress(node.owner)}
                className="text-[#64748B] hover:text-[#0F172A] dark:text-slate-500 dark:hover:text-white transition cursor-pointer"
                title={node.owner}
              >
                {copiedText === node.owner ? (
                  <Check className="w-2.5 h-2.5 text-[#15803D] dark:text-emerald-400" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          </div>

          {/* 3. Info Box: Upline, Origin, Round & Sponsor (Fixed Uniform Height) */}
          <div className="h-[66px] shrink-0 rounded-md bg-[#F8FAFC] dark:bg-[#0c1020] border border-slate-200/80 dark:border-slate-800/90 p-1 px-1.5 flex flex-col justify-between text-[8.5px] overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[#334155] dark:text-slate-300 font-semibold shrink-0">อัพไลน์:</span>
              <button
                type="button"
                onClick={() => node.parentId > 0 && navigateToNode(node.parentId)}
                className="font-mono font-extrabold text-[#2563EB] dark:text-indigo-400 hover:underline cursor-pointer truncate"
              >
                {node.parentId === 0 ? 'Root (#0)' : `#${node.parentId}`}
              </button>
            </div>

            {node.isClone ? (
              <div className="flex items-center justify-between gap-1">
                <span className="text-purple-700 dark:text-fuchsia-300 font-bold shrink-0">รหัสหลัก:</span>
                <button
                  type="button"
                  onClick={() => navigateToNode(node.originMainId)}
                  className="font-mono font-extrabold text-[#B45309] dark:text-amber-400 hover:underline cursor-pointer truncate"
                  title={`คลิกเพื่อไปที่รหัสหลัก ${node.isExtraLineage ? node.extraMainLabel : `#${node.originMainId}`}`}
                >
                  {node.isExtraLineage
                    ? node.extraMainLabel || `Extra R${node.rank}-#${node.originMainId}`
                    : `#${node.originMainId}`}
                </button>
              </div>
            ) : node.isExtraId ? (
              <div className="flex items-center justify-between gap-1">
                <span className="text-cyan-700 dark:text-cyan-300 font-bold shrink-0">รหัสอิสระ:</span>
                <span className="font-mono font-extrabold text-cyan-700 dark:text-cyan-300 truncate">
                  {node.extraMainLabel || `Extra R${node.rank}-#${node.id}`}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1">
                <span className="text-[#B45309] dark:text-amber-300 font-bold shrink-0">รหัสหลัก R1:</span>
                <span className="font-mono font-extrabold text-[#B45309] dark:text-amber-400 truncate">
                  Main ID #{node.r1MainId || node.originMainId}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-1">
              <span className="text-[#15803D] dark:text-emerald-300 font-bold shrink-0">
                {node.isClone ? 'รอบโคลน:' : 'ประเภท:'}
              </span>
              <span className="font-mono font-extrabold text-[#15803D] dark:text-emerald-300 truncate text-right">
                {node.isClone
                  ? `รอบ ${node.cloneRound || 1}${node.cloneSequence ? ` (#${node.cloneSequence})` : ''} • ${
                      (node.cloneRound || 1) === 2 ? 'BFS' : 'ติดผู้แนะนำ'
                    }`
                  : node.isExtraId
                  ? 'Extra ID'
                  : node.isAutoMainId
                  ? 'Auto ID'
                  : 'Main ID'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1">
              <span
                className={`font-bold shrink-0 ${
                  node.isClone ? 'text-[#15803D] dark:text-emerald-400' : 'text-[#2563EB] dark:text-indigo-300'
                }`}
              >
                ผู้แนะนำ:
              </span>
              <button
                type="button"
                onClick={() =>
                  node.directUplineNodeId > 0 && navigateToNode(node.directUplineNodeId)
                }
                className="font-mono font-extrabold text-[#B45309] dark:text-amber-400 hover:underline cursor-pointer truncate"
              >
                {node.directUplineNodeId === 0 ? '#0' : `#${node.directUplineNodeId}`}
              </button>
            </div>
          </div>

          {/* 4. 2-Column Left / Right Slot Box (Fixed Uniform Height, No Horizontal Overflow) */}
          <div className="h-[56px] shrink-0 grid grid-cols-2 gap-1">
            {/* Left Slot */}
            <div
              className={`min-w-0 overflow-hidden rounded-md p-1 flex flex-col justify-between h-full ${
                node.leftChild > 0
                  ? 'bg-[#DCFCE7]/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/45'
                  : 'bg-[#F8FAFC] dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-0.5 min-w-0">
                <span className="text-[8.5px] font-bold text-[#15803D] dark:text-emerald-400 leading-tight shrink-0">
                  ↙ ซ้าย
                </span>
                {node.leftChild === 0 && (
                  activeLocks.some((l) => l.parentId === String(node.id) && l.isLeft) ? (
                    <span
                      className="px-1 py-0.2 rounded bg-[#FEF3C7] dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/50 text-[#B45309] dark:text-amber-300 font-extrabold text-[7.5px] animate-pulse shrink-0"
                      title="ตำแหน่งนี้กำลังถูกล็อคจองในระบบ FIFO Queue"
                    >
                      🔒 จอง
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openRegisterModal(node.originMainId || node.id, node.id, true)}
                      className="px-1.5 py-0.2 rounded bg-[#15803D] hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-[8px] shadow-2xs transition cursor-pointer shrink-0"
                    >
                      +ลง
                    </button>
                  )
                )}
              </div>
              {node.leftChild > 0 ? (
                <button
                  type="button"
                  onClick={() => navigateToNode(node.leftChild)}
                  className="font-mono font-extrabold text-[8.5px] leading-tight text-[#15803D] hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white transition cursor-pointer truncate text-left w-full"
                  title={formatChildLabel(leftChildNode, node.leftChild)}
                >
                  {formatChildLabel(leftChildNode, node.leftChild)}
                </button>
              ) : (
                <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 leading-tight truncate">
                  ว่าง
                </span>
              )}
              <div className="text-[7.5px] text-[#334155] dark:text-slate-300 font-mono leading-tight truncate">
                {leftChildNode?.isAdminFreeUpgrade
                  ? 'Admin ฟรี • ค่าชั้น 0'
                  : node.isExtraLineage
                  ? `30%|30%|35%→#${node.directUplineNodeId || 1}`
                  : '30% | 15ช | 35%'}
              </div>
            </div>

            {/* Right Slot */}
            <div
              className={`min-w-0 overflow-hidden rounded-md p-1 flex flex-col justify-between h-full ${
                node.rightChild > 0
                  ? 'bg-purple-50 dark:bg-purple-950/35 border border-purple-300 dark:border-purple-500/50'
                  : 'bg-[#F8FAFC] dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-0.5 min-w-0">
                <span className="text-[8.5px] font-bold text-purple-700 dark:text-purple-300 leading-tight shrink-0">
                  ↘ ขวา
                </span>
                {node.rightChild === 0 && (
                  activeLocks.some((l) => l.parentId === String(node.id) && !l.isLeft) ? (
                    <span
                      className="px-1 py-0.2 rounded bg-[#FEF3C7] dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/50 text-[#B45309] dark:text-amber-300 font-extrabold text-[7.5px] animate-pulse shrink-0"
                      title="ตำแหน่งนี้กำลังถูกล็อคจองในระบบ FIFO Queue"
                    >
                      🔒 จอง
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openRegisterModal(node.originMainId || node.id, node.id, false)}
                      className="px-1.5 py-0.2 rounded bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 text-white font-extrabold text-[8px] shadow-2xs transition cursor-pointer shrink-0"
                    >
                      +ลง
                    </button>
                  )
                )}
              </div>
              {node.rightChild > 0 ? (
                <button
                  type="button"
                  onClick={() => navigateToNode(node.rightChild)}
                  className="font-mono font-extrabold text-[8.5px] leading-tight text-purple-800 hover:text-purple-950 dark:text-purple-200 dark:hover:text-white transition cursor-pointer truncate text-left w-full"
                  title={formatChildLabel(rightChildNode, node.rightChild)}
                >
                  {formatChildLabel(rightChildNode, node.rightChild)}
                </button>
              ) : (
                <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 leading-tight truncate">
                  ว่าง
                </span>
              )}
              <div className="text-[7.5px] text-[#334155] dark:text-slate-300 font-mono leading-tight truncate">
                100% Rebirth
              </div>
            </div>
          </div>

          {/* 5. Vault & Auto ID / Clone Count Pill Bar (Fixed Uniform Height across Main & Clone) */}
          <div className="h-[28px] shrink-0 px-1.5 py-0.5 rounded-md bg-[#F8FAFC] dark:bg-[#0c1020] border border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-1 text-[8px] overflow-hidden">
            {node.isClone ? (
              <>
                <span className="text-[#15803D] dark:text-emerald-300 font-mono font-bold flex items-center gap-1 truncate min-w-0">
                  <Dna className="w-2.5 h-2.5 text-[#15803D] dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    โคลนจาก #{node.originMainId} (รอบ {node.cloneRound || 1})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => navigateToNode(node.originMainId)}
                  className="px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-400/50 text-[#15803D] dark:text-emerald-300 font-bold shrink-0 cursor-pointer"
                >
                  หลัก #{node.originMainId}
                </button>
              </>
            ) : (
              <>
                <span className="text-[#334155] dark:text-slate-200 font-mono flex items-center gap-0.5 truncate min-w-0">
                  <Shield className="w-2.5 h-2.5 text-[#B45309] dark:text-amber-400 shrink-0" />
                  <span className="truncate">
                    {node.isExtraId ? (
                      <>
                        Vault 35%:{' '}
                        <strong className="text-[#BE123C] dark:text-rose-300">
                          → #{node.directUplineNodeId || 1}
                        </strong>
                      </>
                    ) : (
                      <>
                        Vault:{' '}
                        <strong className="text-[#0F172A] dark:text-white">
                          {(node.targetMainIdCurrentRank || 1) >= 18 || node.id === 1
                            ? selectedRank <= 3
                              ? `${node.newAutoIdPool.toFixed(2)}/5U`
                              : `${node.newExtraIdPool.toFixed(2)}/${RANK_PRICES_USDT[1] || 10}U`
                            : `${node.upgradeRankPool.toFixed(2)}/${node.nextRankPrice}U`}
                        </strong>
                      </>
                    )}
                  </span>
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {!node.isExtraId && node.totalAutoIdCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const firstAutoId = node.spawnedAutoIds?.[0];
                        if (firstAutoId) {
                          navigateToNode(firstAutoId);
                        } else {
                          setBenefitModalTab('auto_extra');
                          setExpandedBenefitNodeId(node.id);
                        }
                      }}
                      className="px-1 py-0.2 rounded bg-[#FEF3C7] dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/60 text-[#B45309] dark:text-amber-300 hover:bg-amber-200/70 dark:hover:bg-amber-500/35 font-extrabold flex items-center gap-0.5 cursor-pointer text-[7.5px]"
                      title={
                        node.spawnedAutoIds && node.spawnedAutoIds.length > 0
                          ? `คลิกเพื่อไปที่ Auto ID #${node.spawnedAutoIds.join(', #')}`
                          : `รหัสหลักนี้สร้าง Auto ID แล้ว ${node.totalAutoIdCount} รหัส`
                      }
                    >
                      <span>🤖{node.totalAutoIdCount}</span>
                    </button>
                  )}
                  {!node.isExtraId && node.totalExtraIdCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBenefitModalTab('auto_extra');
                        setExpandedBenefitNodeId(node.id);
                      }}
                      className="px-1 py-0.2 rounded bg-purple-100 dark:bg-fuchsia-500/20 border border-purple-300 dark:border-fuchsia-400/60 text-purple-800 dark:text-fuchsia-300 hover:bg-purple-200 dark:hover:bg-fuchsia-500/35 font-extrabold flex items-center gap-0.5 cursor-pointer text-[7.5px]"
                      title={`รหัสหลักนี้สร้าง Extra ID แล้ว ${node.totalExtraIdCount} รหัส (คลิกเพื่อดูรายละเอียด)`}
                    >
                      <span>⚡{node.totalExtraIdCount}</span>
                    </button>
                  )}
                  {(
                    node.isExtraId
                      ? node.spawnedCloneIds.length > 0
                      : node.totalClonesCount > 0 || node.spawnedCloneIds.length > 0
                  ) ? (
                    <button
                      type="button"
                      onClick={() =>
                        node.spawnedCloneIds[0] &&
                        navigateToNode(node.spawnedCloneIds[0].cloneNodeId)
                      }
                      className="text-[#15803D] hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold underline flex items-center gap-0.5 cursor-pointer text-[8px] whitespace-nowrap"
                      title={
                        node.spawnedCloneIds.length > 0
                          ? `โคลนที่เกิดจากโหนดนี้: ${node.spawnedCloneIds
                              .map((c) => `#${c.cloneNodeId}(รอบ${c.round})`)
                              .join(', ')}`
                          : undefined
                      }
                    >
                      <span>
                        ✨โคลน{' '}
                        {node.isExtraId
                          ? node.spawnedCloneIds.length
                          : Math.max(node.totalClonesCount, node.spawnedCloneIds.length)}
                        ↘
                      </span>
                    </button>
                  ) : (
                    node.totalAutoIdCount === 0 &&
                    node.totalExtraIdCount === 0 && (
                      <span className="text-[#64748B] dark:text-slate-500 font-medium text-[7.5px]">ปกติ</span>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* 6. 15-Level Commission Breakdown Box (Fixed Height) */}
          {(() => {
            const ls = node.levelSummary;
            const tiers = node.isAdminFreeUpgrade ? [] : (ls?.tiersBreakdown || []);
            const receivedPayingNodes = node.isAdminFreeUpgrade
              ? 0
              : tiers.reduce((acc, t) => acc + Number(t.leftPayingNodesCount || 0), 0);

            return (
              <div className="h-[22px] shrink-0 px-1.5 rounded-md bg-[#EFF6FF] dark:bg-[#091526] border border-blue-200/80 dark:border-cyan-500/35 text-[8px] font-mono flex items-center overflow-hidden">
                <span className="text-[#1D4ED8] dark:text-cyan-300 font-extrabold truncate">
                  {node.isAdminFreeUpgrade ? (
                    <>
                      🪜 ค่าชั้น: <strong className="text-[#15803D] dark:text-emerald-300">0</strong> (Admin อัพฟรี)
                    </>
                  ) : (
                    <>
                      🪜 ค่าชั้น: รับแล้ว{' '}
                      <strong className="text-[#15803D] dark:text-emerald-300">{receivedPayingNodes.toLocaleString()}</strong> / 32,767
                    </>
                  )}
                </span>
              </div>
            );
          })()}

          {/* 7. Open Benefit & History Popup Modal Button + Quick Referral Link Copy Button (Fixed Height) */}
          <div className="h-[26px] shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const curMaxR = node.targetMainIdCurrentRank || node.rank || 1;
                setModalUpgradeTargetRank(Math.min(18, curMaxR + 1));
                setModalUpgradeMessage(null);
                setModalUpgradeError(null);
                setBenefitModalTab('all');
                setExpandedBenefitNodeId((prev) => (prev === node.id ? null : node.id));
                fetchPerIdHistoryForModal();
              }}
              className={`h-full flex-1 px-1.5 rounded-md font-bold text-[8px] flex items-center justify-between transition cursor-pointer whitespace-nowrap min-w-0 ${
                isBenefitOpen
                  ? 'bg-[#2563EB] dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-600 text-white shadow-xs'
                  : 'bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-[#0c1020] dark:hover:bg-slate-900 text-[#1D4ED8] dark:text-indigo-200 border border-blue-200/80 dark:border-slate-800'
              }`}
            >
              <span className="flex items-center gap-0.5 truncate">
                <Coins className="w-2.5 h-2.5 text-[#2563EB] dark:text-indigo-300 shrink-0" />
                <span className="truncate">ดูผลประโยชน์</span>
              </span>
              <ChevronDown className="w-2.5 h-2.5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                const sponsorTargetId = node.r1MainId || node.originMainId || node.id;
                setSelectedReferralNodeId(sponsorTargetId);
                copyReferralLink(sponsorTargetId, `node-card-ref-${node.id}`);
              }}
              className="h-full px-1.5 rounded-md font-bold text-[8px] bg-[#DCFCE7] hover:bg-emerald-200/80 text-[#15803D] border border-emerald-300 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-500/40 flex items-center gap-0.5 transition cursor-pointer shrink-0 whitespace-nowrap"
              title={`คัดลอกลิ้งผู้แนะนำ รหัส #${node.r1MainId || node.originMainId || node.id}`}
            >
              {copiedReferralKey === `node-card-ref-${node.id}` ? (
                <>
                  <Check className="w-2.5 h-2.5 shrink-0" />
                  <span>คัดลอก</span>
                </>
              ) : (
                <>
                  <Link2 className="w-2.5 h-2.5 shrink-0" />
                  <span>แนะนำ #{node.r1MainId || node.originMainId || node.id}</span>
                </>
              )}
            </button>
          </div>

          {/* 8. Collapse / Expand Subtree Toggle inside Node Card (Fixed Uniform Footer Height) */}
          <div className="h-[22px] shrink-0">
            {hasAnyChildNode ? (
              <button
                type="button"
                onClick={() => toggleCollapseNode(node.id)}
                className={`h-full w-full px-1.5 rounded-md font-bold text-[8.5px] flex items-center justify-center gap-1 border transition cursor-pointer ${
                  isNodeCollapsed
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-300 dark:border-amber-500/50'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/90 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                title={isNodeCollapsed ? 'ขยายแสดงโหนดลูกทีม' : 'ย่อโหนดลูกทีม'}
              >
                {isNodeCollapsed ? (
                  <>
                    <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                    <span>
                      {language === 'th'
                        ? `ขยายลูกทีม (+${descCountInfo?.total || 0})`
                        : `Expand (+${descCountInfo?.total || 0})`}
                    </span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-2.5 h-2.5 shrink-0" />
                    <span>
                      {language === 'th'
                        ? `ย่อลูกทีม (${descCountInfo?.total || 0})`
                        : `Collapse (${descCountInfo?.total || 0})`}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <div className="h-full w-full px-1.5 rounded-md border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 font-semibold text-[8px] flex items-center justify-center">
                {language === 'th' ? 'ลูกทีม (0) • ปลายสาย' : 'Downline (0)'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Recursive Binary Subtree Renderer (Strictly capped at MAX_TREE_DEPTH = 15 levels)
  const renderBinarySubtree = (nodeId: number, currentDepth: number): React.ReactNode => {
    if (currentDepth > MAX_TREE_DEPTH) return null;
    const resolvedId =
      currentDepth === 1 && !activeNodesMap.has(nodeId)
        ? activeNodesMap.has(1)
          ? 1
          : activeNodesMap.keys().next().value || 1
        : nodeId;
    const node = activeNodesMap.get(resolvedId);
    if (!node) return null;

    // Strictly cap effective depth to <= 15 levels (จำกัดเพดานไม่เกิน 15 ชั้น)
    const effectiveMaxDepth =
      maxRenderDepth === 0
        ? MAX_TREE_DEPTH
        : Math.min(MAX_TREE_DEPTH, Math.max(1, maxRenderDepth));
    const hasLeft = node.leftChild > 0 && activeNodesMap.has(node.leftChild);
    const hasRight = node.rightChild > 0 && activeNodesMap.has(node.rightChild);
    const isCollapsed = collapsedNodeIds.has(node.id);
    const isAtDepthLimit = currentDepth >= effectiveMaxDepth;
    const showChildrenRow =
      !isCollapsed && !isAtDepthLimit && (hasLeft || hasRight || currentDepth === 1);
    const hiddenDescCount = descendantCountsMap.get(node.id)?.total || 0;

    return (
      <div className="inline-flex flex-col items-center h-auto w-auto">
        {renderNodeCard(node)}

        {isCollapsed && (hasLeft || hasRight) && (
          <button
            type="button"
            onClick={() => toggleCollapseNode(node.id)}
            className="mt-2 px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/25 dark:hover:bg-amber-500/40 border border-amber-300 dark:border-amber-400/60 text-amber-900 dark:text-amber-200 font-bold text-[9.5px] flex items-center gap-1 shadow-xs transition cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
            <span>
              {language === 'th'
                ? `ซ่อนลูกทีม ${hiddenDescCount} รหัส • คลิกเพื่อขยาย`
                : `${hiddenDescCount} hidden • Expand`}
            </span>
          </button>
        )}

        {!isCollapsed && isAtDepthLimit && (hasLeft || hasRight) && (
          <button
            type="button"
            onClick={() => navigateToNode(node.id)}
            className="mt-2 px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 border border-indigo-300 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-200 font-bold text-[9.5px] flex items-center gap-1 shadow-xs transition cursor-pointer"
            title={`จำกัดการแสดงผลสูงสุด ${effectiveMaxDepth} ชั้น — คลิกเพื่อย้ายจุดศูนย์กลางมาที่ #${node.id} เพื่อดูลูกทีมต่อ`}
          >
            <Layers className="w-3 h-3" />
            <span>
              {language === 'th'
                ? `สุดเพดาน ${effectiveMaxDepth} ชั้น (+${hiddenDescCount}) • คลิกดูต่อ`
                : `Depth limit ${effectiveMaxDepth} (+${hiddenDescCount}) • Focus`}
            </span>
          </button>
        )}

        {showChildrenRow && (
          <div className="inline-flex items-start justify-center gap-2.5 sm:gap-4 md:gap-5 pt-5 sm:pt-6 h-auto w-auto">
            <div className="inline-flex flex-col items-center h-auto w-auto">
              {hasLeft
                ? renderBinarySubtree(node.leftChild, currentDepth + 1)
                : renderEmptySlotCard(node, true)}
            </div>
            <div className="inline-flex flex-col items-center h-auto w-auto">
              {hasRight
                ? renderBinarySubtree(node.rightChild, currentDepth + 1)
                : renderEmptySlotCard(node, false)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const allClonesInRank = useMemo(() => {
    return Array.from(activeNodesMap.values()).filter((n) => n.isClone);
  }, [activeNodesMap]);

  const allAutoIdsInRank = useMemo(() => {
    return Array.from(activeNodesMap.values()).filter((n) => n.isAutoMainId);
  }, [activeNodesMap]);

  if (!hasInitialTreeLoaded) {
    return (
      <div className="w-full min-h-[460px] bg-white dark:bg-[#0b1020] border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-8 flex flex-col items-center justify-center gap-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] dark:shadow-2xl">
        <div className="p-4 rounded-2xl bg-[#EFF6FF] dark:bg-emerald-500/15 border border-blue-200/80 dark:border-emerald-500/35 text-[#2563EB] dark:text-emerald-400 shadow-xs">
          <RefreshCw className="w-9 h-9 animate-spin" />
        </div>
        <div className="text-center space-y-1.5">
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white">
            {language === 'th'
              ? 'กำลังโหลดข้อมูลผังต้นไม้ไบนารี่และคำนวณผลประโยชน์ทั้งหมด...'
              : 'Loading Binary Matrix Tree & Benefit Data...'}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            {language === 'th'
              ? 'ระบบจะแสดงผลผังเมื่อโหลดข้อมูลครบทุกโหนดและทุกกระดานเรียบร้อยแล้ว'
              : 'The tree will be displayed once all nodes and rank data finish loading.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden min-h-[calc(100vh-56px)] h-full flex flex-col bg-white dark:bg-[#0b1020] border border-slate-200/80 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] dark:shadow-2xl space-y-2.5 sm:space-y-3 transition-colors duration-200">
      {/* Top Header & Controls Block with Subtle Pastel Hero Gradient in Light Mode */}
      <div className="flex flex-col gap-2.5 p-2.5 sm:p-3.5 -m-2 sm:-m-4 mb-0 sm:mb-0 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-b from-indigo-50/75 via-sky-50/35 to-white dark:from-transparent dark:via-transparent dark:to-transparent border-b border-slate-200/80 dark:border-slate-800/90">

        {/* Row 1 (Topmost): ข้อมูลระบบ & เครื่องมือย่อย (Unified System Hub) */}
        <div className="bg-[#F8FAFC]/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2 sm:p-2.5 space-y-2 transition shadow-2xs">
          {/* Header Row: Clean Tab Navigation & Collapse Toggle */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#64748B] dark:text-slate-400">📊 ข้อมูลระบบ:</span>
              <div className="inline-flex items-center bg-white dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsSecondaryWidgetsCollapsed(false);
                    setSecondaryWidgetsTab('pools');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    !isSecondaryWidgetsCollapsed && secondaryWidgetsTab === 'pools'
                      ? 'bg-[#2563EB] text-white shadow-2xs'
                      : 'text-[#334155] dark:text-slate-300 hover:text-[#2563EB]'
                  }`}
                >
                  <span>💰 พูล AllSell / Family</span>
                  <span className="text-[10px] opacity-90 font-mono">
                    (+{(activeRankPoolsSummary.rankAllSellUsdt + activeRankPoolsSummary.rankFamilyTotalUsdt).toFixed(1)}U)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSecondaryWidgetsCollapsed(false);
                    setSecondaryWidgetsTab('calculator');
                    setIsPathCalculatorOpen(true);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    !isSecondaryWidgetsCollapsed && secondaryWidgetsTab === 'calculator'
                      ? 'bg-[#2563EB] text-white shadow-2xs'
                      : 'text-[#334155] dark:text-slate-300 hover:text-[#2563EB]'
                  }`}
                >
                  <Calculator className="w-3 h-3" />
                  <span>คำนวณ Extra ID</span>
                </button>

                {isAutoExtraPopupEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondaryWidgetsCollapsed(false);
                      setSecondaryWidgetsTab('alerts');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      !isSecondaryWidgetsCollapsed && secondaryWidgetsTab === 'alerts'
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'text-[#334155] dark:text-slate-300 hover:text-[#2563EB]'
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    <span>Auto / Extra</span>
                    {(autoExtraNotificationsData.readyAutoPoolsCount > 0 || autoExtraNotificationsData.readyExtraPoolsCount > 0) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Collapse / Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsSecondaryWidgetsCollapsed((prev) => !prev)}
              className="text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white px-2 py-0.5 rounded-md hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700 transition cursor-pointer flex items-center gap-1"
            >
              <span>{isSecondaryWidgetsCollapsed ? '▾ แสดงข้อมูล' : '▴ ย่อเก็บส่วนนี้'}</span>
            </button>
          </div>

          {/* Expanded Content Area */}
          {!isSecondaryWidgetsCollapsed && (
            <div className="pt-1">
              {/* TAB 1: Pools */}
              {secondaryWidgetsTab === 'pools' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Card 1: รายได้ AllSell (4%) */}
                  <div
                    onClick={() => {
                      setSystemPoolsModalTab('allsell');
                      fetchPerIdHistoryForModal();
                      setIsSystemPoolsModalOpen(true);
                    }}
                    className="rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-cyan-500/40 hover:border-[#2563EB] dark:hover:border-cyan-400 p-2.5 flex items-center justify-between gap-2 cursor-pointer transition shadow-2xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] border border-blue-200/80 text-[#1D4ED8] dark:bg-cyan-500/20 dark:border-cyan-400/40 dark:text-cyan-300 font-extrabold text-[11px]">
                          🌐 AllSell (4%)
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                          {(systemPoolsData?.allSellWallet || '0xBeFEB9871a20656aeF7E8d218f751e9C23FAF710').slice(0, 6)}...
                          {(systemPoolsData?.allSellWallet || '0xBeFEB9871a20656aeF7E8d218f751e9C23FAF710').slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap font-mono text-xs text-[#334155] dark:text-slate-200">
                        <span>
                          ผัง R{selectedRank}:{' '}
                          <strong className="text-[#2563EB] dark:text-cyan-300 font-extrabold">
                            +{activeRankPoolsSummary.rankAllSellUsdt.toFixed(2)} USDT
                          </strong>
                        </span>
                        {viewMode === 'onchain' && (
                          <span className="text-[#15803D] dark:text-emerald-400 font-bold">
                            (รวมทุกแรงค์ +{Number(systemPoolsData?.allSellTotalUsdt ?? activeRankPoolsSummary.rankAllSellUsdt).toFixed(2)} U)
                          </span>
                        )}
                        {Number(systemPoolsData?.onChainBalances?.allSellWalletUsdt || 0) > 0 && (
                          <span className="text-[10.5px] text-[#B45309] dark:text-amber-300">
                            (ยอดในเชน: {Number(systemPoolsData.onChainBalances.allSellWalletUsdt).toFixed(2)} U)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg bg-[#EFF6FF] hover:bg-blue-100 text-[#1D4ED8] dark:bg-cyan-500/20 dark:text-cyan-200 font-bold text-[10.5px] shrink-0 cursor-pointer"
                    >
                      ประวัติ ↗
                    </button>
                  </div>

                  {/* Card 2: รายได้ Family Pool */}
                  <div
                    onClick={() => {
                      setSystemPoolsModalTab('family');
                      fetchPerIdHistoryForModal();
                      setIsSystemPoolsModalOpen(true);
                    }}
                    className="rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-fuchsia-500/40 hover:border-purple-500 dark:hover:border-fuchsia-400 p-2.5 flex items-center justify-between gap-2 cursor-pointer transition shadow-2xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-purple-100/80 border border-purple-200 text-purple-800 dark:bg-fuchsia-500/20 dark:border-fuchsia-400/40 dark:text-fuchsia-300 font-extrabold text-[11px]">
                          🏛️ Family Pool
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                          {(systemPoolsData?.familyPoolWallet || '0x225DF4b5961f757f54728138F289Eaf49D4F275A').slice(0, 6)}...
                          {(systemPoolsData?.familyPoolWallet || '0x225DF4b5961f757f54728138F289Eaf49D4F275A').slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap font-mono text-xs text-[#334155] dark:text-slate-200">
                        <span>
                          ผัง R{selectedRank}:{' '}
                          <strong className="text-purple-700 dark:text-fuchsia-300 font-extrabold">
                            +{activeRankPoolsSummary.rankFamilyTotalUsdt.toFixed(2)} USDT
                          </strong>
                        </span>
                        {viewMode === 'onchain' && (
                          <span className="text-[#B45309] dark:text-amber-300 font-bold">
                            (รวมทุกแรงค์ +{Number(systemPoolsData?.familyPoolTotalUsdt ?? activeRankPoolsSummary.rankFamilyTotalUsdt).toFixed(2)} U)
                          </span>
                        )}
                        {Number(systemPoolsData?.onChainBalances?.familyPoolWalletUsdt || 0) > 0 && (
                          <span className="text-[10.5px] text-[#15803D] dark:text-emerald-300">
                            (ยอดในเชน: {Number(systemPoolsData.onChainBalances.familyPoolWalletUsdt).toFixed(2)} U)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 font-bold text-[10.5px] shrink-0 cursor-pointer"
                    >
                      ประวัติ ↗
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Calculator */}
              {secondaryWidgetsTab === 'calculator' && (
                <div className="space-y-2">
                  {multiRankSnapshotsState.size > 0 ? (
                    <ExtraIdPathCalculator
                      multiRankSnapshots={multiRankSnapshotsState}
                      defaultMainId={2}
                      defaultProspectiveRank={10}
                      perIdReportsMap={perIdReportsMap}
                      onSelectRankAndNode={(r, nId) => {
                        if (selectedRank !== r) {
                          setSelectedRank(r);
                          loadOnChainTree(r);
                        }
                        navigateToNode(nId);
                      }}
                    />
                  ) : (
                    <div className="p-4 text-center text-xs text-[#64748B] dark:text-slate-400">
                      กำลังโหลดข้อมูลตารางคำนวณเส้นทาง...
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Auto/Extra Alerts */}
              {secondaryWidgetsTab === 'alerts' && isAutoExtraPopupEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Compact Auto ID Card */}
                  <div
                    onClick={() => {
                      setAutoExtraAlertTab('auto');
                      setUnreadAutoExtraCount(0);
                      fetchPerIdHistoryForModal();
                      setIsAutoExtraAlertModalOpen(true);
                    }}
                    className="rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-400/60 p-2.5 flex items-center justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="space-y-1 min-w-0 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10.5px]">
                          🟡 Auto ID (R1)
                        </span>
                        <span className="text-[10px] text-amber-200 font-mono">
                          ออกแล้ว {autoExtraNotificationsData.spawnedAutoIds.length} รหัส
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono">
                        กระเป๋านี้: <strong className="text-emerald-400">{autoExtraNotificationsData.myAutoSpawnedCount}</strong> · คิวสะสม: <strong className="text-cyan-300">{autoExtraNotificationsData.autoPoolsList.length}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      เปิดกล่อง ↗
                    </button>
                  </div>

                  {/* Compact Extra ID Card */}
                  <div
                    onClick={() => {
                      setAutoExtraAlertTab('extra');
                      setUnreadAutoExtraCount(0);
                      fetchPerIdHistoryForModal();
                      setIsAutoExtraAlertModalOpen(true);
                    }}
                    className="rounded-xl bg-gradient-to-r from-red-950/70 via-slate-900 to-red-950/70 border border-red-500/60 p-2.5 flex items-center justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="space-y-1 min-w-0 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-black text-[10.5px]">
                          🔴 Extra ID (R2–27)
                        </span>
                        <span className="text-[10px] text-red-200 font-mono">
                          ออกแล้ว {autoExtraNotificationsData.spawnedExtraIds.length} รหัส
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono">
                        กระเป๋านี้: <strong className="text-emerald-400">{autoExtraNotificationsData.myExtraSpawnedCount}</strong> · คิวสะสม: <strong className="text-cyan-300">{autoExtraNotificationsData.extraPoolsList.length}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      เปิดกล่อง ↗
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 4: Depth Selector & Compact Status Legend Bar (รวมความลึกและสัญลักษณ์ในแถวเดียว ไม่เปลืองพื้นที่) */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Depth Selector & Collapse/Expand All Controls - strictly capped at 15 levels */}
          <div className="flex items-center gap-1.5 min-w-0 max-w-full flex-wrap">
            <span className="text-[#64748B] dark:text-slate-400 font-semibold text-[11px] shrink-0">
              ความลึก (เพดาน ≤ 15 ชั้น):
            </span>
            <div className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-0.5 sm:p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setMaxRenderDepth(0)}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                  maxRenderDepth === 0
                    ? 'bg-[#2563EB] dark:bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                สูงสุด 15 ชั้น ({Math.min(MAX_TREE_DEPTH, maxTreeLevelInRank)}/{MAX_TREE_DEPTH})
              </button>
              {[3, 4, 5, 8, 12, 15].map((depthVal) => (
                <button
                  key={depthVal}
                  type="button"
                  onClick={() => setMaxRenderDepth(depthVal)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition cursor-pointer whitespace-nowrap ${
                    maxRenderDepth === depthVal
                      ? 'bg-[#2563EB] dark:bg-emerald-600 text-white font-bold shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {depthVal} ชั้น
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExpandAllNodes}
                disabled={collapsedNodeIds.size === 0}
                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                title="ขยายโหนดลูกทีมทั้งหมด"
              >
                <Maximize2 className="w-3 h-3" />
                <span>{language === 'th' ? 'ขยายทั้งหมด' : 'Expand All'}</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseSubtrees}
                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer"
                title="ย่อโหนดลูกทีมระดับย่อยทั้งหมด"
              >
                <Minimize2 className="w-3 h-3" />
                <span>{language === 'th' ? 'ย่อลูกทีม' : 'Collapse Subtrees'}</span>
              </button>
            </div>
          </div>

          {/* Compact Status Tag Filter & Legend Dropdown Toggle */}
          <div className="relative shrink-0 flex items-center gap-1.5">
            {highlightedStatusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setHighlightedStatusFilter('all')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-blue-600 text-white text-[10.5px] font-bold shadow-xs cursor-pointer hover:bg-blue-700 transition"
                title="ล้างตัวกรองไฮไลท์สถานะโหนด"
              >
                <span>
                  เน้น:{' '}
                  {highlightedStatusFilter === 'main'
                    ? 'MAIN ID'
                    : highlightedStatusFilter === 'auto'
                    ? 'AUTO ID'
                    : highlightedStatusFilter === 'extra'
                    ? 'EXTRA ID'
                    : 'CLONE ID'}
                </span>
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLegendOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer shadow-2xs ${
                highlightedStatusFilter !== 'all'
                  ? 'bg-[#EFF6FF] border-blue-300 text-[#1D4ED8] dark:bg-indigo-950/70 dark:border-indigo-400/60 dark:text-indigo-200'
                  : 'bg-[#F8FAFC] hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-800 text-[#334155] dark:text-slate-300'
              }`}
              title="คลิกเพื่อดูคำอธิบายสีกรอบและแท็กสถานะโหนด (คลิกเลือกไฮไลท์ได้)"
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              </span>
              <span>สถานะ / สีกรอบ</span>
              <ChevronDown className={`w-3 h-3 text-[#64748B] transition-transform duration-200 ${isLegendOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLegendOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-80 p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl shadow-xl flex flex-col gap-2 text-[11px] animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  <div>
                    <span className="font-bold text-[#0F172A] dark:text-white block">
                      ป้ายสถานะโหนด (Node Status Tags)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      คลิกเพื่อไฮไลท์เฉพาะสถานะในผัง R{selectedRank}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLegendOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {[
                  {
                    key: 'main' as const,
                    badge: 'MAIN ID',
                    label: 'รหัสหลัก (Main ID)',
                    count: statusCountsInRank.main,
                    Icon: Crown,
                    badgeClass: 'bg-[#2563EB] text-white dark:bg-sky-400 dark:text-slate-950',
                    rowClass:
                      'bg-[#EFF6FF] border-blue-200 text-[#1D4ED8] dark:bg-slate-800/80 dark:border-sky-400/40 dark:text-sky-200',
                  },
                  {
                    key: 'auto' as const,
                    badge: 'AUTO ID',
                    label: 'รหัสอัตโนมัติ (Auto ID)',
                    count: statusCountsInRank.auto,
                    Icon: Bot,
                    badgeClass: 'bg-amber-500 text-slate-950 dark:bg-amber-400 dark:text-slate-950',
                    rowClass:
                      'bg-[#FEF3C7] border-amber-300 text-[#B45309] dark:bg-amber-950/60 dark:border-amber-500/40 dark:text-amber-300',
                  },
                  {
                    key: 'extra' as const,
                    badge: 'EXTRA ID',
                    label: 'รหัสเสริม (Extra ID)',
                    count: statusCountsInRank.extra,
                    Icon: Zap,
                    badgeClass: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white',
                    rowClass:
                      'bg-[#FEE2E2] border-rose-300 text-[#BE123C] dark:bg-rose-950/60 dark:border-rose-500/40 dark:text-rose-300',
                  },
                  {
                    key: 'clone' as const,
                    badge: 'CLONE ID',
                    label: 'รหัสโคลนนิ่ง (Cloning ID)',
                    count: statusCountsInRank.clone,
                    Icon: Dna,
                    badgeClass: 'bg-[#15803D] text-white dark:bg-emerald-400 dark:text-slate-950',
                    rowClass:
                      'bg-[#DCFCE7] border-emerald-300 text-[#15803D] dark:bg-emerald-950/60 dark:border-emerald-500/40 dark:text-emerald-300',
                  },
                ].map((item) => {
                  const ItemIcon = item.Icon;
                  const isActive = highlightedStatusFilter === item.key;
                  return (
                    <button
                      key={`legend-status-${item.key}`}
                      type="button"
                      onClick={() =>
                        setHighlightedStatusFilter((prev) => (prev === item.key ? 'all' : item.key))
                      }
                      className={`w-full flex items-center justify-between gap-2 p-1.5 rounded-lg border font-bold transition cursor-pointer ${item.rowClass} ${
                        isActive ? 'ring-2 ring-blue-500 dark:ring-cyan-400 shadow-sm' : 'hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-black inline-flex items-center gap-1 shrink-0 ${item.badgeClass}`}
                        >
                          <ItemIcon className="w-2.5 h-2.5 shrink-0" />
                          <span>{item.badge}</span>
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/30 shrink-0">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 5: Rank Matrices Button Bar (Matching User's Screenshot Design) */}
        <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80">
          {/* Horizontal Scrollable Rank Buttons Bar */}
          <div className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain pb-2 pt-0.5 matrix-scroll-container matrix-horizontal-scroll-only flex items-center gap-2 select-none">
            {RANK_PRICES_USDT.map((price, idx) => {
              const r = idx + 1;
              const isSelected = selectedRank === r;
              const isPassed = currentUserRank > r;
              const isCurrent = currentUserRank === r;
              const count =
                rankNodeCounts[r] !== undefined
                  ? rankNodeCounts[r]
                  : (r === selectedRank ? totalNodesInRank : (r === 1 ? 1 : 0));

              let buttonClasses = '';
              let textColor = '';
              let countBadgeStyle = '';
              let priceBadgeStyle = '';

              if (isSelected) {
                buttonClasses =
                  'bg-[#2563EB] dark:bg-gradient-to-r dark:from-indigo-600 dark:via-purple-600 dark:to-violet-600 border-2 border-blue-400 dark:border-indigo-300 shadow-[0_4px_14px_-2px_rgba(37,99,235,0.35)] dark:shadow-[0_0_16px_rgba(139,92,246,0.5)] ring-2 ring-blue-400/30 dark:ring-indigo-400/30';
                textColor = 'text-white font-extrabold';
                countBadgeStyle = 'bg-white/20 text-white border border-white/30 dark:bg-black/40 dark:text-cyan-300 dark:border-cyan-400/30 font-bold';
                priceBadgeStyle = 'bg-white/20 text-blue-50 border border-white/30 dark:bg-black/40 dark:text-purple-100 dark:border-purple-400/30 font-bold';
              } else if (isCurrent) {
                buttonClasses =
                  'bg-[#FEF3C7] hover:bg-amber-200/70 dark:bg-[#24170a] dark:hover:bg-[#34220f] border border-amber-300 dark:border-amber-600/70 shadow-2xs text-[#B45309] dark:text-amber-300';
                textColor = 'text-[#B45309] dark:text-amber-400 font-extrabold';
                countBadgeStyle = 'bg-white/80 text-[#15803D] border border-emerald-300 dark:bg-black/50 dark:text-emerald-300 dark:border-emerald-500/25 font-bold';
                priceBadgeStyle = 'bg-white/80 text-[#334155] border border-amber-300/70 dark:bg-black/50 dark:text-slate-300 dark:border-slate-700/60 font-medium';
              } else if (isPassed) {
                buttonClasses =
                  'bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-[#181a38] dark:hover:bg-[#21244c] border border-blue-200/80 dark:border-[#3b3e6e] text-[#1D4ED8] dark:text-slate-200';
                textColor = 'text-[#1E40AF] dark:text-white font-bold';
                countBadgeStyle = 'bg-[#DCFCE7] text-[#15803D] border border-emerald-200 dark:bg-black/50 dark:text-emerald-300 dark:border-emerald-500/25 font-bold';
                priceBadgeStyle = 'bg-white text-[#334155] border border-slate-200 dark:bg-black/50 dark:text-slate-300 dark:border-slate-700/60 font-medium';
              } else {
                buttonClasses =
                  'bg-[#F8FAFC] hover:bg-slate-100 dark:bg-[#0f1422] dark:hover:bg-[#151c2e] border border-slate-200/80 dark:border-slate-800 text-[#64748B] dark:text-slate-400';
                textColor = 'text-[#334155] dark:text-slate-300 font-bold';
                countBadgeStyle = 'bg-white text-[#64748B] border border-slate-200/80 dark:bg-black/40 dark:text-slate-400 dark:border-slate-800 font-medium';
                priceBadgeStyle = 'bg-white text-[#64748B] border border-slate-200/80 dark:bg-black/40 dark:text-slate-400 dark:border-slate-800 font-medium';
              }

              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    const targetRank = r;
                    setSelectedRank(targetRank);
                    setFocusRootId(1);
                    setNavigationHistory([1]);
                    setSearchInput('1');
                    setExpandedBenefitNodeId(null);
                    setLatestNewNodeAlert(null);
                    setZoomScale(0.55);
                    setRealtimeCountdown(realtimeInterval);
                    loadOnChainTree(targetRank);
                  }}
                  className={`px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-1.5 text-xs ${buttonClasses}`}
                  title={`คลิกเพื่อดูผัง Rank ${r} (${price} USDT) • มีสมาชิกในผังนี้ ${count} โหนด`}
                >
                  {(isSelected || isPassed) && (
                    <span className={`${isSelected ? 'text-white dark:text-emerald-400' : 'text-[#15803D] dark:text-emerald-400'} font-black text-xs leading-none`}>
                      ✓
                    </span>
                  )}

                  {(isSelected || isCurrent) && (
                    <span className="text-xs leading-none">👑</span>
                  )}

                  <span className={`${textColor} text-xs tracking-tight whitespace-nowrap`}>
                    {language === 'th' ? `ผัง ${r}` : `Rank ${r}`}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] leading-tight ${countBadgeStyle}`}
                  >
                    {count}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] leading-tight ${priceBadgeStyle}`}
                  >
                    {price}U
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Navigation, Breadcrumb & Auto-Fit Bar */}
      <div className="rounded-2xl bg-[#F8FAFC] dark:bg-[#11172a] border border-slate-200/80 dark:border-slate-800/90 p-3 sm:p-3.5 space-y-2.5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)]">
        {/* Row 1: Back Button + Search Input */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGoBack}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EFF6FF] dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-[#334155] hover:text-[#2563EB] dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#2563EB] dark:text-amber-400" />
            <span>ย้อนกลับผัง</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = searchInput.trim();
              if (/^0x[a-fA-F0-9]{6,}$/.test(trimmed)) {
                const lower = trimmed.toLowerCase();
                const found = Array.from(activeNodesMap.values()).find((n) =>
                  n.owner.toLowerCase().startsWith(lower)
                );
                if (found) navigateToNode(found.id);
                return;
              }
              const target = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
              if (target >= 1) navigateToNode(target);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              inputMode="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="#ID"
              className="w-20 sm:w-24 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB] dark:focus:border-indigo-500 shadow-2xs"
            />
            <button
              type="submit"
              className="p-1.5 rounded-xl bg-white hover:bg-[#EFF6FF] dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-[#334155] hover:text-[#2563EB] dark:text-slate-300 transition cursor-pointer shadow-2xs"
              title="ค้นหาโหนด"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Row 2: Breadcrumbs & Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm flex-wrap">
            <span className="text-[#64748B] dark:text-slate-400 font-medium">เส้นทางผัง:</span>
            {breadcrumbPath.map((nodeId, idx) => (
              <React.Fragment key={nodeId}>
                {idx > 0 && <span className="text-slate-400 dark:text-slate-600">→</span>}
                <button
                  type="button"
                  onClick={() => navigateToNode(nodeId)}
                  className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs transition cursor-pointer ${
                    nodeId === focusRootId
                      ? 'bg-[#2563EB] dark:bg-indigo-600 text-white shadow-xs'
                      : 'bg-white hover:bg-[#EFF6FF] text-[#334155] hover:text-[#2563EB] border border-slate-200/80 dark:border-transparent dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  #{nodeId}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.25, Number((z - 0.08).toFixed(2))))}
              className="p-1 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              title="ย่อผัง (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((z) => (z === 0.55 ? 1 : 0.55))}
              className="text-[10px] font-mono text-[#2563EB] dark:text-amber-300 font-extrabold hover:underline px-1.5 cursor-pointer"
              title="สลับขนาด 55% / 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.5, Number((z + 0.08).toFixed(2))))}
              className="p-1 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              title="ขยายผัง (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleAutoFitScreen}
              className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] hover:bg-blue-100/80 text-[#1D4ED8] border border-blue-200/80 dark:bg-indigo-600/25 dark:hover:bg-indigo-600/40 dark:text-indigo-300 dark:border-indigo-500/30 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
              title="ปรับขนาดให้พอดีหน้าจออัตโนมัติ"
            >
              <Maximize2 className="w-3 h-3" />
              <span>พอดีจอ</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Horizontal-Scroll-Only Binary Tree Viewport with Mobile Touch Indicators */}
      <div className="relative w-full max-w-full min-w-0 flex-1 flex flex-col space-y-2">
        {/* Touch-Scroll Indicator & Quick Horizontal Pan Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
            isTouchScrolling
              ? 'bg-[#EFF6FF] border-[#2563EB] shadow-[0_4px_20px_-2px_rgba(37,99,235,0.18)] dark:bg-indigo-950/85 dark:border-indigo-400/70 dark:shadow-[0_0_16px_rgba(99,102,241,0.35)]'
              : 'bg-[#F8FAFC] border-slate-200/80 dark:bg-slate-950/90 dark:border-slate-800/90'
          }`}
        >
          {/* Left: Visual Touch / Swipe Hint */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg border shrink-0 ${
                isTouchScrolling
                  ? 'bg-[#2563EB] border-[#2563EB] text-white scale-105 dark:bg-indigo-500/30 dark:border-indigo-400 dark:text-indigo-200'
                  : 'bg-[#EFF6FF] border-blue-200/80 text-[#2563EB] dark:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300'
              } transition-transform`}
            >
              <Hand className="w-3.5 h-3.5 sm:hidden animate-pulse" />
              <MoveHorizontal className="w-3.5 h-3.5 hidden sm:block" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] sm:text-xs font-extrabold text-[#0F172A] dark:text-slate-200">
                <span className="text-[#1D4ED8] dark:text-amber-300">
                  {language === 'th'
                    ? '↔ ลาก (Drag) หรือปัดเพื่อเลื่อนดูผัง • คลิกการ์ดสมาชิกเพื่อดูข้อมูล / ต่อสายซ้าย (L)-ขวา (R)'
                    : '↔ Drag / swipe to pan tree • Click any member card to inspect or place L / R'}
                </span>
                <span className="hidden xs:inline-block px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 font-mono text-[10px] text-[#2563EB] dark:text-cyan-300">
                  {scrollProgressPercent}%
                </span>
              </div>
              {/* Horizontal Scroll Track Indicator */}
              {hasHorizontalOverflow && (
                <div className="w-36 sm:w-52 h-1.5 rounded-full bg-slate-200 dark:bg-slate-900 border border-slate-300/70 dark:border-slate-800 overflow-hidden mt-1 relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2563EB] via-indigo-500 to-emerald-500 dark:from-emerald-400 dark:via-indigo-400 dark:to-amber-400 transition-all duration-150"
                    style={{
                      width: '28%',
                      marginLeft: `${Math.min(72, Math.max(0, Math.round(scrollProgressPercent * 0.72)))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Touch-Friendly Quick 2D Pan Buttons (Left / Up / Center / Down / Right) */}
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => scrollTreeHorizontallyBy(-260)}
              disabled={!canScrollLeft}
              className="px-2 py-1 rounded-lg bg-white hover:bg-[#EFF6FF] dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-35 text-[#334155] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold text-[11px] flex items-center gap-0.5 transition cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              title={language === 'th' ? 'เลื่อนผังไปทางซ้าย' : 'Scroll Left'}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#15803D] dark:text-emerald-400" />
              <span>{language === 'th' ? 'ซ้าย' : 'Left'}</span>
            </button>

            <button
              type="button"
              onClick={() => scrollTreeVerticallyBy(-260)}
              disabled={!canScrollUp}
              className="px-2 py-1 rounded-lg bg-white hover:bg-[#EFF6FF] dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-35 text-[#334155] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold text-[11px] flex items-center gap-0.5 transition cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              title={language === 'th' ? 'เลื่อนผังขึ้นด้านบน' : 'Scroll Up'}
            >
              <ChevronUp className="w-3.5 h-3.5 text-[#2563EB] dark:text-cyan-400" />
              <span>{language === 'th' ? 'ขึ้น' : 'Up'}</span>
            </button>

            <button
              type="button"
              onClick={scrollTreeToCenter}
              className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-blue-100/80 dark:bg-indigo-600/30 dark:hover:bg-indigo-600/50 text-[#1D4ED8] dark:text-indigo-200 border border-blue-200/80 dark:border-indigo-400/50 font-extrabold text-[11px] font-mono transition cursor-pointer"
              title={language === 'th' ? 'จัดกึ่งกลางโหนดหลัก' : 'Center Root Node'}
            >
              🎯 #{focusRootId}
            </button>

            <button
              type="button"
              onClick={() => scrollTreeVerticallyBy(260)}
              disabled={!canScrollDown}
              className="px-2 py-1 rounded-lg bg-white hover:bg-[#EFF6FF] dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-35 text-[#334155] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold text-[11px] flex items-center gap-0.5 transition cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              title={language === 'th' ? 'เลื่อนผังลงด้านล่าง' : 'Scroll Down'}
            >
              <span>{language === 'th' ? 'ลง' : 'Down'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#2563EB] dark:text-cyan-400" />
            </button>

            <button
              type="button"
              onClick={() => scrollTreeHorizontallyBy(260)}
              disabled={!canScrollRight}
              className="px-2 py-1 rounded-lg bg-white hover:bg-[#EFF6FF] dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-35 text-[#334155] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold text-[11px] flex items-center gap-0.5 transition cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              title={language === 'th' ? 'เลื่อนผังไปทางขวา' : 'Scroll Right'}
            >
              <span>{language === 'th' ? 'ขวา' : 'Right'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </button>
          </div>
        </div>

        {/* Selected Member Quick-Inspect & Left (L) / Right (R) Downline Action Bar */}
        {selectedTreeNodeId !== null && activeNodesMap.has(selectedTreeNodeId) && (() => {
          const selNode = activeNodesMap.get(selectedTreeNodeId)!;
          const selStatusMeta = getNodeStatusMeta(selNode);
          const SelStatusIcon = selStatusMeta.Icon;
          const selDesc = descendantCountsMap.get(selNode.id);
          const selHasChildren = selNode.leftChild > 0 || selNode.rightChild > 0;
          const selCollapsed = collapsedNodeIds.has(selNode.id);
          const selLabel = selNode.isExtraId
            ? selNode.extraMainLabel || `Extra R${selNode.rank}-#${selNode.id}`
            : selNode.isClone
            ? `Main #${selNode.r1MainId || selNode.originMainId} (โคลน R${selNode.rank}-#${selNode.id})`
            : selNode.isAutoMainId
            ? `Auto ID #${selNode.r1MainId || selNode.originMainId}`
            : `Main #${selNode.r1MainId || selNode.originMainId} (R${selNode.rank}-#${selNode.id})`;

          return (
            <div className="rounded-xl bg-gradient-to-r from-[#EFF6FF] via-white to-emerald-50/70 dark:from-slate-900 dark:via-[#0d1428] dark:to-emerald-950/30 border-2 border-[#2563EB]/60 dark:border-cyan-500/60 p-2.5 sm:p-3 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-start sm:items-center gap-2.5 flex-wrap min-w-0">
                <div className="p-2 rounded-xl bg-[#2563EB] dark:bg-cyan-500/20 text-white dark:text-cyan-300 shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-extrabold text-sm text-[#0F172A] dark:text-white">
                      {selLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full border font-mono font-black text-[10px] inline-flex items-center gap-1 ${selStatusMeta.floatingBadgeClass}`}
                    >
                      <SelStatusIcon className="w-3 h-3 shrink-0" />
                      <span>{selStatusMeta.tagText}</span>
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-mono font-bold text-[10px]">
                      R{selNode.rank} • ชั้น {Math.min(MAX_TREE_DEPTH, selNode.level)}/{MAX_TREE_DEPTH}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                      ลูกทีมใต้สาย: {selDesc?.total || 0} รหัส
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>กระเป๋า: {shortenWallet(selNode.owner)}</span>
                    <span>•</span>
                    <span>อัพไลน์: {selNode.parentId === 0 ? 'Root (#0)' : `#${selNode.parentId}`}</span>
                    <span>•</span>
                    <span>ผู้แนะนำ: #{selNode.directUplineNodeId}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {/* Left (L) Slot Action */}
                {selNode.leftChild === 0 ? (
                  <button
                    type="button"
                    onClick={() => openRegisterModal(selNode.originMainId || selNode.id, selNode.id, true)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#15803D] hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? '+ ต่อสายฝั่งซ้าย (L)' : '+ Place Left (L)'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      navigateToNode(selNode.leftChild);
                      setSelectedTreeNodeId(selNode.leftChild);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold font-mono text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>ซ้าย (L): #{selNode.leftChild}</span>
                  </button>
                )}

                {/* Right (R) Slot Action */}
                {selNode.rightChild === 0 ? (
                  <button
                    type="button"
                    onClick={() => openRegisterModal(selNode.originMainId || selNode.id, selNode.id, false)}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-xs transition cursor-pointer"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? '+ ต่อสายฝั่งขวา (R)' : '+ Place Right (R)'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      navigateToNode(selNode.rightChild);
                      setSelectedTreeNodeId(selNode.rightChild);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-500/40 text-purple-800 dark:text-purple-300 font-bold font-mono text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>ขวา (R): #{selNode.rightChild}</span>
                  </button>
                )}

                {selHasChildren && (
                  <button
                    type="button"
                    onClick={() => toggleCollapseNode(selNode.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    {selCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    <span>{selCollapsed ? 'ขยายลูกทีม' : 'ย่อลูกทีม'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const curMaxR = selNode.targetMainIdCurrentRank || selNode.rank || 1;
                    setModalUpgradeTargetRank(Math.min(18, curMaxR + 1));
                    setModalUpgradeMessage(null);
                    setModalUpgradeError(null);
                    setBenefitModalTab('all');
                    setExpandedBenefitNodeId(selNode.id);
                    fetchPerIdHistoryForModal();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{language === 'th' ? 'ดูข้อมูลเต็ม' : 'Full Info'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToNode(selNode.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition cursor-pointer"
                  title="ตั้งรหัสนี้เป็นจุดศูนย์กลางผัง"
                >
                  🎯 โฟกัส
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTreeNodeId(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer"
                  title="ปิดแถบเลือกสมาชิก"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Relative Wrapper for Interactive 2D Pan & Zoom Binary Tree + Edge Touch Indicators */}
        <div className="relative w-full max-w-full min-w-0 h-[68vh] sm:h-[76vh] min-h-[420px] max-h-[820px] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800/90 bg-[#F8FAFC] dark:bg-[#080c17] shadow-inner">
          {/* Left Overflow Edge Gradient & Floating Touch Button */}
          {canScrollLeft && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-7 sm:w-10 bg-gradient-to-r from-[#F8FAFC] via-[#F8FAFC]/80 dark:from-[#080c17] dark:via-[#080c17]/75 to-transparent z-20"
              />
              <button
                type="button"
                onClick={() => scrollTreeHorizontallyBy(-280)}
                className="sm:hidden absolute left-1.5 top-1/2 -translate-y-1/2 z-25 w-8 h-12 rounded-xl bg-white/95 dark:bg-slate-900/90 active:bg-[#2563EB] border border-slate-300 dark:border-indigo-400/60 text-[#0F172A] dark:text-white shadow-md flex items-center justify-center cursor-pointer"
                aria-label="Scroll tree left"
              >
                <ChevronLeft className="w-4 h-4 text-[#15803D] dark:text-emerald-300 animate-pulse" />
              </button>
            </>
          )}

          {/* Right Overflow Edge Gradient & Floating Touch Button */}
          {canScrollRight && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-7 sm:w-10 bg-gradient-to-l from-[#F8FAFC] via-[#F8FAFC]/80 dark:from-[#080c17] dark:via-[#080c17]/75 to-transparent z-20"
              />
              <button
                type="button"
                onClick={() => scrollTreeHorizontallyBy(280)}
                className="sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 z-25 w-8 h-12 rounded-xl bg-white/95 dark:bg-slate-900/90 active:bg-[#2563EB] border border-slate-300 dark:border-indigo-400/60 text-[#0F172A] dark:text-white shadow-md flex items-center justify-center cursor-pointer"
                aria-label="Scroll tree right"
              >
                <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-300 animate-pulse" />
              </button>
            </>
          )}

          {/* Interactive Drag-to-Pan & Pinch/Zoom Container */}
          <div
            ref={scrollViewportRef}
            onScroll={updateHorizontalScrollIndicators}
            onMouseDown={handleViewportMouseDown}
            onClickCapture={(e) => {
              if (dragStateRef.current.hasMoved) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDistRef.current = Math.hypot(dx, dy);
                pinchStartZoomRef.current = zoomScale;
              } else {
                pinchStartDistRef.current = null;
                setIsTouchScrolling(true);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && pinchStartDistRef.current) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const ratio = dist / pinchStartDistRef.current;
                const nextZoom = Math.max(
                  0.25,
                  Math.min(1.5, Number((pinchStartZoomRef.current * ratio).toFixed(2)))
                );
                setZoomScale(nextZoom);
              }
            }}
            onTouchEnd={() => {
              pinchStartDistRef.current = null;
              updateHorizontalScrollIndicators();
              setTimeout(() => setIsTouchScrolling(false), 500);
            }}
            className={`w-full max-w-full min-w-0 min-h-0 flex-1 h-full p-2 sm:p-5 md:p-6 pb-24 sm:pb-28 matrix-scroll-container matrix-pan-viewport ${
              isDraggingTree ? 'cursor-grabbing select-none' : 'cursor-grab'
            }`}
          >
            <div
              style={{
                zoom: zoomScale,
              }}
              className="w-max min-w-full h-max flex justify-center items-start mx-auto"
            >
              <div
                ref={treeContentRef}
                className="relative inline-flex flex-col items-center h-max w-max px-6 sm:px-10 py-4 pb-16"
              >
                {/* Dynamic SVG Curved Connector Lines Overlay */}
                {!isLoadingTree && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                    {connectorLines.map((line) => {
                      const midY = line.y1 + (line.y2 - line.y1) * 0.5;
                      const d = `M ${line.x1} ${line.y1} C ${line.x1} ${midY}, ${line.x2} ${midY}, ${line.x2} ${line.y2}`;
                      const strokeColor = line.isFilled
                        ? line.isLeft
                          ? '#10b981'
                          : '#a855f7'
                        : '#94a3b8';

                      return (
                        <path
                          key={line.key}
                          d={d}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="2.2"
                          strokeDasharray={line.isFilled ? undefined : '5 5'}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Recursive Binary Tree Nodes */}
                {isLoadingTree || activeNodesMap.size === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#64748B] dark:text-slate-400">
                    <RefreshCw className="w-8 h-8 text-[#2563EB] dark:text-emerald-400 animate-spin" />
                    <span className="text-sm font-semibold">
                      {language === 'th'
                        ? `กำลังโหลดข้อมูลผัง Rank ${selectedRank} และคำนวณผลประโยชน์...`
                        : `Loading Rank ${selectedRank} binary tree nodes...`}
                    </span>
                  </div>
                ) : (
                  renderBinarySubtree(focusRootId, 1)
                )}
              </div>
            </div>
          </div>

          {/* Mobile Touch Swipe Indicator Pill */}
          {hasHorizontalOverflow && (
            <div className="sm:hidden pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-25">
              <div
                className={`px-3 py-1 rounded-full border text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md transition-all ${
                  isTouchScrolling
                    ? 'bg-[#2563EB]/95 border-blue-300 text-white shadow-md'
                    : 'bg-white/90 dark:bg-slate-950/85 border-slate-300 dark:border-indigo-500/40 text-[#334155] dark:text-indigo-200 shadow-xs'
                }`}
              >
                <ChevronLeft className={`w-3 h-3 ${canScrollLeft ? 'text-[#15803D] dark:text-emerald-300' : 'text-slate-400 dark:text-slate-600'}`} />
                <span>ปัดซ้าย–ขวา ({scrollProgressPercent}%)</span>
                <ChevronRight className={`w-3 h-3 ${canScrollRight ? 'text-purple-600 dark:text-purple-300' : 'text-slate-400 dark:text-slate-600'}`} />
              </div>
            </div>
          )}

          {/* ปุ่มลอยตัวมุมซ้ายล่าง: ดูข้อมูล ID กระเป๋านี้ | มุมขวาล่าง: สมัครสมาชิก */}
          <div className="fixed bottom-3.5 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5 z-40 flex items-center justify-between gap-2 pointer-events-none">
            {/* ปุ่มดูข้อมูล ID กระเป๋านี้ ลอยอยู่มุมซ้ายล่าง */}
            <button
              type="button"
              onClick={() => {
                const focusedOwner =
                  activeNodesMap.get(focusRootId)?.owner ||
                  activeNodesMap.get(1)?.owner ||
                  '0x622E20082e63c7220c5AF0A77Cbc437a98505311';
                setSelectedInspectWallet(userAddress || focusedOwner);
                fetchPerIdHistoryForModal();
                setIsWalletIdsModalOpen(true);
              }}
              className="pointer-events-auto px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-[0_8px_25px_rgba(99,102,241,0.45)] border border-indigo-400/60 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <User className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                {language === 'th' ? 'ดูข้อมูล ID กระเป๋านี้' : 'View Wallet IDs'}
              </span>
            </button>

            {/* ปุ่มสมัครสมาชิก ลอยอยู่มุมขวาล่าง */}
            <button
              type="button"
              onClick={() => {
                if (onOpenRegisterModal) {
                  onOpenRegisterModal();
                } else {
                  openRegisterModal(focusRootId || 1);
                }
              }}
              className="pointer-events-auto px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-[0_8px_25px_rgba(16,185,129,0.45)] border border-emerald-300/60 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                {language === 'th' ? 'สมัครสมาชิก' : 'Register'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Registration Popup Modal */}
      {isRegisterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4"
          onClick={() => !regIsSubmitting && setIsRegisterModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-950 border-2 border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.35)] overflow-hidden p-4 sm:p-5 text-left space-y-3.5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    {language === 'th' ? '📝 ฟอร์มสมัครสมาชิก DApp' : '📝 Register DApp Node'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {language === 'th' ? `ผัง Rank 1 (${RANK_PRICES_USDT[0] || 5} USDT ต่อโหนด)` : `Rank 1 Matrix (${RANK_PRICES_USDT[0] || 5} USDT / Node)`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                disabled={regIsSubmitting}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Placement Box (if triggered from node slot) */}
            {regTargetParentId !== undefined && (
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-emerald-300 font-bold">
                  <span>🎯 ตำแหน่งที่เลือกวาง:</span>
                  <span className="font-mono text-amber-400">
                    {regIsLeft ? '↙ ฝั่งซ้าย' : '↘ ฝั่งขวา'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-mono">
                  อัพไลน์ผัง #{regTargetParentId} • ผู้แนะนำตรง #{regSponsorId}
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              {/* Sponsor Node ID Input */}
              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">
                  {language === 'th' ? 'รหัสผู้แนะนำตรง (Sponsor Node ID):' : 'Direct Sponsor Node ID:'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={regSponsorId}
                    onChange={(e) => setRegSponsorId(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setRegSponsorId(1)}
                    className="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-xs cursor-pointer"
                  >
                    #1 (Root)
                  </button>
                </div>
              </div>

              {/* Number of Nodes */}
              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">
                  {language === 'th' ? 'จำนวนรหัสที่ต้องการสมัคร:' : 'Number of Registration Nodes:'}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setRegNodeCount(cnt)}
                      className={`flex-1 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer border ${
                        regNodeCount === cnt
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {cnt} รหัส ({cnt * (RANK_PRICES_USDT[0] || 5)} U)
                    </button>
                  ))}
                </div>
              </div>

              {/* USDT Balance & Allowance Box */}
              <div className="rounded-xl bg-[#0d1222] border border-slate-800 p-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">ยอดคงเหลือ USDT:</span>
                  <span className="font-mono font-bold text-white">{usdtBalance || '0.00'} USDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">สิทธิ์การใช้งาน (Allowance):</span>
                  <span className="font-mono font-bold text-emerald-400">{allowance || '0.00'} USDT</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-300 font-bold">รวมค่าสมัครทั้งหมด:</span>
                  <span className="font-mono font-extrabold text-amber-400 text-sm">
                    {regNodeCount * (RANK_PRICES_USDT[0] || 5)} USDT
                  </span>
                </div>
              </div>

              {/* Messages / Alerts */}
              {regTxError && (
                <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="break-words">{regTxError}</span>
                </div>
              )}
              {regTxMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{regTxMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {parseFloat(allowance || '0') < regNodeCount * (RANK_PRICES_USDT[0] || 5) && (
                  <button
                    type="button"
                    onClick={handleModalApproveUsdt}
                    disabled={regIsApproving || regIsSubmitting}
                    className="w-full py-2.5 px-3 rounded-xl font-extrabold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {regIsApproving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>
                      {regIsApproving
                        ? 'กำลังอนุมัติ USDT...'
                        : `อนุมัติ USDT (${regNodeCount * (RANK_PRICES_USDT[0] || 5)} USDT)`}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleModalSubmitRegister}
                  disabled={regIsSubmitting || regIsApproving}
                  className="w-full py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-950/60 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {regIsSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {regIsSubmitting
                      ? 'กำลังสมัครสมาชิก...'
                      : `🚀 ยืนยันสมัครสมาชิก (${regNodeCount * (RANK_PRICES_USDT[0] || 5)} USDT)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP MODAL: รายละเอียดผลประโยชน์ & ประวัติของไอดี (เมื่อกดปุ่ม ดูผลประโยชน์ / ดูข้อมูล) */}
      {/* ===================================================================== */}
      {expandedBenefitNodeId !== null &&
        (activeNodesMap.has(expandedBenefitNodeId) ||
          compactSimNodes.some((n) => n.id === expandedBenefitNodeId)) &&
        (() => {
        const simFallback = compactSimNodes.find((n) => n.id === expandedBenefitNodeId);
        const modalNode: NonNullable<ReturnType<typeof activeNodesMap.get>> =
          activeNodesMap.get(expandedBenefitNodeId) ||
          ({
            id: simFallback?.id || expandedBenefitNodeId,
            owner: simFallback?.owner || '0x7B900000000000000000000000000000000042A1',
            parentId: simFallback?.parentId || 0,
            leftChild: simFallback?.leftChild || 0,
            rightChild: simFallback?.rightChild || 0,
            isClone: Boolean(simFallback?.isClone),
            rank: selectedRank,
            level: 1,
            isLeft: Boolean(simFallback?.isLeft),
            originMainId: simFallback?.originMainId || simFallback?.id || expandedBenefitNodeId,
            r1MainId: simFallback?.r1MainId || simFallback?.originMainId || simFallback?.id || expandedBenefitNodeId,
            directUplineNodeId:
              simFallback?.id === 1
                ? 0
                : simFallback?.isClone
                ? simFallback?.originMainId || simFallback?.parentId || 1
                : simFallback?.parentId || 1,
            cloneRound: simFallback?.cloneRound || (simFallback?.isClone ? 1 : 0),
            vaultBalance: 0,
            upgradeRankPool: 0,
            autoIdPool: 0,
            extraIdPool: 0,
            autoIdCount: 0,
            extraIdCount: 0,
            targetMainIdCurrentRank: selectedRank,
            directCommissionEarned: 0,
            levelCommissionEarned: 0,
            cloneLevelCommissionEarned: 0,
            levelBreakdown: Array(15).fill(0),
            cloneLevelBreakdown: Array(15).fill(0),
            levelOrderCounts: Array(15).fill(0),
            cloneLevelOrderCounts: Array(15).fill(0),
            spawnedCloneIds: [],
            spawnedCloneDetails: [],
            spawnedAutoIds: [],
          } as unknown as NonNullable<ReturnType<typeof activeNodesMap.get>>);
        const targetMainId = modalNode.isExtraLineage
          ? modalNode.directUplineNodeId || 1
          : modalNode.r1MainId || modalNode.originMainId || modalNode.id;
        const idReport =
          (modalNode.rank === 1 && perIdReportsMap.get(modalNode.id)) ||
          perIdReportsMap.get(targetMainId) ||
          null;
        const mainReport = perIdReportsMap.get(targetMainId) || idReport;

        // Sort all history & ID lists by LATEST reference time descending (อ้างอิงเวลาล่าสุด: ใหม่สุด -> เก่าสุด)
        const sortByLatestRefDesc = (arr: any[]) =>
          [...arr].sort((a, b) => {
            const tA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
            if (tB !== tA) return tB - tA;
            const rDiff = Number(b?.rank || 1) - Number(a?.rank || 1);
            if (rDiff !== 0) return rDiff;
            return Number(b?.fromNodeId ?? b?.id ?? 0) - Number(a?.fromNodeId ?? a?.id ?? 0);
          });

        const directHistory: any[] = sortByLatestRefDesc(mainReport?.direct30History || []);
        const levelHistory: any[] = sortByLatestRefDesc(mainReport?.level30History || []);
        const vaultHistory: any[] = sortByLatestRefDesc(mainReport?.vault35History || []);
        const rawVaultLedger: any[] = mainReport?.vault35Ledger || [];
        const vaultInflowCount = rawVaultLedger.filter((item: any) => item.direction === 'IN').length;
        const vaultOutflowCount = rawVaultLedger.filter((item: any) => item.direction === 'OUT').length;
        const filteredVaultLedger: any[] = rawVaultLedger.filter((item: any) => {
          if (vaultLedgerFilter === 'in') return item.direction === 'IN';
          if (vaultLedgerFilter === 'out') return item.direction === 'OUT';
          return true;
        });
        const fallbackAutoIds = (modalNode.spawnedAutoIds || []).map((aid) => {
          const an = activeNodesMap.get(aid);
          return {
            id: aid,
            rank: 1,
            parentId: an?.parentId || 0,
            side: an ? (an.isLeft ? 'ซ้าย' : 'ขวา') : 'ขวา',
            label: `Auto ID #${aid} (R1-#${aid})`,
          };
        });
        const rawAutoIdsList: any[] =
          mainReport?.autoIdsSpawned && mainReport.autoIdsSpawned.length > 0
            ? mainReport.autoIdsSpawned
            : fallbackAutoIds;
        const autoIdsList: any[] = sortByLatestRefDesc(rawAutoIdsList);
        const extraIdsList: any[] = sortByLatestRefDesc(mainReport?.autoExtraIdsSpawned || []);
        const rawClonesList: any[] = (mainReport?.clonesSpawned || []).map((cl: any, idx: number) => ({
          ...cl,
          _displaySeq: cl.cloneSequence || idx + 1,
        }));
        const clonesList: any[] = sortByLatestRefDesc(rawClonesList);
        const rankNodesList: any[] = [...(mainReport?.rankNodesList || [])].sort(
          (a: any, b: any) => Number(b.rank || 0) - Number(a.rank || 0)
        );

        const ITEMS_PER_PAGE = 10;
        const getSectionPage = (key: string, totalItems: number) => {
          const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
          const current = modalSectionPages[`${expandedBenefitNodeId}_${key}`] || 1;
          return Math.min(Math.max(1, current), totalPages);
        };
        const setSectionPage = (key: string, page: number) => {
          setModalSectionPages((prev) => ({
            ...prev,
            [`${expandedBenefitNodeId}_${key}`]: page,
          }));
        };
        const renderPaginationBar = (key: string, totalItems: number) => {
          if (totalItems <= ITEMS_PER_PAGE) return null;
          const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
          const currentPage = getSectionPage(key, totalItems);
          return (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setSectionPage(key, currentPage - 1)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
              >
                ◀ ก่อนหน้า
              </button>
              <span className="text-slate-400">
                หน้า <strong className="text-amber-300">{currentPage}</strong> / {totalPages} (10 รายการ/หน้า)
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setSectionPage(key, currentPage + 1)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
              >
                ถัดไป ▶
              </button>
            </div>
          );
        };

        const currentMaxR = Math.max(
          modalNode.targetMainIdCurrentRank || 1,
          mainReport?.currentMaxRank || 1,
          modalNode.rank || 1
        );
        const effectiveTargetRank =
          modalUpgradeTargetRank > currentMaxR
            ? Math.min(18, modalUpgradeTargetRank)
            : Math.min(18, currentMaxR + 1);
        const targetRankPrice = RANK_PRICES_USDT[effectiveTargetRank - 1] || 10;
        const curUpgradePoolVal = Number(
          modalNode.isExtraLineage
            ? 0
            : mainReport?.upgradeRankPool ?? modalNode.upgradeRankPool ?? 0
        );
        const poolDeduct = Math.min(curUpgradePoolVal, targetRankPrice);
        const netDiffToPay = Math.max(0, Number((targetRankPrice - poolDeduct).toFixed(2)));

        const handleTriggerModalUpgrade = async (rankToUpgrade: number) => {
          if (isModalUpgrading || currentMaxR >= 18 || rankToUpgrade <= currentMaxR || rankToUpgrade > 18) return;
          setIsModalUpgrading(true);
          setModalUpgradeError(null);
          const pendingMsg = `กำลังอัปเกรด Main ID #${targetMainId} สู่ Rank ${rankToUpgrade} (${RANK_PRICES_USDT[rankToUpgrade - 1] || 10} USDT)...`;
          setModalUpgradeMessage(pendingMsg);
          const toastId = `modal-upgrade-${targetMainId}-${rankToUpgrade}-${Date.now()}`;
          emitTransactionToast({
            id: toastId,
            status: 'pending',
            step: `กำลังอัปเกรดสู่ Rank ${rankToUpgrade}...`,
            message: pendingMsg,
          });
          try {
            let confirmedTxHash: string | null = null;
            if (onUpgradeToRank) {
              await onUpgradeToRank(rankToUpgrade, targetMainId);
            } else {
              const res = await fetch('/api/matrix/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  targetRank: rankToUpgrade,
                  mainId: targetMainId,
                  owner: modalNode.owner,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'ไม่สามารถอัปเกรดแรงค์ได้');
              }
              confirmedTxHash = data?.txHash || null;
            }
            const okMsg = `🚀 อัปเกรด Main ID #${targetMainId} สู่ Rank ${rankToUpgrade} สำเร็จเรียบร้อยแล้ว!`;
            setModalUpgradeMessage(okMsg);
            emitTransactionToast({
              id: toastId,
              status: 'confirmed',
              step: `ยืนยันการอัปเกรด Rank ${rankToUpgrade} สำเร็จ!`,
              message: okMsg,
              txHash: confirmedTxHash,
            });
            setModalUpgradeTargetRank(Math.min(18, rankToUpgrade + 1));
            await fetchPerIdHistoryForModal();
            await loadOnChainTree(selectedRank, { silent: true, forceSync: true });
          } catch (err: any) {
            const errMsg = err?.message || 'การอัปเกรดแรงค์ล้มเหลว';
            setModalUpgradeMessage(null);
            setModalUpgradeError(errMsg);
            emitTransactionToast({
              id: toastId,
              status: 'error',
              step: `อัปเกรด Rank ${rankToUpgrade} ไม่สำเร็จ`,
              message: errMsg,
            });
          } finally {
            setIsModalUpgrading(false);
          }
        };

        const handleTriggerModalAdminFreeUpgrade = async (rankToUpgrade: number) => {
          if (isModalUpgrading || currentMaxR >= 18 || rankToUpgrade <= currentMaxR || rankToUpgrade > 18) return;
          setIsModalUpgrading(true);
          setModalUpgradeError(null);
          const pendingMsg = `กำลังดำเนินการ Admin อัพ Rank ฟรี ให้ Main ID #${targetMainId} สู่ Rank ${rankToUpgrade} (ไม่จ่ายค่าคอมเมื่อวางซ้าย • ระบบโคลนนิ่งทำงานปกติเมื่อวางขวา)...`;
          setModalUpgradeMessage(pendingMsg);
          const toastId = `modal-admin-free-upgrade-${targetMainId}-${rankToUpgrade}-${Date.now()}`;
          emitTransactionToast({
            id: toastId,
            status: 'pending',
            step: `Admin อัพ Rank ฟรี สู่ Rank ${rankToUpgrade}...`,
            message: pendingMsg,
          });
          try {
            let confirmedTxHash: string | null = null;
            let okMsg = `✅ Admin Upgrade สำเร็จ! อัพ Rank รหัส #${targetMainId} ให้ฟรีสู่ Rank ${rankToUpgrade} เรียบร้อยแล้ว (ไม่จ่ายค่าคอมเมื่อวางซ้าย และระบบโคลนนิ่งทำงานปกติเมื่อวางขวา)`;
            if (onAdminUpgrade) {
              const resObj = await onAdminUpgrade(String(targetMainId), rankToUpgrade);
              if (resObj && resObj.success === false) {
                throw new Error(resObj.error || 'Admin Upgrade ล้มเหลว');
              }
              if (resObj?.message) okMsg = resObj.message;
              confirmedTxHash = resObj?.txHash || null;
            } else {
              const res = await fetch('/api/admin/upgrade-rank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mainId: targetMainId,
                  targetUser: modalNode.owner,
                  targetRank: rankToUpgrade,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Admin Upgrade ล้มเหลว');
              }
              if (data?.message) okMsg = data.message;
              confirmedTxHash = data?.txHash || null;
            }
            setModalUpgradeMessage(okMsg);
            emitTransactionToast({
              id: toastId,
              status: 'confirmed',
              step: `Admin อัพ Rank ${rankToUpgrade} ฟรี สำเร็จ!`,
              message: okMsg,
              txHash: confirmedTxHash,
            });
            setModalUpgradeTargetRank(Math.min(18, rankToUpgrade + 1));
            await fetchPerIdHistoryForModal();
            await loadOnChainTree(selectedRank, { silent: true, forceSync: false });
          } catch (err: any) {
            const errMsg = err?.message || 'Admin อัพ Rank ฟรี ล้มเหลว';
            setModalUpgradeMessage(null);
            setModalUpgradeError(errMsg);
            emitTransactionToast({
              id: toastId,
              status: 'error',
              step: `Admin อัพ Rank ${rankToUpgrade} ฟรี ไม่สำเร็จ`,
              message: errMsg,
            });
          } finally {
            setIsModalUpgrading(false);
          }
        };

        const titleBadge = modalNode.isExtraLineage
          ? modalNode.extraMainLabel || `Extra R${modalNode.rank}-#${modalNode.originMainId}`
          : modalNode.isClone
          ? `Main #${targetMainId} (โคลน R${modalNode.rank}-#${modalNode.id})`
          : modalNode.isAutoMainId
          ? `Auto ID #${targetMainId} (R${modalNode.rank}-#${modalNode.id})`
          : `Main ID #${targetMainId} (R${modalNode.rank}-#${modalNode.id})`;

        const statusBadgeLabel = modalNode.isClone
          ? 'CLONE ID'
          : modalNode.isExtraId
          ? 'EXTRA ID'
          : modalNode.isAutoMainId
          ? 'AUTO ID'
          : 'MANUAL ID';

        const statusBadgeClass = modalNode.isClone
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          : modalNode.isExtraId
          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
          : modalNode.isAutoMainId
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';

        const autoPage = getSectionPage('auto', autoIdsList.length);
        const pagedAutoIds = autoIdsList.slice((autoPage - 1) * ITEMS_PER_PAGE, autoPage * ITEMS_PER_PAGE);

        const extraPage = getSectionPage('extra', extraIdsList.length);
        const pagedExtraIds = extraIdsList.slice((extraPage - 1) * ITEMS_PER_PAGE, extraPage * ITEMS_PER_PAGE);

        const clonePage = getSectionPage('clone', clonesList.length);
        const pagedClones = clonesList.slice((clonePage - 1) * ITEMS_PER_PAGE, clonePage * ITEMS_PER_PAGE);

        const directPage = getSectionPage('direct30', directHistory.length);
        const pagedDirectHistory = directHistory.slice((directPage - 1) * ITEMS_PER_PAGE, directPage * ITEMS_PER_PAGE);

        const levelPage = getSectionPage('level30', levelHistory.length);
        const pagedLevelHistory = levelHistory.slice((levelPage - 1) * ITEMS_PER_PAGE, levelPage * ITEMS_PER_PAGE);

        const vaultPage = getSectionPage(
          'vault35',
          filteredVaultLedger.length > 0 ? filteredVaultLedger.length : vaultHistory.length
        );
        const pagedVaultLedger = filteredVaultLedger.slice(
          (vaultPage - 1) * ITEMS_PER_PAGE,
          vaultPage * ITEMS_PER_PAGE
        );
        const pagedVaultHistory = vaultHistory.slice(
          (vaultPage - 1) * ITEMS_PER_PAGE,
          vaultPage * ITEMS_PER_PAGE
        );

        const rankNodesPage = getSectionPage('rankNodes', rankNodesList.length);
        const pagedRankNodes = rankNodesList.slice((rankNodesPage - 1) * ITEMS_PER_PAGE, rankNodesPage * ITEMS_PER_PAGE);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
            onClick={() => setExpandedBenefitNodeId(null)}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0b1022] border-2 border-indigo-500/50 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-4 sm:p-6 space-y-4 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
                      <Coins className="w-5 h-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white font-mono">
                      {titleBadge}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full border font-mono font-bold text-[11px] ${statusBadgeClass}`}>
                      {statusBadgeLabel}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-[11px]">
                      Max Rank: R{currentMaxR}
                    </span>
                    {!modalNode.isExtraLineage && (
                      currentMaxR >= 18 ? (
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-400 font-extrabold text-[11px] flex items-center gap-1 opacity-60 cursor-not-allowed"
                          title="รหัสหลักนี้อยู่ใน Rank 18 (แรงค์สูงสุด) เรียบร้อยแล้ว"
                        >
                          <span>👑 อยู่ Rank 18 สูงสุดแล้ว (ปิดการอัพเดท)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isModalUpgrading}
                          onClick={() => handleTriggerModalUpgrade(effectiveTargetRank)}
                          className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-extrabold text-[11px] shadow-md transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {isModalUpgrading
                              ? 'กำลังอัพเกรด...'
                              : `🚀 อัพ Rank R${effectiveTargetRank}`}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2">
                    <span>
                      กระเป๋า:{' '}
                      <strong className="text-indigo-300">
                        {modalNode.owner.slice(0, 8)}...{modalNode.owner.slice(-6)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      อัพไลน์ใน R{modalNode.rank}:{' '}
                      <strong className="text-white">
                        {modalNode.parentId === 0 ? 'Root (#0)' : `#${modalNode.parentId}`}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      ผู้แนะนำตรง:{' '}
                      <strong className="text-amber-300">
                        #{modalNode.directUplineNodeId || mainReport?.directSponsorNodeId || 1}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 font-bold">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      อ้างอิงเวลาล่าสุด: {lastSyncTime} (ใหม่สุด → เก่าสุด)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedBenefitNodeId(null)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
                  title="ปิดหน้าต่างป๊อปอัพ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Direct Left (L) / Right (R) Downline Status & Placement Bar inside Modal */}
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <span>🌳 ตำแหน่งลูกทีมใต้โหนด #{modalNode.id}:</span>
                  <span className="font-mono text-amber-300">
                    ชั้น {Math.min(MAX_TREE_DEPTH, modalNode.level)}/{MAX_TREE_DEPTH}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {modalNode.leftChild === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBenefitNodeId(null);
                        openRegisterModal(modalNode.originMainId || modalNode.id, modalNode.id, true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>+ ต่อสายงานฝั่งซ้าย (L)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBenefitNodeId(null);
                        navigateToNode(modalNode.leftChild);
                        setSelectedTreeNodeId(modalNode.leftChild);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>ฝั่งซ้าย (L): #{modalNode.leftChild}</span>
                    </button>
                  )}

                  {modalNode.rightChild === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBenefitNodeId(null);
                        openRegisterModal(modalNode.originMainId || modalNode.id, modalNode.id, false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>+ ต่อสายงานฝั่งขวา (R)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBenefitNodeId(null);
                        navigateToNode(modalNode.rightChild);
                        setSelectedTreeNodeId(modalNode.rightChild);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 font-mono font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>ฝั่งขวา (R): #{modalNode.rightChild}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Banner when upgrading inside Modal */}
              {(modalUpgradeMessage || modalUpgradeError) && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                    modalUpgradeError
                      ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                      : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  }`}
                >
                  <span>{modalUpgradeError || modalUpgradeMessage}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setModalUpgradeMessage(null);
                      setModalUpgradeError(null);
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Section 1: Summary Cards (Node Earnings + Main ID Cumulative & 3 Pools) */}
              {modalNode.isExtraLineage ? (
                <div className="rounded-xl bg-[#0d1829] border border-cyan-500/45 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                    <span className="font-bold text-cyan-300 text-sm">
                      ✨ รายได้ที่เกิดจากเม็ดซ้ายของ EXTRA ID ({titleBadge})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-mono font-bold">
                      ส่งผลประโยชน์กลับให้ผู้แนะนำตรง #{modalNode.directUplineNodeId || 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono">
                    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2.5">
                      <span className="text-slate-400 block text-[10px]">
                        30% ค่าแนะนำ → ส่งให้ #{modalNode.directUplineNodeId || 1}
                      </span>
                      <span className="text-emerald-400 font-extrabold text-sm">
                        {modalNode.leftChild > 0
                          ? `+${((RANK_PRICES_USDT[modalNode.rank - 1] || 10) * 0.3).toFixed(2)} USDT`
                          : '0.00 USDT'}
                      </span>
                    </div>
                    <div className="bg-slate-950/80 border border-cyan-500/30 rounded-lg p-2.5">
                      <span className="text-slate-400 block text-[10px]">
                        30% ค่าชั้น → ส่งให้ #{modalNode.directUplineNodeId || 1}
                      </span>
                      <span className="text-cyan-300 font-extrabold text-sm">
                        {modalNode.leftChild > 0
                          ? `+${((RANK_PRICES_USDT[modalNode.rank - 1] || 10) * 0.3).toFixed(2)} USDT`
                          : '0.00 USDT'}
                      </span>
                    </div>
                    <div className="bg-slate-950/80 border border-rose-500/30 rounded-lg p-2.5">
                      <span className="text-slate-400 block text-[10px]">
                        35% Vault → เข้า Extra Pool ของ #{modalNode.directUplineNodeId || 1}
                      </span>
                      <span className="text-rose-400 font-extrabold text-sm">
                        {modalNode.leftChild > 0
                          ? `+${((RANK_PRICES_USDT[modalNode.rank - 1] || 10) * 0.35).toFixed(2)} USDT`
                          : '0.00 USDT'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Box 1 (Moved to Top): ผลประโยชน์สะสมของรหัสหลัก & 3 Pools + ปุ่มอัพ Rank */}
                  <div className="rounded-xl bg-[#10162f] border border-indigo-500/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1.5">
                      <span className="font-bold text-indigo-300 text-xs sm:text-sm">
                        💎 สะสมรวมของรหัสหลัก (Main ID #{targetMainId} ทุกแรงค์)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                        แยกกระปุกอิสระ
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">รวม 30% ค่าแนะนำ (ทุกแรงค์):</span>
                        <span className="font-extrabold text-emerald-400">
                          +{(mainReport?.direct30TotalUsdt ?? modalNode.directRewardAllNodes).toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">รวม 30% ค่าชั้น 15 ชั้น (ทุกแรงค์):</span>
                        <span className="font-extrabold text-cyan-300">
                          +{(mainReport?.level30TotalUsdt ?? modalNode.unilevelRewardAllNodes).toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">รวม 35% อัพเกรดสะสมทั้งหมด (Gross Vault):</span>
                        <span className="font-extrabold text-indigo-300">
                          +{(mainReport?.vault35GrossTotalUsdt ?? 0).toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-indigo-500/20 text-[10px]">
                        <div className="bg-slate-950/90 border border-amber-500/30 rounded p-1.5 text-center space-y-0.5">
                          <span className="text-slate-400 block">Upgrade Pool</span>
                          <span className="text-amber-400 font-extrabold text-xs block">
                            {Number(
                              modalNode.isExtraLineage
                                ? 0
                                : mainReport?.upgradeRankPool ?? modalNode.upgradeRankPool ?? 0
                            ).toFixed(2)}{' '}
                            U
                          </span>
                        </div>
                        <div className="bg-slate-950/90 border border-yellow-500/30 rounded p-1.5 text-center space-y-0.5">
                          <span className="text-slate-400 block">Auto ID Pool</span>
                          <span className="text-yellow-400 font-extrabold text-xs block">
                            {Number(
                              modalNode.isExtraLineage
                                ? 0
                                : mainReport?.newAutoIdPool ?? modalNode.newAutoIdPool ?? 0
                            ).toFixed(2)}{' '}
                            U
                          </span>
                          <span className="text-amber-300 font-bold text-[9.5px] block">
                            ออกแล้ว: {Math.max(modalNode.totalAutoIdCount, autoIdsList.length)} รหัส
                          </span>
                        </div>
                        <div className="bg-slate-950/90 border border-rose-500/30 rounded p-1.5 text-center space-y-0.5">
                          <span className="text-slate-400 block">Extra ID Pool (รวมยอดเก่า)</span>
                          <span className="text-rose-400 font-extrabold text-xs block">
                            {Number(
                              modalNode.isExtraLineage
                                ? 0
                                : mainReport?.newExtraIdPool ?? modalNode.newExtraIdPool ?? 0
                            ).toFixed(2)}{' '}
                            U
                          </span>
                          {!modalNode.isExtraLineage && (
                            <span className="text-amber-200 font-semibold text-[9px] block">
                              รวมยอดเก่าก่อนหัก:{' '}
                              {Number(
                                mainReport?.newExtraIdPoolGross ??
                                  mainReport?.newExtraIdPool ??
                                  modalNode.newExtraIdPool ??
                                  0
                              ).toFixed(2)}{' '}
                              U
                            </span>
                          )}
                          <span className="text-rose-300 font-bold text-[9.5px] block">
                            ออกแล้ว: {Math.max(modalNode.totalExtraIdCount, extraIdsList.length)} รหัส
                          </span>
                        </div>
                      </div>

                      {/* ปุ่มอัพเกรด Rank ของไอดีนี้โดยตรงในหน้าต่างป๊อปอัพ */}
                      {currentMaxR >= 18 ? (
                        <div className="mt-2 pt-2 border-t border-indigo-500/30 space-y-2">
                          <div className="text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                              👑 รหัสหลัก #{targetMainId} อยู่ใน Rank สูงสุด (R18) เรียบร้อยแล้ว
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-500 font-extrabold text-xs flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
                          >
                            <span>🔒 ปิดสถานะปุ่มอัพเดท (อยู่ Rank 18 สูงสุดแล้ว)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-indigo-500/30 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-300 font-bold">เลือก Rank ที่จะอัพ:</span>
                              <select
                                value={effectiveTargetRank}
                                onChange={(e) => setModalUpgradeTargetRank(Number(e.target.value))}
                                className="bg-slate-950 border border-amber-500/50 rounded-lg px-2 py-1 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                              >
                                {Array.from({ length: Math.max(0, 18 - currentMaxR) }, (_, idx) => {
                                  const r = currentMaxR + 1 + idx;
                                  const p = RANK_PRICES_USDT[r - 1] || 10;
                                  return (
                                    <option key={r} value={r}>
                                      Rank {r} ({p.toLocaleString()} USDT)
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <span className="text-[10px] text-slate-300 font-mono">
                              หัก Pool:{' '}
                              <strong className="text-amber-400">-{poolDeduct.toFixed(2)} U</strong> • จ่ายส่วนต่าง:{' '}
                              <strong className="text-emerald-400">{netDiffToPay.toFixed(2)} U</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isModalUpgrading}
                            onClick={() => handleTriggerModalUpgrade(effectiveTargetRank)}
                            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-400 hover:via-orange-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-950/60 border border-amber-300/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
                            <span>
                              {isModalUpgrading
                                ? `กำลังอัพเกรด Main ID #${targetMainId} สู่ Rank ${effectiveTargetRank}...`
                                : `🚀 อัพเกรด Main ID #${targetMainId} สู่ Rank ${effectiveTargetRank} (${targetRankPrice.toLocaleString()} USDT)`}
                            </span>
                          </button>
                          {(isAuthorizedAdminWallet(userAddress) || Boolean(onAdminUpgrade)) && (
                            <button
                              type="button"
                              disabled={isModalUpgrading}
                              onClick={() => handleTriggerModalAdminFreeUpgrade(effectiveTargetRank)}
                              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:via-pink-500 hover:to-amber-400 text-white font-extrabold text-xs shadow-lg shadow-rose-950/60 border border-rose-300/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <Shield className="w-4 h-4 text-amber-200 shrink-0" />
                              <span>
                                {isModalUpgrading
                                  ? `กำลังอัพ Rank ฟรีให้ #${targetMainId}...`
                                  : `👑 Admin อัพ Rank ฟรี #${targetMainId} สู่ Rank ${effectiveTargetRank} (ไม่จ่ายค่าคอม • โคลนนิ่งปกติ)`}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* เงื่อนไขการรับ AllSell 4 กอง ของ Main ID นี้ */}
                      {!modalNode.isExtraLineage && (() => {
                        const defaultPools = [
                          {
                            poolNumber: 1,
                            titleTh: `กองที่ 1 : r-11 (${(RANK_PRICES_USDT[10] || 300).toLocaleString()} USDT)`,
                            requiredSelfRank: 11,
                            hasSelfRank: currentMaxR >= 11,
                            requiredDirectCount: 5,
                            allowedDirectRanksLabel: 'r-8 หรือ r-9 หรือ r-10 หรือ r-11',
                            qualifiedDirectCount: 0,
                            qualifiedDirectIds: [] as Array<{ id: number; currentMaxRank: number }>,
                            isQualified: false,
                            poolTotalUsdt: Number(((systemPoolsData?.allSellTotalUsdt || 0) * 0.25).toFixed(2)),
                            estimatedShareUsdt: 0,
                          },
                          {
                            poolNumber: 2,
                            titleTh: `กองที่ 2 : r-14 (${(RANK_PRICES_USDT[13] || 800).toLocaleString()} USDT)`,
                            requiredSelfRank: 14,
                            hasSelfRank: currentMaxR >= 14,
                            requiredDirectCount: 2,
                            allowedDirectRanksLabel: 'r-12 หรือ r-13 หรือ r-14',
                            qualifiedDirectCount: 0,
                            qualifiedDirectIds: [] as Array<{ id: number; currentMaxRank: number }>,
                            isQualified: false,
                            poolTotalUsdt: Number(((systemPoolsData?.allSellTotalUsdt || 0) * 0.25).toFixed(2)),
                            estimatedShareUsdt: 0,
                          },
                          {
                            poolNumber: 3,
                            titleTh: `กองที่ 3 : r-16 (${(RANK_PRICES_USDT[15] || 2000).toLocaleString()} USDT)`,
                            requiredSelfRank: 16,
                            hasSelfRank: currentMaxR >= 16,
                            requiredDirectCount: 2,
                            allowedDirectRanksLabel: 'r-14 หรือ r-15 หรือ r-16',
                            qualifiedDirectCount: 0,
                            qualifiedDirectIds: [] as Array<{ id: number; currentMaxRank: number }>,
                            isQualified: false,
                            poolTotalUsdt: Number(((systemPoolsData?.allSellTotalUsdt || 0) * 0.25).toFixed(2)),
                            estimatedShareUsdt: 0,
                          },
                          {
                            poolNumber: 4,
                            titleTh: `กองที่ 4 : r-18 (${(RANK_PRICES_USDT[17] || 5000).toLocaleString()} USDT)`,
                            requiredSelfRank: 18,
                            hasSelfRank: currentMaxR >= 18,
                            requiredDirectCount: 5,
                            allowedDirectRanksLabel: 'r-16 หรือ r-17 หรือ r-18',
                            qualifiedDirectCount: 0,
                            qualifiedDirectIds: [] as Array<{ id: number; currentMaxRank: number }>,
                            isQualified: false,
                            poolTotalUsdt: Number(((systemPoolsData?.allSellTotalUsdt || 0) * 0.25).toFixed(2)),
                            estimatedShareUsdt: 0,
                          },
                        ];
                        const qual = mainReport?.allSellQualification || idReport?.allSellQualification;
                        const poolsList = Array.isArray(qual?.pools) && qual.pools.length === 4 ? qual.pools : defaultPools;
                        const totalDirectMainIds = Number(qual?.totalDirectMainIds || 0);
                        const qualifiedPoolsCount = Number(qual?.totalQualifiedPoolsCount || 0);

                        return (
                          <div className="mt-2.5 pt-2.5 border-t border-cyan-500/30 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-cyan-300 font-bold text-[11px]">
                                🌐 คุณสมบัติรับ AllSell 4 กอง (Main ID #{targetMainId})
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-bold">
                                แนะนำตรงทั้งหมด: {totalDirectMainIds} ID • ผ่านแล้ว {qualifiedPoolsCount}/4 กอง
                              </span>
                            </div>
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 flex items-center justify-between flex-wrap gap-1 text-[10px]">
                              <span className="text-amber-200 font-bold">
                                🗓️ เงื่อนไขการจ่ายเงิน AllSell: จ่ายให้รหัสที่ผ่านเกณฑ์ <strong className="text-amber-300 underline">ทุกกลางเดือน และ ต้นเดือน</strong>
                              </span>
                              <span className="text-emerald-300 font-bold text-[9.5px]">
                                2 รอบ/เดือน (วันที่ 1 & 15)
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                              {poolsList.map((p: any) => (
                                <div
                                  key={`id-allsell-pool-${p.poolNumber}`}
                                  className={`rounded-lg p-2 border ${
                                    p.isQualified
                                      ? 'bg-emerald-950/40 border-emerald-500/50'
                                      : 'bg-slate-950/90 border-slate-800'
                                  } space-y-1`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-extrabold text-amber-300 text-[10.5px]">{p.titleTh}</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        p.isQualified
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}
                                    >
                                      {p.isQualified ? '✅ ได้รับสิทธิ์' : '⏳ รอคุณสมบัติ'}
                                    </span>
                                  </div>
                                  <div className="text-slate-300 flex items-center justify-between">
                                    <span>1. ID หลักดำรงอยู่ใน r-{p.requiredSelfRank}:</span>
                                    <span className={p.hasSelfRank ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                      {p.hasSelfRank ? `✅ มี (r-${currentMaxR})` : `❌ อยู่ r-${currentMaxR}`}
                                    </span>
                                  </div>
                                  <div className="text-slate-300">
                                    <div className="flex items-center justify-between">
                                      <span>2. แนะนำตรง {p.requiredDirectCount} ID:</span>
                                      <span
                                        className={
                                          p.qualifiedDirectCount >= p.requiredDirectCount
                                            ? 'text-emerald-400 font-bold'
                                            : 'text-amber-300 font-bold'
                                        }
                                      >
                                        {p.qualifiedDirectCount} / {p.requiredDirectCount} ID
                                      </span>
                                    </div>
                                    <div className="text-[9.5px] text-slate-400">
                                      (ต้องดำรงอยู่ใน {p.allowedDirectRanksLabel})
                                    </div>
                                  </div>
                                  <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9.5px]">
                                    <span className="text-slate-400">กองละ 25% ({Number(p.poolTotalUsdt || 0).toFixed(2)} U):</span>
                                    <span className="text-cyan-300 font-extrabold">
                                      {p.isQualified ? `รับ +${Number(p.estimatedShareUsdt || 0).toFixed(2)} U` : '0.00 U'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Box 2: ผลประโยชน์เฉพาะโหนดที่กด */}
                  <div className="rounded-xl bg-[#09191f] border border-emerald-500/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                      <span className="font-bold text-emerald-400 text-xs sm:text-sm">
                        📍 ผลประโยชน์เฉพาะโหนดนี้ (R{modalNode.rank}-#{modalNode.id})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                        {modalNode.isClone
                          ? `Clone Node • รอบที่ ${modalNode.cloneRound || 1}${
                              modalNode.cloneSequence ? ` (ใบที่ #${modalNode.cloneSequence})` : ''
                            }`
                          : 'Main Node'}
                      </span>
                    </div>
                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">30% ค่าแนะนำตรง (เฉพาะโหนดนี้):</span>
                        <span className="font-extrabold text-emerald-400">
                          +{modalNode.directRewardThisNode.toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">30% ค่าชั้น ยูนิเลเวล 15 ชั้น (เฉพาะโหนดนี้):</span>
                        <span className="font-extrabold text-cyan-300">
                          +{(modalNode.isAdminFreeUpgrade ? 0 : modalNode.unilevelRewardThisNode).toFixed(2)} USDT
                          {modalNode.isAdminFreeUpgrade ? ' (Admin อัพฟรี)' : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-emerald-500/20">
                        <span className="text-slate-300">35% Vault โหนดนี้ (คงเหลือใน R{modalNode.rank}):</span>
                        <span className="font-extrabold text-amber-300">
                          +{modalNode.vaultBalance.toFixed(2)} USDT
                        </span>
                      </div>

                      {/* 15-Level Breakdown inside Box 2 */}
                      {(() => {
                        const ls = modalNode.levelSummary || idReport?.levelSummary;
                        const tiers = modalNode.isAdminFreeUpgrade ? [] : (ls?.tiersBreakdown || []);
                        const ratePerNode =
                          ls?.ratePerNodeUsdt ??
                          Number(((RANK_PRICES_USDT[modalNode.rank - 1] || 5) * 0.02).toFixed(2));
                        const receivedPayingNodes = modalNode.isAdminFreeUpgrade
                          ? 0
                          : tiers.reduce(
                              (acc: number, t: any) => acc + Number(t.leftPayingNodesCount || 0),
                              0
                            );
                        const remainingPayingNodes = Math.max(0, 32767 - receivedPayingNodes);
                        const remainingUsdt = Number((remainingPayingNodes * ratePerNode).toFixed(2));
                        return (
                          <div className="mt-2 pt-2 border-t border-cyan-500/30 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-cyan-300 font-extrabold">
                                🪜 ค่าชั้นโหนดนี้: รับแล้ว {receivedPayingNodes.toLocaleString()} / 32,767 รหัส
                                {modalNode.isAdminFreeUpgrade ? ' (Admin อัพฟรี = 0)' : ''}
                              </span>
                              <span className="text-amber-300 font-bold">
                                คงเหลืออีก {remainingPayingNodes.toLocaleString()} รหัส (
                                {remainingUsdt.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                U)
                              </span>
                            </div>
                            {tiers.length > 0 ? (
                              <div className="space-y-1 bg-slate-950/80 p-2 rounded-lg border border-cyan-500/25">
                                {tiers.map((t: any) => (
                                  <div
                                    key={`modal-box1-tier-${t.tier}`}
                                    className="flex items-center justify-between gap-2 text-[10.5px]"
                                  >
                                    <span className="text-slate-300">
                                      • <strong className="text-cyan-300">ชั้นที่ {t.tier}</strong>: ซ้าย{' '}
                                      <strong className="text-white">{t.leftPayingNodesCount}</strong> รหัส
                                      {t.leftNodeIds && t.leftNodeIds.length > 0
                                        ? ` (#${t.leftNodeIds.join(', #')})`
                                        : ''}
                                    </span>
                                    <span className="text-emerald-400 font-extrabold">
                                      +{Number(t.amountUsdt || 0).toFixed(2)} USDT
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-slate-500 text-[10.5px]">
                                {modalNode.isAdminFreeUpgrade
                                  ? 'เงื่อนไข Admin อัพ Rank ฟรี: ค่าชั้นที่แสดงเป็น 0'
                                  : 'ยังไม่มีชั้นที่รับค่าชั้นใต้โหนดนี้ (เหลืออีก 15 ชั้น)'}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2: History Filter Tabs inside Popup */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                {[
                  { key: 'all', label: '📋 ดูทั้งหมดครบทุกหมวด (ล่าสุดขึ้นก่อน • แถวละ 10 รายการ)' },
                  { key: 'direct30', label: `💵 30% ค่าแนะนำ (${directHistory.length})` },
                  { key: 'level30', label: `🪜 30% ค่าชั้น (${levelHistory.length})` },
                  {
                    key: 'vault35',
                    label: `🏦 บัญชีกระปุก 35% Vault (${rawVaultLedger.length > 0 ? rawVaultLedger.length : vaultHistory.length})`,
                  },
                  {
                    key: 'auto_extra',
                    label: `🤖 Auto ID (${autoIdsList.length}) • Extra ID (${extraIdsList.length}) • โคลน (${clonesList.length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBenefitModalTab(tab.key as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      benefitModalTab === tab.key
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white bg-slate-900/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Section 3: Auto ID, Auto Extra ID & Clone IDs of this ID (10 items per page, latest first) */}
              {(benefitModalTab === 'all' || benefitModalTab === 'auto_extra') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Auto IDs in R1 */}
                  <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3 space-y-2">
                    <div className="font-bold text-amber-300 flex items-center justify-between">
                      <span>🤖 รหัส Auto ID (R1)</span>
                      <span className="font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {autoIdsList.length} รหัส
                      </span>
                    </div>
                    {autoIdsList.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">
                        {modalNode.isAutoMainId
                          ? `รหัสนี้คือ Auto ID #${targetMainId} (เกิดจาก Main #${mainReport?.spawnedByMainId || 1})`
                          : 'ยังไม่มี Auto ID ที่เกิดจากรหัสนี้'}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 font-mono text-[11px]">
                          {pagedAutoIds.map((a: any) => (
                            <div
                              key={`modal-auto-${a.id}`}
                              className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-amber-300 font-bold">{a.label}</span>
                                <span className="text-slate-400">
                                  ใต้ #{a.parentId} ({a.side})
                                </span>
                              </div>
                              <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>อ้างอิงเวลาล่าสุด: {formatModalRowTime(a.timestamp)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {renderPaginationBar('auto', autoIdsList.length)}
                      </>
                    )}
                  </div>

                  {/* Auto Extra IDs in R2-R27 */}
                  <div className="bg-slate-950/90 border border-fuchsia-500/30 rounded-xl p-3 space-y-2">
                    <div className="font-bold text-fuchsia-300 flex items-center justify-between">
                      <span>✨ รหัส Auto Extra ID (R2-27)</span>
                      <span className="font-mono px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">
                        {extraIdsList.length} รหัส
                      </span>
                    </div>
                    {extraIdsList.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">ยังไม่มี Auto Extra ID ที่เกิดจากรหัสนี้</div>
                    ) : (
                      <>
                        <div className="space-y-1 font-mono text-[11px]">
                          {pagedExtraIds.map((ex: any) => (
                            <div
                              key={`modal-extra-${ex.rank}-${ex.id}`}
                              className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-fuchsia-300 font-bold">{ex.label}</span>
                                <span className="text-slate-400">
                                  ใต้ R{ex.rank}-#{ex.parentId} ({ex.side})
                                </span>
                              </div>
                              <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>อ้างอิงเวลาล่าสุด: {formatModalRowTime(ex.timestamp)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {renderPaginationBar('extra', extraIdsList.length)}
                      </>
                    )}
                  </div>

                  {/* Clones 100% Rebirth */}
                  <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3 space-y-2">
                    <div className="font-bold text-cyan-300 flex items-center justify-between">
                      <span>♻️ รหัสโคลน 100% Rebirth</span>
                      <span className="font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        {clonesList.length} รหัส
                      </span>
                    </div>
                    {clonesList.length === 0 ? (
                      <div className="text-slate-500 text-[11px]">ยังไม่มีโคลนที่แตกตัวจากรหัสนี้</div>
                    ) : (
                      <>
                        <div className="space-y-1 font-mono text-[11px]">
                          {pagedClones.map((cl: any) => (
                            <div
                              key={`modal-clone-${cl.rank}-${cl.id}`}
                              className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 space-y-0.5"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-cyan-300 font-bold">
                                  โคลน R{cl.rank}-#{cl.id} (รอบที่ {cl.cloneRound || 1} • ใบที่ #{cl._displaySeq})
                                </span>
                                <span className="text-slate-400 shrink-0">
                                  ใต้ R{cl.rank}-#{cl.parentId} ({cl.side})
                                </span>
                              </div>
                              <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>อ้างอิงเวลาล่าสุด: {formatModalRowTime(cl.timestamp)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {renderPaginationBar('clone', clonesList.length)}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Section 4: Commission History Lists (30% Direct / 30% Level / 35% Upgrade Vault) - 10 items per page, latest first */}
              {benefitModalTab !== 'auto_extra' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                  {/* 30% Direct Referral History */}
                  {(benefitModalTab === 'all' || benefitModalTab === 'direct30') && (
                    <div
                      className={`bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3 space-y-2 ${
                        benefitModalTab === 'direct30' ? 'lg:col-span-3' : ''
                      }`}
                    >
                      <div className="font-bold text-emerald-400 flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span>💵 ประวัติ 30% ค่าแนะนำ ({directHistory.length} รายการ)</span>
                        <span className="font-mono text-sm">
                          +{(mainReport?.direct30TotalUsdt ?? modalNode.directRewardAllNodes).toFixed(2)} U
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-cyan-300/90 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>การแสดงข้อมูลในตาราง: อ้างอิงเวลาล่าสุด (ใหม่สุด → เก่าสุด)</span>
                      </div>
                      {directHistory.length === 0 ? (
                        <div className="text-slate-500 py-3 text-center">ยังไม่มีประวัติค่าแนะนำ 30%</div>
                      ) : (
                        <>
                          <div className="space-y-1.5 font-mono text-[11px]">
                            {pagedDirectHistory.map((item: any, idx: number) => (
                              <div
                                key={`md-${directPage}-${idx}`}
                                className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-start justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-amber-300 font-bold">[Rank {item.rank}]</span>{' '}
                                    <span className="text-slate-200">{item.note}</span>
                                  </div>
                                  <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>เวลาอ้างอิงล่าสุด: {formatModalRowTime(item.timestamp)}</span>
                                  </div>
                                </div>
                                <span className="text-emerald-400 font-extrabold shrink-0">
                                  +{Number(item.amountUsdt).toFixed(2)} U
                                </span>
                              </div>
                            ))}
                          </div>
                          {renderPaginationBar('direct30', directHistory.length)}
                        </>
                      )}
                    </div>
                  )}

                  {/* 30% Level Bonus History */}
                  {(benefitModalTab === 'all' || benefitModalTab === 'level30') && (
                    <div
                      className={`bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3 space-y-2 ${
                        benefitModalTab === 'level30' ? 'lg:col-span-3' : ''
                      }`}
                    >
                      <div className="font-bold text-cyan-300 flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span>🪜 ประวัติ 30% ค่าชั้น ({levelHistory.length} รายการ)</span>
                        <span className="font-mono text-sm">
                          +{(mainReport?.level30TotalUsdt ?? modalNode.unilevelRewardAllNodes).toFixed(2)} U
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-cyan-300/90 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>การแสดงข้อมูลในตาราง: อ้างอิงเวลาล่าสุด (ใหม่สุด → เก่าสุด)</span>
                      </div>
                      {levelHistory.length === 0 ? (
                        <div className="text-slate-500 py-3 text-center">ยังไม่มีประวัติค่าชั้น 2% (15 ชั้น)</div>
                      ) : (
                        <>
                          <div className="space-y-1.5 font-mono text-[11px]">
                            {pagedLevelHistory.map((item: any, idx: number) => (
                              <div
                                key={`ml-${levelPage}-${idx}`}
                                className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-start justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-amber-300 font-bold">[Rank {item.rank}]</span>{' '}
                                    <span className="text-slate-200">{item.note}</span>
                                  </div>
                                  <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>เวลาอ้างอิงล่าสุด: {formatModalRowTime(item.timestamp)}</span>
                                  </div>
                                </div>
                                <span className="text-cyan-300 font-extrabold shrink-0">
                                  +{Number(item.amountUsdt).toFixed(2)} U
                                </span>
                              </div>
                            ))}
                          </div>
                          {renderPaginationBar('level30', levelHistory.length)}
                        </>
                      )}
                    </div>
                  )}

                  {/* 35% Upgrade Vault History & Audit Ledger */}
                  {(benefitModalTab === 'all' || benefitModalTab === 'vault35') && (
                    <div
                      className={`bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3 space-y-2.5 ${
                        benefitModalTab === 'vault35' ? 'lg:col-span-3' : ''
                      }`}
                    >
                      <div className="font-bold text-indigo-300 flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🏦 บัญชีกระปุก 35% Vault & ประวัติการใช้งาน</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                            {filteredVaultLedger.length > 0 ? filteredVaultLedger.length : vaultHistory.length} รายการ
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-emerald-400 font-bold">
                            รับสะสม +{(mainReport?.vault35GrossTotalUsdt ?? 0).toFixed(2)} U
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-rose-400 font-bold">
                            ใช้ไป -{(mainReport?.vault35DeductedTotalUsdt ?? 0).toFixed(2)} U
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-amber-300 font-extrabold bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 rounded">
                            คงเหลือ {(mainReport?.vault35RemainingTotalUsdt ?? 0).toFixed(2)} U
                          </span>
                        </div>
                      </div>

                      {/* รายละเอียดสรุปยอดการใช้จ่ายและการกระจายกระปุก (Deduction & Pool Balance Summary) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono">
                        <div className="space-y-1">
                          <span className="text-slate-400 block text-[10px]">🟢 รับเข้าสะสมทั้งหมด (Gross Vault):</span>
                          <span className="text-emerald-400 font-extrabold text-sm block">
                            +{(mainReport?.vault35GrossTotalUsdt ?? 0).toFixed(2)} USDT
                          </span>
                          <span className="text-slate-400 text-[10px] block">
                            จากเม็ดซ้าย {vaultHistory.length} ครั้ง
                          </span>
                        </div>
                        <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-800 md:pl-2.5">
                          <span className="text-slate-400 block text-[10px]">🔴 นำไปใช้ทำอะไรบ้าง (รวมหัก):</span>
                          <span className="text-rose-400 font-extrabold text-sm block">
                            -{(mainReport?.vault35DeductedTotalUsdt ?? 0).toFixed(2)} USDT
                          </span>
                          <div className="space-y-0.5 text-[10px] text-slate-300">
                            {(mainReport?.vault35DeductedTotalUsdt ?? 0) === 0 ? (
                              <div className="text-slate-500 italic">ยังไม่มีการหักใช้งานใดๆ</div>
                            ) : (
                              <>
                                <div>• สร้าง Extra ID: <strong className="text-rose-300">-{Number(mainReport?.vaultDeductedBreakdown?.extraIdsTotalUsdt ?? 0).toFixed(2)} U</strong> ({extraIdsList.length} รหัส)</div>
                                <div>• สร้าง Auto ID: <strong className="text-amber-300">-{Number(mainReport?.vaultDeductedBreakdown?.autoIdsTotalUsdt ?? 0).toFixed(2)} U</strong> ({autoIdsList.length} รหัส)</div>
                                {(mainReport?.vaultDeductedBreakdown?.upgradesTotalUsdt ?? 0) > 0 && (
                                  <div>• หักอัปเกรดแรงค์: <strong className="text-cyan-300">-{Number(mainReport?.vaultDeductedBreakdown?.upgradesTotalUsdt).toFixed(2)} U</strong></div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-800 md:pl-2.5">
                          <span className="text-slate-400 block text-[10px]">💰 ยอดคงเหลือสุทธิปัจจุบัน:</span>
                          <span className="text-amber-400 font-extrabold text-sm block">
                            {(mainReport?.vault35RemainingTotalUsdt ?? 0).toFixed(2)} USDT
                          </span>
                          <div className="space-y-0.5 text-[10px] text-slate-300">
                            <div>• Extra Pool: <strong className="text-rose-300">{Number(mainReport?.newExtraIdPool ?? 0).toFixed(2)} U</strong></div>
                            <div>• Auto ID Pool: <strong className="text-amber-300">{Number(mainReport?.newAutoIdPool ?? 0).toFixed(2)} U</strong></div>
                            <div>• Upgrade Pool: <strong className="text-indigo-300">{Number(mainReport?.upgradeRankPool ?? 0).toFixed(2)} U</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* ตัวกรอง รับเข้า vs นำไปใช้ (Inflow vs Outflow Filter Tabs) */}
                      {rawVaultLedger.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setVaultLedgerFilter('all');
                              setSectionPage('vault35', 1);
                            }}
                            className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition cursor-pointer ${
                              vaultLedgerFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            ทั้งหมด ({rawVaultLedger.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVaultLedgerFilter('in');
                              setSectionPage('vault35', 1);
                            }}
                            className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              vaultLedgerFilter === 'in'
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-slate-900 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
                            }`}
                          >
                            <span>🟢 รับเข้า 35% ({vaultInflowCount})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVaultLedgerFilter('out');
                              setSectionPage('vault35', 1);
                            }}
                            className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              vaultLedgerFilter === 'out'
                                ? 'bg-rose-600 text-white shadow'
                                : 'bg-slate-900 text-rose-400/80 hover:text-rose-300 border border-slate-800'
                            }`}
                          >
                            <span>🔴 นำไปใช้/หักออก ({vaultOutflowCount})</span>
                          </button>
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-cyan-300/90 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>การแสดงข้อมูลในตาราง: อ้างอิงเวลาล่าสุด (ใหม่สุด → เก่าสุด)</span>
                      </div>

                      {/* ตารางรายการ Ledger */}
                      {filteredVaultLedger.length === 0 && vaultHistory.length === 0 ? (
                        <div className="text-slate-500 py-3 text-center">ยังไม่มีประวัติในกระปุก 35% Vault</div>
                      ) : filteredVaultLedger.length > 0 ? (
                        <>
                          <div className="space-y-1.5 font-mono text-[11px]">
                            {pagedVaultLedger.map((item: any, idx: number) => {
                              const isIn = item.direction === 'IN';
                              return (
                                <div
                                  key={`vl-${vaultPage}-${item.id || idx}`}
                                  className={`p-2 rounded-lg border flex items-start justify-between gap-2 transition ${
                                    isIn
                                      ? 'bg-emerald-950/20 border-emerald-500/30'
                                      : 'bg-rose-950/20 border-rose-500/30'
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                                          isIn
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        }`}
                                      >
                                        {isIn ? '🟢 + รับเข้า' : '🔴 - นำไปใช้'}
                                      </span>
                                      <span className="text-amber-300 font-bold">[Rank {item.rank}]</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                          item.poolType === 'AUTO_ID_POOL'
                                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                            : item.poolType === 'EXTRA_ID_POOL'
                                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        }`}
                                      >
                                        {item.poolLabelTh || item.poolType}
                                      </span>
                                      <span className="text-slate-200 font-semibold">{item.actionLabelTh}</span>
                                    </div>
                                    <div className="text-slate-300 text-[10.5px]">
                                      {item.descriptionTh || item.note}
                                    </div>
                                    <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>เวลาทำรายการ: {formatModalRowTime(item.timestamp)}</span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 space-y-0.5">
                                    <div
                                      className={`font-black text-xs ${
                                        isIn ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {isIn ? '+' : '-'}{Number(item.amountUsdt).toFixed(2)} USDT
                                    </div>
                                    <div className="text-[9.5px] text-amber-300 font-extrabold bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700/80">
                                      คงเหลือ: {Number(item.balanceAfterUsdt ?? 0).toFixed(2)} U
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {renderPaginationBar('vault35', filteredVaultLedger.length)}
                        </>
                      ) : (
                        <>
                          <div className="space-y-1.5 font-mono text-[11px]">
                            {pagedVaultHistory.map((item: any, idx: number) => (
                              <div
                                key={`mv-${vaultPage}-${idx}`}
                                className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-start justify-between gap-2"
                              >
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-amber-300 font-bold">[Rank {item.rank}]</span>{' '}
                                    <span className="text-slate-200">{item.note}</span>
                                  </div>
                                  <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>เวลาอ้างอิงล่าสุด: {formatModalRowTime(item.timestamp)}</span>
                                  </div>
                                </div>
                                <span className="text-indigo-300 font-extrabold shrink-0">
                                  +{Number(item.amountUsdt).toFixed(2)} U
                                </span>
                              </div>
                            ))}
                          </div>
                          {renderPaginationBar('vault35', vaultHistory.length)}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rank Nodes Summary Footer inside Modal (10 items per page, latest rank first) */}
              {rankNodesList.length > 0 && (
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between flex-wrap gap-1">
                    <span>
                      📌 ตำแหน่งโหนดของ Main ID #{targetMainId} ในแต่ละแรงค์ (คลิกเพื่อสลับไปดูแรงค์นั้น):
                    </span>
                    <span className="text-amber-300 font-mono text-[10.5px]">
                      ทั้งหมด {rankNodesList.length} แรงค์ (แสดงล่าสุดขึ้นก่อน • 10 แรงค์/หน้า)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                    {pagedRankNodes.map((rn: any) => (
                      <button
                        key={`modal-rn-${rn.rank}-${rn.nodeId}`}
                        type="button"
                        onClick={() => {
                          setSelectedRank(rn.rank);
                          setFocusRootId(rn.nodeId);
                          setExpandedBenefitNodeId(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-indigo-950 border border-slate-700 hover:border-indigo-500/50 text-slate-200 transition cursor-pointer flex items-center justify-between"
                      >
                        <span>
                          <strong className="text-amber-300">R{rn.rank}-#{rn.nodeId}</strong> (ใต้ #{rn.parentId}{' '}
                          {rn.side})
                        </span>
                        <span>
                          Vault: <strong className="text-emerald-400">{rn.nodeVault.toFixed(2)}U</strong>
                        </span>
                      </button>
                    ))}
                  </div>
                  {renderPaginationBar('rankNodes', rankNodesList.length)}
                </div>
              )}

              {/* Close Button Footer */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setExpandedBenefitNodeId(null)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs shadow-lg cursor-pointer transition"
                >
                  ปิดหน้าต่างป๊อปอัพ
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* POPUP MODAL: ดูข้อมูล ID ของกระเป๋านี้ (แสดงเฉพาะข้อมูล ID ของกระเป๋าที่ Login) */}
      {/* ===================================================================== */}
      {isWalletIdsModalOpen && (() => {
        const allReports = Array.from(perIdReportsMap.values()).sort(
          (a: any, b: any) => Number(a.id) - Number(b.id)
        );

        // แสดงเฉพาะข้อมูล ID ของกระเป๋าที่ Login (userAddress) เท่านั้น
        const activeWallet =
          userAddress ||
          selectedInspectWallet ||
          activeNodesMap.get(focusRootId)?.owner ||
          activeNodesMap.get(1)?.owner ||
          '0x622E20082e63c7220c5AF0A77Cbc437a98505311';
        const activeWalletLower = activeWallet.toLowerCase();

        const walletReportsMap = new Map<number, any>();
        for (const rep of allReports) {
          if (String(rep.owner || '').toLowerCase() === activeWalletLower) {
            walletReportsMap.set(Number(rep.id), rep);
          }
        }

        // Fallback: หากมีโหนดในผัง Rank 1 ที่เป็นของกระเป๋าที่ Login แต่ยังไม่อยู่ใน perIdReportsMap ให้แสดงทันที
        if (selectedRank === 1) {
          for (const n of activeNodesMap.values()) {
            if (
              String(n.owner || '').toLowerCase() === activeWalletLower &&
              !walletReportsMap.has(Number(n.id))
            ) {
              walletReportsMap.set(Number(n.id), {
                id: n.id,
                label: n.isClone
                  ? `Clone #${n.id} (ของ Main #${n.originMainId || n.id})`
                  : n.isExtraId
                  ? `Extra ID #${n.id}`
                  : n.isAutoMainId
                  ? `Auto ID #${n.id}`
                  : `Main ID #${n.id}`,
                typeBadge: n.isClone
                  ? 'CLONE ID'
                  : n.isExtraId
                  ? 'EXTRA ID'
                  : n.isAutoMainId
                  ? 'AUTO ID'
                  : 'MAIN ID',
                isClone: Boolean(n.isClone),
                isAutoId: Boolean(n.isAutoMainId),
                isExtraId: Boolean(n.isExtraId),
                originMainId: n.originMainId || n.id,
                cloneRound: n.cloneRound || 0,
                owner: n.owner,
                directSponsorNodeId: n.directUplineNodeId || 1,
                parentId: n.parentId || 0,
                side: n.parentId === 0 ? 'ROOT' : n.isLeft ? 'LEFT' : 'RIGHT',
                currentMaxRank: n.targetMainIdCurrentRank || 1,
                direct30TotalUsdt: n.directRewardAllNodes || n.directRewardThisNode || 0,
                level30TotalUsdt: n.unilevelRewardAllNodes || n.unilevelRewardThisNode || 0,
                vault35GrossTotalUsdt: n.grossVaultFromLineage || n.vaultBalance || 0,
                upgradeRankPool: n.upgradeRankPool || 0,
                newAutoIdPool: n.newAutoIdPool || 0,
                newExtraIdPool: n.newExtraIdPool || 0,
                totalAutoIdCount: n.totalAutoIdCount || 0,
                totalExtraIdCount: n.totalExtraIdCount || 0,
                levelSummary: n.levelSummary,
              });
            }
          }
        }

        const walletReports = Array.from(walletReportsMap.values()).sort(
          (a: any, b: any) => Number(b.id) - Number(a.id)
        );

        const WALLET_PAGE_SIZE = 10;

        const mainAndAutoReports = walletReports.filter((rep: any) => !rep.isClone);
        const manualMainReports = walletReports.filter(
          (rep: any) => !rep.isClone && !rep.isAutoId && !rep.isExtraId
        );
        const autoIdReports = walletReports.filter(
          (rep: any) => !rep.isClone && Boolean(rep.isAutoId) && !rep.isExtraId
        );
        const extraIdReports = walletReports.filter(
          (rep: any) => !rep.isClone && Boolean(rep.isExtraId)
        );
        const cloneReports = walletReports.filter((rep: any) => Boolean(rep.isClone));

        const walletStatusGroups = [
          {
            key: 'main' as const,
            tabLabel: '🔵 Main ID',
            title: '🔵 ชุด Main ID (รหัสหลัก)',
            subtitle: 'รหัสสมาชิกหลักที่สมัครและถือครองสิทธิ์ในผัง',
            items: manualMainReports,
            tabActiveClass:
              'bg-[#2563EB] text-white border-[#2563EB] dark:bg-indigo-600 dark:text-white dark:border-indigo-400 shadow-sm',
            headerClass:
              'bg-[#EFF6FF] dark:bg-indigo-950/50 border-blue-200 dark:border-indigo-500/40 text-[#1D4ED8] dark:text-indigo-200',
            countBadgeClass:
              'bg-white dark:bg-indigo-500/30 text-[#1D4ED8] dark:text-indigo-100 border-blue-200 dark:border-indigo-400/40',
          },
          {
            key: 'auto' as const,
            tabLabel: '🟡 Auto ID',
            title: '🟡 ชุด Auto ID (รหัสอัตโนมัติ)',
            subtitle: 'รหัสหลักใหม่ที่ระบบสร้างให้อัตโนมัติจาก Auto ID Pool',
            items: autoIdReports,
            tabActiveClass:
              'bg-amber-600 text-white border-amber-600 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-300 shadow-sm',
            headerClass:
              'bg-[#FEF3C7] dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40 text-[#B45309] dark:text-amber-200',
            countBadgeClass:
              'bg-white dark:bg-amber-500/30 text-[#B45309] dark:text-amber-100 border-amber-200 dark:border-amber-400/40',
          },
          {
            key: 'extra' as const,
            tabLabel: '🔴 Extra ID',
            title: '🔴 ชุด Extra ID (รหัสเสริม)',
            subtitle: 'รหัสเสริมที่เกิดจาก Extra ID Pool เพื่อช่วยขยายและดันสายงาน',
            items: extraIdReports,
            tabActiveClass:
              'bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:text-white dark:border-rose-300 shadow-sm',
            headerClass:
              'bg-[#FFE4E6] dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/40 text-[#BE123C] dark:text-rose-200',
            countBadgeClass:
              'bg-white dark:bg-rose-500/30 text-[#BE123C] dark:text-rose-100 border-rose-200 dark:border-rose-400/40',
          },
          {
            key: 'clone' as const,
            tabLabel: '🟢 โคลนนิ่ง',
            title: '🟢 ชุด โคลนนิ่ง (Clone ID)',
            subtitle: 'รหัสโคลนนิ่ง 100% Rebirth ที่แตกตัวลงช่วยลูกทีมและรับรายได้ซ้ำ',
            items: cloneReports,
            tabActiveClass:
              'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-300 shadow-sm',
            headerClass:
              'bg-[#DCFCE7] dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-[#15803D] dark:text-emerald-200',
            countBadgeClass:
              'bg-white dark:bg-emerald-500/30 text-[#15803D] dark:text-emerald-100 border-emerald-200 dark:border-emerald-400/40',
          },
        ];

        const visibleStatusGroups =
          walletIdsStatusFilter === 'all'
            ? walletStatusGroups.filter((g) => g.items.length > 0)
            : walletStatusGroups.filter((g) => g.key === walletIdsStatusFilter);

        const totalDirect30 = mainAndAutoReports.reduce(
          (sum: number, r: any) => sum + Number(r.direct30TotalUsdt || 0),
          0
        );
        const totalLevel30 = mainAndAutoReports.reduce(
          (sum: number, r: any) => sum + Number(r.level30TotalUsdt || 0),
          0
        );
        const totalGrossVault35 = mainAndAutoReports.reduce(
          (sum: number, r: any) => sum + Number(r.vault35GrossTotalUsdt || 0),
          0
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
            onClick={() => setIsWalletIdsModalOpen(false)}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0b1022] border border-slate-200/80 dark:border-2 dark:border-indigo-500/60 rounded-2xl shadow-[0_20px_60px_-10px_rgba(15,23,42,0.18)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-4 sm:p-6 space-y-4 text-xs transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-2 rounded-xl bg-[#EFF6FF] dark:bg-indigo-500/20 border border-blue-200 dark:border-indigo-500/40 text-[#2563EB] dark:text-indigo-300">
                      <User className="w-5 h-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white">
                      👛 ข้อมูล ID ทั้งหมดของกระเป๋านี้
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-mono font-bold text-[11px]">
                      ถือครอง {walletReports.length} ID ({manualMainReports.length} Main ID • {autoIdReports.length} Auto ID • {extraIdReports.length} Extra ID • {cloneReports.length} โคลนนิ่ง)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/35 font-mono font-bold text-[11px]">
                      <Clock className="w-3 h-3 text-[#2563EB] dark:text-cyan-400" />
                      อ้างอิงเวลาล่าสุด: {lastSyncTime} (ใหม่สุด → เก่าสุด)
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>กระเป๋าที่ Login ปัจจุบัน:</span>
                    <strong className="text-[#0F172A] dark:text-amber-300 break-all">{activeWallet}</strong>
                    <span className="px-2 py-0.5 rounded-md bg-[#DCFCE7] border border-emerald-200 text-[#15803D] dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300 text-[10px] font-bold">
                      คุณ (Logged In)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyAddress(activeWallet)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#334155] border border-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 cursor-pointer inline-flex items-center gap-1"
                    >
                      {copiedText === activeWallet ? (
                        <>
                          <Check className="w-3 h-3 text-[#15803D] dark:text-emerald-400" />
                          <span className="text-[#15803D] dark:text-emerald-400">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>คัดลอก</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWalletIdsModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] hover:text-[#0F172A] border border-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-slate-700 transition cursor-pointer shrink-0"
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wallet Total Earnings Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                <div className="bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/80 dark:border-emerald-500/35 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-[#64748B] dark:text-slate-400 block">รวม 30% ค่าแนะนำ (ทั้งกระเป๋า)</span>
                  <span className="text-sm sm:text-base font-extrabold text-[#15803D] dark:text-emerald-400">
                    +{totalDirect30.toFixed(2)} USDT
                  </span>
                </div>
                <div className="bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/80 dark:border-cyan-500/35 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-[#64748B] dark:text-slate-400 block">รวม 30% ค่าชั้น (ทั้งกระเป๋า)</span>
                  <span className="text-sm sm:text-base font-extrabold text-[#1D4ED8] dark:text-cyan-300">
                    +{totalLevel30.toFixed(2)} USDT
                  </span>
                </div>
                <div className="bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/80 dark:border-amber-500/35 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-[#64748B] dark:text-slate-400 block">รวมรับเข้ากระเป๋าทั้งหมด</span>
                  <span className="text-sm sm:text-base font-extrabold text-[#B45309] dark:text-amber-300">
                    +{(totalDirect30 + totalLevel30).toFixed(2)} USDT
                  </span>
                </div>
                <div className="bg-[#F8FAFC] dark:bg-slate-950/90 border border-slate-200/80 dark:border-indigo-500/35 rounded-xl p-3 shadow-xs">
                  <span className="text-[10px] text-[#64748B] dark:text-slate-400 block">รวม 35% อัพเกรดสะสม</span>
                  <span className="text-sm sm:text-base font-extrabold text-[#2563EB] dark:text-indigo-300">
                    +{totalGrossVault35.toFixed(2)} USDT
                  </span>
                </div>
              </div>

              {/* List of IDs Owned by This Wallet (Separated by Status Group) */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#0F172A] dark:text-indigo-300 flex items-center justify-between flex-wrap gap-2">
                  <span>📋 รายการ ID แยกตามชุดสถานะ ({walletReports.length} ID):</span>
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400 font-normal">
                    เลือกดูเฉพาะชุดสถานะ หรือดูแยกเป็นหมวดหมู่ได้ทันที
                  </span>
                </div>

                {/* Status Group Filter Bar */}
                {walletReports.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pb-1">
                    <button
                      type="button"
                      onClick={() => setWalletIdsStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1.5 ${
                        walletIdsStatusFilter === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span>ทั้งหมด</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-black/15 dark:bg-black/25 font-mono text-[10px]">
                        {walletReports.length}
                      </span>
                    </button>

                    {walletStatusGroups.map((group) => {
                      const isActive = walletIdsStatusFilter === group.key;
                      return (
                        <button
                          key={`wallet-status-tab-${group.key}`}
                          type="button"
                          onClick={() => setWalletIdsStatusFilter(group.key)}
                          className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] transition cursor-pointer inline-flex items-center gap-1.5 ${
                            isActive
                              ? group.tabActiveClass
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <span>{group.tabLabel}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                              isActive
                                ? 'bg-black/20 text-inherit'
                                : 'bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {group.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {walletReports.length === 0 ? (
                  <div className="bg-[#F8FAFC] dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 text-center space-y-3">
                    <div className="text-[#0F172A] dark:text-slate-300 font-bold text-sm">
                      กระเป๋าที่ Login นี้ ({activeWallet.slice(0, 6)}...{activeWallet.slice(-4)}) ยังไม่มีรหัสสมาชิกในระบบ
                    </div>
                    <div className="text-[#64748B] dark:text-slate-400 text-xs max-w-lg mx-auto">
                      หากคุณเพิ่งเข้าสู่ระบบด้วยกระเป๋าใหม่ สามารถกดปุ่มด้านล่างเพื่อสมัครรหัสสมาชิก (Main ID) ให้กระเป๋านี้ได้ทันที
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsWalletIdsModalOpen(false);
                          openRegisterModal(focusRootId || 1);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white dark:bg-gradient-to-r dark:from-emerald-500 dark:to-teal-500 dark:hover:from-emerald-400 dark:hover:to-teal-400 dark:text-slate-950 font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>+ สมัครสมาชิก / ลงรหัสให้กระเป๋านี้</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleStatusGroups.map((group) => {
                      const pageKey = `wallet_${activeWalletLower}_${group.key}`;
                      const groupTotalPages = Math.max(1, Math.ceil(group.items.length / WALLET_PAGE_SIZE));
                      const groupCurrentPage = Math.min(
                        Math.max(1, modalSectionPages[pageKey] || 1),
                        groupTotalPages
                      );
                      const pagedGroupItems = group.items.slice(
                        (groupCurrentPage - 1) * WALLET_PAGE_SIZE,
                        groupCurrentPage * WALLET_PAGE_SIZE
                      );

                      return (
                        <div
                          key={`wallet-status-section-${group.key}`}
                          className="rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-3"
                        >
                          {/* Status Group Header */}
                          <div
                            className={`flex items-center justify-between gap-2 flex-wrap px-3 py-2 rounded-xl border ${group.headerClass}`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2">
                                <span>{group.title}</span>
                              </div>
                              <div className="text-[10.5px] opacity-85">{group.subtitle}</div>
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full border font-mono font-extrabold text-[11px] ${group.countBadgeClass}`}
                            >
                              {group.items.length} รหัส
                            </span>
                          </div>

                          {group.items.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-5 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                              ยังไม่มีรหัสในสถานะ {group.tabLabel} สำหรับกระเป๋านี้
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {pagedGroupItems.map((rep: any) => {
                                  const nodeInActiveRank =
                                    activeNodesMap.get(Number(rep.id)) ||
                                    Array.from(activeNodesMap.values()).find(
                                      (n) =>
                                        !n.isClone &&
                                        (n.r1MainId === Number(rep.id) || n.originMainId === Number(rep.id))
                                    );

                                  const badgeClass = rep.isClone
                                    ? 'bg-[#DCFCE7] text-[#15803D] border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                                    : rep.isExtraId
                                    ? 'bg-[#FFE4E6] text-[#BE123C] border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                                    : rep.isAutoId
                                    ? 'bg-[#FEF3C7] text-[#B45309] border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                                    : 'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40';

                                  const displayTitle =
                                    rep.isExtraId && !rep.isClone
                                      ? `Extra ID #${rep.id}`
                                      : rep.label || `ID #${rep.id}`;

                                  return (
                                    <div
                                      key={`wallet-id-card-${rep.id}`}
                                      className="bg-white dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-indigo-500/50 rounded-xl p-3.5 space-y-2.5 transition shadow-xs"
                                    >
                                      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200/80 dark:border-slate-800/90 pb-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono font-extrabold text-sm text-[#0F172A] dark:text-amber-400">
                                            {displayTitle}
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 rounded-full border font-mono font-bold text-[10px] ${badgeClass}`}
                                          >
                                            {rep.isClone
                                              ? `${rep.typeBadge || 'CLONE ID'} • รอบที่ ${rep.cloneRound || 1}${
                                                  rep.cloneSequence ? ` (ใบที่ #${rep.cloneSequence})` : ''
                                                }`
                                              : rep.isExtraId
                                              ? 'EXTRA ID'
                                              : rep.isAutoId
                                              ? 'AUTO ID'
                                              : rep.typeBadge || 'MAIN ID'}
                                          </span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[#15803D] dark:text-emerald-300 font-mono font-bold text-[11px]">
                                          Max Rank: R{rep.currentMaxRank || 1}
                                        </span>
                                      </div>

                                      <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                                        <span>
                                          อัพไลน์ R1: <strong className="text-slate-900 dark:text-white">#{rep.parentId}</strong> ({rep.side})
                                        </span>
                                        <span>
                                          ผู้แนะนำตรง: <strong className="text-amber-600 dark:text-amber-300">#{rep.directSponsorNodeId}</strong>
                                        </span>
                                      </div>

                                      {/* Earnings & Pools of this ID */}
                                      {(() => {
                                        const isAdminFree = Boolean(
                                          rep.isAdminFreeUpgrade || nodeInActiveRank?.isAdminFreeUpgrade
                                        );
                                        const shownLevelUsdt = isAdminFree
                                          ? 0
                                          : Number(rep.level30TotalUsdt || 0);
                                        return (
                                          <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                                            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                                              <span className="text-slate-400 block">30% แนะนำ</span>
                                              <span className="text-emerald-400 font-extrabold text-xs">
                                                +{Number(rep.direct30TotalUsdt || 0).toFixed(2)} U
                                              </span>
                                            </div>
                                            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-lg p-1.5 text-center">
                                              <span className="text-slate-400 block">30% ค่าชั้น</span>
                                              <span className="text-cyan-300 font-extrabold text-xs">
                                                +{shownLevelUsdt.toFixed(2)} U
                                              </span>
                                            </div>
                                            <div className="bg-slate-900/90 border border-indigo-500/30 rounded-lg p-1.5 text-center">
                                              <span className="text-slate-400 block">35% อัพเกรด</span>
                                              <span className="text-indigo-300 font-extrabold text-xs">
                                                +{Number(rep.vault35GrossTotalUsdt || 0).toFixed(2)} U
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* 15-Level Breakdown per ID inside Wallet IDs Modal */}
                                      {(() => {
                                        const isAdminFree = Boolean(
                                          rep.isAdminFreeUpgrade || nodeInActiveRank?.isAdminFreeUpgrade
                                        );
                                        const ls = rep.levelSummary || nodeInActiveRank?.levelSummary;
                                        const tiers = isAdminFree ? [] : ls?.tiersBreakdown || [];
                                        const thisTotal = isAdminFree ? 0 : ls?.thisNodeLevelTotalUsdt ?? 0;
                                        const clonesTotal = isAdminFree ? 0 : ls?.clonesLevelTotalUsdt ?? 0;
                                        const ratePerNode = ls?.ratePerNodeUsdt ?? 0.1;
                                        const receivedPayingNodes = isAdminFree
                                          ? 0
                                          : tiers.reduce(
                                              (acc: number, t: any) => acc + Number(t.leftPayingNodesCount || 0),
                                              0
                                            );
                                        const remainingPayingNodes = Math.max(0, 32767 - receivedPayingNodes);
                                        const remainingUsdt = Number((remainingPayingNodes * ratePerNode).toFixed(2));

                                        return (
                                          <div className="bg-slate-900/80 border border-cyan-500/30 rounded-lg p-2 space-y-1 font-mono text-[10px]">
                                            <div className="flex items-center justify-between flex-wrap gap-1">
                                              <span className="text-cyan-300 font-bold">
                                                🪜 ค่าชั้น 15 ชั้น: รับแล้ว{' '}
                                                <strong className="text-emerald-300">
                                                  {receivedPayingNodes.toLocaleString()} / 32,767 รหัส
                                                </strong>
                                              </span>
                                              {isAdminFree ? (
                                                <span className="text-rose-300 font-bold">
                                                  Admin อัพฟรี (ค่าชั้น = 0)
                                                </span>
                                              ) : (
                                                <span className="text-amber-300 font-bold">
                                                  คงเหลืออีก {remainingPayingNodes.toLocaleString()} รหัส (
                                                  {remainingUsdt.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}{' '}
                                                  U)
                                                </span>
                                              )}
                                            </div>
                                            {isAdminFree ? (
                                              <div className="text-rose-300/90">
                                                เงื่อนไข Admin อัพ Rank ฟรี: ค่าชั้นที่แสดงเป็น 0
                                              </div>
                                            ) : tiers.length > 0 ? (
                                              <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-800">
                                                {tiers.map((t: any) => (
                                                  <span
                                                    key={`wallet-lvl-${rep.id}-${t.tier}`}
                                                    className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-500/30 text-slate-200"
                                                  >
                                                    ชั้น {t.tier}:{' '}
                                                    <strong className="text-emerald-400">
                                                      +{Number(t.amountUsdt || 0).toFixed(2)}U
                                                    </strong>{' '}
                                                    ({t.leftPayingNodesCount} รหัส
                                                    {t.leftNodeIds && t.leftNodeIds.length > 0
                                                      ? ` #${t.leftNodeIds.join(',#')}`
                                                      : ''}
                                                    )
                                                  </span>
                                                ))}
                                                <span className="ml-auto text-cyan-300 font-bold">
                                                  โหนดนี้ +{thisTotal.toFixed(2)}U
                                                  {clonesTotal > 0 ? ` (+โคลน ${clonesTotal.toFixed(2)}U)` : ''}
                                                </span>
                                              </div>
                                            ) : (
                                              <div className="text-slate-500">
                                                ยังไม่มีชั้นที่รับค่าชั้นใต้โหนดนี้ (เหลืออีก 15 ชั้น)
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {!rep.isClone && (
                                        <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                                          <div className="bg-slate-900/60 border border-amber-500/25 rounded-lg p-1 text-center">
                                            <span className="text-slate-400 block">Upgrade Pool</span>
                                            <span className="text-amber-300 font-bold">
                                              {Number(rep.upgradeRankPool ?? nodeInActiveRank?.upgradeRankPool ?? 0).toFixed(2)} U
                                            </span>
                                          </div>
                                          <div className="bg-slate-900/60 border border-yellow-500/25 rounded-lg p-1 text-center">
                                            <span className="text-slate-400 block">Auto ID Pool</span>
                                            <span className="text-yellow-300 font-bold">
                                              {Number(rep.newAutoIdPool ?? nodeInActiveRank?.newAutoIdPool ?? 0).toFixed(2)} U (
                                              {Math.max(
                                                (rep.autoIdsSpawned || []).length,
                                                Number(rep.totalAutoIdCount || 0),
                                                nodeInActiveRank?.totalAutoIdCount || 0
                                              )}{' '}
                                              รหัส)
                                            </span>
                                          </div>
                                          <div className="bg-slate-900/60 border border-rose-500/25 rounded-lg p-1 text-center">
                                            <span className="text-slate-400 block">Extra ID Pool</span>
                                            <span className="text-rose-300 font-bold">
                                              {Number(rep.newExtraIdPool ?? nodeInActiveRank?.newExtraIdPool ?? 0).toFixed(2)} U (
                                              {Math.max(
                                                (rep.autoExtraIdsSpawned || []).length,
                                                Number(rep.totalExtraIdCount || 0)
                                              )}{' '}
                                              รหัส)
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Referral Link Row for this ID */}
                                      <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/90 border border-blue-200/80 dark:border-indigo-500/35 rounded-lg px-2.5 py-1.5 font-mono text-[10.5px]">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <Link2 className="w-3.5 h-3.5 text-[#2563EB] dark:text-indigo-400 shrink-0" />
                                          <span className="text-[#334155] dark:text-slate-300 truncate">
                                            {buildReferralLink(rep.originMainId || rep.id)}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            copyReferralLink(
                                              rep.originMainId || rep.id,
                                              `wallet-modal-ref-${rep.id}`
                                            )
                                          }
                                          className="px-2 py-0.5 rounded bg-[#2563EB] hover:bg-blue-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-[10px] shrink-0 inline-flex items-center gap-1 cursor-pointer transition"
                                        >
                                          {copiedReferralKey === `wallet-modal-ref-${rep.id}` ? (
                                            <>
                                              <Check className="w-3 h-3" />
                                              <span>คัดลอกลิ้งแล้ว</span>
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="w-3 h-3" />
                                              <span>คัดลอกลิ้งแนะนำ #{rep.originMainId || rep.id}</span>
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      {/* Action Buttons for this ID */}
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const targetNodeId = nodeInActiveRank
                                              ? nodeInActiveRank.id
                                              : Number(rep.id);
                                            const curMaxR = Number(rep.currentMaxRank || 1);
                                            setModalUpgradeTargetRank(Math.min(18, curMaxR + 1));
                                            setModalUpgradeMessage(null);
                                            setModalUpgradeError(null);
                                            setBenefitModalTab('all');
                                            if (!activeNodesMap.has(targetNodeId)) {
                                              setSelectedRank(1);
                                              loadOnChainTree(1);
                                            }
                                            setIsWalletIdsModalOpen(false);
                                            setExpandedBenefitNodeId(targetNodeId);
                                          }}
                                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-600 dark:hover:from-indigo-500 dark:hover:to-violet-500 text-white font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                                        >
                                          <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                          <span>
                                            {Number(rep.currentMaxRank || 1) >= 18
                                              ? 'ดูผลประโยชน์ (Max R18)'
                                              : 'ดูผลประโยชน์ / อัพ Rank'}
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const targetNodeId = nodeInActiveRank
                                              ? nodeInActiveRank.id
                                              : Number(rep.id);
                                            if (!activeNodesMap.has(targetNodeId)) {
                                              setSelectedRank(1);
                                              loadOnChainTree(1);
                                            }
                                            navigateToNode(targetNodeId);
                                            setIsWalletIdsModalOpen(false);
                                          }}
                                          className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0F172A] border border-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-amber-300 dark:border-slate-700 font-bold text-[11px] transition cursor-pointer"
                                        >
                                          🎯 ไปที่โหนด
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {group.items.length > WALLET_PAGE_SIZE && (
                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-xs font-mono">
                                  <button
                                    type="button"
                                    disabled={groupCurrentPage <= 1}
                                    onClick={() =>
                                      setModalSectionPages((prev) => ({
                                        ...prev,
                                        [pageKey]: groupCurrentPage - 1,
                                      }))
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
                                  >
                                    ◀ ก่อนหน้า
                                  </button>
                                  <span className="text-slate-600 dark:text-slate-400">
                                    หน้า <strong className="text-amber-600 dark:text-amber-300">{groupCurrentPage}</strong> /{' '}
                                    {groupTotalPages} (แสดง 10 รายการ/หน้า)
                                  </span>
                                  <button
                                    type="button"
                                    disabled={groupCurrentPage >= groupTotalPages}
                                    onClick={() =>
                                      setModalSectionPages((prev) => ({
                                        ...prev,
                                        [pageKey]: groupCurrentPage + 1,
                                      }))
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition"
                                  >
                                    ถัดไป ▶
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWalletIdsModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* POPUP MODAL: รายได้ AllSell (4%) & Family Pool */}
      {/* ===================================================================== */}
      {isSystemPoolsModalOpen && (() => {
        const allSellWallet =
          systemPoolsData?.allSellWallet || '0xBeFEB9871a20656aeF7E8d218f751e9C23FAF710';
        const familyPoolWallet =
          systemPoolsData?.familyPoolWallet || '0x225DF4b5961f757f54728138F289Eaf49D4F275A';

        const isOnChainMode = viewMode === 'onchain';
        const totalAllSellUsdt = isOnChainMode
          ? Number(systemPoolsData?.allSellTotalUsdt ?? activeRankPoolsSummary.rankAllSellUsdt)
          : activeRankPoolsSummary.rankAllSellUsdt;
        const totalFamilyUsdt = isOnChainMode
          ? Number(systemPoolsData?.familyPoolTotalUsdt ?? activeRankPoolsSummary.rankFamilyTotalUsdt)
          : activeRankPoolsSummary.rankFamilyTotalUsdt;
        const familyUnpaidLevelUsdt = isOnChainMode
          ? Number(
              systemPoolsData?.familyPoolUnpaidLevelUsdt ??
                activeRankPoolsSummary.rankFamilyUnpaidLevelUsdt
            )
          : activeRankPoolsSummary.rankFamilyUnpaidLevelUsdt;
        const familyRootCloneDirectUsdt = isOnChainMode
          ? Number(
              systemPoolsData?.familyPoolRootCloneDirectUsdt ??
                activeRankPoolsSummary.rankFamilyRootCloneDirectUsdt
            )
          : activeRankPoolsSummary.rankFamilyRootCloneDirectUsdt;

        const sortPoolHistByLatest = (arr: any[]) =>
          [...arr].sort((a, b) => {
            const tA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
            if (tB !== tA) return tB - tA;
            const rDiff = Number(b?.rank || 1) - Number(a?.rank || 1);
            if (rDiff !== 0) return rDiff;
            return Number(b?.fromNodeId || 0) - Number(a?.fromNodeId || 0);
          });

        const rawAllSellHistoryList: any[] =
          isOnChainMode && Array.isArray(systemPoolsData?.allSellHistory) && systemPoolsData.allSellHistory.length > 0
            ? systemPoolsData.allSellHistory
            : activeRankPoolsSummary.rankAllSellHistory;
        const allSellHistoryList: any[] = sortPoolHistByLatest(rawAllSellHistoryList);

        const rawFamilyHistoryList: any[] =
          isOnChainMode && Array.isArray(systemPoolsData?.familyPoolHistory) && systemPoolsData.familyPoolHistory.length > 0
            ? systemPoolsData.familyPoolHistory
            : activeRankPoolsSummary.rankFamilyHistory;
        const familyHistoryList: any[] = sortPoolHistByLatest(rawFamilyHistoryList);

        const SYS_PAGE_SIZE = 10;
        const allSellTotalPages = Math.max(1, Math.ceil(allSellHistoryList.length / SYS_PAGE_SIZE));
        const allSellPage = Math.min(Math.max(1, modalSectionPages['sys_allsell'] || 1), allSellTotalPages);
        const pagedAllSellHistory = allSellHistoryList.slice(
          (allSellPage - 1) * SYS_PAGE_SIZE,
          allSellPage * SYS_PAGE_SIZE
        );

        const familyTotalPages = Math.max(1, Math.ceil(familyHistoryList.length / SYS_PAGE_SIZE));
        const familyPage = Math.min(Math.max(1, modalSectionPages['sys_family'] || 1), familyTotalPages);
        const pagedFamilyHistory = familyHistoryList.slice(
          (familyPage - 1) * SYS_PAGE_SIZE,
          familyPage * SYS_PAGE_SIZE
        );

        const onChainAllSellBal = Number(systemPoolsData?.onChainBalances?.allSellWalletUsdt || 0);
        const onChainFamilyBal = Number(systemPoolsData?.onChainBalances?.familyPoolWalletUsdt || 0);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
            onClick={() => setIsSystemPoolsModalOpen(false)}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0b1022] border-2 border-cyan-500/50 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-4 sm:p-6 space-y-4 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
                      <Coins className="w-5 h-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white">
                      📊 รายงานรายได้ AllSell (4%) และ Family Pool
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-[11px]">
                      {isOnChainMode ? 'ข้อมูลจริงบนบล็อกเชน (On-Chain)' : `โหมดดูตัวอย่างผัง Rank ${selectedRank}`}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 font-mono font-bold text-[11px]">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      อ้างอิงเวลาล่าสุด: {lastSyncTime} (ใหม่สุด → เก่าสุด)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    ดึงข้อมูลการจ่ายรายได้ AllSell 4% และ Family Pool (ค่าชั้นส่วนที่เหลือจาก 15 ชั้น + ค่าแนะนำ 30% จากโคลนรหัส #1) เรียงตามเวลาล่าสุด
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSystemPoolsModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2 Summary Cards: AllSell vs Family Pool */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
                {/* AllSell Box */}
                <div className="rounded-xl bg-[#0b1c2c] border border-cyan-500/45 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                    <span className="font-bold text-cyan-300 text-sm">🌐 รายได้ AllSell (4% ทุกเม็ดซ้าย)</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 text-[10px] font-bold">
                      4% / เม็ดซ้าย
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">ยอดสะสมในผัง Rank {selectedRank}:</span>
                      <span className="font-extrabold text-cyan-300">
                        +{activeRankPoolsSummary.rankAllSellUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">ยอดสะสมรวมทุกแรงค์ (สัญญาปัจจุบัน):</span>
                      <span className="font-extrabold text-emerald-400 text-sm">
                        +{totalAllSellUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-cyan-500/20">
                      <span className="text-slate-300">ยอดคงเหลือจริงในกระเป๋า AllSell บนเชน:</span>
                      <span className="font-extrabold text-amber-300 text-sm">
                        {onChainAllSellBal.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                      <span className="truncate">กระเป๋า: {allSellWallet}</span>
                      <button
                        type="button"
                        onClick={() => copyAddress(allSellWallet)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 cursor-pointer shrink-0"
                      >
                        {copiedText === allSellWallet ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Family Pool Box */}
                <div className="rounded-xl bg-[#1d1130] border border-fuchsia-500/45 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-fuchsia-500/20 pb-1.5">
                    <span className="font-bold text-fuchsia-300 text-sm">🏛️ รายได้ Family Pool</span>
                    <span className="px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 text-[10px] font-bold">
                      Unpaid 15 ชั้น + 30% โคลน #1
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">1) ค่าชั้นส่วนที่เหลือจาก 15 ชั้น (2%/ชั้น):</span>
                      <span className="font-extrabold text-fuchsia-300">
                        +{familyUnpaidLevelUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">2) 30% ค่าแนะนำจากโคลนรหัส #1:</span>
                      <span className="font-extrabold text-purple-300">
                        +{familyRootCloneDirectUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">รวมสะสมทุกแรงค์ (สัญญาปัจจุบัน):</span>
                      <span className="font-extrabold text-amber-300 text-sm">
                        +{totalFamilyUsdt.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-fuchsia-500/20">
                      <span className="text-slate-300">ยอดคงเหลือจริงในกระเป๋า FamilyPool บนเชน:</span>
                      <span className="font-extrabold text-emerald-400 text-sm">
                        {onChainFamilyBal.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                      <span className="truncate">กระเป๋า: {familyPoolWallet}</span>
                      <button
                        type="button"
                        onClick={() => copyAddress(familyPoolWallet)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-fuchsia-300 border border-slate-700 cursor-pointer shrink-0"
                      >
                        {copiedText === familyPoolWallet ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* เงื่อนไขและการแบ่งยอด AllSell (4%) ออกเป็น 4 กอง */}
              {(() => {
                const fallbackFourPools = [
                  {
                    poolNumber: 1,
                    titleTh: `กองที่ 1 : r-11 (${(RANK_PRICES_USDT[10] || 300).toLocaleString()} USDT)`,
                    targetRank: 11,
                    targetRankPriceUsdt: RANK_PRICES_USDT[10] || 300,
                    requiredSelfRank: 11,
                    requiredDirectCount: 5,
                    allowedDirectRanksLabel: 'r-8 หรือ r-9 หรือ r-10 หรือ r-11',
                    sharePercentOfAllSell: 25,
                    poolTotalUsdt: Number((totalAllSellUsdt * 0.25).toFixed(2)),
                    poolOnChainUsdt: Number((onChainAllSellBal * 0.25).toFixed(2)),
                    qualifiedMainIds: [] as number[],
                    qualifiedCount: 0,
                    sharePerQualifiedIdUsdt: 0,
                  },
                  {
                    poolNumber: 2,
                    titleTh: `กองที่ 2 : r-14 (${(RANK_PRICES_USDT[13] || 800).toLocaleString()} USDT)`,
                    targetRank: 14,
                    targetRankPriceUsdt: RANK_PRICES_USDT[13] || 800,
                    requiredSelfRank: 14,
                    requiredDirectCount: 2,
                    allowedDirectRanksLabel: 'r-12 หรือ r-13 หรือ r-14',
                    sharePercentOfAllSell: 25,
                    poolTotalUsdt: Number((totalAllSellUsdt * 0.25).toFixed(2)),
                    poolOnChainUsdt: Number((onChainAllSellBal * 0.25).toFixed(2)),
                    qualifiedMainIds: [] as number[],
                    qualifiedCount: 0,
                    sharePerQualifiedIdUsdt: 0,
                  },
                  {
                    poolNumber: 3,
                    titleTh: `กองที่ 3 : r-16 (${(RANK_PRICES_USDT[15] || 2000).toLocaleString()} USDT)`,
                    targetRank: 16,
                    targetRankPriceUsdt: RANK_PRICES_USDT[15] || 2000,
                    requiredSelfRank: 16,
                    requiredDirectCount: 2,
                    allowedDirectRanksLabel: 'r-14 หรือ r-15 หรือ r-16',
                    sharePercentOfAllSell: 25,
                    poolTotalUsdt: Number((totalAllSellUsdt * 0.25).toFixed(2)),
                    poolOnChainUsdt: Number((onChainAllSellBal * 0.25).toFixed(2)),
                    qualifiedMainIds: [] as number[],
                    qualifiedCount: 0,
                    sharePerQualifiedIdUsdt: 0,
                  },
                  {
                    poolNumber: 4,
                    titleTh: `กองที่ 4 : r-18 (${(RANK_PRICES_USDT[17] || 5000).toLocaleString()} USDT)`,
                    targetRank: 18,
                    targetRankPriceUsdt: RANK_PRICES_USDT[17] || 5000,
                    requiredSelfRank: 18,
                    requiredDirectCount: 5,
                    allowedDirectRanksLabel: 'r-16 หรือ r-17 หรือ r-18',
                    sharePercentOfAllSell: 25,
                    poolTotalUsdt: Number((totalAllSellUsdt * 0.25).toFixed(2)),
                    poolOnChainUsdt: Number((onChainAllSellBal * 0.25).toFixed(2)),
                    qualifiedMainIds: [] as number[],
                    qualifiedCount: 0,
                    sharePerQualifiedIdUsdt: 0,
                  },
                ];
                const fourPoolsList: any[] =
                  Array.isArray(systemPoolsData?.allSellFourPools) && systemPoolsData.allSellFourPools.length === 4
                    ? systemPoolsData.allSellFourPools
                    : fallbackFourPools;

                const autoStatus = systemPoolsData?.allSellAutoPayout;
                const isAutoEnabled = autoStatus ? Boolean(autoStatus.autoEnabled) : true;
                const nextCycleLabel =
                  autoStatus?.nextCycleLabelTh || 'วันที่ 1 (ต้นเดือน) และ วันที่ 15 (กลางเดือน) เวลา 00:00 น.';
                const countdownText = autoStatus?.countdownTextTh || 'คำนวณเวลานับถอยหลังอัตโนมัติ';
                const autoHistoryList: any[] = Array.isArray(autoStatus?.history) ? autoStatus.history : [];

                const handleToggleAutoAllSell = async () => {
                  try {
                    setIsRunningAllSellAuto(true);
                    setAllSellAutoMsg(null);
                    const res = await fetch('/api/matrix/allsell-auto-payout/toggle', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ enabled: !isAutoEnabled }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setAllSellAutoMsg(data.message);
                      setSystemPoolsData((prev: any) =>
                        prev
                          ? {
                              ...prev,
                              allSellAutoPayout: {
                                ...(prev.allSellAutoPayout || {}),
                                autoEnabled: data.autoEnabled,
                              },
                            }
                          : prev
                      );
                    }
                  } catch (e: any) {
                    setAllSellAutoMsg(e?.message || 'เกิดข้อผิดพลาดในการสลับสถานะ Auto AllSell');
                  } finally {
                    setIsRunningAllSellAuto(false);
                  }
                };

                const handleExecuteAutoAllSellNow = async () => {
                  try {
                    setIsRunningAllSellAuto(true);
                    setAllSellAutoMsg(null);
                    const res = await fetch('/api/matrix/allsell-auto-payout/execute-now', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setAllSellAutoMsg(data.message || 'ตัดรอบจ่าย AllSell อัตโนมัติสำเร็จ!');
                      const refreshRes = await fetch('/api/matrix/per-id-history');
                      const refreshJson = await refreshRes.json();
                      if (refreshJson?.success && refreshJson.systemPools) {
                        setSystemPoolsData(refreshJson.systemPools);
                      }
                    } else {
                      setAllSellAutoMsg(data.error || 'ไม่สามารถตัดรอบได้');
                    }
                  } catch (e: any) {
                    setAllSellAutoMsg(e?.message || 'เกิดข้อผิดพลาดในการสั่งตัดรอบ');
                  } finally {
                    setIsRunningAllSellAuto(false);
                  }
                };

                return (
                  <div className="rounded-xl bg-[#091526] border border-cyan-500/40 p-3.5 space-y-2.5 font-mono">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-cyan-500/20 pb-2">
                      <div>
                        <span className="font-extrabold text-cyan-300 text-xs sm:text-sm">
                          🏆 เงื่อนไข AllSell 4% : แบ่งยอดออกเป็น 4 กอง (กองละ 25% ของยอด AllSell)
                        </span>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          r- คือ Rank • ยอดรวม AllSell ทั้งหมด +{totalAllSellUsdt.toFixed(2)} USDT แบ่งเข้ากองที่ 1–4 กองละ +{(totalAllSellUsdt * 0.25).toFixed(2)} USDT
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-extrabold text-[10.5px] border ${
                            isAutoEnabled
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {isAutoEnabled
                            ? '🟢 ระบบตัดจ่ายอัตโนมัติ: เปิดใช้งาน (Auto ON)'
                            : '⚪ ระบบตัดจ่ายอัตโนมัติ: ปิดชั่วคราว'}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 font-bold text-[10.5px]">
                          4 กอง × 25% = 100% ของ AllSell (4%)
                        </span>
                      </div>
                    </div>

                    {/* แผงควบคุมการตัดรอบจ่าย AllSell อัตโนมัติ (ทุกต้นเดือน วันที่ 1 และกลางเดือน วันที่ 15) */}
                    <div className="rounded-xl bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-emerald-500/10 border border-amber-500/40 p-3 space-y-2 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="text-amber-200 font-extrabold flex items-center gap-1.5 flex-wrap">
                            <span>⚡ ระบบตัดรอบและจ่ายเงิน AllSell อัตโนมัติ (Auto Scheduler):</span>
                            <span className="text-emerald-300 underline">
                              ทุกกลางเดือน (วันที่ 15) และ ต้นเดือน (วันที่ 1) เวลา 00:00 น.
                            </span>
                          </div>
                          <div className="text-[10.5px] text-slate-300 flex flex-wrap items-center gap-3">
                            <span>
                              🗓️ รอบตัดจ่ายถัดไป: <strong className="text-amber-300">{nextCycleLabel}</strong>
                            </span>
                            <span>
                              ⏳ นับถอยหลัง: <strong className="text-cyan-300">{countdownText}</strong>
                            </span>
                            {autoStatus?.lastExecutedAt && (
                              <span>
                                ✅ ตัดรอบล่าสุด: <strong className="text-emerald-300">{formatModalRowTime(autoStatus.lastExecutedAt)}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {isAuthorizedAdminWallet(userAddress) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isRunningAllSellAuto}
                              onClick={handleToggleAutoAllSell}
                              className={`px-2.5 py-1.5 rounded-lg font-bold text-[10.5px] border transition cursor-pointer disabled:opacity-50 ${
                                isAutoEnabled
                                  ? 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                              }`}
                            >
                              {isAutoEnabled ? '⏸️ ปิด Auto ชั่วคราว' : '▶️ เปิด Auto Payout'}
                            </button>
                            <button
                              type="button"
                              disabled={isRunningAllSellAuto}
                              onClick={handleExecuteAutoAllSellNow}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-[10.5px] border border-emerald-400/50 shadow cursor-pointer disabled:opacity-50"
                            >
                              {isRunningAllSellAuto ? '⏳ กำลังประมวลผลรอบจ่าย...' : '⚡ สั่งตัดรอบจ่ายผู้ผ่านเกณฑ์ทันที'}
                            </button>
                          </div>
                        )}
                      </div>

                      {allSellAutoMsg && (
                        <div className="rounded-lg bg-slate-950/90 border border-emerald-500/40 px-2.5 py-1.5 text-[10.5px] text-emerald-300 font-bold">
                          🔔 {allSellAutoMsg}
                        </div>
                      )}

                      {autoHistoryList.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                          <div className="text-[10px] text-cyan-300 font-bold">
                            📜 ประวัติการตัดรอบจ่าย AllSell อัตโนมัติล่าสุด ({autoHistoryList.length} รอบ):
                          </div>
                          <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                            {autoHistoryList.slice(0, 5).map((rec: any) => (
                              <div
                                key={rec.id}
                                className="bg-slate-950/85 border border-slate-800 rounded-lg px-2.5 py-1 flex items-center justify-between flex-wrap gap-2 text-[10px]"
                              >
                                <div>
                                  <span className="text-amber-300 font-bold">[{rec.cycleLabelTh}]</span>{' '}
                                  <span className="text-slate-300">{rec.noteTh}</span>
                                </div>
                                <span className="text-cyan-400 font-mono">
                                  {formatModalRowTime(rec.executedAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                      {fourPoolsList.map((pool: any) => (
                        <div
                          key={`sys-allsell-four-${pool.poolNumber}`}
                          className="rounded-xl bg-slate-950/90 border border-cyan-500/30 p-3 space-y-1.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-1">
                              <span className="font-extrabold text-amber-300 text-xs">{pool.titleTh}</span>
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9.5px] font-bold">
                                25% Pool
                              </span>
                            </div>

                            <div className="space-y-1 text-[10.5px] text-slate-300">
                              <div>
                                <span className="text-cyan-300 font-bold">1.</span> ต้องมี ID หลักนั้น ดำรงอยู่ใน{' '}
                                <strong className="text-amber-300">
                                  r-{pool.requiredSelfRank} ({Number(pool.targetRankPriceUsdt).toLocaleString()} USDT)
                                </strong>
                              </div>
                              <div>
                                <span className="text-cyan-300 font-bold">2.</span> ต้องมี ID ที่แนะนำตรง จำนวน{' '}
                                <strong className="text-emerald-300">{pool.requiredDirectCount} ID</strong> ดำรงอยู่ใน{' '}
                                <strong className="text-cyan-200">{pool.allowedDirectRanksLabel}</strong>
                              </div>
                              <div>
                                <span className="text-amber-300 font-bold">3.</span> ระบบตัดจ่ายอัตโนมัติ{' '}
                                <strong className="text-amber-300">ทุกกลางเดือน (15) & ต้นเดือน (1)</strong>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800 space-y-1 text-[10.5px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">ยอดกองนี้ (25%):</span>
                              <span className="font-extrabold text-emerald-400">
                                +{Number(pool.poolTotalUsdt || 0).toFixed(2)} USDT
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">ผู้ผ่านคุณสมบัติ:</span>
                              <span className="font-bold text-amber-300">
                                {Number(pool.qualifiedCount || 0)} รหัส
                                {Array.isArray(pool.qualifiedMainIds) && pool.qualifiedMainIds.length > 0
                                  ? ` (${pool.qualifiedMainIds.map((id: number) => `#${id}`).join(', ')})`
                                  : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">เฉลี่ยต่อรหัสที่ผ่าน:</span>
                              <span className="font-extrabold text-cyan-300">
                                {Number(pool.qualifiedCount || 0) > 0
                                  ? `+${Number(pool.sharePerQualifiedIdUsdt || 0).toFixed(2)} USDT`
                                  : 'รอผู้ผ่านเงื่อนไข'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                {[
                  { key: 'all', label: '📋 ดูทั้งหมด (AllSell + Family Pool)' },
                  { key: 'allsell', label: `🌐 ประวัติ AllSell 4% (${allSellHistoryList.length} รายการ)` },
                  { key: 'family', label: `🏛️ ประวัติ Family Pool (${familyHistoryList.length} รายการ)` },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSystemPoolsModalTab(t.key as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                      systemPoolsModalTab === t.key
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white bg-slate-900/60'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* History Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 font-mono text-[11px]">
                {(systemPoolsModalTab === 'all' || systemPoolsModalTab === 'allsell') && (
                  <div
                    className={`bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3 space-y-2 ${
                      systemPoolsModalTab === 'allsell' ? 'lg:col-span-2' : ''
                    }`}
                  >
                    <div className="font-bold text-cyan-300 flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span>🌐 ประวัติรายได้ AllSell 4% ({allSellHistoryList.length} รายการ)</span>
                      <span className="text-emerald-400 font-extrabold">+{totalAllSellUsdt.toFixed(2)} USDT</span>
                    </div>
                    {allSellHistoryList.length === 0 ? (
                      <div className="text-slate-500 py-4 text-center">
                        ยังไม่มีรายการเม็ดซ้ายในผังนี้ (เมื่อมีโหนดวางฝั่งซ้าย ระบบจะหัก 4% เข้า AllSell ทันที)
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          {pagedAllSellHistory.map((item: any, idx: number) => (
                            <div
                              key={`allsell-hist-${allSellPage}-${idx}`}
                              className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-start justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div>
                                  <span className="text-amber-300 font-bold">[Rank {item.rank}]</span>{' '}
                                  <span className="text-slate-200">{item.note}</span>
                                </div>
                                <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>เวลาอ้างอิงล่าสุด: {formatModalRowTime(item.timestamp)}</span>
                                </div>
                              </div>
                              <span className="text-cyan-300 font-extrabold shrink-0">
                                +{Number(item.amountUsdt).toFixed(2)} U
                              </span>
                            </div>
                          ))}
                        </div>
                        {allSellHistoryList.length > SYS_PAGE_SIZE && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10.5px]">
                            <button
                              type="button"
                              disabled={allSellPage <= 1}
                              onClick={() =>
                                setModalSectionPages((prev) => ({ ...prev, sys_allsell: allSellPage - 1 }))
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                            >
                              ◀ ก่อนหน้า
                            </button>
                            <span className="text-slate-400">
                              หน้า <strong className="text-amber-300">{allSellPage}</strong> / {allSellTotalPages} (10 รายการ/หน้า)
                            </span>
                            <button
                              type="button"
                              disabled={allSellPage >= allSellTotalPages}
                              onClick={() =>
                                setModalSectionPages((prev) => ({ ...prev, sys_allsell: allSellPage + 1 }))
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                            >
                              ถัดไป ▶
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {(systemPoolsModalTab === 'all' || systemPoolsModalTab === 'family') && (
                  <div
                    className={`bg-slate-950/90 border border-fuchsia-500/30 rounded-xl p-3 space-y-2 ${
                      systemPoolsModalTab === 'family' ? 'lg:col-span-2' : ''
                    }`}
                  >
                    <div className="font-bold text-fuchsia-300 flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span>🏛️ ประวัติรายได้ Family Pool ({familyHistoryList.length} รายการ)</span>
                      <span className="text-amber-300 font-extrabold">+{totalFamilyUsdt.toFixed(2)} USDT</span>
                    </div>
                    {familyHistoryList.length === 0 ? (
                      <div className="text-slate-500 py-4 text-center">
                        ยังไม่มีรายการเม็ดซ้ายในผังนี้ (เมื่อมีโหนดวางฝั่งซ้าย ค่าชั้นที่เหลือจาก 15 ชั้น และ 30% จากโคลน #1 จะเข้า Family Pool ทันที)
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          {pagedFamilyHistory.map((item: any, idx: number) => (
                            <div
                              key={`family-hist-${familyPage}-${idx}`}
                              className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-start justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div>
                                  <span className="text-amber-300 font-bold">[Rank {item.rank}]</span>{' '}
                                  <span className="text-slate-200">{item.note}</span>
                                </div>
                                <div className="text-[10px] text-cyan-400/90 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>เวลาอ้างอิงล่าสุด: {formatModalRowTime(item.timestamp)}</span>
                                </div>
                              </div>
                              <span className="text-fuchsia-300 font-extrabold shrink-0">
                                +{Number(item.amountUsdt).toFixed(2)} U
                              </span>
                            </div>
                          ))}
                        </div>
                        {familyHistoryList.length > SYS_PAGE_SIZE && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10.5px]">
                            <button
                              type="button"
                              disabled={familyPage <= 1}
                              onClick={() =>
                                setModalSectionPages((prev) => ({ ...prev, sys_family: familyPage - 1 }))
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                            >
                              ◀ ก่อนหน้า
                            </button>
                            <span className="text-slate-400">
                              หน้า <strong className="text-amber-300">{familyPage}</strong> / {familyTotalPages} (10 รายการ/หน้า)
                            </span>
                            <button
                              type="button"
                              disabled={familyPage >= familyTotalPages}
                              onClick={() =>
                                setModalSectionPages((prev) => ({ ...prev, sys_family: familyPage + 1 }))
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                            >
                              ถัดไป ▶
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSystemPoolsModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs cursor-pointer transition"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* FLOATING REAL-TIME POPUP TOAST: แจ้งเตือนสดเมื่อเกิด Auto ID / Extra ID ใหม่ */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isAutoExtraPopupEnabled && liveAutoExtraToast && (
          <motion.div
            key={`live-auto-extra-${liveAutoExtraToast.category}-${liveAutoExtraToast.rank}-${liveAutoExtraToast.id}`}
            initial={{ opacity: 0, y: -24, x: 32, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed top-4 right-3 sm:right-5 z-[70] w-[calc(100vw-24px)] max-w-md"
          >
            <div
              className={`rounded-2xl p-3.5 sm:p-4 border-2 shadow-2xl backdrop-blur-md relative overflow-hidden ${
                liveAutoExtraToast.category === 'EXTRA_ID'
                  ? 'bg-gradient-to-r from-[#2c0b14]/95 via-[#131726]/95 to-[#280b16]/95 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.5)]'
                  : liveAutoExtraToast.category === 'AUTO_ID'
                  ? 'bg-gradient-to-r from-[#2b1e06]/95 via-[#131726]/95 to-[#261a07]/95 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
                  : 'bg-gradient-to-r from-[#0c261f]/95 via-[#131726]/95 to-[#0d222c]/95 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.5)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 border ${
                      liveAutoExtraToast.category === 'EXTRA_ID'
                        ? 'bg-red-500/25 border-red-400 text-red-200'
                        : liveAutoExtraToast.category === 'AUTO_ID'
                        ? 'bg-amber-400/25 border-amber-300 text-amber-200'
                        : 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    }`}
                  >
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                          liveAutoExtraToast.category === 'EXTRA_ID'
                            ? 'bg-red-500 text-white'
                            : liveAutoExtraToast.category === 'AUTO_ID'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {liveAutoExtraToast.category === 'EXTRA_ID'
                          ? '🔴 EXTRA ID ALERT'
                          : liveAutoExtraToast.category === 'AUTO_ID'
                          ? '🟡 AUTO ID ALERT'
                          : '⚡ POOL READY ALERT'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        เวลาล่าสุด {liveAutoExtraToast.timestamp}
                      </span>
                    </div>
                    <div className="font-extrabold text-white text-xs sm:text-sm leading-snug">
                      {liveAutoExtraToast.title}
                    </div>
                    <div className="text-[11px] text-slate-200 font-mono leading-relaxed">
                      {liveAutoExtraToast.subtitle}
                    </div>
                    {liveAutoExtraToast.owner && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        กระเป๋าเจ้าของ: {liveAutoExtraToast.owner.slice(0, 8)}...
                        {liveAutoExtraToast.owner.slice(-6)}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLiveAutoExtraToast(null)}
                  className="p-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer shrink-0"
                  title="ปิดป๊อปอัพแจ้งเตือน"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetR = liveAutoExtraToast.rank || 1;
                    const targetNode = liveAutoExtraToast.id || 1;
                    setLiveAutoExtraToast(null);
                    if (selectedRank !== targetR) {
                      setSelectedRank(targetR);
                      loadOnChainTree(targetR);
                    }
                    navigateToNode(targetNode);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>
                    ดูในผัง R{liveAutoExtraToast.rank}-#{liveAutoExtraToast.id} ทันที
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cat = liveAutoExtraToast.category;
                    setLiveAutoExtraToast(null);
                    setAutoExtraAlertTab(
                      cat === 'EXTRA_ID' ? 'extra' : cat === 'AUTO_ID' ? 'auto' : 'pool'
                    );
                    setUnreadAutoExtraCount(0);
                    setIsAutoExtraAlertModalOpen(true);
                  }}
                  className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer"
                >
                  เปิดกล่องแจ้งเตือน
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* POPUP MODAL: กล่องแจ้งเตือนและศูนย์รวม Auto ID & Extra ID */}
      {/* ===================================================================== */}
      {isAutoExtraAlertModalOpen && (() => {
        const {
          spawnedAutoIds,
          spawnedExtraIds,
          poolAlerts,
          autoPoolsList,
          extraPoolsList,
          readyAutoPoolsCount,
          readyExtraPoolsCount,
          myAutoSpawnedCount,
          myExtraSpawnedCount,
          myPoolAlertsCount,
        } = autoExtraNotificationsData;

        const q = autoExtraSearchQuery.trim().toLowerCase();
        const matchesQuery = (
          idNum: number,
          sourceMain: number,
          parentNum: number,
          ownerAddr: string,
          labelStr: string
        ) => {
          if (!q) return true;
          const cleanNum = q.replace(/^#/, '');
          if (
            String(idNum) === cleanNum ||
            String(sourceMain) === cleanNum ||
            String(parentNum) === cleanNum
          ) {
            return true;
          }
          return (
            ownerAddr.toLowerCase().includes(q) || labelStr.toLowerCase().includes(q)
          );
        };

        const filteredAutoList = spawnedAutoIds.filter((item) => {
          if (autoExtraAlertTab === 'mine' && !item.isMyWallet) return false;
          return matchesQuery(
            item.id,
            item.sourceMainId,
            item.parentId,
            item.owner,
            item.label
          );
        });

        const filteredExtraList = spawnedExtraIds.filter((item) => {
          if (autoExtraAlertTab === 'mine' && !item.isMyWallet) return false;
          return matchesQuery(
            item.id,
            item.sourceMainId,
            item.parentId,
            item.owner,
            item.label
          );
        });

        const filteredPoolList = poolAlerts.filter((item) => {
          if (autoExtraAlertTab === 'mine' && !item.isMyWallet) return false;
          return matchesQuery(
            item.mainId,
            item.mainId,
            item.mainId,
            item.owner,
            item.noteTh
          );
        });

        const AE_PAGE_SIZE = 10;
        const autoAlertPage = Math.min(
          Math.max(1, modalSectionPages.ae_auto || 1),
          Math.max(1, Math.ceil(filteredAutoList.length / AE_PAGE_SIZE))
        );
        const autoAlertTotalPages = Math.max(
          1,
          Math.ceil(filteredAutoList.length / AE_PAGE_SIZE)
        );
        const pagedAutoAlerts = filteredAutoList.slice(
          (autoAlertPage - 1) * AE_PAGE_SIZE,
          autoAlertPage * AE_PAGE_SIZE
        );

        const extraAlertPage = Math.min(
          Math.max(1, modalSectionPages.ae_extra || 1),
          Math.max(1, Math.ceil(filteredExtraList.length / AE_PAGE_SIZE))
        );
        const extraAlertTotalPages = Math.max(
          1,
          Math.ceil(filteredExtraList.length / AE_PAGE_SIZE)
        );
        const pagedExtraAlerts = filteredExtraList.slice(
          (extraAlertPage - 1) * AE_PAGE_SIZE,
          extraAlertPage * AE_PAGE_SIZE
        );

        const poolAlertPage = Math.min(
          Math.max(1, modalSectionPages.ae_pool || 1),
          Math.max(1, Math.ceil(filteredPoolList.length / AE_PAGE_SIZE))
        );
        const poolAlertTotalPages = Math.max(
          1,
          Math.ceil(filteredPoolList.length / AE_PAGE_SIZE)
        );
        const pagedPoolAlerts = filteredPoolList.slice(
          (poolAlertPage - 1) * AE_PAGE_SIZE,
          poolAlertPage * AE_PAGE_SIZE
        );

        const triggerSampleAlertToast = (type: 'AUTO_ID' | 'EXTRA_ID') => {
          const nowTime = new Date().toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          if (type === 'AUTO_ID') {
            const sample = spawnedAutoIds[0];
            setLiveAutoExtraToast({
              id: sample ? sample.id : 18,
              rank: 1,
              category: 'AUTO_ID',
              title: sample
                ? `🟡 แจ้งเตือน Auto ID! (${sample.label})`
                : `🟡 แจ้งเตือน Auto ID ใหม่! (Auto ID #18 • R1-#18)`,
              subtitle: sample
                ? sample.noteTh
                : `แตกตัวอัตโนมัติจากกระปุก New Auto ID Pool (${RANK_PRICES_USDT[0] || 5} USDT) ของ Main ID #1 → วางต่อสายใต้ #9 (↙ ขาซ้าย)`,
              sourceMainId: sample ? sample.sourceMainId : 1,
              parentId: sample ? sample.parentId : 9,
              side: sample ? sample.side : 'LEFT',
              owner:
                sample?.owner ||
                userAddress ||
                '0x622E20082e63c7220c5AF0A77Cbc437a98505311',
              amountUsdt: RANK_PRICES_USDT[0] || 5,
              timestamp: nowTime,
            });
          } else {
            const sampleEx = spawnedExtraIds[0];
            setLiveAutoExtraToast({
              id: sampleEx ? sampleEx.id : 5,
              rank: sampleEx ? sampleEx.rank : 2,
              category: 'EXTRA_ID',
              title: sampleEx
                ? `🔴 แจ้งเตือน Extra ID! (${sampleEx.label})`
                : `🔴 แจ้งเตือน Extra ID ใหม่! (Extra R2-#5)`,
              subtitle: sampleEx
                ? sampleEx.noteTh
                : `แตกตัวอัตโนมัติจากกระปุก New Extra ID Pool (${RANK_PRICES_USDT[1] || 10} USDT) ของ Main ID #1 ในผัง Rank 2 → วางต่อสายใต้ R2-#2 (↙ ขาซ้าย)`,
              sourceMainId: sampleEx ? sampleEx.sourceMainId : 1,
              parentId: sampleEx ? sampleEx.parentId : 2,
              side: sampleEx ? sampleEx.side : 'LEFT',
              owner:
                sampleEx?.owner ||
                userAddress ||
                '0x622E20082e63c7220c5AF0A77Cbc437a98505311',
              amountUsdt: sampleEx ? sampleEx.costUsdt : RANK_PRICES_USDT[1] || 10,
              timestamp: nowTime,
            });
          }
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
            onClick={() => setIsAutoExtraAlertModalOpen(false)}
          >
            <div
              className="w-full max-w-5xl rounded-2xl bg-[#0b1020] border-2 border-amber-400/70 shadow-[0_0_60px_rgba(245,158,11,0.3)] overflow-hidden my-auto max-h-[92vh] flex flex-col text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="px-4 py-3.5 bg-gradient-to-r from-[#281b05] via-slate-900 to-[#2b0c14] border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white text-sm sm:text-base">
                        🔔 ระบบแจ้งเตือนและกล่องแจ้งเตือน Auto ID & Extra ID
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold">
                        Real-Time On-Chain Monitor
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      ติดตามรหัส Auto ID (กรอบทอง • R1) และ Extra ID (กรอบแดง • R2–R27) ที่แตกตัวอัตโนมัติ รวมถึงคิวกระปุกสะสมที่พร้อมออกรหัสใหม่
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsAutoExtraPopupEnabled((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] border transition cursor-pointer flex items-center gap-1 ${
                      isAutoExtraPopupEnabled
                        ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>
                      {isAutoExtraPopupEnabled
                        ? 'เปิดเด้งแจ้งเตือนอัตโนมัติ'
                        : 'ปิดเด้งแจ้งเตือนอัตโนมัติ'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerSampleAlertToast('AUTO_ID')}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-[11px] cursor-pointer transition"
                    title="ทดสอบแสดงกล่องเด้งแจ้งเตือน Auto ID มุมขวาบน"
                  >
                    🧪 ทดสอบเด้ง Auto ID
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerSampleAlertToast('EXTRA_ID')}
                    className="px-2.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-400/50 text-red-200 font-bold text-[11px] cursor-pointer transition"
                    title="ทดสอบแสดงกล่องเด้งแจ้งเตือน Extra ID มุมขวาบน"
                  >
                    🧪 ทดสอบเด้ง Extra ID
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAutoExtraAlertModalOpen(false)}
                    className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
                {/* Summary KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
                  {/* Card 1: Auto ID Summary */}
                  <div className="rounded-xl bg-gradient-to-br from-[#281c06] to-[#121626] border-2 border-amber-400/60 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-amber-500/25 pb-1.5">
                      <span className="font-extrabold text-amber-300 text-xs sm:text-sm">
                        🟡 สรุป Auto ID (Rank 1)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                        {RANK_PRICES_USDT[0] || 5} USDT / รหัส
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Auto ID ออกแล้วทั้งหมด:</span>
                      <span className="font-extrabold text-amber-300 text-sm">
                        {spawnedAutoIds.length} รหัส
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">ของกระเป๋าที่เชื่อมต่อ:</span>
                      <span className="font-extrabold text-emerald-400">
                        {myAutoSpawnedCount} รหัส
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                      <span className="text-slate-300">พร้อมออกทันที / กำลังสะสม:</span>
                      <span className="font-extrabold text-cyan-300">
                        {readyAutoPoolsCount} พร้อมออก • {autoPoolsList.length} คิวสะสม
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Extra ID Summary */}
                  <div className="rounded-xl bg-gradient-to-br from-[#2b0c14] to-[#121626] border-2 border-red-500/65 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-red-500/25 pb-1.5">
                      <span className="font-extrabold text-red-300 text-xs sm:text-sm">
                        🔴 สรุป Extra ID (Rank 2–27)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-500 text-white font-black text-[10px]">
                        R2–R27
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Extra ID ออกแล้วทั้งหมด:</span>
                      <span className="font-extrabold text-red-300 text-sm">
                        {spawnedExtraIds.length} รหัส
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">ของกระเป๋าที่เชื่อมต่อ:</span>
                      <span className="font-extrabold text-emerald-400">
                        {myExtraSpawnedCount} รหัส
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-red-500/20">
                      <span className="text-slate-300">พร้อมออกทันที / กำลังสะสม:</span>
                      <span className="font-extrabold text-cyan-300">
                        {readyExtraPoolsCount} พร้อมออก • {extraPoolsList.length} คิวสะสม
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Rules & Pool Queue */}
                  <div className="rounded-xl bg-gradient-to-br from-[#0e2229] to-[#121626] border border-cyan-500/50 p-3.5 space-y-1.5 font-sans">
                    <div className="flex items-center justify-between border-b border-cyan-500/25 pb-1.5">
                      <span className="font-extrabold text-cyan-300 text-xs sm:text-sm">
                        ⚡ เงื่อนไขการแจ้งเตือนอัตโนมัติ
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-mono font-bold text-[10px]">
                        Auto Trigger
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-1 leading-relaxed">
                      <div>
                        • <strong className="text-amber-300">Auto ID (กรอบทอง)</strong>: แตกอัตโนมัติใน Rank 1 เมื่อกระปุก New Auto ID Pool สะสมครบ <strong>{(RANK_PRICES_USDT[0] || 5).toFixed(2)} USDT</strong>
                      </div>
                      <div>
                        • <strong className="text-red-300">Extra ID (กรอบแดง)</strong>: รวมยอดเก่าคงเหลือ + ยอดใหม่ในกระปุก New Extra ID Pool ก่อนสร้าง Extra ID เมื่อครบราคาผัง R18→R2 (เริ่ม {RANK_PRICES_USDT[1] || 10} USDT)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Tabs + Search Input */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      {
                        key: 'all',
                        label: `🔔 ทั้งหมด (${
                          spawnedAutoIds.length + spawnedExtraIds.length + poolAlerts.length
                        })`,
                      },
                      {
                        key: 'auto',
                        label: `🟡 Auto ID ที่เกิดแล้ว (${spawnedAutoIds.length})`,
                      },
                      {
                        key: 'extra',
                        label: `🔴 Extra ID ที่เกิดแล้ว (${spawnedExtraIds.length})`,
                      },
                      {
                        key: 'pool',
                        label: `⚡ คิวกระปุกพร้อมออก/กำลังสะสม (${poolAlerts.length})`,
                      },
                      {
                        key: 'mine',
                        label: `👛 เฉพาะกระเป๋าของฉัน (${
                          myAutoSpawnedCount + myExtraSpawnedCount + myPoolAlertsCount
                        })`,
                      },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setAutoExtraAlertTab(tab.key as any)}
                        className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] transition cursor-pointer ${
                          autoExtraAlertTab === tab.key
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 shadow'
                            : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={autoExtraSearchQuery}
                      onChange={(e) => setAutoExtraSearchQuery(e.target.value)}
                      placeholder="ค้นหา #ID หรือ 0xWallet..."
                      className="w-44 sm:w-56 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    {autoExtraSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAutoExtraSearchQuery('')}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] cursor-pointer"
                      >
                        ล้าง
                      </button>
                    )}
                  </div>
                </div>

                {/* Section A & B: Spawned Auto IDs & Spawned Extra IDs Boxes */}
                {(autoExtraAlertTab === 'all' ||
                  autoExtraAlertTab === 'auto' ||
                  autoExtraAlertTab === 'extra' ||
                  autoExtraAlertTab === 'mine') && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 font-mono text-[11px]">
                    {/* Box A: Auto ID Notifications */}
                    {(autoExtraAlertTab === 'all' ||
                      autoExtraAlertTab === 'auto' ||
                      autoExtraAlertTab === 'mine') && (
                      <div
                        className={`bg-slate-950/95 border-2 border-amber-400/50 rounded-xl p-3 space-y-2.5 ${
                          autoExtraAlertTab === 'auto' ? 'lg:col-span-2' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-amber-300 text-xs sm:text-sm flex items-center gap-1.5">
                            <span>🟡 กล่องรายการแจ้งเตือน Auto ID (Rank 1)</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold">
                            {filteredAutoList.length} รหัส
                          </span>
                        </div>

                        {filteredAutoList.length === 0 ? (
                          <div className="text-slate-400 py-5 text-center font-sans">
                            ยังไม่มีรายการ Auto ID ในหมวดที่เลือก (เมื่อกระปุก New Auto ID Pool ครบ {(RANK_PRICES_USDT[0] || 5).toFixed(2)} USDT ระบบจะออก Auto ID และแจ้งเตือนที่นี่ทันที)
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {pagedAutoAlerts.map((item) => (
                                <div
                                  key={item.key}
                                  className="rounded-xl bg-[#141829] border border-amber-400/40 hover:border-amber-300 p-2.5 space-y-1.5 transition"
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-[10px]">
                                        🟡 AUTO ID
                                      </span>
                                      <span className="font-extrabold text-amber-300 text-xs">
                                        {item.label}
                                      </span>
                                      {item.isMyWallet && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9.5px] font-bold">
                                          กระเป๋าของคุณ
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-emerald-400 font-extrabold text-[11px]">
                                      หักกระปุก {(RANK_PRICES_USDT[0] || 5).toFixed(2)} USDT
                                    </span>
                                  </div>

                                  <div className="text-slate-200 leading-relaxed">
                                    แตกตัวจากรหัสหลัก:{' '}
                                    <strong className="text-amber-300">
                                      Main ID #{item.sourceMainId}
                                    </strong>{' '}
                                    • ต่อสายเข้าผังใต้:{' '}
                                    <strong className="text-indigo-300">
                                      อัพไลน์ #{item.parentId}
                                    </strong>{' '}
                                    <span
                                      className={
                                        item.side === 'LEFT'
                                          ? 'text-emerald-300 font-bold'
                                          : 'text-purple-300 font-bold'
                                      }
                                    >
                                      ({item.side === 'LEFT' ? '↙ ขาซ้าย' : '↘ ขาขวา'})
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 flex-wrap">
                                    <span className="text-[10px] text-slate-400">
                                      เจ้าของ: {item.owner.slice(0, 8)}...{item.owner.slice(-6)}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsAutoExtraAlertModalOpen(false);
                                          if (selectedRank !== 1) {
                                            setSelectedRank(1);
                                            loadOnChainTree(1);
                                          }
                                          navigateToNode(item.id);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-[10.5px] cursor-pointer transition"
                                      >
                                        🔍 ดูในผัง R1-#{item.id}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsAutoExtraAlertModalOpen(false);
                                          if (selectedRank !== 1) {
                                            setSelectedRank(1);
                                            loadOnChainTree(1);
                                          }
                                          setBenefitModalTab('all');
                                          setExpandedBenefitNodeId(item.id);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/50 text-indigo-200 font-bold text-[10.5px] cursor-pointer transition"
                                      >
                                        📊 ดูข้อมูล ID
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {filteredAutoList.length > AE_PAGE_SIZE && (
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10.5px]">
                                <button
                                  type="button"
                                  disabled={autoAlertPage <= 1}
                                  onClick={() =>
                                    setModalSectionPages((prev) => ({
                                      ...prev,
                                      ae_auto: autoAlertPage - 1,
                                    }))
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                                >
                                  ◀ ก่อนหน้า
                                </button>
                                <span className="text-slate-400">
                                  หน้า <strong className="text-amber-300">{autoAlertPage}</strong> /{' '}
                                  {autoAlertTotalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={autoAlertPage >= autoAlertTotalPages}
                                  onClick={() =>
                                    setModalSectionPages((prev) => ({
                                      ...prev,
                                      ae_auto: autoAlertPage + 1,
                                    }))
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                                >
                                  ถัดไป ▶
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Box B: Extra ID Notifications */}
                    {(autoExtraAlertTab === 'all' ||
                      autoExtraAlertTab === 'extra' ||
                      autoExtraAlertTab === 'mine') && (
                      <div
                        className={`bg-slate-950/95 border-2 border-red-500/50 rounded-xl p-3 space-y-2.5 ${
                          autoExtraAlertTab === 'extra' ? 'lg:col-span-2' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-red-300 text-xs sm:text-sm flex items-center gap-1.5">
                            <span>🔴 กล่องรายการแจ้งเตือน Extra ID (Rank 2–27)</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-400/40 text-red-300 font-bold">
                            {filteredExtraList.length} รหัส
                          </span>
                        </div>

                        {filteredExtraList.length === 0 ? (
                          <div className="text-slate-400 py-5 text-center font-sans">
                            ยังไม่มีรายการ Extra ID ในหมวดที่เลือก (เมื่อกระปุก New Extra ID Pool สะสมครบราคาผัง R2–R27 ระบบจะออก Extra ID และแจ้งเตือนที่นี่ทันที)
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {pagedExtraAlerts.map((item) => (
                                <div
                                  key={item.key}
                                  className="rounded-xl bg-[#1a111a] border border-red-500/45 hover:border-red-400 p-2.5 space-y-1.5 transition"
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-2 py-0.5 rounded bg-gradient-to-r from-red-600 to-rose-500 text-white font-black text-[10px]">
                                        🔴 EXTRA ID (R{item.rank})
                                      </span>
                                      <span className="font-extrabold text-red-300 text-xs">
                                        {item.label}
                                      </span>
                                      {item.isMyWallet && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9.5px] font-bold">
                                          กระเป๋าของคุณ
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-amber-300 font-extrabold text-[11px]">
                                      หักกระปุก {item.costUsdt.toFixed(2)} USDT
                                    </span>
                                  </div>

                                  <div className="text-slate-200 leading-relaxed">
                                    แตกตัวจากรหัสหลัก:{' '}
                                    <strong className="text-amber-300">
                                      Main ID #{item.sourceMainId}
                                    </strong>{' '}
                                    • ต่อสายเข้าผัง Rank {item.rank} ใต้:{' '}
                                    <strong className="text-indigo-300">
                                      R{item.rank}-#{item.parentId}
                                    </strong>{' '}
                                    <span
                                      className={
                                        item.side === 'LEFT'
                                          ? 'text-emerald-300 font-bold'
                                          : 'text-purple-300 font-bold'
                                      }
                                    >
                                      ({item.side === 'LEFT' ? '↙ ขาซ้าย' : '↘ ขาขวา'})
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 flex-wrap">
                                    <span className="text-[10px] text-slate-400">
                                      เจ้าของ: {item.owner.slice(0, 8)}...{item.owner.slice(-6)}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsAutoExtraAlertModalOpen(false);
                                          if (selectedRank !== item.rank) {
                                            setSelectedRank(item.rank);
                                            loadOnChainTree(item.rank);
                                          }
                                          navigateToNode(item.id);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-400/50 text-red-200 font-bold text-[10.5px] cursor-pointer transition"
                                      >
                                        🔍 ดูในผัง R{item.rank}-#{item.id}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {filteredExtraList.length > AE_PAGE_SIZE && (
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10.5px]">
                                <button
                                  type="button"
                                  disabled={extraAlertPage <= 1}
                                  onClick={() =>
                                    setModalSectionPages((prev) => ({
                                      ...prev,
                                      ae_extra: extraAlertPage - 1,
                                    }))
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                                >
                                  ◀ ก่อนหน้า
                                </button>
                                <span className="text-slate-400">
                                  หน้า <strong className="text-red-300">{extraAlertPage}</strong> /{' '}
                                  {extraAlertTotalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={extraAlertPage >= extraAlertTotalPages}
                                  onClick={() =>
                                    setModalSectionPages((prev) => ({
                                      ...prev,
                                      ae_extra: extraAlertPage + 1,
                                    }))
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                                >
                                  ถัดไป ▶
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Section C: Ready & Accumulating Pool Queue Notifications */}
                {(autoExtraAlertTab === 'all' ||
                  autoExtraAlertTab === 'pool' ||
                  autoExtraAlertTab === 'mine') && (
                  <div className="bg-slate-950/95 border border-cyan-500/45 rounded-xl p-3.5 space-y-2.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                      <span className="font-extrabold text-cyan-300 text-xs sm:text-sm flex items-center gap-1.5">
                        <span>⚡ คิวแจ้งเตือนกระปุกสะสมเตรียมออก Auto ID & Extra ID</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-bold">
                        {filteredPoolList.length} รายการ
                      </span>
                    </div>

                    {filteredPoolList.length === 0 ? (
                      <div className="text-slate-400 py-4 text-center font-sans">
                        ยังไม่มีรหัสที่มียอดค้างในกระปุก New Auto ID Pool หรือ New Extra ID Pool
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {pagedPoolAlerts.map((p) => (
                            <div
                              key={p.key}
                              className={`rounded-xl p-3 border space-y-2 ${
                                p.isReady
                                  ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                                  : p.category === 'AUTO_POOL'
                                  ? 'bg-slate-900/90 border-amber-500/35'
                                  : 'bg-slate-900/90 border-red-500/35'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                      p.category === 'AUTO_POOL'
                                        ? 'bg-amber-400 text-slate-950'
                                        : 'bg-red-500 text-white'
                                    }`}
                                  >
                                    {p.category === 'AUTO_POOL'
                                      ? '🟡 New Auto ID Pool'
                                      : '🔴 New Extra ID Pool'}
                                  </span>
                                  <strong className="text-white text-xs">
                                    Main ID #{p.mainId}
                                  </strong>
                                  {p.isMyWallet && (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[9.5px] font-bold">
                                      ของคุณ
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`font-extrabold ${
                                    p.isReady ? 'text-emerald-300' : 'text-amber-300'
                                  }`}
                                >
                                  {p.poolBalanceUsdt.toFixed(2)} / {p.targetCostUsdt.toFixed(2)} U (
                                  {p.progressPct}%)
                                </span>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    p.isReady
                                      ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                                      : p.category === 'AUTO_POOL'
                                      ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                                      : 'bg-gradient-to-r from-red-500 to-rose-400'
                                  }`}
                                  style={{ width: `${p.progressPct}%` }}
                                />
                              </div>

                              <div className="text-slate-300 text-[10.5px] leading-snug">
                                {p.noteTh}
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                                <span className="text-[10px] text-slate-400">
                                  แรงค์ปัจจุบัน: R{p.currentRank} • {p.owner.slice(0, 6)}...
                                  {p.owner.slice(-4)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAutoExtraAlertModalOpen(false);
                                    if (selectedRank !== 1) {
                                      setSelectedRank(1);
                                      loadOnChainTree(1);
                                    }
                                    navigateToNode(p.mainId);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 font-bold text-[10px] cursor-pointer"
                                >
                                  🔍 ดู Main #{p.mainId}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {filteredPoolList.length > AE_PAGE_SIZE && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10.5px]">
                            <button
                              type="button"
                              disabled={poolAlertPage <= 1}
                              onClick={() =>
                                setModalSectionPages((prev) => ({
                                  ...prev,
                                  ae_pool: poolAlertPage - 1,
                                }))
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                            >
                              ◀ ก่อนหน้า
                            </button>
                            <span className="text-slate-400">
                              หน้า <strong className="text-cyan-300">{poolAlertPage}</strong> /{' '}
                              {poolAlertTotalPages}
                            </span>
                            <button
                              type="button"
                              disabled={poolAlertPage >= poolAlertTotalPages}
                              onClick={() =>
                                setModalSectionPages((prev) => ({
                                  ...prev,
                                  ae_pool: poolAlertPage + 1,
                                }))
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                            >
                              ถัดไป ▶
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAutoExtraAlertModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black text-xs cursor-pointer transition shadow-md"
                  >
                    ปิดกล่องแจ้งเตือน
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
