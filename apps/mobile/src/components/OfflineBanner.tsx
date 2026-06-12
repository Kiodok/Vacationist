import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutationState } from '@tanstack/react-query';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '@vacationist/ui';

export const OFFLINE_BANNER_HEIGHT = 28;

// idle → (reconnect with queued changes) → syncing → (queue drained) → synced → idle
type SyncPhase = 'idle' | 'syncing' | 'synced';

export function OfflineBanner() {
  const { t } = useTranslation('common');
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  // Mutations queued while offline (paused, waiting for reconnect).
  const pausedCount = useMutationState({
    filters: { status: 'pending' },
    select: (m) => m.state.isPaused,
  }).filter(Boolean).length;

  // All pending mutations (paused or in flight) — when this drains to zero
  // after a reconnect, the replay is complete.
  const pendingCount = useMutationState({ filters: { status: 'pending' } }).length;

  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const hadQueuedRef = useRef(false);
  const prevConnectedRef = useRef<boolean | null>(null);

  // Remember that work was queued offline so the banner doesn't flash
  // "Syncing…" on reconnects with nothing to replay.
  useEffect(() => {
    if (isConnected === false && pausedCount > 0) {
      hadQueuedRef.current = true;
    }
  }, [isConnected, pausedCount]);

  useEffect(() => {
    const prev = prevConnectedRef.current;
    prevConnectedRef.current = isConnected;
    if (prev === false && isConnected === true && hadQueuedRef.current) {
      setSyncPhase('syncing');
    }
  }, [isConnected]);

  useEffect(() => {
    if (syncPhase !== 'syncing' || pendingCount > 0) return;
    hadQueuedRef.current = false;
    setSyncPhase('synced');
  }, [syncPhase, pendingCount]);

  // Separate effect so the cleanup from the syncing→synced transition does not
  // cancel this timer. Without the split, setSyncPhase('synced') re-triggers
  // the combined effect, whose cleanup calls clearTimeout before it fires.
  useEffect(() => {
    if (syncPhase !== 'synced') return;
    const timer = setTimeout(() => setSyncPhase('idle'), 2500);
    return () => clearTimeout(timer);
  }, [syncPhase]);

  // null = status not yet determined → keep banner hidden until we know for sure
  if (isConnected === false) {
    return (
      <View style={[styles.banner, { bottom: insets.bottom, backgroundColor: colors.warning }]}>
        <Ionicons name="cloud-offline-outline" size={14} color="#000" />
        <Text style={styles.text}>
          {pausedCount > 0
            ? t('offline.pendingChanges', { count: pausedCount })
            : t('offline.banner')}
        </Text>
      </View>
    );
  }

  if (syncPhase === 'syncing') {
    return (
      <View style={[styles.banner, { bottom: insets.bottom, backgroundColor: colors.primary }]}>
        <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
        <Text style={[styles.text, styles.textLight]}>{t('offline.syncing')}</Text>
      </View>
    );
  }

  if (syncPhase === 'synced') {
    return (
      <View style={[styles.banner, { bottom: insets.bottom, backgroundColor: colors.success }]}>
        <Ionicons name="checkmark-circle-outline" size={14} color="#000" />
        <Text style={styles.text}>{t('offline.synced')}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: OFFLINE_BANNER_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 9,
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  textLight: {
    color: '#FFFFFF',
  },
});
