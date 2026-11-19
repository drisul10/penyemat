// AES-GCM 256 with a fresh 12-byte IV per encryption (PRD F4.3, ARCHITECTURE 5.5).

export interface Sealed {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

/** The CryptoKey is non-extractable. Raw bytes are kept only for sharing with other library tabs. */
export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, plaintext: Uint8Array): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext as BufferSource);
  return { iv, ciphertext: new Uint8Array(buffer) };
}

/** Throws when the key is wrong or the data was changed (GCM tag check). */
export async function open(key: CryptoKey, sealed: Sealed): Promise<Uint8Array> {
  const buffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv as BufferSource },
    key,
    sealed.ciphertext as BufferSource,
  );
  return new Uint8Array(buffer);
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  return seal(key, new TextEncoder().encode(JSON.stringify(value)));
}

export async function openJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await open(key, sealed))) as T;
}
