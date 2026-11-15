import { RANK_PRICES_USDT } from '../contracts/config';
import type { SimRawNode } from '../components/ExtraIdPathCalculator';

export type SandboxEventType =
  | 'REGISTER'
  | 'UPGRADE'
  | 'CLONE'
  | 'AUTO_ID'
  | 'EXTRA_ID'
  | 'VAULT_GAIN'
  | 'EXTRA_LEFT_BONUS'
  | 'AUTO_UPGRADE';

export interface SandboxEventLog {
  id: string;
  stepNo: number;
  actionNo: number;
  type: SandboxEventType;
  rank: number;
  nodeId: number;
  ownerMainId: number;
  parentId: number;
  side: 'LEFT' | 'RIGHT';
  amountUsdt?: number;
  roundNumber?: number;
  summaryTh: string;
  summaryEn: string;
}

export interface SandboxState {
  ranks: Map<number, Map<number, SimRawNode>>;
  extraLeftBonusByMain: Map<number, number>;
  events: SandboxEventLog[];
  actionCount: number;
  lastSpawnedByRank: Map<number, number[]>;
  lastActionEstGasUnits: number;
}

export interface PlacementPrediction {
  kind: 'REGISTER_R1' | 'CLONE' | 'AUTO_ID' | 'EXTRA_ID' | 'UPGRADE';
  rank: number;
  parentId: number;
  side: 'LEFT' | 'RIGHT';
  ready: boolean;
  poolCurrentUsdt: number;
  poolTargetUsdt: number;
  roundNumber?: number;
  detailTh: string;
  detailEn: string;
}

export interface MainIdSandboxSummary {
  mainId: number;
  owner: string;
  currentRank: number;
  window5: [number, number];
  upgradePoolUsdt: number;
  autoPoolUsdt: number;
  extraPoolUsdt: number;
  extraLeftBonusUsdt: number;
  nextRankPriceUsdt: number;
  r1ClonesSpawned: number;
  nextCloneRoundInViewRank: number;
  clonesSpawnedInViewRank: number;
}

const ROOT_FALLBACK_OWNER = '0x622E20082e63c7220c5AF0A77Cbc437a98505311';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getSandboxFiveRankWindow(currentRank: number): [number, number] {
  if (currentRank <= 0) return [1, 1];
  const start = currentRank >= 5 ? currentRank - 4 : 1;
  return [start, Math.min(18, currentRank)];
}

export function cloneSandboxState(src: SandboxState): SandboxState {
  const ranks = new Map<number, Map<number, SimRawNode>>();
  for (let r = 1; r <= 18; r++) {
    const m = new Map<number, SimRawNode>();
    const srcM = src.ranks.get(r);
    if (srcM) {
      for (const [k, v] of srcM.entries()) {
        m.set(k, { ...v });
      }
    }
    ranks.set(r, m);
  }
  const extraLeftBonusByMain = new Map<number, number>(src.extraLeftBonusByMain);
  const lastSpawnedByRank = new Map<number, number[]>();
  for (const [k, arr] of src.lastSpawnedByRank.entries()) {
    lastSpawnedByRank.set(k, [...arr]);
  }
  return {
    ranks,
    extraLeftBonusByMain,
    events: [...src.events],
    actionCount: src.actionCount,
    lastSpawnedByRank,
    lastActionEstGasUnits: src.lastActionEstGasUnits,
  };
}

export function createFreshSandboxState(rootOwner: string = ROOT_FALLBACK_OWNER): SandboxState {
  const ranks = new Map<number, Map<number, SimRawNode>>();
  for (let r = 1; r <= 18; r++) {
    const m = new Map<number, SimRawNode>();
    m.set(1, {
      id: 1,
      rank: r,
      owner: rootOwner,
      parentId: 0,
      leftChild: 0,
      rightChild: 0,
      isClone: false,
      isExtraId: false,
      directSponsor: ZERO_ADDRESS,
      originMainId: 1,
      directSponsorNodeId: 1,
      cloneRound: 0,
      totalClonesSpawned: 0,
      nodeVault: 0,
      originType: 'MANUAL_REGISTER',
    });
    ranks.set(r, m);
  }
  return {
    ranks,
    extraLeftBonusByMain: new Map<number, number>(),
    events: [],
    actionCount: 0,
    lastSpawnedByRank: new Map<number, number[]>(),
    lastActionEstGasUnits: 0,
  };
}

