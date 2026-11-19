// URL normalization (ARCHITECTURE.md section 4): lowercase the host, drop the #fragment,
// drop utm_*, fbclid, and gclid parameters, keep the path as is.

const TRACKING_PARAMS = new Set(['fbclid', 'gclid']);

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  const keep: [string, string][] = [];
  for (const [key, value] of url.searchParams) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) continue;
    keep.push([key, value]);
  }
  if (keep.length !== [...url.searchParams].length) {
    url.search = keep.length ? `?${new URLSearchParams(keep).toString()}` : '';
  }
  return url.toString();
}

/** Host without a leading "www.", used as the card's site line. */
export function siteOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, '');
  } catch {
    return input;
  }
}

/** Parses an address the user typed. Returns null unless it is a full http(s) address. */
export function parseUserUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}
