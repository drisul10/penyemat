import type { KdfParams } from '../../src/lib/db/schema';
import { PenyematDB, setDb } from '../../src/lib/db/schema';

let counter = 0;

export async function freshDb(): Promise<PenyematDB> {
  const db = new PenyematDB(`test-${Date.now()}-${counter++}`);
  await db.open();
  setDb(db);
  return db;
}

/** Light Argon2id parameters so most tests run fast. One test covers the real defaults. */
export const FAST_KDF: KdfParams = { name: 'argon2id', memoryKiB: 64, iterations: 1, parallelism: 1 };