export function createSandboxStateFromSnapshots(
  multiRankSnapshots: Map<number, Map<number, SimRawNode>>,
  perIdReportsMap?: Map<number, any>
): SandboxState {
  if (!multiRankSnapshots || multiRankSnapshots.size === 0) {
    return createFreshSandboxState();
  }

  const ranks = new Map<number, Map<number, SimRawNode>>();
  const r1Source = multiRankSnapshots.get(1);
  const rootOwner = r1Source?.get(1)?.owner || ROOT_FALLBACK_OWNER;

  for (let r = 1; r <= 18; r++) {
    const srcM = multiRankSnapshots.get(r);
    const m = new Map<number, SimRawNode>();
    if (srcM && srcM.size > 0) {
      for (const [k, v] of srcM.entries()) {
        m.set(k, { ...v });
      }
    } else {
      m.set(1, {
        id: 1,
        rank: r,
        owner: rootOwner,
        parentId: 0,
        leftChild: 0,
        rightChild: 0,
        isClone: false,
        isExtraId: false,
        directSponsor: ZERO_ADDRESS,
        originMainId: 1,
        directSponsorNodeId: 1,
        cloneRound: 0,
        totalClonesSpawned: 0,
        nodeVault: 0,
        originType: 'MANUAL_REGISTER',
      });
    }
    ranks.set(r, m);
  }

  // Initialize totalClonesSpawned accurately on non-clone nodes
  for (let r = 1; r <= 18; r++) {
    const snapR = ranks.get(r)!;
    for (const n of snapR.values()) {
      if (n.isClone) continue;
      if (typeof n.totalClonesSpawned === 'number' && n.totalClonesSpawned > 0) continue;
      const r1MainTag = n.originMainId > 0 ? n.originMainId : n.id;
      let cloneCnt = 0;
      for (const c of snapR.values()) {
        if (!c.isClone) continue;
        if (n.isExtraId) {
          if (c.originMainId === n.id && c.owner.toLowerCase() === n.owner.toLowerCase()) {
            cloneCnt++;
          }
        } else {
          if (
            (c.originMainId === n.id || c.originMainId === r1MainTag) &&
            c.owner.toLowerCase() === n.owner.toLowerCase()
          ) {
            cloneCnt++;
          }
        }
      }
      n.totalClonesSpawned = cloneCnt;
    }
  }

  const r1Map = ranks.get(1)!;
  const extraLeftBonusByMain = new Map<number, number>();

  for (let r = 18; r >= 1; r--) {
    const snapR = ranks.get(r)!;
    const price = RANK_PRICES_USDT[r - 1] || 10;
    for (const sn of snapR.values()) {
      const originNode = !sn.isClone
        ? sn
        : Array.from(snapR.values()).find(
            (x) => !x.isClone && x.owner.toLowerCase() === sn.owner.toLowerCase() && x.id === sn.originMainId
          ) || sn;
      const isExtraLineage = !sn.isClone ? sn.isExtraId : sn.isExtraId || originNode.isExtraId;
      if (isExtraLineage && sn.leftChild > 0) {
        const spMain = originNode.directSponsorNodeId > 0 ? originNode.directSponsorNodeId : 1;
        extraLeftBonusByMain.set(
          spMain,
          Number(((extraLeftBonusByMain.get(spMain) || 0) + price * 0.35).toFixed(4))
        );
      }
    }
  }

  for (const r1Node of r1Map.values()) {
    if (r1Node.isClone || r1Node.isExtraId) continue;
    const rep = perIdReportsMap?.get(r1Node.id);
    if (rep && typeof rep.extraLeftVaultBonus === 'number') {
      extraLeftBonusByMain.set(r1Node.id, Number(rep.extraLeftVaultBonus.toFixed(4)));
    }
  }

  return {
    ranks,
    extraLeftBonusByMain,
    events: [],
    actionCount: 0,
    lastSpawnedByRank: new Map<number, number[]>(),
    lastActionEstGasUnits: 0,
  };
}

// --- Core Contract-Aligned Lookup Helpers ---

export function getNodeInRankForMain(
  state: SandboxState,
  r1MainId: number,
  rank: number
): number {
  const r1Map = state.ranks.get(1);
  if (!r1Map) return 0;
  if (rank === 1) return r1Map.has(r1MainId) ? r1MainId : 0;
  const snapR = state.ranks.get(rank);
  if (!snapR) return 0;
  for (const n of snapR.values()) {
    if (!n.isClone && !n.isExtraId && n.originMainId === r1MainId) {
      return n.id;
    }
  }
  const r1Node = r1Map.get(r1MainId);
  if (!r1Node) return 0;
  const ownerLow = r1Node.owner.toLowerCase();
  const r1MainsOfOwner = Array.from(r1Map.values())
    .filter((x) => !x.isClone && !x.isExtraId && x.owner.toLowerCase() === ownerLow)
    .sort((a, b) => a.id - b.id);
  const idx = r1MainsOfOwner.findIndex((x) => x.id === r1MainId);
  if (idx < 0) return 0;
  const rMainsOfOwner = Array.from(snapR.values())
    .filter((x) => !x.isClone && !x.isExtraId && x.owner.toLowerCase() === ownerLow)
    .sort((a, b) => a.id - b.id);
  return idx < rMainsOfOwner.length ? rMainsOfOwner[idx].id : 0;
}

export function resolveR1MainForSandboxNode(
  state: SandboxState,
  rank: number,
  nodeId: number
): number {
  const r1Map = state.ranks.get(1);
  const snapR = state.ranks.get(rank);
  const n = snapR?.get(nodeId);
  if (!n) return 1;
  if (rank === 1 && !n.isClone && !n.isExtraId) return n.id;
  if (n.isExtraId) {
    return n.directSponsorNodeId > 0 ? n.directSponsorNodeId : 1;
  }
  if (n.isClone && n.originMainId > 0 && snapR?.has(n.originMainId)) {
    const localOrig = snapR.get(n.originMainId)!;
    if (!localOrig.isClone && localOrig.isExtraId && localOrig.owner.toLowerCase() === n.owner.toLowerCase()) {
      return localOrig.directSponsorNodeId > 0 ? localOrig.directSponsorNodeId : 1;
    }
  }
  const orig = n.originMainId > 0 ? n.originMainId : n.id;
  if (rank === 1) return orig;
  if (r1Map?.has(orig) && !r1Map.get(orig)!.isClone) {
    if (r1Map.get(orig)!.owner.toLowerCase() === n.owner.toLowerCase()) return orig;
  }
  const ownerLow = n.owner.toLowerCase();
  const rMains = Array.from(snapR!.values())
    .filter((x) => !x.isClone && !x.isExtraId && x.owner.toLowerCase() === ownerLow)
    .sort((a, b) => a.id - b.id);
  const idx = rMains.findIndex((x) => x.id === orig || x.id === n.id);
  const r1Mains = r1Map
    ? Array.from(r1Map.values())
        .filter((x) => !x.isClone && !x.isExtraId && x.owner.toLowerCase() === ownerLow)
        .sort((a, b) => a.id - b.id)
    : [];
  if (idx >= 0 && idx < r1Mains.length) return r1Mains[idx].id;
  return r1Mains[0]?.id || 1;
}

export function getMainIdCurrentRankInSandbox(state: SandboxState, r1MainId: number): number {
  if (r1MainId === 1) return 18;
  let maxR = 1;
  for (let r = 2; r <= 18; r++) {
    if (getNodeInRankForMain(state, r1MainId, r) > 0) {
      maxR = r;
    }
  }
  return maxR;
}

