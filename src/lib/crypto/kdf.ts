import { argon2id } from 'hash-wasm';
import type { KdfParams } from '../db/schema';

// Argon2id at the OWASP minimum: 19 MiB, 2 passes, 1 lane (ARCHITECTURE 5.5, risk T4).
// Parameters are stored with the lock so a later version can raise them on passphrase change.
export const DEFAULT_KDF: KdfParams = {
  name: 'argon2id',
  memoryKiB: 19 * 1024,
  iterations: 2,
  parallelism: 1,
};

export const MIN_PASSPHRASE = 8;

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Derives the 32 raw key bytes. The caller keeps them in memory only (F4.4). */
export async function deriveKeyBytes(passphrase: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  return argon2id({
    password: passphrase.normalize('NFC'),
    salt,
    memorySize: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
}
