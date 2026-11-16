import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Search, ArrowLeft, ExternalLink, ArrowUp, X, Users } from 'lucide-react';

export interface MatrixTreeNodeRaw {
  id: number;
  rank: number;
  owner: string;
  directSponsor?: string;
  parentId: number;
  leftChild: number;
  rightChild: number;
  isClone?: boolean;
  isExtraId?: boolean;
  originMainId?: number;
  cloneRound?: number;
  cloneSequence?: number;
  directSponsorNodeId?: number;
  originType?: string;
  confirmedOriginType?: string;
  createdAt?: string;
  isLeft?: boolean;
}

interface LayerNodeEntry {
  node: MatrixTreeNodeRaw;
  layer: number;
  parentId: number;
  side: 'ROOT' | 'LEFT' | 'RIGHT';
  path: string[];
}

interface Dashboard2MatrixPanelProps {
  displayId: number;
  currentRank: number;
  initialRank?: number;
  initialRootNodeId?: number | null;
  rankCounts: Record<number, number>;
  contractAddress: string;
  refreshTrigger?: any;
  onBackToHome: () => void;
  onSelectMainId: (idStr: string) => void;
  onOpenFullMatrixCanvas: (targetRank?: number) => void;
}

const fmtNum = (n: number): string => n.toLocaleString('en-US');

