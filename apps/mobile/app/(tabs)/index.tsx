import { useState, useMemo } from 'react';
import { View, Text, Pressable, Image, RefreshControl, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
import { TripCard, getEffectiveStatus } from '../../src/features/trips/components/TripCard';
import { TripListSkeleton } from '../../src/features/trips/components/TripListSkeleton';
import { EmptyTrips } from '../../src/features/trips/components/EmptyTrips';
import { useAuthStore } from '../../src/stores/authStore';
import type { Trip } from '@vacationist/types';
import { colors } from '@vacationist/ui';

type TripWithCount = Trip & { member_count: number };

const SECTIONS = [
  {
    key: 'planning' as const,
    title: 'In Planning',
    icon: 'calendar-outline' as const,
    iconColor: colors.primary,
    textClass: 'text-primary',
  },
  {
    key: 'active' as const,
    title: 'Ongoing',
    icon: 'airplane-outline' as const,
    iconColor: colors.success,
    textClass: 'text-success',
  },
  {
    key: 'completed' as const,
    title: 'Completed',
    icon: 'checkmark-done-outline' as const,
    iconColor: colors.textMuted,
    textClass: 'text-text-muted',
  },
] as const;

export default function TripsScreen() {
  const router = useRouter();
  const { data: trips, isLoading, isFetching, refetch } = useTrips();
  const user = useAuthStore((s) => s.user);
  const [avatarError, setAvatarError] = useState(false);

  const sections = useMemo(() => {
    if (!trips) return [];
    const buckets: Record<'planning' | 'active' | 'completed', TripWithCount[]> = {
      planning: [],
      active: [],
      completed: [],
    };
    for (const trip of trips as TripWithCount[]) {
      const s = getEffectiveStatus(trip);
      if (s === 'active') {
        buckets.active.push(trip);
      } else if (s === 'completed' || s === 'archived') {
        buckets.completed.push(trip);
      } else {
        buckets.planning.push(trip);
      }
    }
    return SECTIONS
      .filter((cfg) => buckets[cfg.key].length > 0)
      .map((cfg) => ({ ...cfg, data: buckets[cfg.key] }));
  }, [trips]);

  function handleCreateTrip() {
    router.push('/trip/create' as never);
  }

  function handleTripPress(tripId: string) {
    router.push({ pathname: '/trip/[id]', params: { id: tripId } } as never);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <TripListSkeleton />
      </SafeAreaView>
    );
  }

  if (!trips || trips.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <EmptyTrips onCreateTrip={handleCreateTrip} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListHeaderComponent={
          <View className="flex-row items-center justify-between pt-md pb-sm">
            <Pressable
              onPress={() => router.navigate('/(tabs)/profile' as never)}
              className="w-[40px] h-[40px] rounded-full bg-surface items-center justify-center overflow-hidden"
            >
              {user?.avatar_url && !avatarError ? (
                <Image
                  source={{ uri: user.avatar_url }}
                  className="w-full h-full"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <Ionicons name="person" size={20} color="#FFFFFF" />
              )}
            </Pressable>
            <Text className="text-heading-xl text-text-primary">Trips</Text>
            <View className="w-[40px]" />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center gap-xs pt-md pb-sm px-xs">
            <Ionicons name={section.icon} size={16} color={section.iconColor} />
            <Text className={`text-body font-semibold ${section.textClass}`}>
              {section.title}
            </Text>
            <Text className="text-body-small text-text-muted">({section.data.length})</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="mb-sm">
            <TripCard
              trip={item}
              onPress={() => handleTripPress(item.id)}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      <Pressable
        onPress={handleCreateTrip}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}
