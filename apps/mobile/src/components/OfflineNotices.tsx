import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutationState } from '@tanstack/react-query';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToastStore } from '../stores/toastStore';

/** How long the "you're offline" launch notice stays up before dismissing itself. */
const LAUNCH_TOAST_MS = 5000;

/**
 * Renders nothing — owns the two transient offline notices that replaced the permanent bottom bar
 * (v1.39.0). Users expect offline changes to persist and sync on their own, so the app stays quiet
 * except at the two moments they'd otherwise wonder what happened:
 *
 *  1. Launch while offline → one reassuring toast, once per app launch. Only the FIRST resolved
 *     connectivity status counts: going offline mid-session shows just the header indicator, so a
 *     flapping connection can't spam toasts.
 *  2. Reconnect after changes were queued → "All changes synced" once the replay has drained.
 *
 * There is deliberately no change counter anywhere.
 */
export function OfflineNotices() {
  const { t } = useTranslation('common');
  const { isConnected } = useNetworkStatus();
  const addToast = useToastStore((s) => s.addToast);

  // Mutations queued while offline (paused, waiting for reconnect).
  const pausedCount = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.isPaused,
  }).filter(Boolean).length;

  // All pending mutations (paused or in flight) — when this drains to zero after a reconnect, the
  // replay is complete.
  const pendingCount = useMutationState({ filters: { status: 'pending' } }).length;

  const launchHandledRef = useRef(false);
  const hadQueuedRef = useRef(false);
  const prevConnectedRef = useRef<boolean | null>(null);
  const [awaitingDrain, setAwaitingDrain] = useState(false);

  // null = status not determined yet → wait; only the first real answer decides the launch toast.
  useEffect(() => {
    if (isConnected === null || launchHandledRef.current) return;
    launchHandledRef.current = true;
    if (isConnected === false) {
      addToast('warning', t('offline.launchToast'), { durationMs: LAUNCH_TOAST_MS });
    }
  }, [isConnected, addToast, t]);

  // Remember that work was queued offline so a reconnect with nothing to replay stays silent.
  useEffect(() => {
    if (isConnected === false && pausedCount > 0) hadQueuedRef.current = true;
  }, [isConnected, pausedCount]);

  useEffect(() => {
    const prev = prevConnectedRef.current;
    prevConnectedRef.current = isConnected;
    if (prev === false && isConnected === true && hadQueuedRef.current) setAwaitingDrain(true);
  }, [isConnected]);

  useEffect(() => {
    if (!awaitingDrain || pendingCount > 0) return;
    hadQueuedRef.current = false;
    setAwaitingDrain(false);
    addToast('success', t('offline.synced'));
  }, [awaitingDrain, pendingCount, addToast, t]);

  return null;
}
