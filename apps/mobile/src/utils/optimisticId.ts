import * as Crypto from 'expo-crypto';

export const OPTIMISTIC_ID_PREFIX = '__optimistic-';

export function createOptimisticId(): string {
  return `${OPTIMISTIC_ID_PREFIX}${Crypto.randomUUID()}`;
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}
