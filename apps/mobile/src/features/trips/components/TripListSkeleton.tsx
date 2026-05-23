import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@vacationist/ui';
import { colors } from '@vacationist/ui';

function TripCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Skeleton width="60%" height={20} borderRadius={6} />
        <Skeleton width={60} height={22} borderRadius={11} />
      </View>
      <Skeleton width="40%" height={14} borderRadius={4} style={styles.date} />
      <View style={styles.footer}>
        <View style={styles.avatars}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={28} height={28} borderRadius={14} style={{ marginLeft: i > 0 ? -8 : 0 }} />
          ))}
        </View>
        <Skeleton width={50} height={14} borderRadius={4} />
      </View>
    </View>
  );
}

export function TripListSkeleton() {
  return (
    <View style={styles.container}>
      {[0, 1, 2].map((i) => (
        <TripCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  avatars: {
    flexDirection: 'row',
  },
});