export function calcSandboxPools(state: SandboxState, r1MainId: number) {
  const currentRank = getMainIdCurrentRankInSandbox(state, r1MainId);
  const [w5Start, w5End] = getSandboxFiveRankWindow(currentRank);

  let upgradePoolUsdt = 0;
  if (currentRank < 18) {
    for (let r = w5Start; r <= w5End; r++) {
      const nId = getNodeInRankForMain(state, r1MainId, r);
      if (nId > 0) {
        upgradePoolUsdt = Number((upgradePoolUsdt + (state.ranks.get(r)?.get(nId)?.nodeVault || 0)).toFixed(4));
      }
    }
  }

  let autoPoolUsdt = 0;
  for (let r = 1; r <= 3; r++) {
    if (r < w5Start) {
      const nId = getNodeInRankForMain(state, r1MainId, r);
      if (nId > 0) {
        autoPoolUsdt = Number((autoPoolUsdt + (state.ranks.get(r)?.get(nId)?.nodeVault || 0)).toFixed(4));
      }
    }
  }

  const extraLeftBonusUsdt = state.extraLeftBonusByMain.get(r1MainId) || 0;
  let extraPoolUsdt = extraLeftBonusUsdt;
  for (let r = 4; r <= 18; r++) {
    if (currentRank === 18 || r < w5Start) {
      const nId = getNodeInRankForMain(state, r1MainId, r);
      if (nId > 0) {
        extraPoolUsdt = Number((extraPoolUsdt + (state.ranks.get(r)?.get(nId)?.nodeVault || 0)).toFixed(4));
      }
    }
  }

  return {
    currentRank,
    window5: [w5Start, w5End] as [number, number],
    upgradePoolUsdt,
    autoPoolUsdt,
    extraPoolUsdt,
    extraLeftBonusUsdt,
  };
}

export function getMainIdSandboxSummary(
  state: SandboxState,
  r1MainId: number,
  viewRank: number
): MainIdSandboxSummary {
  const r1Node = state.ranks.get(1)?.get(r1MainId);
  const pools = calcSandboxPools(state, r1MainId);
  const nextRankPriceUsdt = pools.currentRank < 18 ? (RANK_PRICES_USDT[pools.currentRank] || 0) : 0;

  const r1ClonesSpawned = r1Node?.totalClonesSpawned || 0;
  const viewNodeId = getNodeInRankForMain(state, r1MainId, viewRank);
  const viewNode = viewNodeId > 0 ? state.ranks.get(viewRank)?.get(viewNodeId) : undefined;
  const clonesSpawnedInViewRank = viewNode?.totalClonesSpawned || 0;
  const nextCloneRoundInViewRank = (clonesSpawnedInViewRank % 2) + 1;

  return {
    mainId: r1MainId,
    owner: r1Node?.owner || ZERO_ADDRESS,
    ...pools,
    nextRankPriceUsdt,
    r1ClonesSpawned,
    clonesSpawnedInViewRank,
    nextCloneRoundInViewRank,
  };
}

export function findFirstAvailableUnderInState(
  state: SandboxState,
  rank: number,
  startNodeId: number
): { parentId: number; isLeft: boolean } {
  const snapR = state.ranks.get(rank);
  if (!snapR || snapR.size === 0) return { parentId: 1, isLeft: true };
  const rootId = startNodeId > 0 && snapR.has(startNodeId) ? startNodeId : 1;
  const queue: number[] = [rootId];
  const visited = new Set<number>();
  let ops = 0;

  while (queue.length > 0 && ops < 256) {
    ops++;
    const curId = queue.shift()!;
    if (visited.has(curId)) continue;
    visited.add(curId);
    const node = snapR.get(curId);
    if (!node) continue;
    if (node.leftChild === 0) return { parentId: curId, isLeft: true };
    if (node.rightChild === 0) return { parentId: curId, isLeft: false };
    if (node.leftChild > 0) queue.push(node.leftChild);
    if (node.rightChild > 0) queue.push(node.rightChild);
  }

  const sortedIds = Array.from(snapR.keys()).sort((a, b) => a - b);
  for (const id of sortedIds) {
    const n = snapR.get(id)!;
    if (n.leftChild === 0) return { parentId: id, isLeft: true };
    if (n.rightChild === 0) return { parentId: id, isLeft: false };
  }
  return { parentId: rootId, isLeft: true };
}

export function findPlacementSpotInState(
  state: SandboxState,
  rank: number,
  sponsorNodeId: number,
  isExtra: boolean
): { parentId: number; isLeft: boolean } {
  const snapR = state.ranks.get(rank);
  if (!snapR || snapR.size === 0) return { parentId: 1, isLeft: true };

  if (sponsorNodeId <= 0 || !snapR.has(sponsorNodeId)) {
    return findFirstAvailableUnderInState(state, rank, 1);
  }

  let primaryNodeId = sponsorNodeId;
  const rawNode = snapR.get(primaryNodeId)!;
  const originTag = rawNode.originMainId > 0 ? rawNode.originMainId : primaryNodeId;
  if (!isExtra && rank === 1 && snapR.has(originTag)) {
    primaryNodeId = originTag;
  }

  const pNode = snapR.get(primaryNodeId)!;
  if (pNode.leftChild === 0) return { parentId: primaryNodeId, isLeft: true };
  if (pNode.rightChild === 0) return { parentId: primaryNodeId, isLeft: false };

  const sortedIds = Array.from(snapR.keys()).sort((a, b) => a - b);
  for (const id of sortedIds) {
    const c = snapR.get(id)!;
    if (c.isClone && (c.originMainId === originTag || c.originMainId === primaryNodeId)) {
      if (c.leftChild === 0) return { parentId: id, isLeft: true };
      if (c.rightChild === 0) return { parentId: id, isLeft: false };
    }
  }

  return findFirstAvailableUnderInState(state, rank, primaryNodeId);
}

// --- Predictive Radar (Non-Mutating) ---