const shortAddr = (addr?: string): string => {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const isAutoNode = (node?: MatrixTreeNodeRaw | null): boolean => {
  if (!node) return false;
  const ot = String(node.originType || '').toUpperCase();
  const cot = String(node.confirmedOriginType || '').toUpperCase();
  return ot === 'AUTO_ID' || ot === 'AUTO_NEW_MAIN' || cot === 'AUTO_ID' || cot === 'AUTO_NEW_MAIN';
};

const isExtraNode = (node?: MatrixTreeNodeRaw | null): boolean => {
  if (!node) return false;
  const ot = String(node.originType || '').toUpperCase();
  const cot = String(node.confirmedOriginType || '').toUpperCase();
  return Boolean(node.isExtraId) || ot === 'AUTO_EXTRA' || cot === 'AUTO_EXTRA';
};

const isCloneNode = (node?: MatrixTreeNodeRaw | null): boolean => {
  if (!node) return false;
  return Boolean(node.isClone) || String(node.originType || '').toUpperCase() === 'CLONE';
};

const getMainId = (node?: MatrixTreeNodeRaw | null, fallbackId?: number): number => {
  if (!node) return Number(fallbackId || 0);
  const orig = Number(node.originMainId || 0);
  return orig > 0 ? orig : Number(node.id || fallbackId || 0);
};

const getNodeTypeLabel = (
  node?: MatrixTreeNodeRaw | null,
  cloneSeq = 0,
  totalClonesForMain = 0
): string => {
  if (!node) return 'Main ID';
  if (isExtraNode(node)) return `Extra ID (จาก #${node.originMainId || node.directSponsorNodeId || '-'})`;
  if (isCloneNode(node)) {
    if (cloneSeq > 0) {
      return totalClonesForMain > 0
        ? `โคลนนิ่ง ครั้งที่ ${cloneSeq} (ทั้งหมด ${totalClonesForMain})`
        : `โคลนนิ่ง ครั้งที่ ${cloneSeq}`;
    }
    return `โคลนนิ่ง (จาก Main #${node.originMainId || '-'})`;
  }
  if (isAutoNode(node)) {
    return 'Auto ID';
  }
  return 'Main ID';
};

const getShortTypeTag = (node?: MatrixTreeNodeRaw | null): string => {
  if (!node) return 'MAIN';
  if (isExtraNode(node)) return 'EXTRA';
  if (isCloneNode(node)) return 'CLONE';
  if (isAutoNode(node)) return 'AUTO';
  return 'MAIN';
};

const getDisplayStatusText = (node?: MatrixTreeNodeRaw | null, cloneSeq = 0): string => {
  if (!node) return 'Main ID';
  if (isExtraNode(node)) return 'Extra ID';
  if (isCloneNode(node)) {
    return cloneSeq > 0 ? `โคลนนิ่ง · ครั้งที่ ${cloneSeq}` : 'โคลนนิ่ง';
  }
  if (isAutoNode(node)) return 'Auto ID';
  return 'Main ID';
};

export const Dashboard2MatrixPanel: React.FC<Dashboard2MatrixPanelProps> = ({
  displayId,
  currentRank,
  initialRank,
  initialRootNodeId,
  rankCounts,
  contractAddress,
  refreshTrigger,
  onBackToHome,
  onSelectMainId,
  onOpenFullMatrixCanvas,
}) => {
  const [matrixRank, setMatrixRank] = useState<number>(() =>
    Math.max(1, Math.min(18, Number(initialRank || currentRank || 1)))
  );
  const [selectedLayer, setSelectedLayer] = useState<number>(0);
  const [focusedRootId, setFocusedRootId] = useState<number | null>(
    initialRootNodeId ? Number(initialRootNodeId) : null
  );
  const [nodes, setNodes] = useState<MatrixTreeNodeRaw[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [layerPopupModal, setLayerPopupModal] = useState<number | 'all' | null>(null);
  const [popupTypeFilter, setPopupTypeFilter] = useState<'ALL' | 'MAIN' | 'AUTO' | 'CLONE' | 'EXTRA'>('ALL');
  const [popupSearch, setPopupSearch] = useState<string>('');
  const [searchResult, setSearchResult] = useState<{
    message: string;
    isError?: boolean;
    matches?: Array<{
      node: MatrixTreeNodeRaw;
      layerInSubtree?: number;
      layerFromGlobal?: number;
    }>;
  } | null>(null);

  useEffect(() => {
    if (initialRank && initialRank >= 1 && initialRank <= 18) {
      setMatrixRank(initialRank);
      setSelectedLayer(0);
    }
  }, [initialRank]);

  useEffect(() => {
    setFocusedRootId(initialRootNodeId ? Number(initialRootNodeId) : null);
    setSelectedLayer(0);
    setSearchResult(null);
  }, [displayId, initialRootNodeId]);

  const fetchRankNodes = useCallback(async (opts?: { silent?: boolean } | unknown) => {
    const silent = Boolean(opts && typeof opts === 'object' && 'silent' in opts && (opts as { silent?: boolean }).silent);
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const qs = new URLSearchParams({ rank: String(matrixRank) });
      if (contractAddress) qs.set('contract', contractAddress);
      const res = await fetch(`/api/matrix/tree-nodes?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'ไม่สามารถโหลดข้อมูลผัง Matrix ได้');
      }
      setNodes(Array.isArray(json.nodes) ? json.nodes : []);
    } catch (err: any) {
      if (!silent) {
        setLoadError(err?.message || 'เกิดข้อผิดพลาดในการโหลดผัง Matrix');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [matrixRank, contractAddress]);

  useEffect(() => {
    fetchRankNodes();
    const onRefresh = () => fetchRankNodes({ silent: true });
    window.addEventListener('matrix:tree:refresh', onRefresh);
    const interval = setInterval(() => {
      fetchRankNodes({ silent: true });
    }, 15000);
    return () => {
      window.removeEventListener('matrix:tree:refresh', onRefresh);
      clearInterval(interval);
    };
  }, [fetchRankNodes, refreshTrigger]);

  const { nodeMap, cloneIdsByMainId, cloneSeqByNodeId } = useMemo(() => {
    const m = new Map<number, MatrixTreeNodeRaw>();
    const clonesByMain = new Map<number, number[]>();
    const sorted = [...nodes].sort((a, b) => Number(a.id) - Number(b.id));
    for (const n of sorted) {
      m.set(Number(n.id), n);
      if (isCloneNode(n)) {
        const mainId = getMainId(n);
        const list = clonesByMain.get(mainId) || [];
        list.push(Number(n.id));
        clonesByMain.set(mainId, list);
      }
    }
    const seqMap = new Map<number, number>();
    for (const n of sorted) {
      if (isCloneNode(n)) {
        const mainId = getMainId(n);
        const list = clonesByMain.get(mainId) || [];
        const perMainSeq = list.indexOf(Number(n.id)) + 1;
        seqMap.set(Number(n.id), perMainSeq);
      }
    }
    return { nodeMap: m, cloneIdsByMainId: clonesByMain, cloneSeqByNodeId: seqMap };
  }, [nodes]);

  const defaultRootId = useMemo(() => {
    if (nodeMap.has(displayId)) return displayId;
    const ownedInRank = nodes.find(
      (n) => Number(n.originMainId) === displayId && !n.isClone && !n.isExtraId
    );
    if (ownedInRank) return Number(ownedInRank.id);
    if (nodeMap.has(1)) return 1;
    return nodes.length > 0 ? Number(nodes[0].id) : displayId;
  }, [nodeMap, nodes, displayId]);

  const effectiveRootId = useMemo(() => {
    if (focusedRootId && nodeMap.has(focusedRootId)) return focusedRootId;
    return defaultRootId;
  }, [focusedRootId, nodeMap, defaultRootId]);

  const rootNode = nodeMap.get(effectiveRootId) || null;
  const leftChildNode =
    rootNode && rootNode.leftChild > 0 ? nodeMap.get(Number(rootNode.leftChild)) || null : null;
  const rightChildNode =
    rootNode && rootNode.rightChild > 0 ? nodeMap.get(Number(rootNode.rightChild)) || null : null;

  // Build layers 0 (Root) -> 1..15 BFS from effectiveRootId + global depth map from #1
  const { layersMap, subtreeDepthMap, globalDepthMap, totalSubtreeCount } = useMemo(() => {
    const layers: Record<number, LayerNodeEntry[]> = {};
    for (let l = 0; l <= 15; l++) layers[l] = [];
    const subDepth = new Map<number, LayerNodeEntry>();
    const globDepth = new Map<number, number>();
    let subTotal = 0;

    if (rootNode) {
      const visited = new Set<number>([Number(rootNode.id)]);
      const rootEntry: LayerNodeEntry = {
        node: rootNode,
        layer: 0,
        parentId: Number(rootNode.parentId || 0),
        side: 'ROOT',
        path: ['ROOT'],
      };
      layers[0] = [rootEntry];
      subDepth.set(Number(rootNode.id), rootEntry);
      subTotal = 1;

      for (let l = 0; l < 15; l++) {
        const current = layers[l];
        if (!current || current.length === 0) break;
        const next: LayerNodeEntry[] = [];
        for (const entry of current) {
          const leftId = Number(entry.node.leftChild || 0);
          if (leftId > 0 && !visited.has(leftId) && nodeMap.has(leftId)) {
            visited.add(leftId);
            const leftNode = nodeMap.get(leftId)!;
            const childEntry: LayerNodeEntry = {
              node: leftNode,
              layer: l + 1,
              parentId: Number(entry.node.id),
              side: 'LEFT',
              path: [...entry.path, `L(#${leftId})`],
            };
            next.push(childEntry);
            subDepth.set(leftId, childEntry);
            subTotal += 1;
          }
          const rightId = Number(entry.node.rightChild || 0);
          if (rightId > 0 && !visited.has(rightId) && nodeMap.has(rightId)) {
            visited.add(rightId);
            const rightNode = nodeMap.get(rightId)!;
            const childEntry: LayerNodeEntry = {
              node: rightNode,
              layer: l + 1,
              parentId: Number(entry.node.id),
              side: 'RIGHT',
              path: [...entry.path, `R(#${rightId})`],
            };
            next.push(childEntry);
            subDepth.set(rightId, childEntry);
            subTotal += 1;
          }
        }
        layers[l + 1] = next;
      }
    }

    // Compute global depth starting from #1 (Layer 0 = Root #1)
    const globalRoot = nodeMap.get(1) || nodes[0];
    if (globalRoot) {
      const gVisited = new Set<number>([Number(globalRoot.id)]);
      const queue: Array<{ id: number; depth: number }> = [{ id: Number(globalRoot.id), depth: 0 }];
      globDepth.set(Number(globalRoot.id), 0);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const n = nodeMap.get(cur.id);
        if (!n) continue;
        for (const cid of [Number(n.leftChild || 0), Number(n.rightChild || 0)]) {
          if (cid > 0 && !gVisited.has(cid) && nodeMap.has(cid)) {
            gVisited.add(cid);
            globDepth.set(cid, cur.depth + 1);
            queue.push({ id: cid, depth: cur.depth + 1 });
          }
        }
      }
    }

    return {
      layersMap: layers,
      subtreeDepthMap: subDepth,
      globalDepthMap: globDepth,
      totalSubtreeCount: subTotal,
    };
  }, [rootNode, nodeMap, nodes]);

  const currentLayerEntries = layersMap[selectedLayer] || [];
  const theoreticalCapacity = 2 ** selectedLayer;

  const chooseLayer = (n: number) => {
    const clamped = Math.max(0, Math.min(15, n));
    setSelectedLayer(clamped);
  };

  const focusNodeAsRoot = (nodeId: number) => {
    if (!nodeMap.has(nodeId)) return;
    setFocusedRootId(nodeId);
    setSelectedLayer(0);
  };

  const runMatrixSearch = () => {
    const raw = searchInput.trim();
    if (!raw) {
      setSearchResult({
        message: 'กรุณากรอก ID, Wallet หรือเลขชั้น (0–15) ที่ต้องการค้นหา',
        isError: true,
      });
      return;
    }

    // Explicit layer command: e.g. "ชั้น 0", "ชั้น 5", "layer 5", "L5"
    const explicitLayerMatch = raw.match(/^(?:ชั้น|layer|l)\s*(\d{1,2})$/i);
    if (explicitLayerMatch) {
      const n = Number(explicitLayerMatch[1]);
      if (n >= 0 && n <= 15) {
        chooseLayer(n);
        const foundCount = (layersMap[n] || []).length;
        setSearchResult({
          message: `แสดงผังชั้นที่ ${n} (Rank ${matrixRank}) แล้ว · ความจุตามทฤษฎี ${fmtNum(
            2 ** n
          )} ตำแหน่ง · พบสมาชิกจริงในชั้นนี้ ${foundCount} รหัส`,
        });
        return;
      }
      setSearchResult({
        message: 'เลขชั้นต้องอยู่ระหว่าง 0–15 เท่านั้น',
        isError: true,
      });
      return;
    }

    // Bare 1-2 digit number (0..15) OR explicit ID (#5 / ID 5 / 26)
    const bareNumberMatch = raw.match(/^(\d{1,2})$/);
    if (bareNumberMatch) {
      const n = Number(bareNumberMatch[1]);
      if (n >= 0 && n <= 15) {
        chooseLayer(n);
        const foundInLayer = (layersMap[n] || []).length;
        const nodeHit = n > 0 ? nodeMap.get(n) : undefined;
        if (nodeHit) {
          const subEntry = subtreeDepthMap.get(n);
          setSearchResult({
            message: `แสดงชั้นที่ ${n} (พบจริง ${foundInLayer} รหัส) · และพบ Node #${n} ใน Rank ${matrixRank}${
              subEntry ? ` (อยู่ชั้นที่ ${subEntry.layer} ใต้ #${effectiveRootId})` : ''
            }`,
            matches: [
              {
                node: nodeHit,
                layerInSubtree: subEntry?.layer,
                layerFromGlobal: globalDepthMap.get(n),
              },
            ],
          });
        } else {
          setSearchResult({
            message: `แสดงผังชั้นที่ ${n} (Rank ${matrixRank}) แล้ว · ความจุตามทฤษฎี ${fmtNum(
              2 ** n
            )} ตำแหน่ง · พบสมาชิกจริง ${foundInLayer} รหัส`,
          });
        }
        return;
      }
    }

    // Search by Node ID (#id, id 14, or number > 15)
    const idMatch = raw.match(/^(?:#|id\s*#?)?\s*(\d+)$/i);
    if (idMatch) {
      const targetId = Number(idMatch[1]);
      const nodeHit = nodeMap.get(targetId);
      if (!nodeHit) {
        setSearchResult({
          message: `ไม่พบ ID #${targetId} ใน Rank ${matrixRank} (ลองสลับ Rank ด้านบนหรือตรวจสอบเลข ID)`,
          isError: true,
        });
        return;
      }
      const subEntry = subtreeDepthMap.get(targetId);
      if (subEntry && subEntry.layer <= 15) {
        chooseLayer(subEntry.layer);
      }
      setSearchResult({
        message: `พบ ID #${targetId} (${getNodeTypeLabel(nodeHit)}) ใน Rank ${matrixRank}${
          subEntry !== undefined
            ? ` · อยู่ชั้นที่ ${subEntry.layer} ใต้ Root #${effectiveRootId}`
            : ` · อยู่นอกสายใต้ #${effectiveRootId} (ชั้นที่ ${
                globalDepthMap.get(targetId) ?? '—'
              } จาก Root #1)`
        }`,
        matches: [
          {
            node: nodeHit,
            layerInSubtree: subEntry?.layer,
            layerFromGlobal: globalDepthMap.get(targetId),
          },
        ],
      });
      return;
    }

    // Text / Wallet search
    const q = raw.toLowerCase();
    const matched = nodes.filter((n) => {
      const hay = [
        `#${n.id}`,
        String(n.id),
        n.owner || '',
        getNodeTypeLabel(n),
        n.originMainId ? `#${n.originMainId}` : '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    if (matched.length === 0) {
      setSearchResult({
        message: `ไม่พบสมาชิกหรือตำแหน่งที่ตรงกับ "${raw}" ใน Rank ${matrixRank}`,
        isError: true,
      });
      return;
    }

    const first = matched[0];
    const firstSub = subtreeDepthMap.get(Number(first.id));
    if (firstSub && firstSub.layer <= 15) {
      chooseLayer(firstSub.layer);
    }
    setSearchResult({
      message: `พบทั้งหมด ${matched.length} รายการที่ตรงกับ "${raw}" ใน Rank ${matrixRank}`,
      matches: matched.slice(0, 12).map((n) => ({
        node: n,
        layerInSubtree: subtreeDepthMap.get(Number(n.id))?.layer,
        layerFromGlobal: globalDepthMap.get(Number(n.id)),
      })),
    });
  };

  return (
    <div className="space-y-3.5">
      {/* HEADER BAR MATCHING MATRIX 15 LAYERS TEMPLATE */}
      <section className="mx-1 p-4 sm:p-5 text-white rounded-[24px] bg-[radial-gradient(ellipse_at_85%_90%,rgba(71,225,255,0.42),transparent_40%),linear-gradient(120deg,#031c5c,#075ed0_65%,#031d61)] shadow-[0_8px_24px_rgba(0,60,155,0.4)] border border-[#42bfff]/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-[40px] sm:text-[46px] leading-none text-[#7cefff] drop-shadow-[0_0_16px_#28caff]">
              ∞
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black leading-tight tracking-wide">
                ผัง MATRIX 15 ชั้น
              </h2>
              <small className="block text-[10px] sm:text-[11px] text-[#d6f6ff] tracking-wider mt-0.5">
                FRACTAL FLOW MATRIX 18 · Rank {matrixRank}
              </small>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-3 py-1.5 rounded-full bg-white/15 border border-[#9eeaff] text-xs font-bold whitespace-nowrap">
              👤 ID #{getMainId(rootNode, effectiveRootId)} ·{' '}
              {getDisplayStatusText(
                rootNode,
                rootNode ? cloneSeqByNodeId.get(Number(rootNode.id)) || 0 : 0
              )}
            </span>
            <button
              type="button"
              onClick={fetchRankNodes}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 border border-cyan-300/40 text-white cursor-pointer"
              title="รีเฟรชข้อมูลผัง"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onOpenFullMatrixCanvas(matrixRank)}
              className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-cyan-300/40 text-[11px] font-bold text-white inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              ผังกราฟเต็มจอ <ExternalLink className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="px-2.5 py-1.5 rounded-xl bg-white text-[#0754b9] text-[11px] font-black inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" /> กลับหน้าหลัก
            </button>
          </div>
        </div>

        {/* RANK 1–18 SWITCHER */}
        <div className="mt-3 pt-3 border-t border-white/15">
          <div className="flex items-center justify-between text-[10.5px] text-cyan-100 mb-1.5">
            <span className="font-bold">เลือก Rank ที่ต้องการดูผัง (Rank 1–18):</span>
            <span className="font-mono">
              {nodes.length} รหัสใน Rank {matrixRank}
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: 18 }, (_, i) => i + 1).map((r) => {
              const active = matrixRank === r;
              const cnt = Number(rankCounts[r] ?? (r === matrixRank ? nodes.length : 0));
              return (
                <button
                  key={`m-rank-${r}`}
                  type="button"
                  onClick={() => {
                    setMatrixRank(r);
                    setFocusedRootId(null);
                    setSelectedLayer(0);
                    setSearchResult(null);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 border transition cursor-pointer ${
                    active
                      ? 'bg-[#ffdf6d] text-[#0b2a66] border-[#fff1a8] shadow-sm'
                      : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                  }`}
                >
                  R{r} <span className="opacity-80 font-mono">({cnt})</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {loadError && (
        <div className="mx-1 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {loadError}
        </div>
      )}

      {!nodeMap.has(displayId) && nodes.length > 0 && effectiveRootId !== displayId && (
        <div className="mx-1 px-3.5 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          ID #{displayId} ยังไม่ได้ปลดล็อก Rank {matrixRank} — แสดงผังเริ่มต้นจาก ROOT #{effectiveRootId}
        </div>
      )}

      {/* 1. SUMMARY METRICS STRIP */}
      <section className="mx-1 p-4 rounded-[21px] bg-white/90 border border-[#b8e1ff] shadow-[0_8px_22px_rgba(7,85,181,0.17)]">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 sm:p-3 rounded-[15px] bg-gradient-to-br from-white to-[#d9f1ff] border border-[#b5ddff]">
            <small className="block text-[10px] font-bold text-[#5a78a1]">ชั้นที่เลือก</small>
            <b className="text-[17px] sm:text-[20px] font-black font-mono tabular-nums text-[#09275f] block mt-0.5">
              {selectedLayer} / 15
            </b>
          </div>
          <div className="p-2.5 sm:p-3 rounded-[15px] bg-gradient-to-br from-white to-[#d9f1ff] border border-[#b5ddff]">
            <small className="block text-[10px] font-bold text-[#5a78a1]">
              ตำแหน่งสูงสุดในชั้น*
            </small>
            <b className="text-[17px] sm:text-[20px] font-black font-mono tabular-nums text-[#09275f] block mt-0.5">
              {fmtNum(theoreticalCapacity)}
            </b>
          </div>
          <div className="p-2.5 sm:p-3 rounded-[15px] bg-gradient-to-br from-white to-[#d9f1ff] border border-[#b5ddff]">
            <small className="block text-[10px] font-bold text-[#5a78a1]">สมาชิกที่พบจริง</small>
            <b className="text-[17px] sm:text-[20px] font-black font-mono tabular-nums text-[#0758d4] block mt-0.5">
              {fmtNum(currentLayerEntries.length)}
            </b>
          </div>
        </div>
        <p className="text-[11px] text-[#58769d] leading-relaxed mt-2.5">
          *จำนวนตำแหน่งเป็นการคำนวณตามโครงสร้าง Binary Tree ทางทฤษฎี (ชั้นที่ n มี 2^n ตำแหน่ง โดยชั้น 0 คือ Root) · ใต้{' '}
          <strong className="text-[#0754b9]">ID #{effectiveRootId}</strong> ใน Rank {matrixRank}{' '}
          พบสมาชิกสะสมชั้น 0–15 รวม <strong className="font-mono">{totalSubtreeCount}</strong> รหัส
        </p>
      </section>

      {/* 2. SEARCH MEMBER / LAYER */}
      <section className="mx-1 p-4 rounded-[21px] bg-white/90 border border-[#b8e1ff] shadow-[0_8px_22px_rgba(7,85,181,0.17)]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h3 className="text-[15px] sm:text-[16px] font-black text-[#09275f]">
            🔎 ค้นหาสมาชิก / ตำแหน่ง
          </h3>
          <small className="text-[10.5px] font-semibold text-[#5a78a1]">
            ID · Wallet · ชั้น
          </small>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[#5a78a1] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runMatrixSearch();
              }}
              placeholder="กรอก ID (#14), Wallet (0x...) หรือเลขชั้น เช่น 5"
              className="w-full pl-9 pr-3 py-2.5 rounded-[13px] border border-[#9fcfff] bg-[#f7fcff] text-[#09275f] text-xs sm:text-[13px] font-semibold outline-none focus:border-[#087cf4] focus:ring-2 focus:ring-[#087cf4]/20"
            />
          </div>
          <button
            type="button"
            onClick={runMatrixSearch}
            className="px-4 py-2.5 rounded-[13px] text-white text-xs sm:text-[13px] font-bold bg-gradient-to-r from-[#22caff] to-[#0758d4] shadow-[0_4px_12px_rgba(8,124,244,0.35)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            ค้นหา
          </button>
        </div>

        <div
          className={`mt-2.5 text-[11px] leading-relaxed px-3 py-2.5 rounded-[12px] border ${
            searchResult?.isError
              ? 'text-[#9b4b16] bg-[#fff8e9] border-[#f3d9a7]'
              : 'text-[#315b8b] bg-[#edf8ff] border-[#c6e6ff]'
          }`}
          aria-live="polite"
        >
          {searchResult ? (
            <div className="space-y-2">
              <div className="font-semibold">{searchResult.message}</div>
              {searchResult.matches && searchResult.matches.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {searchResult.matches.map((m) => (
                    <div
                      key={`sr-${m.node.id}`}
                      className="p-2 rounded-xl bg-white border border-[#b4ddff] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-[#09265f] font-mono">
                          ID #{getMainId(m.node)}{' '}
                          <span className="text-[10px] font-sans text-[#0756bc]">
                            ·{' '}
                            {getDisplayStatusText(
                              m.node,
                              cloneSeqByNodeId.get(Number(m.node.id)) || 0
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#4f7097] truncate">
                          R{matrixRank}-#{m.node.id} ·{' '}
                          {m.layerInSubtree !== undefined
                            ? `ชั้น ${m.layerInSubtree} (ใต้ #${effectiveRootId})`
                            : m.layerFromGlobal !== undefined
                            ? `ชั้น ${m.layerFromGlobal} (จาก #1)`
                            : ''}{' '}
                          · Parent #{m.node.parentId || 0}{' '}
                          {m.node.parentId > 0 ? (m.node.isLeft ? '(ซ้าย)' : '(ขวา)') : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => focusNodeAsRoot(Number(m.node.id))}
                        className="px-2 py-1 rounded-lg bg-[#087cf4] text-white text-[10px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        เปิดผัง #{m.node.id}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span>
              พิมพ์เลขชั้น (เช่น 0, 1 หรือ ชั้น 5) เพื่อกระโดดไปยังชั้นนั้นทันที หรือค้นหาด้วยเลข ID / กระเป๋า Wallet
            </span>
          )}
        </div>
      </section>

      {/* 3. MATRIX VISUAL TREE + LAYER FOCUS */}
      <section className="mx-1 p-4 rounded-[21px] bg-white/90 border border-[#b8e1ff] shadow-[0_8px_22px_rgba(7,85,181,0.17)]">
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <h3 className="text-[15px] sm:text-[16px] font-black text-[#09275f]">
            🌐 โครงสร้าง Matrix (Rank {matrixRank})
          </h3>
          <small className="text-[10.5px] font-semibold text-[#5a78a1]">
            เลือกชั้นเพื่อดูตำแหน่งจริง
          </small>
        </div>

        {/* Quick 0..15 Layer Chips */}
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 16 }, (_, idx) => idx).map((n) => {
            const active = selectedLayer === n;
            const cnt = (layersMap[n] || []).length;
            return (
              <button
                key={`ql-${n}`}
                type="button"
                onClick={() => chooseLayer(n)}
                className={`px-2.5 py-1.5 rounded-[12px] text-[11px] font-bold border transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-[#22caff] to-[#0758d4] text-white border-[#25caff] shadow-sm'
                    : cnt > 0
                    ? 'bg-[#eff9ff] text-[#0753ae] border-[#9fcfff] hover:bg-[#dff3ff]'
                    : 'bg-[#f7fbff] text-[#6d8aad] border-[#d3e9ff] hover:bg-[#eff9ff]'
                }`}
              >
                ชั้น {n}
                {cnt > 0 && <span className="ml-1 font-mono opacity-85">({cnt})</span>}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-3 flex-wrap text-[10.5px] font-semibold text-[#476b98] mt-3">
          <span>
            <i className="inline-block w-2.5 h-2.5 rounded-full bg-[#087cf4] mr-1 align-middle" />
            Root / แม่ทีม
          </span>
          <span>
            <i className="inline-block w-2.5 h-2.5 rounded-full bg-[#16a9ff] mr-1 align-middle" />
            สายซ้าย
          </span>
          <span>
            <i className="inline-block w-2.5 h-2.5 rounded-full bg-[#8c62e9] mr-1 align-middle" />
            สายขวา
          </span>
          <span>
            <i className="inline-block w-2.5 h-2.5 rounded-full bg-[#9bb3cd] mr-1 align-middle" />
            ว่าง / รอสมาชิก
          </span>
        </div>

        {/* Up/Reset Navigation */}
        {(effectiveRootId !== defaultRootId || (rootNode && rootNode.parentId > 0)) && (
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            {rootNode && rootNode.parentId > 0 && nodeMap.has(Number(rootNode.parentId)) && (
              <button
                type="button"
                onClick={() => focusNodeAsRoot(Number(rootNode.parentId))}
                className="px-2.5 py-1 rounded-lg bg-[#eff8ff] border border-[#a5d6ff] text-[11px] font-bold text-[#0754b9] inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowUp className="w-3 h-3" /> ขึ้นไปอัพไลน์ #{rootNode.parentId}
              </button>
            )}
            {effectiveRootId !== defaultRootId && (
              <button
                type="button"
                onClick={() => focusNodeAsRoot(defaultRootId)}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#a5d6ff] text-[11px] font-bold text-[#0754b9] cursor-pointer"
              >
                ↺ กลับไป ROOT #{defaultRootId}
              </button>
            )}
          </div>
        )}

        {/* Root Node Card */}
        <div className="mt-3.5 mx-auto w-[min(280px,88%)] text-center rounded-[17px] p-3 bg-gradient-to-br from-[#0643a9] to-[#0789f4] text-white border-2 border-[#9ceeff] shadow-[0_5px_17px_rgba(6,120,220,0.4)]">
          <b className="block text-[16px] font-black">
            ROOT · ID #{getMainId(rootNode, effectiveRootId)}
          </b>
          <small className="block text-[10.5px] text-[#dcf8ff] mt-0.5">
            {rootNode
              ? `${getNodeTypeLabel(
                  rootNode,
                  cloneSeqByNodeId.get(Number(rootNode.id)) || 0,
                  (cloneIdsByMainId.get(getMainId(rootNode)) || []).length
                )}${
                  rootNode.id !== getMainId(rootNode) ? ` (โหนด #${rootNode.id})` : ''
                } · แนะนำโดย #${rootNode.directSponsorNodeId || '-'} · ${shortAddr(
                  rootNode.owner
                )}`
              : 'ตำแหน่งอ้างอิงของผัง'}
          </small>
        </div>

        {/* Immediate Left / Right Branch Cards */}
        <div className="relative flex justify-center gap-4 sm:gap-6 mx-auto mt-[22px] max-w-[460px]">
          <div className="absolute -top-[12px] left-1/4 right-1/4 h-[1px] bg-[#4c9fe5]" />

          {/* LEFT CHILD */}
          {leftChildNode ? (
            <button
              type="button"
              onClick={() => focusNodeAsRoot(Number(leftChildNode.id))}
              className="relative flex-1 max-w-[200px] text-center p-3 rounded-[15px] bg-gradient-to-br from-white to-[#d8f1ff] border border-[#9fd5ff] border-b-4 border-b-[#16a9ff] shadow-[0_4px_12px_rgba(7,85,181,0.17)] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
              <b className="block text-[13px] font-black text-[#09275f]">
                LEFT · ID #{getMainId(leftChildNode)}
              </b>
              <small className="block text-[10px] text-[#3e6493] mt-1 leading-snug">
                {getDisplayStatusText(
                  leftChildNode,
                  cloneSeqByNodeId.get(Number(leftChildNode.id)) || 0
                )}{' '}
                · แนะนำ #{leftChildNode.directSponsorNodeId || '-'}
                <br />
                {leftChildNode.id !== getMainId(leftChildNode)
                  ? `โหนด #${leftChildNode.id} · `
                  : ''}
                {shortAddr(leftChildNode.owner)} · แตะดูสายนี้ ›
              </small>
            </button>
          ) : (
            <div className="relative flex-1 max-w-[200px] text-center p-3 rounded-[15px] bg-[#f6fbff] border border-dashed border-[#9fd5ff] border-b-4 border-b-[#9bb3cd] text-[#7692b6]">
              <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
              <b className="block text-[13px] font-black">LEFT · ว่าง</b>
              <small className="block text-[10px] mt-1">ตำแหน่งซ้ายรอสมาชิก</small>
            </div>
          )}

          {/* RIGHT CHILD */}
          {rightChildNode ? (
            <button
              type="button"
              onClick={() => focusNodeAsRoot(Number(rightChildNode.id))}
              className="relative flex-1 max-w-[200px] text-center p-3 rounded-[15px] bg-gradient-to-br from-white to-[#eee9ff] border border-[#c6b5ff] border-b-4 border-b-[#8c62e9] shadow-[0_4px_12px_rgba(7,85,181,0.17)] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
              <b className="block text-[13px] font-black text-[#09275f]">
                RIGHT · ID #{getMainId(rightChildNode)}
              </b>
              <small className="block text-[10px] text-[#4c4287] mt-1 leading-snug">
                {getDisplayStatusText(
                  rightChildNode,
                  cloneSeqByNodeId.get(Number(rightChildNode.id)) || 0
                )}{' '}
                · แนะนำ #{rightChildNode.directSponsorNodeId || '-'}
                <br />
                {rightChildNode.id !== getMainId(rightChildNode)
                  ? `โหนด #${rightChildNode.id} · `
                  : ''}
                {shortAddr(rightChildNode.owner)} · แตะดูสายนี้ ›
              </small>
            </button>
          ) : (
            <div className="relative flex-1 max-w-[200px] text-center p-3 rounded-[15px] bg-[#f6fbff] border border-dashed border-[#9fd5ff] border-b-4 border-b-[#9bb3cd] text-[#7692b6]">
              <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
              <b className="block text-[13px] font-black">RIGHT · ว่าง</b>
              <small className="block text-[10px] mt-1">ตำแหน่งขวารอสมาชิก</small>
            </div>
          )}
        </div>

        {/* Selected Layer Detail Panel */}
        <div className="flex items-center justify-between gap-2 mt-5 mb-2 flex-wrap">
          <h3 className="text-[15px] sm:text-[16px] font-black text-[#09275f]">
            ชั้นที่ {selectedLayer}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-[#e4f4ff] text-[#0757b8] font-mono tabular-nums">
              {fmtNum(theoreticalCapacity)} ตำแหน่ง · พบ {currentLayerEntries.length} รหัส
            </span>
            {currentLayerEntries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPopupTypeFilter('ALL');
                  setPopupSearch('');
                  setLayerPopupModal(selectedLayer);
                }}
                className="px-2.5 py-1 rounded-full bg-[#087cf4] hover:bg-[#0568d0] text-white text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Users className="w-3 h-3" /> ดูรายชื่อชั้น {selectedLayer}
              </button>
            )}
          </div>
        </div>

        <div className="p-3 rounded-[16px] bg-[#f4fbff] border border-[#c6e6ff]">
          <b className="text-xs font-black text-[#09275f]">
            รายละเอียดตำแหน่ง (ชั้นที่ {selectedLayer})
          </b>
          <p className="text-[11px] text-[#58769d] leading-relaxed mt-1">
            {selectedLayer === 0
              ? `ชั้นที่ 0 เป็นตำแหน่ง Root ของผัง (ID #${effectiveRootId}) · มีตำแหน่งลูกชั้นที่ 1 ซ้าย ${
                  leftChildNode ? `#${leftChildNode.id}` : 'ว่าง'
                } / ขวา ${rightChildNode ? `#${rightChildNode.id}` : 'ว่าง'}`
              : `ชั้นที่ ${selectedLayer} มีตำแหน่งตามทฤษฎี ${fmtNum(
                  theoreticalCapacity
                )} ตำแหน่ง โดยแต่ละตำแหน่งมีลูกได้สูงสุด 2 ตำแหน่ง · ปัจจุบันพบสมาชิกจริง ${
                  currentLayerEntries.length
                } รหัส`}
          </p>

          {selectedLayer === 0 ? (
            <div className="relative flex justify-center gap-4 mx-auto mt-5 max-w-[430px]">
              <div className="absolute -top-[12px] left-1/4 right-1/4 h-[1px] bg-[#4c9fe5]" />
              <div
                onClick={() => leftChildNode && focusNodeAsRoot(Number(leftChildNode.id))}
                className={`relative flex-1 max-w-[180px] text-center p-2.5 rounded-[14px] ${
                  leftChildNode
                    ? 'bg-white border border-[#9fd5ff] border-b-4 border-b-[#16a9ff] cursor-pointer hover:bg-[#eff9ff]'
                    : 'bg-[#f6fbff] border border-dashed border-[#b8d9f5] text-[#7692b6]'
                }`}
              >
                <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
                <b className="block text-xs font-black">
                  {leftChildNode ? `LEFT CHILD · ID #${getMainId(leftChildNode)}` : 'LEFT CHILD'}
                </b>
                <small className="block text-[10px] mt-0.5 text-[#5a78a1]">
                  {leftChildNode
                    ? getNodeTypeLabel(
                        leftChildNode,
                        cloneSeqByNodeId.get(Number(leftChildNode.id)) || 0,
                        (cloneIdsByMainId.get(getMainId(leftChildNode)) || []).length
                      )
                    : 'รอข้อมูลสมาชิก'}
                </small>
              </div>

              <div
                onClick={() => rightChildNode && focusNodeAsRoot(Number(rightChildNode.id))}
                className={`relative flex-1 max-w-[180px] text-center p-2.5 rounded-[14px] ${
                  rightChildNode
                    ? 'bg-white border border-[#c6b5ff] border-b-4 border-b-[#8c62e9] cursor-pointer hover:bg-[#f8f5ff]'
                    : 'bg-[#f6fbff] border border-dashed border-[#b8d9f5] text-[#7692b6]'
                }`}
              >
                <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
                <b className="block text-xs font-black">
                  {rightChildNode ? `RIGHT CHILD · ID #${getMainId(rightChildNode)}` : 'RIGHT CHILD'}
                </b>
                <small className="block text-[10px] mt-0.5 text-[#5a78a1]">
                  {rightChildNode
                    ? getNodeTypeLabel(
                        rightChildNode,
                        cloneSeqByNodeId.get(Number(rightChildNode.id)) || 0,
                        (cloneIdsByMainId.get(getMainId(rightChildNode)) || []).length
                      )
                    : 'รอข้อมูลสมาชิก'}
                </small>
              </div>
            </div>
          ) : currentLayerEntries.length === 0 ? (
            <div className="relative flex justify-center gap-4 mx-auto mt-5 max-w-[430px]">
              <div className="absolute -top-[12px] left-1/4 right-1/4 h-[1px] bg-[#4c9fe5]" />
              <div className="relative flex-1 max-w-[180px] text-center p-2.5 rounded-[14px] bg-[#f6fbff] border border-dashed border-[#b8d9f5] text-[#7692b6]">
                <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
                <b className="block text-xs font-black">LEFT CHILD</b>
                <small className="block text-[10px] mt-0.5">รอสมาชิกในชั้นที่ {selectedLayer}</small>
              </div>
              <div className="relative flex-1 max-w-[180px] text-center p-2.5 rounded-[14px] bg-[#f6fbff] border border-dashed border-[#b8d9f5] text-[#7692b6]">
                <span className="absolute -top-[13px] left-1/2 w-[1px] h-[13px] bg-[#4c9fe5]" />
                <b className="block text-xs font-black">RIGHT CHILD</b>
                <small className="block text-[10px] mt-0.5">รอสมาชิกในชั้นที่ {selectedLayer}</small>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2.5 max-h-[340px] overflow-y-auto pr-1">
              {currentLayerEntries.map((entry) => {
                const n = entry.node;
                const isLeftSide = entry.side === 'LEFT';
                return (
                  <div
                    key={`layer-node-${n.id}`}
                    className={`p-2.5 rounded-[14px] bg-white border border-[#b4ddff] border-b-4 ${
                      isLeftSide ? 'border-b-[#16a9ff]' : 'border-b-[#8c62e9]'
                    } flex items-center justify-between gap-2 text-xs`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-black text-[#09275f] font-mono">
                        ID #{getMainId(n)}{' '}
                        <span className="text-[10px] font-sans font-bold text-[#0756bc]">
                          ·{' '}
                          {getDisplayStatusText(
                            n,
                            cloneSeqByNodeId.get(Number(n.id)) || 0
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#45668f] truncate">
                        {n.id !== getMainId(n) ? `โหนด #${n.id} · ` : ''}
                        ใต้ #{entry.parentId} ({isLeftSide ? 'ซ้าย' : 'ขวา'}) · แนะนำ #
                        {n.directSponsorNodeId || '-'}
                      </div>
                      <div className="text-[10px] font-mono text-[#6584ab]">
                        ซ้าย: {n.leftChild > 0 ? `#${n.leftChild}` : 'ว่าง'} · ขวา:{' '}
                        {n.rightChild > 0 ? `#${n.rightChild}` : 'ว่าง'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => focusNodeAsRoot(Number(n.id))}
                        className="px-2 py-1 rounded-lg bg-[#087cf4] text-white text-[10px] font-bold hover:bg-[#0568d0] cursor-pointer"
                      >
                        เปิดผัง
                      </button>
                      {!n.isExtraId && !n.isClone && (
                        <button
                          type="button"
                          onClick={() => onSelectMainId(String(getMainId(n)))}
                          className="px-2 py-0.5 rounded-lg bg-[#e6f5ff] border border-[#a5d6ff] text-[#0754b9] text-[10px] font-bold cursor-pointer"
                        >
                          ดู ID
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. 15-LAYER SELECTOR GRID */}
      <section className="mx-1 p-4 rounded-[21px] bg-white/90 border border-[#b8e1ff] shadow-[0_8px_22px_rgba(7,85,181,0.17)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-[15px] sm:text-[16px] font-black text-[#09275f]">
            📚 เลือกดูชั้น 0–15 (Root → ชั้น 15)
          </h3>
          <small className="text-[10.5px] font-semibold text-[#5a78a1]">
            แตะชั้นที่ต้องการ
          </small>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Array.from({ length: 16 }, (_, idx) => idx).map((n) => {
            const selected = selectedLayer === n;
            const realCount = (layersMap[n] || []).length;
            return (
              <button
                key={`layer-card-${n}`}
                type="button"
                onClick={() => chooseLayer(n)}
                className={`p-2.5 rounded-[14px] border text-left transition cursor-pointer ${
                  selected
                    ? 'bg-gradient-to-br from-[#087cf4] to-[#0648b2] text-white border-[#57d8ff] shadow-md'
                    : 'bg-gradient-to-br from-white to-[#e3f4ff] text-[#09275f] border-[#b2dafa] hover:border-[#087cf4]'
                }`}
              >
                <b className="block text-[13px] font-black">
                  ชั้นที่ {n}{n === 0 ? ' (Root)' : ''}
                </b>
                <small
                  className={`block text-[10px] mt-0.5 font-mono tabular-nums ${
                    selected ? 'text-[#e2f8ff]' : 'text-[#5a78a1]'
                  }`}
                >
                  {fmtNum(2 ** n)} ตำแหน่งสูงสุด*
                </small>
                <small
                  className={`block text-[10px] font-bold mt-0.5 font-mono ${
                    selected
                      ? 'text-[#ffdf6d]'
                      : realCount > 0
                      ? 'text-emerald-700'
                      : 'text-[#7c97b8]'
                  }`}
                >
                  พบจริง {realCount} รหัส
                </small>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. 15-LAYER SUMMARY TABLE */}
      <section className="mx-1 p-4 rounded-[21px] bg-white/90 border border-[#b8e1ff] shadow-[0_8px_22px_rgba(7,85,181,0.17)]">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div>
            <h3 className="text-[15px] sm:text-[16px] font-black text-[#09275f]">
              📋 สรุปโครงสร้างแต่ละชั้น
            </h3>
            <small className="text-[10.5px] font-semibold text-[#5a78a1]">
              ความจุตามทฤษฎี & สมาชิกจริง
            </small>
          </div>
          {totalSubtreeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setPopupTypeFilter('ALL');
                setPopupSearch('');
                setLayerPopupModal('all');
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#22caff] to-[#0758d4] text-white text-[11px] font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer hover:brightness-105 transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span>ดูสมาชิกจริงทั้งหมด ({totalSubtreeCount} รหัส)</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1.5 min-w-[480px] text-xs">
            <thead>
              <tr className="text-left text-[#54749b]">
                <th className="px-2 py-1.5">ชั้น</th>
                <th className="px-2 py-1.5">ตำแหน่งสูงสุด*</th>
                <th className="px-2 py-1.5">ตำแหน่งลูกชั้นถัดไป</th>
                <th className="px-2 py-1.5">ข้อมูลสมาชิกจริง (ใต้ #{effectiveRootId})</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, idx) => idx).map((n) => {
                const realEntries = layersMap[n] || [];
                const previewIds = realEntries
                  .slice(0, 3)
                  .map((e) => `#${getMainId(e.node)}${isCloneNode(e.node) ? '(โคลน)' : ''}`)
                  .join(', ');
                const extraMore = realEntries.length > 3 ? ` +${realEntries.length - 3}` : '';
                const isRowSelected = selectedLayer === n;
                return (
                  <tr
                    key={`layer-row-${n}`}
                    onClick={() => chooseLayer(n)}
                    className={`cursor-pointer transition ${
                      isRowSelected ? 'ring-2 ring-[#087cf4] rounded-[10px]' : ''
                    }`}
                  >
                    <td
                      className={`px-2.5 py-2.5 rounded-l-[10px] font-bold ${
                        isRowSelected
                          ? 'bg-[#087cf4] text-white'
                          : 'bg-[#edf7ff] text-[#0757b8]'
                      }`}
                    >
                      ชั้น {n}
                    </td>
                    <td
                      className={`px-2.5 py-2.5 font-mono tabular-nums ${
                        isRowSelected ? 'bg-[#dff2ff]' : 'bg-[#edf7ff]'
                      }`}
                    >
                      {fmtNum(2 ** n)}
                    </td>
                    <td
                      className={`px-2.5 py-2.5 font-mono tabular-nums ${
                        isRowSelected ? 'bg-[#dff2ff]' : 'bg-[#edf7ff]'
                      }`}
                    >
                      {n === 15 ? '—' : fmtNum(2 ** (n + 1))}
                    </td>
                    <td
                      className={`px-2.5 py-2.5 rounded-r-[10px] ${
                        isRowSelected ? 'bg-[#dff2ff]' : 'bg-[#edf7ff]'
                      }`}
                    >
                      {realEntries.length > 0 ? (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-emerald-700">
                            {realEntries.length} รหัส{' '}
                            <span className="font-mono text-[#09275f] font-normal">
                              ({previewIds}
                              {extraMore})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              chooseLayer(n);
                              setPopupTypeFilter('ALL');
                              setPopupSearch('');
                              setLayerPopupModal(n);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#087cf4] hover:bg-[#0568d0] text-white text-[10.5px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer shadow-xs"
                          >
                            <Users className="w-3 h-3" />
                            <span>ดูข้อมูลสมาชิก</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#6d8aad]">ว่าง (0 รหัส)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-[#58769d] leading-relaxed mt-2">
          กดปุ่ม <strong className="text-[#0754b9]">ดูข้อมูลสมาชิก</strong> ในคอลัมน์ข้อมูลสมาชิกจริง เพื่อเปิดป๊อปอัพแสดง ID, สถานะไอดี และผู้แนะนำของแต่ละรหัส
        </p>
      </section>

      {/* POPUP MODAL: REAL MEMBERS IN LAYER / SUBTREE (ID, STATUS, SPONSOR) */}
      {layerPopupModal !== null && (() => {
        const rawEntries: LayerNodeEntry[] =
          layerPopupModal === 'all'
            ? Array.from({ length: 16 }, (_, idx) => layersMap[idx] || []).flat()
            : layersMap[layerPopupModal] || [];

        const tagCounts = {
          ALL: rawEntries.length,
          MAIN: 0,
          AUTO: 0,
          CLONE: 0,
          EXTRA: 0,
        };
        for (const entry of rawEntries) {
          const tag = getShortTypeTag(entry.node) as 'MAIN' | 'AUTO' | 'CLONE' | 'EXTRA';
          if (tagCounts[tag] !== undefined) tagCounts[tag] += 1;
        }

        const qTrim = popupSearch.trim().toLowerCase().replace(/^#/, '');
        const filteredEntries = rawEntries.filter((entry) => {
          const n = entry.node;
          const tag = getShortTypeTag(n);
          if (popupTypeFilter !== 'ALL' && tag !== popupTypeFilter) return false;
          if (qTrim) {
            const mainIdNum = getMainId(n);
            const totalClones = (cloneIdsByMainId.get(mainIdNum) || []).length;
            const cloneSeq = cloneSeqByNodeId.get(Number(n.id)) || 0;
            const originNode = n.originMainId ? nodeMap.get(Number(n.originMainId)) : undefined;
            const sponsorId =
              Number(n.directSponsorNodeId || 0) > 0
                ? Number(n.directSponsorNodeId)
                : Number(originNode?.directSponsorNodeId || n.originMainId || 0);
            const hay = `${n.id} #${n.id} ${mainIdNum} #${mainIdNum} ${getNodeTypeLabel(
              n,
              cloneSeq,
              totalClones
            )} ${tag} ${sponsorId} #${sponsorId} ${n.owner || ''}`.toLowerCase();
            if (!hay.includes(qTrim)) return false;
          }
          return true;
        });

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setLayerPopupModal(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-[24px] bg-gradient-to-br from-white to-[#e3f4ff] border-2 border-[#a9ddff] shadow-2xl p-4 sm:p-5 text-[#09265f] space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#b8e5ff] pb-2.5">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#09265f]">
                    {layerPopupModal === 'all'
                      ? `👥 ข้อมูลสมาชิกจริง (ชั้น 0–15 · Rank ${matrixRank} · ใต้ #${effectiveRootId})`
                      : `👥 ข้อมูลสมาชิกจริง — ชั้นที่ ${layerPopupModal} (Rank ${matrixRank} · ใต้ #${effectiveRootId})`}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#45668f] mt-0.5">
                    แสดง ID · สถานะไอดี (Main / Auto / Clone / Extra) · ผู้แนะนำตรง
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLayerPopupModal(null)}
                  className="p-1.5 rounded-xl bg-white hover:bg-blue-50 border border-[#b8e5ff] text-[#0756bc] cursor-pointer shrink-0"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Layer Quick Selector inside Modal */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setLayerPopupModal('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border cursor-pointer ${
                    layerPopupModal === 'all'
                      ? 'bg-[#087cf4] text-white border-[#087cf4]'
                      : 'bg-white text-[#0756bc] border-[#b8e5ff]'
                  }`}
                >
                  ทุกชั้น ({totalSubtreeCount})
                </button>
                {Array.from({ length: 16 }, (_, idx) => idx).map((layerNum) => {
                  const cnt = (layersMap[layerNum] || []).length;
                  if (cnt === 0 && layerPopupModal !== layerNum) return null;
                  const active = layerPopupModal === layerNum;
                  return (
                    <button
                      key={`pop-l-${layerNum}`}
                      type="button"
                      onClick={() => setLayerPopupModal(layerNum)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border cursor-pointer ${
                        active
                          ? 'bg-[#087cf4] text-white border-[#087cf4]'
                          : 'bg-white text-[#0756bc] border-[#b8e5ff]'
                      }`}
                    >
                      ชั้น {layerNum} ({cnt})
                    </button>
                  );
                })}
              </div>

              {/* Status Filter Chips + Search */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { key: 'ALL', label: 'ทั้งหมด' },
                      { key: 'MAIN', label: 'Main ID' },
                      { key: 'AUTO', label: 'Auto ID' },
                      { key: 'CLONE', label: 'โคลนนิ่ง' },
                      { key: 'EXTRA', label: 'Extra ID' },
                    ] as const
                  ).map((f) => {
                    const active = popupTypeFilter === f.key;
                    const count = tagCounts[f.key];
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setPopupTypeFilter(f.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
                          active
                            ? 'bg-[#0754b9] text-white border-[#0754b9]'
                            : 'bg-white text-[#0756bc] border-[#b8e5ff]'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span
                          className={`px-1.5 rounded-full text-[10px] font-mono ${
                            active ? 'bg-white/25 text-white' : 'bg-[#e3f4ff] text-[#0756bc]'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#5a78a1] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={popupSearch}
                    onChange={(e) => setPopupSearch(e.target.value)}
                    placeholder="ค้นหาเลข ID, สถานะไอดี, เลขผู้แนะนำ หรือกระเป๋า..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#a9d7ff] text-xs font-semibold text-[#09265f] focus:outline-none focus:border-[#087cf4]"
                  />
                </div>
              </div>

              {/* Members Table / Cards */}
              {filteredEntries.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white border border-[#b8e5ff] text-xs font-semibold text-[#54759c]">
                  ไม่พบสมาชิกจริงตามเงื่อนไขที่เลือก
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredEntries.map((entry) => {
                    const n = entry.node;
                    const tag = getShortTypeTag(n);
                    const mainIdNum = getMainId(n);
                    const isClone = isCloneNode(n);
                    const totalClonesForMain = isClone
                      ? (cloneIdsByMainId.get(mainIdNum) || []).length
                      : 0;
                    const cloneSeq = isClone ? cloneSeqByNodeId.get(Number(n.id)) || 0 : 0;
                    const statusLabel = isClone
                      ? cloneSeq > 0
                        ? `โคลนนิ่ง · ครั้งที่ ${cloneSeq}`
                        : 'โคลนนิ่ง'
                      : getNodeTypeLabel(n);
                    const detailStatusLabel = isClone
                      ? `โคลนนิ่ง${cloneSeq > 0 ? ` ครั้งที่ ${cloneSeq}` : ''} ของ #${mainIdNum} (ทั้งหมด ${totalClonesForMain} ครั้ง · โหนด #${n.id})`
                      : n.id !== mainIdNum
                      ? `${statusLabel} (โหนด #${n.id})`
                      : statusLabel;
                    const originNode = n.originMainId
                      ? nodeMap.get(Number(n.originMainId))
                      : undefined;
                    const sponsorId =
                      Number(n.directSponsorNodeId || 0) > 0
                        ? Number(n.directSponsorNodeId)
                        : Number(originNode?.directSponsorNodeId || 0);
                    const sponsorNode = sponsorId > 0 ? nodeMap.get(sponsorId) : undefined;
                    const sponsorStatus = sponsorNode ? getShortTypeTag(sponsorNode) : '';

                    const badgeClass =
                      tag === 'AUTO'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : tag === 'EXTRA'
                        ? 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300'
                        : tag === 'CLONE'
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300';

                    return (
                      <div
                        key={`pop-member-${entry.layer}-${n.id}`}
                        className="p-3 rounded-xl bg-white border border-[#b8e5ff] flex items-center justify-between gap-2.5 text-xs shadow-2xs"
                      >
                        <div className="min-w-0 space-y-1 flex-1">
                          {/* Row 1: Main ID + Status (+ Total Clones) + Layer */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-sm text-[#0754b9]">
                              ID #{mainIdNum}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeClass}`}
                            >
                              {statusLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#eef7ff] text-[#35567e] font-mono text-[10px] font-bold">
                              ชั้น {entry.layer} ·{' '}
                              {entry.side === 'ROOT'
                                ? 'ROOT'
                                : entry.side === 'LEFT'
                                ? `ซ้ายใต้ #${entry.parentId}`
                                : `ขวาใต้ #${entry.parentId}`}
                            </span>
                          </div>

                          {/* Row 2: Explicit ID Status & Direct Sponsor */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] bg-[#f5fbff] px-2.5 py-1.5 rounded-lg border border-[#d7edff]">
                            <div>
                              <span className="text-[#5a78a1] font-semibold">สถานะไอดี: </span>
                              <strong className="text-[#09265f]">{detailStatusLabel}</strong>
                            </div>
                            <div>
                              <span className="text-[#5a78a1] font-semibold">ผู้แนะนำ: </span>
                              <strong className="font-mono text-[#0754b9]">
                                {sponsorId > 0 ? `#${sponsorId}` : '—'}
                              </strong>
                              {sponsorStatus && (
                                <span className="ml-1 text-[10px] text-[#54759c]">
                                  ({sponsorStatus})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] font-mono text-[#6283aa]">
                            Wallet: {shortAddr(n.owner)} · Rank {matrixRank}
                            {n.id !== mainIdNum ? ` · โหนดในผัง #${n.id}` : ''}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              focusNodeAsRoot(Number(n.id));
                              setLayerPopupModal(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#087cf4] hover:bg-[#0568d0] text-white text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                          >
                            เปิดผัง #{n.id}
                          </button>
                          {!n.isExtraId && !n.isClone && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectMainId(String(mainIdNum));
                                setLayerPopupModal(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#e6f5ff] hover:bg-[#d5eeff] border border-[#a5d6ff] text-[#0754b9] text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              สลับดู ID
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
