import { useState, useMemo } from 'react';
import { View, Text, Pressable, Image, RefreshControl, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
import { TripCard, getEffectiveStatus } from '../../src/features/trips/components/TripCard';
import { TripListSkeleton } from '../../src/features/trips/components/TripListSkeleton';
import { EmptyTrips } from '../../src/features/trips/components/EmptyTrips';
import { useAuthStore } from '../../src/stores/authStore';
import { useCollapsibleSections } from '../../src/hooks/useCollapsibleSections';
import { CollapsibleSectionHeader } from '../../src/components/CollapsibleSectionHeader';
import { SearchInput } from '../../src/components/SearchInput';
import type { Trip } from '@vacationist/types';
import { colors } from '@vacationist/ui';
import { getQueryDisplayState } from '../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../src/components/OfflineEmptyState';

type TripWithCount = Trip & { member_count: number };
type YearDivider = { __type: 'year_divider'; year: number; sectionKey: string };
type SectionItem = TripWithCount | YearDivider;

function insertYearDividers(
  trips: TripWithCount[],
  dateField: 'start_date' | 'end_date',
  descending: boolean,
  sectionKey: string,
): SectionItem[] {
  if (trips.length === 0) return [];
  const sorted = [...trips].sort((a, b) => {
    const diff = a[dateField].localeCompare(b[dateField]);
    return descending ? -diff : diff;
  });
  const years = new Set(sorted.map((t) => dayjs(t[dateField]).year()));
  if (years.size <= 1) return sorted;
  const items: SectionItem[] = [];
  let currentYear: number | null = null;
  for (const trip of sorted) {
    const year = dayjs(trip[dateField]).year();
    if (year !== currentYear) {
      items.push({ __type: 'year_divider', year, sectionKey });
      currentYear = year;
    }
    items.push(trip);
  }
  return items;
}

export default function TripsScreen() {
  const { t } = useTranslation('trips');
  const router = useRouter();
  const tripsQuery = useTrips();
  const { data: trips, refetch } = tripsQuery;
  const ux = getQueryDisplayState(tripsQuery);
  const user = useAuthStore((s) => s.user);
  const [avatarError, setAvatarError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toggle, isCollapsed } = useCollapsibleSections({ defaultCollapsed: ['completed'] });

  const SECTIONS = useMemo(() => [
    {
      key: 'active' as const,
      title: t('section.ongoing'),
      icon: 'airplane-outline' as const,
      iconColor: colors.success,
      textClass: 'text-success',
    },
    {
      key: 'planning' as const,
      title: t('section.inPlanning'),
      icon: 'calendar-outline' as const,
      iconColor: colors.primary,
      textClass: 'text-primary',
    },
    {
      key: 'completed' as const,
      title: t('section.completed'),
      icon: 'checkmark-done-outline' as const,
      iconColor: colors.textMuted,
      textClass: 'text-text-muted',
    },
  ] as const, [t]);

  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trips as TripWithCount[];
    return (trips as TripWithCount[]).filter(
      (trip) =>
        trip.title.toLowerCase().includes(q) ||
        trip.description?.toLowerCase().includes(q),
    );
  }, [trips, searchQuery]);

  const sections = useMemo(() => {
    const buckets: Record<'planning' | 'active' | 'completed', TripWithCount[]> = {
      planning: [],
      active: [],
      completed: [],
    };
    for (const trip of filteredTrips) {
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
      .map((cfg) => {
        const tripCount = buckets[cfg.key].length;
        let items: SectionItem[];
        if (cfg.key === 'completed') {
          items = insertYearDividers(buckets[cfg.key], 'end_date', true, cfg.key);
        } else if (cfg.key === 'planning') {
          items = insertYearDividers(buckets[cfg.key], 'start_date', false, cfg.key);
        } else {
          items = buckets[cfg.key];
        }
        return {
          ...cfg,
          originalCount: tripCount,
          data: isCollapsed(cfg.key) ? [] : items,
        };
      });
  }, [filteredTrips, SECTIONS, isCollapsed]);

  function handleCreateTrip() {
    router.push('/trip/create' as never);
  }

  function handleTripPress(tripId: string) {
    router.push({ pathname: '/trip/[id]', params: { id: tripId } } as never);
  }

  if (ux.showSkeleton) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <TripListSkeleton />
      </SafeAreaView>
    );
  }
  if (ux.showOfflineEmpty) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <OfflineEmptyState onRetry={refetch} />
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
        keyExtractor={(item) => '__type' in item ? `${item.sectionKey}-year-${item.year}` : item.id}
        stickySectionHeadersEnabled={false}
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListHeaderComponent={
          <View className="pt-md pb-sm gap-sm">
            <View className="flex-row items-center justify-between">
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
              <Text className="text-heading-xl text-text-primary">{t('screen.title')}</Text>
              <View className="w-[40px]" />
            </View>
            <SearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('search.placeholder')}
            />
          </View>
        }
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View className="py-xl items-center gap-sm">
              <Ionicons name="search-outline" size={32} color={colors.textMuted} />
              <Text className="text-text-secondary text-body">
                {t('search.noResults', { query: searchQuery.trim() })}
              </Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <CollapsibleSectionHeader
            icon={section.icon}
            iconColor={section.iconColor}
            textClass={section.textClass}
            title={section.title}
            count={section.originalCount}
            collapsed={isCollapsed(section.key)}
            onToggle={() => toggle(section.key)}
          />
        )}
        renderItem={({ item }) => {
          if ('__type' in item) {
            return (
              <Text className="text-label text-text-muted font-semibold uppercase px-xs pt-sm pb-xs tracking-widest">
                {item.year}
              </Text>
            );
          }
          return (
            <View className="mb-sm">
              <TripCard
                trip={item}
                onPress={() => handleTripPress(item.id)}
              />
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={ux.refreshing}
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