export function predictNextPlacements(
  state: SandboxState,
  selectedMainId: number,
  viewRank: number
): PlacementPrediction[] {
  const safeMainId = state.ranks.get(1)?.has(selectedMainId) ? selectedMainId : 1;
  const pools = calcSandboxPools(state, safeMainId);
  const r1Price = RANK_PRICES_USDT[0] || 5;
  const predictions: PlacementPrediction[] = [];

  // 1. Next Register in Rank 1 under selectedMainId
  const regSpot = findPlacementSpotInState(state, 1, safeMainId, false);
  predictions.push({
    kind: 'REGISTER_R1',
    rank: 1,
    parentId: regSpot.parentId,
    side: regSpot.isLeft ? 'LEFT' : 'RIGHT',
    ready: true,
    poolCurrentUsdt: 0,
    poolTargetUsdt: r1Price,
    detailTh: `สมัครใหม่ R1 ใต้ #${safeMainId} จะวางที่ R1-#${regSpot.parentId} (${regSpot.isLeft ? 'ซ้าย' : 'ขวา'})`,
    detailEn: `New R1 under #${safeMainId} lands at R1-#${regSpot.parentId} (${regSpot.isLeft ? 'Left' : 'Right'})`,
  });

  // 2. Next Clone in viewRank for selectedMainId
  const nodeInViewId = getNodeInRankForMain(state, safeMainId, viewRank);
  if (nodeInViewId > 0) {
    const viewNode = state.ranks.get(viewRank)!.get(nodeInViewId)!;
    const r1Node = state.ranks.get(1)?.get(safeMainId);
    const cloneCount = viewNode.totalClonesSpawned || 0;
    const roundIdx = cloneCount % 2; // 0 => Round 1, 1 => Round 2
    const roundNum = roundIdx + 1;

    let sponsorInRank = 1;
    if (safeMainId > 1) {
      const r1SpId = r1Node?.directSponsorNodeId || 1;
      sponsorInRank = getNodeInRankForMain(state, r1SpId, viewRank);
    }

    const cloneSpot =
      roundIdx === 0
        ? findPlacementSpotInState(state, viewRank, sponsorInRank, false)
        : findFirstAvailableUnderInState(state, viewRank, 1);

    predictions.push({
      kind: 'CLONE',
      rank: viewRank,
      parentId: cloneSpot.parentId,
      side: cloneSpot.isLeft ? 'LEFT' : 'RIGHT',
      ready: true,
      roundNumber: roundNum,
      poolCurrentUsdt: 0,
      poolTargetUsdt: 0,
      detailTh: `โคลนรอบ ${roundNum} ของ #${safeMainId} ใน R${viewRank} (${roundNum === 1 ? 'ตามสายผู้แนะนำ' : 'BFS จาก #1'}) จะลง R${viewRank}-#${cloneSpot.parentId} (${cloneSpot.isLeft ? 'ซ้าย' : 'ขวา'})`,
      detailEn: `Round ${roundNum} Clone of #${safeMainId} in R${viewRank} (${roundNum === 1 ? 'Sponsor line' : 'Global BFS #1'}) lands at R${viewRank}-#${cloneSpot.parentId} (${cloneSpot.isLeft ? 'Left' : 'Right'})`,
    });
  }

  // 3. Next Auto ID (R1)
  const autoSpot = findPlacementSpotInState(state, 1, safeMainId, false);
  const autoReady = pools.autoPoolUsdt + 1e-6 >= r1Price;
  predictions.push({
    kind: 'AUTO_ID',
    rank: 1,
    parentId: autoSpot.parentId,
    side: autoSpot.isLeft ? 'LEFT' : 'RIGHT',
    ready: autoReady,
    poolCurrentUsdt: pools.autoPoolUsdt,
    poolTargetUsdt: r1Price,
    detailTh: `Auto ID ใหม่ของ #${safeMainId} จะเสียบที่ R1-#${autoSpot.parentId} (${autoSpot.isLeft ? 'ซ้าย' : 'ขวา'})`,
    detailEn: `Auto ID of #${safeMainId} lands at R1-#${autoSpot.parentId} (${autoSpot.isLeft ? 'Left' : 'Right'})`,
  });

  // 4. Next Auto Extra ID (R18 -> R2 priority scan)
  let targetExtraRank = 2;
  let extraReady = false;
  for (let r = 18; r >= 2; r--) {
    const spInR = getNodeInRankForMain(state, safeMainId, r);
    if (spInR <= 0) continue;
    const p = RANK_PRICES_USDT[r - 1] || 10;
    if (pools.extraPoolUsdt + 1e-6 >= p) {
      targetExtraRank = r;
      extraReady = true;
      break;
    }
  }
  if (!extraReady) {
    // Pick highest unlocked rank >= 2, or viewRank if >= 2
    if (viewRank >= 2 && getNodeInRankForMain(state, safeMainId, viewRank) > 0) {
      targetExtraRank = viewRank;
    } else if (pools.currentRank >= 2) {
      targetExtraRank = pools.currentRank;
    }
  }
  const sponsorInExtraRank = getNodeInRankForMain(state, safeMainId, targetExtraRank);
  const extraPrice = RANK_PRICES_USDT[targetExtraRank - 1] || 10;
  const extraSpot =
    sponsorInExtraRank > 0
      ? findPlacementSpotInState(state, targetExtraRank, sponsorInExtraRank, true)
      : findFirstAvailableUnderInState(state, targetExtraRank, 1);

  predictions.push({
    kind: 'EXTRA_ID',
    rank: targetExtraRank,
    parentId: extraSpot.parentId,
    side: extraSpot.isLeft ? 'LEFT' : 'RIGHT',
    ready: extraReady,
    poolCurrentUsdt: pools.extraPoolUsdt,
    poolTargetUsdt: extraPrice,
    detailTh: `Extra ID (R${targetExtraRank}) ของ #${safeMainId} จะลงที่ R${targetExtraRank}-#${extraSpot.parentId} (${extraSpot.isLeft ? 'ซ้าย' : 'ขวา'})`,
    detailEn: `Extra ID (R${targetExtraRank}) of #${safeMainId} lands at R${targetExtraRank}-#${extraSpot.parentId} (${extraSpot.isLeft ? 'Left' : 'Right'})`,
  });

  // 5. Next Upgrade Spot if mainId < 18
  if (pools.currentRank < 18) {
    const nextR = pools.currentRank + 1;
    const r1Node = state.ranks.get(1)?.get(safeMainId);
    const spMain = r1Node?.directSponsorNodeId || 1;
    const spInNext = getNodeInRankForMain(state, spMain, nextR);
    const upgSpot = findPlacementSpotInState(state, nextR, spInNext, false);
    const upgPrice = RANK_PRICES_USDT[nextR - 1] || 10;
    predictions.push({
      kind: 'UPGRADE',
      rank: nextR,
      parentId: upgSpot.parentId,
      side: upgSpot.isLeft ? 'LEFT' : 'RIGHT',
      ready: pools.upgradePoolUsdt + 1e-6 >= upgPrice,
      poolCurrentUsdt: pools.upgradePoolUsdt,
      poolTargetUsdt: upgPrice,
      detailTh: `อัปเกรด #${safeMainId} → R${nextR} จะลงที่ R${nextR}-#${upgSpot.parentId} (${upgSpot.isLeft ? 'ซ้าย' : 'ขวา'})`,
      detailEn: `Upgrade #${safeMainId} → R${nextR} lands at R${nextR}-#${upgSpot.parentId} (${upgSpot.isLeft ? 'Left' : 'Right'})`,
    });
  }

  return predictions;
}

