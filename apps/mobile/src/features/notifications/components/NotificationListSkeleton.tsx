import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, colors } from '@vacationist/ui';

function NotificationItemSkeleton() {
  return (
    <View style={styles.item}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={styles.content}>
        <Skeleton width="65%" height={15} borderRadius={4} />
        <Skeleton width="45%" height={12} borderRadius={4} style={styles.body} />
        <Skeleton width={48} height={11} borderRadius={4} style={styles.time} />
      </View>
      <Skeleton width={8} height={8} borderRadius={4} />
    </View>
  );
}

export function NotificationListSkeleton() {
  return (
    <View style={styles.container}>
      {[0, 1, 2, 3, 4].map((i) => (
        <NotificationItemSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  body: {
    marginTop: 2,
  },
  time: {
    marginTop: 2,
  },
});
