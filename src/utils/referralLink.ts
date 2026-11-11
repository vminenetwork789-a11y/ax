export const REFERRAL_STORAGE_KEY = 'f27_referral_sponsor_id';

/**
 * Reads ?ref= or ?sponsor= from current URL query string or hash.
 * If found and valid (>= 1), saves it to localStorage and returns the numeric ID.
 */
export function detectAndSaveReferralFromUrl(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const rawRef =
      params.get('ref') ||
      params.get('sponsor') ||
      params.get('upline') ||
      params.get('r');

    if (rawRef) {
      const cleaned = rawRef.replace(/[^0-9]/g, '');
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        window.localStorage.setItem(REFERRAL_STORAGE_KEY, String(parsed));
        return parsed;
      }
    }

    // Also check hash query e.g. #/?ref=5
    if (window.location.hash && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashQuery);
      const hashRef = hashParams.get('ref') || hashParams.get('sponsor');
      if (hashRef) {
        const cleaned = hashRef.replace(/[^0-9]/g, '');
        const parsed = parseInt(cleaned, 10);
        if (!isNaN(parsed) && parsed >= 1) {
          window.localStorage.setItem(REFERRAL_STORAGE_KEY, String(parsed));
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage/URL parsing errors
  }
  return null;
}

/**
 * Returns the active referral sponsor ID from URL first, or from localStorage if previously visited via referral link.
 */
export function getActiveReferralSponsorId(): number | null {
  const fromUrl = detectAndSaveReferralFromUrl();
  if (fromUrl && fromUrl >= 1) return fromUrl;

  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Sets or updates the active referral sponsor ID in localStorage and URL query param without reloading.
 */
export function setActiveReferralSponsorId(sponsorId: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (sponsorId && sponsorId >= 1) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, String(sponsorId));
    } else {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent('matrix:referral:changed', { detail: { sponsorId } })
    );
  } catch {
    // Ignore
  }
}

/**
 * Builds the shareable referral URL for a given Main / Sponsor Node ID.
 */
export function buildReferralLink(nodeId: number | string): string {
  const cleanId = Math.max(1, parseInt(String(nodeId).replace(/[^0-9]/g, ''), 10) || 1);
  if (typeof window === 'undefined') {
    return `https://fractalflowmatrix27.app/?ref=${cleanId}`;
  }
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('ref', String(cleanId));
  return url.toString();
}