// --- Internal Mutation Engine (Used on Cloned State) ---

function makeSimWallet(indexNum: number): string {
  const hex = indexNum.toString(16).padStart(4, '0');
  return `0x51a000000000000000000000000000000000${hex}`;
}

function insertNodeMut(
  state: SandboxState,
  rank: number,
  owner: string,
  directSponsor: string,
  parentId: number,
  isLeft: boolean,
  isClone: boolean,
  isExtraId: boolean,
  originMainId: number,
  directSponsorNodeId: number,
  originType: string
): SimRawNode {
  const snapR = state.ranks.get(rank)!;
  const maxId = snapR.size > 0 ? Math.max(...Array.from(snapR.keys())) : 0;
  const newId = maxId + 1;
  const parentNode = snapR.get(parentId)!;
  if (isLeft) parentNode.leftChild = newId;
  else parentNode.rightChild = newId;

  const newNode: SimRawNode = {
    id: newId,
    rank,
    owner,
    parentId,
    leftChild: 0,
    rightChild: 0,
    isClone,
    isExtraId,
    directSponsor,
    originMainId: originMainId > 0 ? originMainId : newId,
    directSponsorNodeId,
    totalClonesSpawned: 0,
    nodeVault: 0,
    originType,
  };
  snapR.set(newId, newNode);

  const spawnedArr = state.lastSpawnedByRank.get(rank) || [];
  spawnedArr.push(newId);
  state.lastSpawnedByRank.set(rank, spawnedArr);

  return newNode;
}

function pushEvent(state: SandboxState, ev: Omit<SandboxEventLog, 'id' | 'stepNo' | 'actionNo'>) {
  const stepNo = state.events.length + 1;
  state.events.push({
    ...ev,
    id: `sim-ev-${state.actionCount}-${stepNo}-${ev.rank}-${ev.nodeId}`,
    stepNo,
    actionNo: state.actionCount,
  });
}

function deductVaultRangeMut(
  state: SandboxState,
  r1MainId: number,
  startRank: number,
  endRank: number,
  amount: number
) {
  let rem = amount;
  for (let r = startRank; r <= endRank && rem > 1e-6; r++) {
    const nId = getNodeInRankForMain(state, r1MainId, r);
    if (nId <= 0) continue;
    const n = state.ranks.get(r)?.get(nId);
    if (!n || n.nodeVault <= 0) continue;
    const deduct = Math.min(n.nodeVault, rem);
    n.nodeVault = Math.max(0, Number((n.nodeVault - deduct).toFixed(4)));
    rem = Number((rem - deduct).toFixed(4));
  }
}

function deductExtraPoolMut(state: SandboxState, r1MainId: number, price: number) {
  let rem = price;
  const bonus = state.extraLeftBonusByMain.get(r1MainId) || 0;
  if (bonus > 0) {
    const bDeduct = Math.min(bonus, rem);
    state.extraLeftBonusByMain.set(r1MainId, Math.max(0, Number((bonus - bDeduct).toFixed(4))));
    rem = Number((rem - bDeduct).toFixed(4));
  }
  if (rem > 1e-6) {
    const curRank = getMainIdCurrentRankInSandbox(state, r1MainId);
    const [w5Start] = getSandboxFiveRankWindow(curRank);
    if (curRank === 18 || w5Start > 4) {
      const endR = curRank === 18 ? 18 : w5Start - 1;
      deductVaultRangeMut(state, r1MainId, 4, endR, rem);
    }
  }
}

