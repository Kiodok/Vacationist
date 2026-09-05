import { useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { i18n as i18nInstance } from '@vacationist/i18n';
import { formatCurrency } from '@vacationist/utils';
import { colors, ThemedIcon, ScrollView } from '@vacationist/ui';
import { useMyTripCostShares } from '../../src/features/costsOverview/hooks/useMyTripCostShares';
import { getQueryDisplayState } from '../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../src/components/OfflineEmptyState';

const CURRENT_YEAR = new Date().getFullYear();

export default function CostsOverviewScreen() {
  const { t } = useTranslation('costsOverview');
  const router = useRouter();
  const query = useMyTripCostShares();
  const { data, refetch, displayCurrency } = query;
  const ux = getQueryDisplayState(query);
  const [expandedYears, setExpandedYears] = useState<Set<number> | null>(null);

  const years = data ? Object.keys(data.totalByYear).map(Number).sort((a, b) => b - a) : [];

  // Default expand/collapse rule (per the Tech Lead): a single year is expanded by default; with
  // multiple years, only the current calendar year starts expanded. Computed once when the years
  // are first known — a later refetch (e.g. pull-to-refresh) must not silently re-collapse a
  // section the user already opened.
  useEffect(() => {
    if (expandedYears !== null || years.length === 0) return;
    setExpandedYears(years.length === 1 ? new Set(years) : new Set([CURRENT_YEAR].filter((y) => years.includes(y))));
  }, [years, expandedYears]);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const locale = i18nInstance.language === 'de' ? 'de-DE' : 'en-US';
  const isEmpty = !!data && data.trips.length === 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        // Web: cap the tab's width to match the trip chat's reading width, instead of stretching
        // full-bleed across a wide desktop viewport.
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          flexGrow: 1,
          ...(Platform.OS === 'web' ? { maxWidth: 960, width: '100%', alignSelf: 'center' } : {}),
        }}
        refreshControl={<RefreshControl refreshing={ux.refreshing} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {ux.showOfflineEmpty ? (
          <OfflineEmptyState onRetry={refetch} />
        ) : ux.showSkeleton ? (
          <View className="items-center py-xl">
            <ThemedIcon name="stats-chart-outline" size={32} color={colors.textMuted} />
          </View>
        ) : isEmpty ? (
          <View className="flex-1 items-center justify-center gap-sm px-xl">
            <ThemedIcon name="stats-chart-outline" size={40} color={colors.textMuted} />
            <Text className="text-body text-text-secondary text-center">{t('empty.title')}</Text>
            <Text className="text-body-small text-text-muted text-center">{t('empty.subtitle')}</Text>
          </View>
        ) : data ? (
          <>
            {/* Header aggregate — my share, summed across every trip, in preferred currency */}
            <View className="bg-surface border border-border rounded-md p-md items-center gap-xs">
              <Text className="text-heading-xl text-text-primary">
                {formatCurrency(data.total, displayCurrency, locale)}
              </Text>
              <Text className="text-body-small text-text-secondary">{t('header.total')}</Text>
              {data.excludedSourceCount > 0 && (
                <Text className="text-label text-text-muted">{t('ratesExcluded', { count: data.excludedSourceCount })}</Text>
              )}
            </View>

            {years.map((year) => {
              const tripsInYear = data.trips.filter((tr) => tr.year === year).sort((a, b) => b.startDate.localeCompare(a.startDate));
              const isExpanded = expandedYears?.has(year) ?? false;
              return (
                <View key={year} className="gap-sm">
                  <Pressable
                    onPress={() => toggleYear(year)}
                    className="flex-row items-center justify-between py-xs"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className="flex-row items-center gap-sm">
                      <ThemedIcon name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
                      <Text className="text-heading-m text-text-primary">{year}</Text>
                      <Text className="text-body-small text-text-muted">
                        {t('year.tripCount', { count: tripsInYear.length })}
                      </Text>
                    </View>
                    <Text className="text-body font-semibold text-text-secondary">
                      {formatCurrency(data.totalByYear[year], displayCurrency, locale)}
                    </Text>
                  </Pressable>

                  {isExpanded && (
                    <View className="gap-sm">
                      {tripsInYear.map((tr) => (
                        <Pressable
                          key={tr.tripId}
                          onPress={() => router.push(`/trip/${tr.tripId}?tab=Expenses` as never)}
                          className="bg-surface border border-border rounded-md p-md flex-row items-center justify-between"
                          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                        >
                          <Text className="text-body text-text-primary flex-1 mr-sm" numberOfLines={1}>
                            {tr.tripTitle}
                          </Text>
                          <Text className="text-body font-semibold text-text-secondary">
                            {formatCurrency(tr.share, displayCurrency, locale)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
