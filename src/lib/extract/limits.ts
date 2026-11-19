// Saving rules shared by the toolbar save and the pasted-link save (PRD F1.5, F1.6, F1.7).

export const TEXT_CAP_BYTES = 100 * 1024;

/** Cuts text to its first 100 KB of UTF-8 without splitting a character (F1.7). */
export function capText(text: string, maxBytes = TEXT_CAP_BYTES): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  let end = maxBytes;
  // Step back over UTF-8 continuation bytes (10xxxxxx) so the cut lands on a character start.
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

/** Collapses runs of whitespace so stored text stays compact. */
export function cleanText(text: string): string {
  return text
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const STORE_HOSTS = [
  'chromewebstore.google.com',
  'chrome.google.com/webstore',
  'microsoftedge.microsoft.com/addons',
  'addons.mozilla.org',
  'addons.opera.com',
];

/** Pages the browser won't let an extension read: settings, new tab, extension stores (F1.6). */
export function isUnsavable(url: string | undefined): boolean {
  if (!url) return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const hostPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  return STORE_HOSTS.some((store) => hostPath.startsWith(store));
}

/** PDFs are saved as unreadable in v1 (ARCHITECTURE section 1, PRD F1.5). */
export function isPdf(url: string, contentType?: string): boolean {
  if (contentType?.toLowerCase().includes('application/pdf')) return true;
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}