function applyUpgradeInternalMut(
  state: SandboxState,
  r1MainId: number,
  targetRank: number,
  isAuto: boolean
) {
  const r1Map = state.ranks.get(1)!;
  const r1Node = r1Map.get(r1MainId);
  if (!r1Node || targetRank < 2 || targetRank > 18) return;
  if (getNodeInRankForMain(state, r1MainId, targetRank) > 0) return;

  const spMain = r1Node.directSponsorNodeId > 0 ? r1Node.directSponsorNodeId : 1;
  const spInTarget = getNodeInRankForMain(state, spMain, targetRank);
  const spot = findPlacementSpotInState(state, targetRank, spInTarget, false);

  const node = insertNodeMut(
    state,
    targetRank,
    r1Node.owner,
    r1Node.directSponsor,
    spot.parentId,
    spot.isLeft,
    false,
    false,
    r1MainId,
    spMain,
    'MANUAL_REGISTER'
  );

  const price = RANK_PRICES_USDT[targetRank - 1] || 10;
  pushEvent(state, {
    type: isAuto ? 'AUTO_UPGRADE' : 'UPGRADE',
    rank: targetRank,
    nodeId: node.id,
    ownerMainId: r1MainId,
    parentId: spot.parentId,
    side: spot.isLeft ? 'LEFT' : 'RIGHT',
    amountUsdt: price,
    summaryTh: `${isAuto ? 'Auto Upgrade' : 'อัปเกรด'} Main #${r1MainId} → R${targetRank}-#${node.id} วางใต้ #${spot.parentId} (${spot.isLeft ? 'ซ้าย' : 'ขวา'})`,
    summaryEn: `${isAuto ? 'Auto Upgrade' : 'Upgraded'} Main #${r1MainId} → R${targetRank}-#${node.id} under #${spot.parentId} (${spot.isLeft ? 'Left' : 'Right'})`,
  });

  state.lastActionEstGasUnits += spot.isLeft ? 480000 : 340000;
  processCascadeMut(state, targetRank, node, spot.parentId, spot.isLeft, 0);

  // Check if targetMainId's own 5-rank window shift unlocked Pool 2 or Pool 3
  checkAndSpawnAutoMainMut(state, r1MainId, 1);
  checkAndSpawnExtraMut(state, r1MainId, 1);
}

function checkAndSpawnAutoMainMut(state: SandboxState, r1MainId: number, depth: number) {
  if (depth > 20) return;
  const r1Map = state.ranks.get(1)!;
  const mNode = r1Map.get(r1MainId);
  if (!mNode) return;
  const curRank = getMainIdCurrentRankInSandbox(state, r1MainId);
  const [w5Start] = getSandboxFiveRankWindow(curRank);
  if (w5Start <= 1) return;

  const r1Price = RANK_PRICES_USDT[0] || 5;
  const pools = calcSandboxPools(state, r1MainId);
  if (pools.autoPoolUsdt + 1e-6 < r1Price) return;

  const count = Math.min(2, Math.floor((pools.autoPoolUsdt + 1e-6) / r1Price));
  if (count <= 0) return;

  const endR = w5Start > 3 ? 3 : w5Start - 1;
  deductVaultRangeMut(state, r1MainId, 1, endR, count * r1Price);

  for (let i = 0; i < count; i++) {
    const spot = findPlacementSpotInState(state, 1, r1MainId, false);
    const autoNode = insertNodeMut(
      state,
      1,
      mNode.owner,
      mNode.owner,
      spot.parentId,
      spot.isLeft,
      false,
      false,
      0,
      r1MainId,
      'AUTO_NEW_MAIN'
    );
    pushEvent(state, {
      type: 'AUTO_ID',
      rank: 1,
      nodeId: autoNode.id,
      ownerMainId: r1MainId,
      parentId: spot.parentId,
      side: spot.isLeft ? 'LEFT' : 'RIGHT',
      amountUsdt: r1Price,
      summaryTh: `แตก Auto ID (R1-#${autoNode.id}) ของ Main #${r1MainId} → ลงใต้ R1-#${spot.parentId} (${spot.isLeft ? 'ซ้าย' : 'ขวา'})`,
      summaryEn: `Spawned Auto ID (R1-#${autoNode.id}) for Main #${r1MainId} → under R1-#${spot.parentId} (${spot.isLeft ? 'Left' : 'Right'})`,
    });
    state.lastActionEstGasUnits += 380000;
    processCascadeMut(state, 1, autoNode, spot.parentId, spot.isLeft, depth + 1);
  }
}

function checkAndSpawnExtraMut(state: SandboxState, r1MainId: number, depth: number) {
  if (depth > 20) return;
  const r1Map = state.ranks.get(1)!;
  const mNode = r1Map.get(r1MainId);
  if (!mNode) return;

  for (let pass = 0; pass < 8; pass++) {
    let spawned = false;
    for (let targetRank = 18; targetRank >= 2; targetRank--) {
      const pools = calcSandboxPools(state, r1MainId);
      const price = RANK_PRICES_USDT[targetRank - 1] || 10;
      if (pools.extraPoolUsdt + 1e-6 < price) continue;
      const sponsorInTarget = getNodeInRankForMain(state, r1MainId, targetRank);
      if (sponsorInTarget <= 0) continue;

      deductExtraPoolMut(state, r1MainId, price);
      const spot = findPlacementSpotInState(state, targetRank, sponsorInTarget, true);
      const extraNode = insertNodeMut(
        state,
        targetRank,
        mNode.owner,
        mNode.owner,
        spot.parentId,
        spot.isLeft,
        false,
        true,
        0,
        r1MainId,
        'AUTO_EXTRA'
      );
      pushEvent(state, {
        type: 'EXTRA_ID',
        rank: targetRank,
        nodeId: extraNode.id,
        ownerMainId: r1MainId,
        parentId: spot.parentId,
        side: spot.isLeft ? 'LEFT' : 'RIGHT',
        amountUsdt: price,
        summaryTh: `แตก Auto Extra ID (R${targetRank}-#${extraNode.id}) ของ Main #${r1MainId} → ลงใต้ R${targetRank}-#${spot.parentId} (${spot.isLeft ? 'ซ้าย' : 'ขวา'})`,
        summaryEn: `Spawned Auto Extra ID (R${targetRank}-#${extraNode.id}) for Main #${r1MainId} → under R${targetRank}-#${spot.parentId} (${spot.isLeft ? 'Left' : 'Right'})`,
      });
      state.lastActionEstGasUnits += 420000;
      spawned = true;
      processCascadeMut(state, targetRank, extraNode, spot.parentId, spot.isLeft, depth + 1);
      break;
    }
    if (!spawned) break;
  }
}

