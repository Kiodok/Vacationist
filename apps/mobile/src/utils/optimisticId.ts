import * as Crypto from 'expo-crypto';

export const OPTIMISTIC_ID_PREFIX = '__optimistic-';

export function createOptimisticId(): string {
  return `${OPTIMISTIC_ID_PREFIX}${Crypto.randomUUID()}`;
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

/**
 * A REAL UUID minted on the device, to be sent as the row's primary key. Unlike `createOptimisticId`
 * it is never rewritten: the optimistic row, the queued mutation and the server row all carry it, so
 * work queued behind an offline create (an item inside an offline-created list) can reference it.
 */
export function createClientId(): string {
  return Crypto.randomUUID();
}
