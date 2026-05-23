import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, colors } from '@vacationist/ui';

function ActivityCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width="55%" height={18} borderRadius={5} />
        <Skeleton width={70} height={22} borderRadius={11} />
      </View>
      <Skeleton width="35%" height={13} borderRadius={4} style={styles.meta} />
      <View style={styles.votes}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={52} height={28} borderRadius={14} />
        ))}
      </View>
    </View>
  );
}

function SectionHeaderSkeleton() {
  return <Skeleton width={100} height={14} borderRadius={4} style={styles.sectionHeader} />;
}

export function ActivityListSkeleton() {
  return (
    <View style={styles.container}>
      <SectionHeaderSkeleton />
      <ActivityCardSkeleton />
      <ActivityCardSkeleton />
      <SectionHeaderSkeleton />
      <ActivityCardSkeleton />
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
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    marginTop: 2,
  },
  votes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
