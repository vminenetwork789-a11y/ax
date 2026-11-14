export interface PostTxNoticePayload {
  id: string;
  type: 'register' | 'upgrade' | 'admin_upgrade';
  status: 'confirmed';
  step: string;
  message: string;
  txHash?: string | null;
  assignedNodeIds?: number[];
  targetRank?: number;
  mainId?: number;
  timestamp: string;
  createdAtMs: number;
}

export interface PostTxViewTarget {
  selectedRank?: number;
  selectedMainId?: number;
  focusNodeId?: number;
  assignedNodeIds?: number[];
  type?: 'register' | 'upgrade' | 'admin_upgrade';
  targetRank?: number;
  mainId?: number;
  createdAtMs: number;
}

const POST_TX_NOTICE_KEY = 'f27_post_tx_notice';
const POST_TX_VIEW_KEY = 'f27_post_tx_view';
const MAX_AGE_MS = 90_000;

let pendingReloadTimer: number | null = null;

export function savePostTxNotice(
  payload: Omit<PostTxNoticePayload, 'id' | 'status' | 'timestamp' | 'createdAtMs'>
) {
  if (typeof window === 'undefined') return;
  try {
    const item: PostTxNoticePayload = {
      ...payload,
      id: `post-tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      createdAtMs: Date.now(),
    };
    sessionStorage.setItem(POST_TX_NOTICE_KEY, JSON.stringify(item));
  } catch {
    // Ignore storage quota errors
  }
}

export function consumePostTxNotice(): PostTxNoticePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(POST_TX_NOTICE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(POST_TX_NOTICE_KEY);
    const parsed = JSON.parse(raw) as PostTxNoticePayload;
    if (!parsed || Date.now() - Number(parsed.createdAtMs || 0) > MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePostTxViewTarget(
  target: Omit<PostTxViewTarget, 'createdAtMs'>
) {
  if (typeof window === 'undefined') return;
  try {
    const item: PostTxViewTarget = {
      ...target,
      createdAtMs: Date.now(),
    };
    sessionStorage.setItem(POST_TX_VIEW_KEY, JSON.stringify(item));
  } catch {
    // Ignore storage errors
  }
}

export function peekPostTxViewTarget(): PostTxViewTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(POST_TX_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostTxViewTarget;
    if (!parsed || Date.now() - Number(parsed.createdAtMs || 0) > MAX_AGE_MS) {
      sessionStorage.removeItem(POST_TX_VIEW_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumePostTxViewTarget(): PostTxViewTarget | null {
  if (typeof window === 'undefined') return null;
  const parsed = peekPostTxViewTarget();
  try {
    sessionStorage.removeItem(POST_TX_VIEW_KEY);
  } catch {
    // Ignore
  }
  return parsed;
}

export function triggerAutoPageRefresh(delayMs = 1300) {
  if (typeof window === 'undefined') return;
  if (pendingReloadTimer !== null) {
    window.clearTimeout(pendingReloadTimer);
    pendingReloadTimer = null;
  }
  pendingReloadTimer = window.setTimeout(() => {
    pendingReloadTimer = null;
    try {
      window.location.reload();
    } catch {
      // Fallback: force reload via href assignment
      window.location.href = window.location.href;
    }
  }, Math.max(300, delayMs));
}
