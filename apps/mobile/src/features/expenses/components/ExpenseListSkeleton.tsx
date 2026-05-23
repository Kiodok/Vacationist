import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, colors } from '@vacationist/ui';

function ExpenseItemSkeleton() {
  return (
    <View style={styles.item}>
      <View style={styles.left}>
        <Skeleton width="50%" height={16} borderRadius={5} />
        <Skeleton width="35%" height={12} borderRadius={4} style={styles.sub} />
      </View>
      <View style={styles.right}>
        <Skeleton width={64} height={18} borderRadius={5} />
        <Skeleton width={48} height={20} borderRadius={10} style={styles.badge} />
      </View>
    </View>
  );
}

export function ExpenseListSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton width={80} height={14} borderRadius={4} style={styles.sectionHeader} />
      {[0, 1, 2].map((i) => (
        <ExpenseItemSkeleton key={i} />
      ))}
      <Skeleton width={80} height={14} borderRadius={4} style={styles.sectionHeader} />
      {[0, 1].map((i) => (
        <ExpenseItemSkeleton key={i + 3} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 2,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    gap: 6,
  },
  sub: {
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    marginTop: 2,
  },
});
