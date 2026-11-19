import type { Bookmark, KdfParams, LockedRecord, LockMeta } from '../db/schema';
import { importKey, open, openJson, seal, sealJson } from './aes';
import { fingerprint } from './fingerprint';
import { DEFAULT_KDF, deriveKeyBytes, MIN_PASSPHRASE, randomBytes } from './kdf';

const VERIFIER = new TextEncoder().encode('penyemat-verifier-v1');

/** What a locked record holds once decrypted: the whole bookmark plus its page text. */
export interface LockedPayload {
  bookmark: Bookmark;
  text: string;
}

export interface UnlockedKey {
  raw: Uint8Array;
  key: CryptoKey;
}

export class PassphraseError extends Error {}

export function checkNewPassphrase(passphrase: string): void {
  if ([...passphrase].length < MIN_PASSPHRASE) {
    throw new PassphraseError(`Use at least ${MIN_PASSPHRASE} characters.`);
  }
}

export async function createLock(
  passphrase: string,
  shelfName: string,
  kdf: KdfParams = DEFAULT_KDF,
): Promise<{ meta: LockMeta; unlocked: UnlockedKey }> {
  checkNewPassphrase(passphrase);
  const salt = randomBytes(16);
  const raw = await deriveKeyBytes(passphrase, salt, kdf);
  const key = await importKey(raw);
  const verifier = await seal(key, VERIFIER);
  const meta: LockMeta = {
    id: 'lock',
    shelfName: shelfName.trim() || 'Locked',
    salt,
    kdf,
    verifierIv: verifier.iv,
    verifier: verifier.ciphertext,
    fingerprintSalt: randomBytes(16),
  };
  return { meta, unlocked: { raw, key } };
}

/** Returns the key, or null when the passphrase doesn't match. No attempt limit (F4.11). */
export async function unlock(meta: LockMeta, passphrase: string): Promise<UnlockedKey | null> {
  const raw = await deriveKeyBytes(passphrase, meta.salt, meta.kdf);
  const key = await importKey(raw);
  return (await verifyKey(meta, key)) ? { raw, key } : null;
}

export async function verifyKey(meta: LockMeta, key: CryptoKey): Promise<boolean> {
  try {
    const plain = await open(key, { iv: meta.verifierIv, ciphertext: meta.verifier });
    return plain.length === VERIFIER.length && plain.every((byte, i) => byte === VERIFIER[i]);
  } catch {
    return false;
  }
}

/** Pass the shelf's fingerprint salt so the toolbar button can recognise the address later. */
export async function encryptRecord(
  key: CryptoKey,
  payload: LockedPayload,
  fingerprintSalt?: Uint8Array,
): Promise<LockedRecord> {
  const sealed = await sealJson(key, payload);
  const record: LockedRecord = { id: crypto.randomUUID(), iv: sealed.iv, ciphertext: sealed.ciphertext };
  if (fingerprintSalt) record.fingerprint = await fingerprint(fingerprintSalt, payload.bookmark.url);
  return record;
}

export async function decryptRecord(key: CryptoKey, record: LockedRecord): Promise<LockedPayload> {
  return openJson<LockedPayload>(key, record);
}

/** Re-encrypts every record under a new passphrase (F4.9). The caller writes all of it in one transaction. */
export async function rekey(
  meta: LockMeta,
  oldKey: CryptoKey,
  records: LockedRecord[],
  newPassphrase: string,
): Promise<{ meta: LockMeta; records: LockedRecord[]; unlocked: UnlockedKey }> {
  const next = await createLock(newPassphrase, meta.shelfName, meta.kdf);
  // The fingerprint salt doesn't depend on the passphrase, so existing fingerprints stay valid.
  const salt = meta.fingerprintSalt ?? next.meta.fingerprintSalt ?? randomBytes(16);
  next.meta.fingerprintSalt = salt;
  const reSealed: LockedRecord[] = [];
  for (const record of records) {
    const payload = await decryptRecord(oldKey, record);
    const sealed = await sealJson(next.unlocked.key, payload);
    reSealed.push({
      id: record.id,
      iv: sealed.iv,
      ciphertext: sealed.ciphertext,
      fingerprint: await fingerprint(salt, payload.bookmark.url),
    });
  }
  return { meta: next.meta, records: reSealed, unlocked: next.unlocked };
}
