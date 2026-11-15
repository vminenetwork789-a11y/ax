import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Crown,
  Dna,
  Eye,
  GitBranch,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Target,
  Undo2,
  UserPlus,
  Zap,
  ZoomIn,
  ZoomOut,
  ArrowUpRight,
} from 'lucide-react';
import { RANK_PRICES_USDT } from '../contracts/config';
import type { SimRawNode } from './ExtraIdPathCalculator';
import {
  createFreshSandboxState,
  createSandboxStateFromSnapshots,
  getMainIdCurrentRankInSandbox,
  getMainIdSandboxSummary,
  getNodeInRankForMain,
  predictNextPlacements,
  resolveR1MainForSandboxNode,
  sandboxProcessPoolsForMain,
  sandboxRegisterR1,
  sandboxRunDemoScenario,
  sandboxUpgradeRank,
  type PlacementPrediction,
  type SandboxState,
} from '../utils/matrixSandboxEngine';

interface MatrixSandboxSimulatorProps {
  multiRankSnapshots: Map<number, Map<number, SimRawNode>>;
  perIdReportsMap?: Map<number, any>;
  language?: 'th' | 'en';
  initialRank?: number;
  initialMainId?: number;
}

interface TreeRenderItem {
  key: string;
  isGhost: boolean;
  node?: SimRawNode;
  prediction?: PlacementPrediction;
  parentId: number;
  side: 'LEFT' | 'RIGHT';
  depth: number;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

const NODE_W = 118;
const NODE_H = 66;
const LEVEL_Y_GAP = 104;
const LEAF_X_GAP = 136;

export const MatrixSandboxSimulator: React.FC<MatrixSandboxSimulatorProps> = ({
  multiRankSnapshots,
  perIdReportsMap,
  language = 'th',
  initialRank = 1,
  initialMainId = 1,
}) => {
  const isTh = language === 'th';

  const [sourceMode, setSourceMode] = useState<'live' | 'fresh'>(() =>
    multiRankSnapshots.size > 0 ? 'live' : 'fresh'
  );
  const [sandboxState, setSandboxState] = useState<SandboxState>(() =>
    multiRankSnapshots.size > 0
      ? createSandboxStateFromSnapshots(multiRankSnapshots, perIdReportsMap)
      : createFreshSandboxState()
  );
  const [undoStack, setUndoStack] = useState<SandboxState[]>([]);

  const [viewRank, setViewRank] = useState<number>(Math.min(18, Math.max(1, initialRank)));
  const [focusRootId, setFocusRootId] = useState<number>(1);
  const [maxDepth, setMaxDepth] = useState<number>(5);
  const [zoom, setZoom] = useState<number>(0.92);

  const [selectedMainId, setSelectedMainId] = useState<number>(Math.max(1, initialMainId));
  const [inspectedNodeId, setInspectedNodeId] = useState<number>(1);

  // Action inputs
  const [regSponsorId, setRegSponsorId] = useState<number>(1);
  const [regCount, setRegCount] = useState<number>(1);
  const [upgTargetRank, setUpgTargetRank] = useState<number>(2);

  // Radar & Log filters
  const [showGhostPredictions, setShowGhostPredictions] = useState<boolean>(true);
  const [eventFilter, setEventFilter] = useState<'ALL' | 'CLONE' | 'AUTO_ID' | 'EXTRA_ID' | 'MAIN'>('ALL');

  // Initialize from live snapshots once loaded if user hasn't taken actions yet
  useEffect(() => {
    if (
      sourceMode === 'live' &&
      sandboxState.actionCount === 0 &&
      multiRankSnapshots.size > 0
    ) {
      setSandboxState(createSandboxStateFromSnapshots(multiRankSnapshots, perIdReportsMap));
    }
  }, [multiRankSnapshots, perIdReportsMap, sourceMode, sandboxState.actionCount]);

  // All Main IDs in simulated Rank 1
  const availableMainIds = useMemo(() => {
    const r1 = sandboxState.ranks.get(1);
    if (!r1) return [1];
    return Array.from(r1.values())
      .filter((n) => !n.isClone && !n.isExtraId)
      .map((n) => n.id)
      .sort((a, b) => a - b);
  }, [sandboxState]);

  // Keep selectedMainId valid
  const safeSelectedMainId = useMemo(() => {
    const r1 = sandboxState.ranks.get(1);
    if (r1?.has(selectedMainId)) return selectedMainId;
    return availableMainIds[0] || 1;
  }, [sandboxState, selectedMainId, availableMainIds]);

  const selectedSummary = useMemo(
    () => getMainIdSandboxSummary(sandboxState, safeSelectedMainId, viewRank),
    [sandboxState, safeSelectedMainId, viewRank]
  );

  // Keep upgrade target rank strictly above current rank of selectedMainId (if < 18)
  useEffect(() => {
    const cur = selectedSummary.currentRank;
    if (cur < 18 && upgTargetRank <= cur) {
      setUpgTargetRank(cur + 1);
    }
  }, [selectedSummary.currentRank, upgTargetRank]);

  const predictions = useMemo(
    () => predictNextPlacements(sandboxState, safeSelectedMainId, viewRank),
    [sandboxState, safeSelectedMainId, viewRank]
  );

  const activeRankMap = useMemo(
    () => sandboxState.ranks.get(viewRank) || new Map<number, SimRawNode>(),
    [sandboxState, viewRank]
  );

  const inspectedNode = useMemo(
    () => activeRankMap.get(inspectedNodeId) || activeRankMap.get(focusRootId) || activeRankMap.get(1),
    [activeRankMap, inspectedNodeId, focusRootId]
  );

  // Handlers
  const pushUndoAndSet = (next: SandboxState) => {
    setUndoStack((prev) => [...prev.slice(-24), sandboxState]);
    setSandboxState(next);
  };

  const handleReset = (mode: 'live' | 'fresh' = sourceMode) => {
    setSourceMode(mode);
    setUndoStack([]);
    const fresh =
      mode === 'live' && multiRankSnapshots.size > 0
        ? createSandboxStateFromSnapshots(multiRankSnapshots, perIdReportsMap)
        : createFreshSandboxState();
    setSandboxState(fresh);
    setFocusRootId(1);
    setInspectedNodeId(1);
    setSelectedMainId(1);
    setRegSponsorId(1);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setSandboxState(prev);
  };

  const handleSimRegister = () => {
    const { nextState, createdMainIds } = sandboxRegisterR1(sandboxState, regSponsorId, regCount);
    pushUndoAndSet(nextState);
    if (createdMainIds.length > 0) {
      setViewRank(1);
      setInspectedNodeId(createdMainIds[createdMainIds.length - 1]);
    }
  };

  const handleSimUpgrade = (targetRankOverride?: number) => {
    const targetR = targetRankOverride ?? upgTargetRank;
    if (selectedSummary.currentRank >= 18) return;
    const nextState = sandboxUpgradeRank(sandboxState, safeSelectedMainId, targetR);
    pushUndoAndSet(nextState);
    const landedId = getNodeInRankForMain(nextState, safeSelectedMainId, Math.min(18, targetR));
    setViewRank(Math.min(18, targetR));
    setFocusRootId(1);
    if (landedId > 0) setInspectedNodeId(landedId);
  };

  const handleSimForcePools = () => {
    const nextState = sandboxProcessPoolsForMain(sandboxState, safeSelectedMainId);
    pushUndoAndSet(nextState);
  };

  const handleRunDemoScenario = () => {
    const base =
      sourceMode === 'fresh' ? createFreshSandboxState() : sandboxState;
    const { nextState, focusMainId } = sandboxRunDemoScenario(base);
    pushUndoAndSet(nextState);
    setSelectedMainId(focusMainId);
    setViewRank(1);
    setFocusRootId(1);
    setInspectedNodeId(focusMainId);
  };

  // Build Binary Tree Layout + Ghost Predictions for viewRank
  const treeLayout = useMemo(() => {
    const rootId = activeRankMap.has(focusRootId) ? focusRootId : 1;
    const rootNode = activeRankMap.get(rootId);
    if (!rootNode) {
      return { items: [] as TreeRenderItem[], width: 640, height: 320 };
    }

    // Collect predictions matching viewRank
    const ghostAtSlot = new Map<string, PlacementPrediction[]>();
    if (showGhostPredictions) {
      for (const pred of predictions) {
        if (pred.rank !== viewRank) continue;
        const slotKey = `${pred.parentId}:${pred.side}`;
        const list = ghostAtSlot.get(slotKey) || [];
        list.push(pred);
        ghostAtSlot.set(slotKey, list);
      }
    }

    interface TempLayoutNode {
      key: string;
      isGhost: boolean;
      node?: SimRawNode;
      prediction?: PlacementPrediction;
      parentId: number;
      side: 'LEFT' | 'RIGHT';
      depth: number;
      left?: TempLayoutNode;
      right?: TempLayoutNode;
      xIndex: number;
    }

    const visited = new Set<number>();
    const buildNode = (nodeId: number, depth: number, parentId: number, side: 'LEFT' | 'RIGHT'): TempLayoutNode | null => {
      if (depth > maxDepth || visited.has(nodeId)) return null;
      const n = activeRankMap.get(nodeId);
      if (!n) return null;
      visited.add(nodeId);

      const tNode: TempLayoutNode = {
        key: `node-${nodeId}`,
        isGhost: false,
        node: n,
        parentId,
        side,
        depth,
        xIndex: 0,
      };

      if (depth < maxDepth) {
        if (n.leftChild > 0 && activeRankMap.has(n.leftChild)) {
          tNode.left = buildNode(n.leftChild, depth + 1, nodeId, 'LEFT') || undefined;
        } else {
          const leftGhosts = ghostAtSlot.get(`${nodeId}:LEFT`);
          if (leftGhosts && leftGhosts.length > 0) {
            tNode.left = {
              key: `ghost-${nodeId}-LEFT`,
              isGhost: true,
              prediction: leftGhosts[0],
              parentId: nodeId,
              side: 'LEFT',
              depth: depth + 1,
              xIndex: 0,
            };
          }
        }

        if (n.rightChild > 0 && activeRankMap.has(n.rightChild)) {
          tNode.right = buildNode(n.rightChild, depth + 1, nodeId, 'RIGHT') || undefined;
        } else {
          const rightGhosts = ghostAtSlot.get(`${nodeId}:RIGHT`);
          if (rightGhosts && rightGhosts.length > 0) {
            tNode.right = {
              key: `ghost-${nodeId}-RIGHT`,
              isGhost: true,
              prediction: rightGhosts[0],
              parentId: nodeId,
              side: 'RIGHT',
              depth: depth + 1,
              xIndex: 0,
            };
          }
        }
      }

      return tNode;
    };

    const rootTemp = buildNode(rootId, 0, rootNode.parentId, 'LEFT');
    if (!rootTemp) {
      return { items: [] as TreeRenderItem[], width: 640, height: 320 };
    }

    // In-order leaf spacing for clean balanced binary tree layout without overlap
    let leafCounter = 0;
    let maxSeenDepth = 0;
    const assignX = (t: TempLayoutNode): number => {
      maxSeenDepth = Math.max(maxSeenDepth, t.depth);
      if (!t.left && !t.right) {
        t.xIndex = leafCounter++;
        return t.xIndex;
      }
      const lx = t.left ? assignX(t.left) : null;
      const rx = t.right ? assignX(t.right) : null;
      if (lx !== null && rx !== null) {
        t.xIndex = (lx + rx) / 2;
      } else if (lx !== null) {
        t.xIndex = lx + 0.35;
        if (leafCounter <= lx + 1) leafCounter = Math.ceil(lx + 1);
      } else if (rx !== null) {
        t.xIndex = Math.max(0, rx - 0.35);
      }
      return t.xIndex;
    };
    assignX(rootTemp);

    const padX = 48;
    const padY = 24;
    const items: TreeRenderItem[] = [];

    const collect = (t: TempLayoutNode, parentX?: number, parentY?: number) => {
      const x = padX + t.xIndex * LEAF_X_GAP;
      const y = padY + t.depth * LEVEL_Y_GAP;
      items.push({
        key: t.key,
        isGhost: t.isGhost,
        node: t.node,
        prediction: t.prediction,
        parentId: t.parentId,
        side: t.side,
        depth: t.depth,
        x,
        y,
        parentX,
        parentY,
      });
      if (t.left) collect(t.left, x, y);
      if (t.right) collect(t.right, x, y);
    };
    collect(rootTemp);

    const maxX = items.reduce((m, i) => Math.max(m, i.x), 0);
    return {
      items,
      width: Math.max(640, maxX + NODE_W + padX * 2),
      height: Math.max(300, (maxSeenDepth + 1) * LEVEL_Y_GAP + padY * 2),
    };
  }, [activeRankMap, focusRootId, maxDepth, predictions, showGhostPredictions, viewRank]);

  const lastSpawnedIdsInView = useMemo(
    () => new Set<number>(sandboxState.lastSpawnedByRank.get(viewRank) || []),
    [sandboxState.lastSpawnedByRank, viewRank]
  );

  // Filtered Simulation Events (newest first)
  const filteredEvents = useMemo(() => {
    const rev = [...sandboxState.events].reverse();
    return rev.filter((ev) => {
      if (eventFilter === 'CLONE') return ev.type === 'CLONE';
      if (eventFilter === 'AUTO_ID') return ev.type === 'AUTO_ID';
      if (eventFilter === 'EXTRA_ID') return ev.type === 'EXTRA_ID' || ev.type === 'EXTRA_LEFT_BONUS';
      if (eventFilter === 'MAIN') return ev.type === 'REGISTER' || ev.type === 'UPGRADE' || ev.type === 'AUTO_UPGRADE';
      return true;
    });
  }, [sandboxState.events, eventFilter]);

  const eventCounts = useMemo(() => {
    let clone = 0;
    let autoId = 0;
    let extraId = 0;
    let main = 0;
    for (const ev of sandboxState.events) {
      if (ev.type === 'CLONE') clone++;
      else if (ev.type === 'AUTO_ID') autoId++;
      else if (ev.type === 'EXTRA_ID') extraId++;
      else if (ev.type === 'REGISTER' || ev.type === 'UPGRADE' || ev.type === 'AUTO_UPGRADE') main++;
    }
    return { all: sandboxState.events.length, clone, autoId, extraId, main };
  }, [sandboxState.events]);

  const jumpToRankAndNode = (rank: number, parentOrTargetId: number) => {
    setViewRank(rank);
    setFocusRootId(1);
    setInspectedNodeId(parentOrTargetId);
  };

  const getPredLabel = (p: PlacementPrediction) => {
    if (p.kind === 'CLONE') return `โคลนรอบ ${p.roundNumber || 1}`;
    if (p.kind === 'AUTO_ID') return 'Auto ID (R1)';
    if (p.kind === 'EXTRA_ID') return `Extra ID (R${p.rank})`;
    if (p.kind === 'UPGRADE') return `อัปเกรด R${p.rank}`;
    return 'สมัครใหม่ R1';
  };

  return (
    <div className="space-y-3">
      {/* Top Simulation Control Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {isTh
                  ? 'โหมดจำลองผัง & พยากรณ์ตำแหน่ง (Clone · Auto ID · Auto Extra ID)'
                  : 'Matrix Sandbox & Placement Predictor'}
              </h3>
              <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                Off-Chain · 0 Gas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isTh
                ? 'ทดลองสมัคร อัปเกรด และดูตำแหน่งลงของโคลนนิ่ง รหัส Auto ID และ Extra ID บนผังไบนารี่โดยไม่ส่งธุรกรรมจริงบนบล็อกเชน'
                : 'Simulate registrations, rank upgrades, and preview exact Clone / Auto ID / Extra ID tree placements without spending gas.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Snapshot vs Clean #1 Source */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => handleReset('live')}
                className={`px-2.5 py-1 rounded-md font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceMode === 'live'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isTh ? 'จากผังจริงปัจจุบัน' : 'Live Snapshot'}
              </button>
              <button
                type="button"
                onClick={() => handleReset('fresh')}
                className={`px-2.5 py-1 rounded-md font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceMode === 'fresh'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isTh ? 'เริ่มจากศูนย์ (#1)' : 'Fresh #1'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleRunDemoScenario}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer"
              title="จำลองสมัคร 4 รหัส + อัปเกรดถึง Rank 6 เพื่อดูการเกิด Clone, Auto ID และ Extra ID ทันที"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isTh ? 'รันตัวอย่างครบชุด' : 'Run Full Demo'}</span>
            </button>

            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{isTh ? 'ย้อนกลับ' : 'Undo'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleReset(sourceMode)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isTh ? 'รีเซ็ต' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* Rank 1-18 Selector Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 matrix-scroll-container">
          {RANK_PRICES_USDT.map((price, idx) => {
            const r = idx + 1;
            const count = sandboxState.ranks.get(r)?.size || 0;
            const spawnedCount = sandboxState.lastSpawnedByRank.get(r)?.length || 0;
            const isSelected = viewRank === r;
            return (
              <button
                key={`sb-rank-${r}`}
                type="button"
                onClick={() => {
                  setViewRank(r);
                  setFocusRootId(1);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums whitespace-nowrap shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 font-bold'
                    : spawnedCount > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-200 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>R{r}</span>
                <span className="opacity-80 text-[11px]">({count})</span>
                {spawnedCount > 0 && !isSelected && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    +{spawnedCount}
                  </span>
                )}
                <span className="text-[10px] opacity-65">{price}U</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-Zone Sandbox Layout: Left Interactive Tree Stage (~65%) + Right Control & Radar Deck (~35%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        {/* LEFT ZONE: Interactive Simulated Binary Tree Canvas */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
          {/* Canvas Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                Rank {viewRank} ({RANK_PRICES_USDT[viewRank - 1]} USDT) · {activeRankMap.size} โหนด
              </span>
              {focusRootId > 1 && (
                <button
                  type="button"
                  onClick={() => setFocusRootId(1)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  กลับ Root #1
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGhostPredictions((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition ${
                  showGhostPredictions
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-500/50 text-cyan-800 dark:text-cyan-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>{showGhostPredictions ? 'แสดงช่องถัดไปบนผัง: เปิด' : 'แสดงช่องถัดไปบนผัง: ปิด'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-200"
              >
                <option value={4}>ลึก 4 ชั้น</option>
                <option value={5}>ลึก 5 ชั้น</option>
                <option value={6}>ลึก 6 ชั้น</option>
                <option value={8}>ลึก 8 ชั้น</option>
              </select>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                title="ย่อผัง"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.35, Number((z + 0.1).toFixed(2))))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                title="ขยายผัง"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive SVG + HTML Tree Viewport */}
          <div className="w-full h-[460px] overflow-auto rounded-xl bg-slate-50/80 dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800 matrix-scroll-container relative">
            <div
              style={{
                width: treeLayout.width * zoom,
                height: treeLayout.height * zoom,
                minWidth: '100%',
              }}
              className="relative"
            >
              <div
                style={{
                  width: treeLayout.width,
                  height: treeLayout.height,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
                className="relative"
              >
                {/* Connector Lines */}
                <svg
                  width={treeLayout.width}
                  height={treeLayout.height}
                  className="absolute inset-0 pointer-events-none"
                >
                  {treeLayout.items.map((item) => {
                    if (item.parentX === undefined || item.parentY === undefined) return null;
                    const x1 = item.parentX + NODE_W / 2;
                    const y1 = item.parentY + NODE_H;
                    const x2 = item.x + NODE_W / 2;
                    const y2 = item.y;
                    const midY = (y1 + y2) / 2;
                    const strokeColor = item.isGhost
                      ? '#06b6d4'
                      : item.side === 'LEFT'
                      ? '#3b82f6'
                      : '#10b981';

                    return (
                      <g key={`edge-${item.key}`}>
                        <path
                          d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={item.isGhost ? 1.8 : 2}
                          strokeDasharray={item.isGhost ? '5 4' : undefined}
                          opacity={item.isGhost ? 0.85 : 0.55}
                        />
                        <text
                          x={(x1 + x2) / 2}
                          y={midY - 3}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill={strokeColor}
                        >
                          {item.side === 'LEFT' ? 'L' : 'R'}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Real & Ghost Nodes */}
                {treeLayout.items.map((item) => {
                  if (item.isGhost && item.prediction) {
                    const pred = item.prediction;
                    return (
                      <div
                        key={item.key}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: NODE_W,
                          height: NODE_H,
                        }}
                        className="absolute rounded-xl border-2 border-dashed border-cyan-500 dark:border-cyan-400 bg-cyan-50/90 dark:bg-cyan-950/80 p-1.5 flex flex-col justify-between shadow-sm"
                        title={pred.detailTh}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-cyan-800 dark:text-cyan-200">
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <Target className="w-3 h-3 shrink-0" />
                            <span>{getPredLabel(pred)}</span>
                          </span>
                          <span className="font-mono">{item.side === 'LEFT' ? 'L' : 'R'}</span>
                        </div>
                        <div className="text-[10px] font-mono text-cyan-900 dark:text-cyan-100 truncate">
                          ใต้ #{item.parentId} ({item.side === 'LEFT' ? 'ซ้าย' : 'ขวา'})
                        </div>
                        <div className="text-[9.5px] font-semibold text-cyan-700 dark:text-cyan-300 truncate">
                          {pred.ready ? 'พร้อมลงช่องนี้' : `สะสม ${pred.poolCurrentUsdt.toFixed(1)}/${pred.poolTargetUsdt}U`}
                        </div>
                      </div>
                    );
                  }

                  const n = item.node!;
                  const isInspected = inspectedNode?.id === n.id;
                  const isJustSpawned = lastSpawnedIdsInView.has(n.id);
                  const r1Main = resolveR1MainForSandboxNode(sandboxState, viewRank, n.id);
                  const isAuto = !n.isClone && !n.isExtraId && n.originType === 'AUTO_NEW_MAIN';

                  const styleMeta = n.isClone
                    ? {
                        tag: 'CLONE',
                        Icon: Dna,
                        box: 'bg-emerald-50 dark:bg-emerald-950/75 border-emerald-400 dark:border-emerald-500/70 text-emerald-950 dark:text-emerald-100',
                        tagCls: 'text-emerald-700 dark:text-emerald-300',
                      }
                    : n.isExtraId
                    ? {
                        tag: 'EXTRA',
                        Icon: Zap,
                        box: 'bg-rose-50 dark:bg-rose-950/75 border-rose-400 dark:border-rose-500/70 text-rose-950 dark:text-rose-100',
                        tagCls: 'text-rose-700 dark:text-rose-300',
                      }
                    : isAuto
                    ? {
                        tag: 'AUTO',
                        Icon: Bot,
                        box: 'bg-amber-50 dark:bg-amber-950/75 border-amber-400 dark:border-amber-500/70 text-amber-950 dark:text-amber-100',
                        tagCls: 'text-amber-700 dark:text-amber-300',
                      }
                    : {
                        tag: 'MAIN',
                        Icon: Crown,
                        box: 'bg-white dark:bg-slate-900 border-blue-300 dark:border-sky-500/60 text-slate-900 dark:text-slate-100',
                        tagCls: 'text-blue-700 dark:text-sky-300',
                      };
                  const TypeIcon = styleMeta.Icon;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setInspectedNodeId(n.id);
                        if (r1Main > 0) setSelectedMainId(r1Main);
                      }}
                      onDoubleClick={() => setFocusRootId(n.id)}
                      style={{
                        left: item.x,
                        top: item.y,
                        width: NODE_W,
                        height: NODE_H,
                      }}
                      className={`absolute rounded-xl border p-1.5 text-left flex flex-col justify-between transition cursor-pointer ${
                        styleMeta.box
                      } ${
                        isInspected
                          ? 'ring-2 ring-blue-600 dark:ring-cyan-400 shadow-md'
                          : isJustSpawned
                          ? 'ring-2 ring-emerald-500 shadow-sm'
                          : 'hover:brightness-95 dark:hover:brightness-110'
                      }`}
                      title={`คลิกเพื่อดูรายละเอียด | ดับเบิลคลิกเพื่อโฟกัสใต้ R${viewRank}-#${n.id}`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                        <span className={`inline-flex items-center gap-0.5 ${styleMeta.tagCls}`}>
                          <TypeIcon className="w-3 h-3 shrink-0" />
                          <span>{styleMeta.tag}</span>
                        </span>
                        <span className="font-mono tabular-nums font-extrabold">
                          #{n.id}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono tabular-nums opacity-85">
                        <span className="truncate">
                          {n.isClone || n.isExtraId || isAuto ? `ของ #${r1Main}` : `SP #${n.directSponsorNodeId || 1}`}
                        </span>
                        {n.nodeVault > 0 && (
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            {n.nodeVault.toFixed(1)}U
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9.5px] font-mono tabular-nums opacity-75">
                        <span>L:{n.leftChild > 0 ? `#${n.leftChild}` : 'ว่าง'}</span>
                        <span>R:{n.rightChild > 0 ? `#${n.rightChild}` : 'ว่าง'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inspected Node Footer Strip */}
          {inspectedNode && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  กำลังดู: R{viewRank}-#{inspectedNode.id}
                </span>
                <span>·</span>
                <span>
                  ประเภท:{' '}
                  <strong>
                    {inspectedNode.isClone
                      ? 'CLONE'
                      : inspectedNode.isExtraId
                      ? 'EXTRA ID'
                      : inspectedNode.originType === 'AUTO_NEW_MAIN'
                      ? 'AUTO ID'
                      : 'MAIN ID'}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Parent: {inspectedNode.parentId > 0 ? `#${inspectedNode.parentId}` : 'Root'}
                </span>
                <span>·</span>
                <span>
                  L: {inspectedNode.leftChild > 0 ? `#${inspectedNode.leftChild}` : 'ว่าง'} / R:{' '}
                  {inspectedNode.rightChild > 0 ? `#${inspectedNode.rightChild}` : 'ว่าง'}
                </span>
                <span>·</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                  Vault: {inspectedNode.nodeVault.toFixed(2)} U
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-sans">
                {focusRootId !== inspectedNode.id && (
                  <button
                    type="button"
                    onClick={() => setFocusRootId(inspectedNode.id)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>โฟกัสใต้โหนดนี้</span>
                  </button>
                )}
                {!inspectedNode.isClone && !inspectedNode.isExtraId && viewRank === 1 && (
                  <button
                    type="button"
                    onClick={() => setRegSponsorId(inspectedNode.id)}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ตั้งเป็นผู้แนะนำจำลอง (#{inspectedNode.id})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT ZONE: Control & Telemetry Deck */}
        <div className="xl:col-span-4 space-y-3">
          {/* Card 1: Next Placement Radar for Selected Main ID */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <Target className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>เรดาร์ตำแหน่งถัดไป (Next Slot)</span>
              </div>
              <select
                value={safeSelectedMainId}
                onChange={(e) => setSelectedMainId(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-blue-700 dark:text-sky-300"
              >
                {availableMainIds.map((mId) => (
                  <option key={`sel-m-${mId}`} value={mId}>
                    Main #{mId} (R{getMainIdCurrentRankInSandbox(sandboxState, mId)})
                  </option>
                ))}
              </select>
            </div>

            {/* 3 Pools Summary Strip */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[11px]">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                  Upgrade R{selectedSummary.window5[0]}–{selectedSummary.window5[1]}
                </div>
                <div className="font-bold text-emerald-700 dark:text-emerald-400">
                  {selectedSummary.upgradePoolUsdt.toFixed(2)} U
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                  Auto Pool (R1–3)
                </div>
                <div className="font-bold text-amber-700 dark:text-amber-300">
                  {selectedSummary.autoPoolUsdt.toFixed(2)} U
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                  Extra Pool
                </div>
                <div className="font-bold text-rose-700 dark:text-rose-300">
                  {selectedSummary.extraPoolUsdt.toFixed(2)} U
                </div>
              </div>
            </div>

            {/* Predictions List */}
            <div className="space-y-1.5">
              {predictions.map((pred) => {
                const IconComp =
                  pred.kind === 'CLONE'
                    ? Dna
                    : pred.kind === 'AUTO_ID'
                    ? Bot
                    : pred.kind === 'EXTRA_ID'
                    ? Zap
                    : pred.kind === 'UPGRADE'
                    ? Layers
                    : UserPlus;

                return (
                  <button
                    key={`pred-${pred.kind}-${pred.rank}`}
                    type="button"
                    onClick={() => {
                      setShowGhostPredictions(true);
                      jumpToRankAndNode(pred.rank, pred.parentId);
                    }}
                    className="w-full p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-950/70 dark:hover:bg-slate-800/80 text-left transition flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        <IconComp className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <span>{getPredLabel(pred)}</span>
                        <span className="font-mono text-[11px] text-cyan-700 dark:text-cyan-300">
                          → R{pred.rank}-#{pred.parentId} ({pred.side === 'LEFT' ? 'ซ้าย' : 'ขวา'})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        {isTh ? pred.detailTh : pred.detailEn}
                      </p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 2: Interactive Action Deck */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <span>สั่งจำลองเหตุการณ์ (Step-by-Step)</span>
              </span>
              {sandboxState.lastActionEstGasUnits > 0 && (
                <span className="font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                  เทียบเชน ~{(sandboxState.lastActionEstGasUnits / 1000).toFixed(0)}k gas
                </span>
              )}
            </div>

            {/* Action A: Register R1 */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                1. จำลองสมัครสมาชิกใหม่ (Rank 1)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] text-slate-500 dark:text-slate-400 mb-0.5">
                    ผู้แนะนำ (Sponsor Main ID)
                  </label>
                  <select
                    value={regSponsorId}
                    onChange={(e) => setRegSponsorId(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono"
                  >
                    {availableMainIds.map((mId) => (
                      <option key={`reg-sp-${mId}`} value={mId}>
                        Main #{mId}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] text-slate-500 dark:text-slate-400 mb-0.5">
                    จำนวนรหัส ({regCount * (RANK_PRICES_USDT[0] || 5)} U)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={regCount}
                    onChange={(e) => setRegCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSimRegister}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>จำลองสมัคร {regCount} รหัสใต้ #{regSponsorId}</span>
              </button>
            </div>

            {/* Action B: Upgrade Rank */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span>2. จำลองอัปเกรด Rank (Main #{safeSelectedMainId})</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  ปัจจุบัน R{selectedSummary.currentRank}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={upgTargetRank}
                  disabled={selectedSummary.currentRank >= 18}
                  onChange={(e) => setUpgTargetRank(Number(e.target.value))}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono disabled:opacity-50"
                >
                  {RANK_PRICES_USDT.map((p, idx) => {
                    const r = idx + 1;
                    if (r <= selectedSummary.currentRank) return null;
                    return (
                      <option key={`upg-r-${r}`} value={r}>
                        ไป Rank {r} ({p} U)
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  disabled={selectedSummary.currentRank >= 18}
                  onClick={() => handleSimUpgrade()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed transition"
                >
                  จำลองอัปเกรด
                </button>
                <button
                  type="button"
                  disabled={selectedSummary.currentRank >= 18}
                  onClick={() => handleSimUpgrade(selectedSummary.currentRank + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed transition"
                >
                  +1 R
                </button>
              </div>
            </div>

            {/* Action C: Force Check Pools */}
            <button
              type="button"
              onClick={handleSimForcePools}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>จำลองเช็กแตก Auto ID / Extra ID ของ #{safeSelectedMainId}</span>
            </button>
          </div>

          {/* Card 3: Simulation Event Log */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                บันทึกการลงตำแหน่งจำลอง ({sandboxState.events.length})
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {[
                { key: 'ALL' as const, label: `ทั้งหมด (${eventCounts.all})` },
                { key: 'CLONE' as const, label: `Clone (${eventCounts.clone})` },
                { key: 'AUTO_ID' as const, label: `Auto ID (${eventCounts.autoId})` },
                { key: 'EXTRA_ID' as const, label: `Extra ID (${eventCounts.extraId})` },
                { key: 'MAIN' as const, label: `หลัก/อัป (${eventCounts.main})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setEventFilter(f.key)}
                  className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap shrink-0 cursor-pointer transition ${
                    eventFilter === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 matrix-scroll-container pr-1">
              {filteredEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  กดปุ่ม &quot;รันตัวอย่างครบชุด&quot; หรือทดลองสมัคร/อัปเกรดด้านบนเพื่อดูตำแหน่งลงแบบ Step-by-Step
                </div>
              ) : (
                filteredEvents.slice(0, 80).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => jumpToRankAndNode(ev.rank, ev.nodeId)}
                    className="w-full p-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800/80 border border-slate-200/70 dark:border-slate-800 text-left transition cursor-pointer space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white">
                        #{ev.stepNo} · {ev.type} · R{ev.rank}-#{ev.nodeId}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        ใต้ #{ev.parentId} ({ev.side === 'LEFT' ? 'ซ้าย' : 'ขวา'})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                      {isTh ? ev.summaryTh : ev.summaryEn}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
