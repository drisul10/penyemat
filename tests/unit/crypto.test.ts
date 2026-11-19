import { describe, expect, it } from 'vitest';
import { DEFAULT_KDF } from '../../src/lib/crypto/kdf';
import { createLock, decryptRecord, encryptRecord, PassphraseError, rekey, unlock } from '../../src/lib/crypto/lock';
import type { Bookmark } from '../../src/lib/db/schema';
import { FAST_KDF } from './helpers';

const bookmark: Bookmark = {
  id: 'b1',
  url: 'https://homes.example.com/river',
  title: 'Apartment listings near the river',
  site: 'homes.example.com',
  favicon: '',
  savedAt: 1,
  updatedAt: 1,
  categoryId: 'unsorted',
  textStatus: 'ok',
};

describe('locked shelf crypto (F4)', () => {
  it('uses Argon2id 19 MiB, 2 passes by default and round-trips a record', async () => {
    expect(DEFAULT_KDF).toEqual({ name: 'argon2id', memoryKiB: 19456, iterations: 2, parallelism: 1 });
    const { meta, unlocked } = await createLock('correct horse', 'Locked');
    expect(unlocked.raw.length).toBe(32);
    const record = await encryptRecord(unlocked.key, { bookmark, text: 'two bedrooms by the water' });
    const again = await unlock(meta, 'correct horse');
    expect(again).not.toBeNull();
    if (!again) return;
    expect(await decryptRecord(again.key, record)).toEqual({ bookmark, text: 'two bedrooms by the water' });
  });

  it('keeps no readable data in the stored record', async () => {
    const { unlocked } = await createLock('correct horse', 'Locked', FAST_KDF);
    const record = await encryptRecord(unlocked.key, { bookmark, text: 'two bedrooms by the water' });
    const stored = new TextDecoder('latin1').decode(record.ciphertext);
    expect(stored).not.toContain('homes.example.com');
    expect(stored).not.toContain('bedrooms');
    expect(record.iv.length).toBe(12);
  });

  it('refuses a wrong passphrase with no limit (F4.11)', async () => {
    const { meta } = await createLock('correct horse', 'Locked', FAST_KDF);
    for (let i = 0; i < 5; i++) expect(await unlock(meta, `wrong one ${i}`)).toBeNull();
    expect(await unlock(meta, 'correct horse')).not.toBeNull();
  });

  it('refuses a 7-character passphrase (F4.10)', async () => {
    await expect(createLock('1234567', 'Locked', FAST_KDF)).rejects.toBeInstanceOf(PassphraseError);
    await expect(createLock('12345678', 'Locked', FAST_KDF)).resolves.toBeTruthy();
  });

  it('re-encrypts every record on passphrase change, and the old one stops working (F4.9)', async () => {
    const first = await createLock('old passphrase', 'Locked', FAST_KDF);
    const record = await encryptRecord(first.unlocked.key, { bookmark, text: 'x' });
    const next = await rekey(first.meta, first.unlocked.key, [record], 'new passphrase');
    expect(await unlock(next.meta, 'old passphrase')).toBeNull();
    const key = await unlock(next.meta, 'new passphrase');
    expect(key).not.toBeNull();
    if (!key || !next.records[0]) return;
    expect((await decryptRecord(key.key, next.records[0])).bookmark.title).toBe(bookmark.title);
    await expect(decryptRecord(first.unlocked.key, next.records[0])).rejects.toThrow();
  });
});
