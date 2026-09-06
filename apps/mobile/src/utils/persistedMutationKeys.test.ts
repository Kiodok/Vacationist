import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Static guard (Phase 19): every key in `PERSISTED_MUTATION_KEYS` must have a
 * matching `setMutationDefaults([...])` registration, and vice-versa. A queued
 * offline mutation replays from the persisted queue only via its default
 * `mutationFn` — a key in the list with no default silently no-ops on cold-start
 * replay; a default not in the list is never persisted. This exact drift shipped
 * twice before (`settleAllExpenses`, `deleteAllNotifications`).
 *
 * Done by parsing source text rather than importing the modules, because
 * `mutationDefaults.ts` pulls in `@vacationist/api` (react-native), which the
 * node test environment can't load.
 */

const HERE = __dirname;

function readSrc(rel: string): string {
  return readFileSync(join(HERE, rel), 'utf8');
}

function persistedKeys(): Set<string> {
  const src = readSrc('queryClient.ts');
  const block = src.slice(
    src.indexOf('PERSISTED_MUTATION_KEYS = ['),
    src.indexOf('] as const;'),
  );
  const keys = new Set<string>();
  for (const m of block.matchAll(/'([a-zA-Z]+)'/g)) keys.add(m[1]);
  return keys;
}

function registeredDefaultKeys(): Set<string> {
  const src = readSrc('mutationDefaults.ts');
  const keys = new Set<string>();
  // setMutationDefaults(['key'], ...)  — the first element of the key array
  for (const m of src.matchAll(/setMutationDefaults\(\[\s*'([a-zA-Z]+)'/g)) keys.add(m[1]);
  return keys;
}

describe('PERSISTED_MUTATION_KEYS ⟷ mutationDefaults', () => {
  const persisted = persistedKeys();
  const registered = registeredDefaultKeys();

  it('has a non-trivial list (parser sanity)', () => {
    expect(persisted.size).toBeGreaterThan(50);
    expect(registered.size).toBeGreaterThan(50);
  });

  it('every persisted key has a mutation default (else it no-ops on cold-start replay)', () => {
    const missing = [...persisted].filter((k) => !registered.has(k));
    expect(missing).toEqual([]);
  });

  it('every mutation default is registered as persisted (else it is never queued)', () => {
    const missing = [...registered].filter((k) => !persisted.has(k));
    expect(missing).toEqual([]);
  });
});
