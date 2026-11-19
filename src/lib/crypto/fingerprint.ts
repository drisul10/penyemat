import { normalizeUrl } from '../url';

// Address fingerprints for the locked shelf (owner's choice, 2026-11-19: "Store address fingerprints").
// A salted SHA-256 of the normalized address lets the toolbar button see that a page is already
// locked without the key. Someone with a copy of the data can test a guessed address, but can't
// list or read the shelf.

export async function fingerprint(salt: Uint8Array, url: string): Promise<string> {
  let normalized = url;
  try {
    normalized = normalizeUrl(url);
  } catch {
    // Keep the raw address; it is what was saved.
  }
  const address = new TextEncoder().encode(normalized);
  const input = new Uint8Array(salt.length + address.length);
  input.set(salt);
  input.set(address, salt.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}