function processCascadeMut(
  state: SandboxState,
  rank: number,
  newNode: SimRawNode,
  parentId: number,
  isLeft: boolean,
  depth: number
) {
  if (depth > 25) return;
  const r1Map = state.ranks.get(1)!;
  const snapR = state.ranks.get(rank)!;
  const parentNode = snapR.get(parentId);
  if (!parentNode) return;
  const price = RANK_PRICES_USDT[rank - 1] || 10;

  if (isLeft) {
    let parentOriginNode = parentNode;
    if (parentNode.isClone) {
      const byOrig = snapR.get(parentNode.originMainId);
      if (byOrig && !byOrig.isClone && byOrig.owner.toLowerCase() === parentNode.owner.toLowerCase()) {
        parentOriginNode = byOrig;
      }
    }
    const isParentExtraLineage = parentNode.isExtraId || parentOriginNode.isExtraId;
    const vaultAdded = Number((price * 0.35).toFixed(4));

    if (isParentExtraLineage) {
      const spMain = parentOriginNode.directSponsorNodeId > 0 ? parentOriginNode.directSponsorNodeId : 1;
      state.extraLeftBonusByMain.set(
        spMain,
        Number(((state.extraLeftBonusByMain.get(spMain) || 0) + vaultAdded).toFixed(4))
      );
      pushEvent(state, {
        type: 'EXTRA_LEFT_BONUS',
        rank,
        nodeId: newNode.id,
        ownerMainId: spMain,
        parentId,
        side: 'LEFT',
        amountUsdt: vaultAdded,
        summaryTh: `ลูกซ้ายของ Extra (R${rank}-#${parentId}) ส่งโบนัส +${vaultAdded.toFixed(2)} U เข้า Pool 3 ของ #${spMain}`,
        summaryEn: `Extra left child (R${rank}-#${parentId}) added +${vaultAdded.toFixed(2)} U to Pool 3 of #${spMain}`,
      });
      checkAndSpawnExtraMut(state, spMain, depth + 1);
      return;
    }

    const parentR1Main = resolveR1MainForSandboxNode(state, rank, parentId);
    const vaultTargetNodeId = rank === 1 ? parentR1Main : getNodeInRankForMain(state, parentR1Main, rank);
    const targetVaultNode = snapR.get(vaultTargetNodeId || parentNode.originMainId || parentId);
    if (targetVaultNode) {
      targetVaultNode.nodeVault = Number((targetVaultNode.nodeVault + vaultAdded).toFixed(4));
    }

    pushEvent(state, {
      type: 'VAULT_GAIN',
      rank,
      nodeId: newNode.id,
      ownerMainId: parentR1Main,
      parentId,
      side: 'LEFT',
      amountUsdt: vaultAdded,
      summaryTh: `ลูกซ้าย R${rank}-#${newNode.id} เติม Vault +${vaultAdded.toFixed(2)} U ให้ Main #${parentR1Main} (ใน R${rank})`,
      summaryEn: `Left child R${rank}-#${newNode.id} added +${vaultAdded.toFixed(2)} U Vault to Main #${parentR1Main} (R${rank})`,
    });

    // Check Auto Upgrade if in 5-rank window & parent not yet in rank + 1
    const parentPools = calcSandboxPools(state, parentR1Main);
    if (rank < 18 && getNodeInRankForMain(state, parentR1Main, rank + 1) === 0) {
      const nextPrice = RANK_PRICES_USDT[rank] || 0;
      if (nextPrice > 0 && parentPools.upgradePoolUsdt + 1e-6 >= nextPrice) {
        const [wStart, wEnd] = parentPools.window5;
        deductVaultRangeMut(state, parentR1Main, wStart, wEnd, nextPrice);
        applyUpgradeInternalMut(state, parentR1Main, rank + 1, true);
      }
    }

    checkAndSpawnAutoMainMut(state, parentR1Main, depth + 1);
    if (rank >= 4) {
      checkAndSpawnExtraMut(state, parentR1Main, depth + 1);
    }
  } else {
    // Right child -> 100% Rebirth Clone of parent's origin node
    const originR1Main = resolveR1MainForSandboxNode(state, rank, parentNode.id);
    let originNode = parentNode;
    if (parentNode.isClone) {
      const byOrig = snapR.get(parentNode.originMainId);
      if (byOrig && !byOrig.isClone && byOrig.owner.toLowerCase() === parentNode.owner.toLowerCase()) {
        originNode = byOrig;
      } else {
        const localCorresp = getNodeInRankForMain(state, originR1Main, rank) || parentNode.originMainId || parentNode.id;
        originNode = snapR.get(localCorresp) || parentNode;
      }
    }

    const curClonesCount = originNode.totalClonesSpawned || 0;
    const roundIdx = curClonesCount % 2;
    const roundNumber = roundIdx + 1;
    originNode.totalClonesSpawned = curClonesCount + 1;

    let sponsorTargetInRank = 1;
    let lockedR1SponsorId = originNode.directSponsorNodeId || 1;
    let lockedR1SponsorAddr = originNode.directSponsor;

    if (originNode.isExtraId) {
      const spMain = originNode.directSponsorNodeId > 0 ? originNode.directSponsorNodeId : 1;
      lockedR1SponsorId = spMain;
      sponsorTargetInRank = getNodeInRankForMain(state, spMain, rank);
    } else {
      const r1Orig = r1Map.get(originR1Main);
      const r1SpId = r1Orig?.directSponsorNodeId || 1;
      lockedR1SponsorId = originR1Main === 1 ? 0 : r1SpId;
      if (r1Orig?.directSponsor) lockedR1SponsorAddr = r1Orig.directSponsor;
      sponsorTargetInRank = originR1Main === 1 ? 1 : getNodeInRankForMain(state, r1SpId, rank);
    }

    const cloneSpot =
      roundIdx === 0
        ? findPlacementSpotInState(state, rank, sponsorTargetInRank, false)
        : findFirstAvailableUnderInState(state, rank, 1);

    const cloneNode = insertNodeMut(
      state,
      rank,
      originNode.owner,
      lockedR1SponsorAddr,
      cloneSpot.parentId,
      cloneSpot.isLeft,
      true,
      false,
      rank === 1 || originNode.isExtraId ? originNode.id : originR1Main,
      lockedR1SponsorId,
      'CLONE'
    );

    pushEvent(state, {
      type: 'CLONE',
      rank,
      nodeId: cloneNode.id,
      ownerMainId: originR1Main,
      parentId: cloneSpot.parentId,
      side: cloneSpot.isLeft ? 'LEFT' : 'RIGHT',
      roundNumber,
      summaryTh: `ครบขวา R${rank}-#${parentId} → เด้งโคลน R${rank}-#${cloneNode.id} (ของ #${originR1Main} • รอบ ${roundNumber}) ไปที่ #${cloneSpot.parentId} (${cloneSpot.isLeft ? 'ซ้าย' : 'ขวา'})`,
      summaryEn: `Right trigger R${rank}-#${parentId} → Clone R${rank}-#${cloneNode.id} (of #${originR1Main} • Rnd ${roundNumber}) at #${cloneSpot.parentId} (${cloneSpot.isLeft ? 'Left' : 'Right'})`,
    });
    state.lastActionEstGasUnits += 290000;

    processCascadeMut(state, rank, cloneNode, cloneSpot.parentId, cloneSpot.isLeft, depth + 1);
  }
}

// --- Public Simulation Actions (Return New Immutable SandboxState) ---

export function sandboxRegisterR1(
  prevState: SandboxState,
  sponsorMainId: number,
  count: number = 1
): { nextState: SandboxState; createdMainIds: number[] } {
  const nextState = cloneSandboxState(prevState);
  nextState.actionCount += 1;
  nextState.lastSpawnedByRank.clear();
  nextState.lastActionEstGasUnits = count > 1 ? 85000 : 65000;

  const r1Map = nextState.ranks.get(1)!;
  const safeSponsorId = r1Map.has(sponsorMainId) ? sponsorMainId : 1;
  const spNode = r1Map.get(safeSponsorId)!;
  const r1Price = RANK_PRICES_USDT[0] || 5;
  const safeCount = Math.max(1, Math.min(12, Math.floor(count || 1)));
  const createdMainIds: number[] = [];

  for (let i = 0; i < safeCount; i++) {
    const spot = findPlacementSpotInState(nextState, 1, safeSponsorId, false);
    const virtualAddr = makeSimWallet((r1Map.size || 1) + 1);
    const newNode = insertNodeMut(
      nextState,
      1,
      virtualAddr,
      spNode.owner,
      spot.parentId,
      spot.isLeft,
      false,
      false,
      0,
      safeSponsorId,
      'MANUAL_REGISTER'
    );
    createdMainIds.push(newNode.id);

    pushEvent(nextState, {
      type: 'REGISTER',
      rank: 1,
      nodeId: newNode.id,
      ownerMainId: newNode.id,
      parentId: spot.parentId,
      side: spot.isLeft ? 'LEFT' : 'RIGHT',
      amountUsdt: r1Price,
      summaryTh: `สมัครใหม่ R1-#${newNode.id} (ผู้แนะนำ #${safeSponsorId}) → วางใต้ R1-#${spot.parentId} (${spot.isLeft ? 'ซ้าย' : 'ขวา'})`,
      summaryEn: `Registered R1-#${newNode.id} (Sponsor #${safeSponsorId}) → under R1-#${spot.parentId} (${spot.isLeft ? 'Left' : 'Right'})`,
    });

    nextState.lastActionEstGasUnits += spot.isLeft ? 450000 : 320000;
    processCascadeMut(nextState, 1, newNode, spot.parentId, spot.isLeft, 0);
  }

  return { nextState, createdMainIds };
}

export function sandboxUpgradeRank(
  prevState: SandboxState,
  targetMainId: number,
  targetRank: number
): SandboxState {
  const nextState = cloneSandboxState(prevState);
  nextState.actionCount += 1;
  nextState.lastSpawnedByRank.clear();
  nextState.lastActionEstGasUnits = 65000;

  const r1Map = nextState.ranks.get(1)!;
  if (!r1Map.has(targetMainId)) return nextState;

  const curRank = getMainIdCurrentRankInSandbox(nextState, targetMainId);
  const safeTarget = Math.min(18, Math.max(curRank + 1, Math.floor(targetRank)));
  if (curRank >= 18 || safeTarget <= curRank) return nextState;

  for (let r = curRank + 1; r <= safeTarget; r++) {
    const pools = calcSandboxPools(nextState, targetMainId);
    const price = RANK_PRICES_USDT[r - 1] || 10;
    const paidFromVault = Math.min(pools.upgradePoolUsdt, price);
    if (paidFromVault > 0) {
      deductVaultRangeMut(nextState, targetMainId, pools.window5[0], pools.window5[1], paidFromVault);
    }
    applyUpgradeInternalMut(nextState, targetMainId, r, false);
  }

  return nextState;
}

export function sandboxProcessPoolsForMain(
  prevState: SandboxState,
  targetMainId: number
): SandboxState {
  const nextState = cloneSandboxState(prevState);
  nextState.actionCount += 1;
  nextState.lastSpawnedByRank.clear();
  nextState.lastActionEstGasUnits = 45000;

  checkAndSpawnAutoMainMut(nextState, targetMainId, 0);
  checkAndSpawnExtraMut(nextState, targetMainId, 0);
  return nextState;
}

export function sandboxRunDemoScenario(prevState: SandboxState): {
  nextState: SandboxState;
  focusMainId: number;
} {
  let state = prevState;
  // Register 4 new Main IDs under #1 (fills left/right, triggers Clone R1 & R2)
  const regRes = sandboxRegisterR1(state, 1, 4);
  state = regRes.nextState;
  const focusMainId = regRes.createdMainIds[0] || 2;
  // Upgrade first two newly created IDs up to Rank 6 to demonstrate 5-rank window unlock -> Auto ID + Extra ID
  state = sandboxUpgradeRank(state, focusMainId, 6);
  if (regRes.createdMainIds[1]) {
    state = sandboxUpgradeRank(state, regRes.createdMainIds[1], 5);
  }
  return { nextState: state, focusMainId };
}
