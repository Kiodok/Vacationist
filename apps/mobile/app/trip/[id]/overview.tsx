import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import { ScrollView } from '@vacationist/ui';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { i18n as i18nInstance } from '@vacationist/i18n';
import { dayjs, formatCurrency, computeBudgetProgress } from '@vacationist/utils';
import type { UpdateTripInput } from '@vacationist/types';
import { useTrip, useUpdateTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripCostSummary } from '../../../src/features/trips/hooks/useTripCostSummary';
import { useCurrencyConversion } from '../../../src/features/currencies/hooks/useCurrencies';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { MemberAvatarGroup } from '../../../src/features/trips/components/MemberAvatarGroup';
import { EditTripSheet } from '../../../src/features/trips/components/EditTripSheet';
import { colors, ThemedIcon } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { useCalendarSync } from '../../../src/features/trips/hooks/useCalendarSync';
import { CalendarPickerSheet } from '../../../src/features/trips/components/CalendarPickerSheet';
import { TripHighlightSheet } from '../../../src/features/sharing/components/TripHighlightSheet';
import { TripExportSheet } from '../../../src/features/sharing/components/TripExportSheet';

interface OverviewTabProps {
  onTabChange?: (tab: string) => void;
}

// Unclamped percent (can exceed 100) — green while comfortably under budget, yellow as it gets
// close, red once at or over budget.
function budgetBarColor(percent: number): string {
  if (percent >= 95) return colors.danger;
  if (percent >= 80) return colors.warning;
  return colors.success;
}

export default function OverviewTab({ onTabChange }: OverviewTabProps) {
  const { t } = useTranslation('trips');
  const { t: tCommon } = useTranslation("common");
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip } = useTrip(id!);
  const { data: members } = useTripMembers(id!);
  const { data: role } = useCurrentMemberRole(id!);
  const user = useAuthStore((s) => s.user);
  const costDisplayCurrency = user?.preferred_currency ?? trip?.base_currency ?? 'EUR';
  const { data: costSummary, isLoading: costSummaryLoading } = useTripCostSummary(id!, costDisplayCurrency);
  const { convert } = useCurrencyConversion();
  // costSummary.total is converted into costDisplayCurrency (the member's preferred currency,
  // when set), but trip.budget_per_person is always stored in trip.base_currency — comparing them
  // unconverted silently produces a wrong percent/progress-bar whenever the two currencies differ.
  // Falls back to no budget comparison (rather than a wrong one) if the rate isn't available.
  const budgetPerPersonInDisplayCurrency = trip?.budget_per_person != null
    ? convert(trip.budget_per_person, trip.base_currency, costDisplayCurrency)
    : null;
  const updateTrip = useUpdateTrip();
  const [editOpen, setEditOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const {
    isInCalendar,
    isLoading: calendarLoading,
    isPickerVisible,
    calendars,
    isLoadingCalendars,
    openCalendarPicker,
    closeCalendarPicker,
    confirmAddToCalendar,
    removeFromCalendar,
  } = useCalendarSync(trip);

  if (!trip) return null;

  async function handleCalendarPress() {
    if (isInCalendar) {
      Alert.alert(
        t('overview.removeFromCalendar'),
        t('overview.removeCalendarConfirm'),
        [
          { text: t('overview.removeCalendarAction'), style: 'destructive', onPress: removeFromCalendar },
          { text: tCommon('button.cancel'), style: 'cancel' },
        ],
      );
      return;
    }
    const opened = await openCalendarPicker();
    if (!opened) {
      Alert.alert(t('overview.calendarPermissionDenied'));
    }
  }

  const isOrganizer = role === 'organizer';
  const duration = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day') + 1;

  function handleEditSubmit(input: UpdateTripInput) {
    setEditOpen(false);
    updateTrip.mutate({ tripId: id!, input });
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerClassName="px-md py-md gap-md">
        {/* Edit button — organizers only */}
        {isOrganizer && (
          <Pressable
            onPress={() => setEditOpen(true)}
            className="flex-row items-center justify-end gap-xs"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ThemedIcon name="pencil-outline" size={16} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">{t('overview.editTrip')}</Text>
          </Pressable>
        )}

        {trip.description ? (
          <View className="bg-surface border border-border rounded-md p-md">
            <Text className="text-body text-text-primary">{trip.description}</Text>
          </View>
        ) : null}

        {/* Quick stats — Days & Members row */}
        <View className="flex-row gap-sm">
          <Pressable
            className="flex-1"
            onPress={() => onTabChange?.('Calendar')}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="bg-surface border border-border rounded-md p-md items-center gap-xs">
              <View style={styles.iconBadgeInfo}>
                <ThemedIcon name="calendar-outline" size={20} color={colors.info} />
              </View>
              <Text className="text-heading-m text-text-primary">{duration}</Text>
              <Text className="text-body-small text-text-secondary">
                {t('overview.days')}
              </Text>
            </View>
          </Pressable>

          <Pressable
            className="flex-1"
            onPress={() => onTabChange?.('Settings')}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="bg-surface border border-border rounded-md p-md items-center gap-xs">
              <View style={styles.iconBadgePrimary}>
                <ThemedIcon name="people-outline" size={20} color={colors.primary} />
              </View>
              <Text className="text-heading-m text-text-primary">
                {trip.member_count}
              </Text>
              <Text className="text-body-small text-text-secondary">{t('overview.members')}</Text>
            </View>
          </Pressable>
        </View>

        {/* Budget + Trip costs. Web: same row (plenty of horizontal space). Android/iOS: stacked
            — a wide phone screen with a large converted total/budget figure can overflow a
            half-width card, so native always gets the full row to itself. Each card is
            independently conditional (budget may be unset; costSummary loads async), so either
            can render alone.
            costSummaryLoading also covers exchange rates still loading (see
            useTripCostSummary.ts) — costSummary can otherwise be truthy but computed against an
            incomplete rate map, briefly showing an understated total. */}
        {(trip.budget_per_person != null || (costSummary && !costSummaryLoading)) && (
          <View className={`gap-sm items-stretch ${Platform.OS === 'web' ? 'flex-row' : ''}`}>
            {trip.budget_per_person != null && (
              <View className="flex-1 bg-surface border border-border rounded-md p-md flex-row items-center gap-md">
                <View style={styles.iconBadgeWarning}>
                  <ThemedIcon name="wallet-outline" size={20} color={colors.warning} />
                </View>
                <View className="flex-1">
                  <Text className="text-label text-text-muted uppercase">{trip.base_currency}</Text>
                  <Text className="text-heading-m text-text-primary">
                    {trip.budget_per_person.toLocaleString(i18nInstance.language === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text className="text-body-small text-text-secondary">{t('overview.budget')}</Text>
                </View>
              </View>
            )}

            {/* Trip costs — items 7/8: sum of Base/Transfer/Activities/Expenses, converted into the
                member's preferred currency when set (else the trip's own currency). Rendered only
                once costSummary has actually loaded, so it never flashes a false "0" total.
                Pressable — tapping it is a shortcut to the Expenses tab, same as the Days/Members
                stat cards above link to their own tabs. */}
            {costSummary && !costSummaryLoading && (
              <Pressable
                className="flex-1"
                onPress={() => onTabChange?.('Expenses')}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              >
                <View className="bg-surface border border-border rounded-md p-md gap-sm">
                  <View className="flex-row items-center gap-md">
                    <View style={styles.iconBadgePrimary}>
                      <ThemedIcon name="cash-outline" size={20} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-heading-m text-text-primary">
                        {formatCurrency(costSummary.total, costDisplayCurrency, i18nInstance.language === 'de' ? 'de-DE' : 'en-US')}
                      </Text>
                      <Text className="text-body-small text-text-secondary">{t('overview.costSummary')}</Text>
                    </View>
                  </View>

                  {(() => {
                    const progress = computeBudgetProgress(costSummary.total, budgetPerPersonInDisplayCurrency, trip.member_count);
                    const perPersonText = formatCurrency(progress.perPerson, costDisplayCurrency, i18nInstance.language === 'de' ? 'de-DE' : 'en-US');
                    return (
                      <>
                        <Text className="text-body-small text-text-secondary">
                          {progress.hasBudget
                            ? t('overview.perPersonOfBudget', {
                                perPerson: perPersonText,
                                budget: formatCurrency(trip.budget_per_person ?? 0, trip.base_currency, i18nInstance.language === 'de' ? 'de-DE' : 'en-US'),
                              })
                            : t('overview.perPerson', { perPerson: perPersonText })}
                        </Text>
                        {progress.hasBudget && (
                          <View className="h-[6px] rounded-full bg-border overflow-hidden">
                            <View
                              style={{
                                width: `${progress.clampedPercent}%`,
                                height: '100%',
                                backgroundColor: budgetBarColor(progress.percent),
                              }}
                            />
                          </View>
                        )}
                      </>
                    );
                  })()}

                  {costSummary.excludedSourceCount > 0 && (
                    <Text className="text-label text-text-muted">
                      {t('overview.ratesExcluded', { count: costSummary.excludedSourceCount })}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        )}

        {/* Members preview */}
        {members && members.length > 0 && (
          <Pressable
            onPress={() => onTabChange?.('Settings')}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="bg-surface border border-border rounded-md p-md">
              <Text className="text-label text-text-muted uppercase mb-sm">{t('overview.members')}</Text>
              <View className="flex-row items-center gap-md">
                <MemberAvatarGroup
                  members={members.map((m) => ({
                    id: m.user_id,
                    name: m.user.name,
                    avatar_url: m.user.avatar_url,
                  }))}
                />
              </View>
            </View>
          </Pressable>
        )}

        {/* Info */}
        <View className="bg-surface border border-border rounded-md p-md gap-sm">
          <Text className="text-label text-text-muted uppercase">{t('overview.details')}</Text>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('overview.currency')}</Text>
            <Text className="text-body-small text-text-primary">{trip.base_currency}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('overview.timezone')}</Text>
            <Text className="text-body-small text-text-primary">
              {trip.timezone.replace('Europe/', '')}
            </Text>
          </View>
        </View>

        {/* Add to / Remove from Calendar — native only */}
        {Platform.OS !== 'web' && (
          <Pressable
            onPress={handleCalendarPress}
            disabled={calendarLoading || isLoadingCalendars}
            className="flex-row items-center justify-center gap-sm bg-surface border border-border rounded-md p-md"
            style={({ pressed }) => ({ opacity: pressed || calendarLoading || isLoadingCalendars ? 0.6 : 1 })}
          >
            <ThemedIcon
              name={isInCalendar ? 'checkmark-circle-outline' : 'calendar-outline'}
              size={18}
              color={isInCalendar ? colors.success : colors.primary}
            />
            <Text className={`text-body font-medium ${isInCalendar ? 'text-success' : 'text-primary'}`}>
              {isInCalendar ? t('overview.inCalendar') : t('overview.addToCalendar')}
            </Text>
          </Pressable>
        )}

        {/* Share Trip Highlights — native only (view-shot has limited web support) */}
        {Platform.OS !== 'web' && (
          <Pressable
            onPress={() => setHighlightOpen(true)}
            className="flex-row items-center justify-center gap-sm bg-surface border border-border rounded-md p-md"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ThemedIcon name="image-outline" size={18} color={colors.primary} />
            <Text className="text-body font-medium text-primary">{t('overview.shareHighlights')}</Text>
          </Pressable>
        )}

        {/* Export Trip */}
        <Pressable
          onPress={() => setExportOpen(true)}
          className="flex-row items-center justify-center gap-sm bg-surface border border-border rounded-md p-md"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ThemedIcon name="document-text-outline" size={18} color={colors.primary} />
          <Text className="text-body font-medium text-primary">{t('overview.exportTrip')}</Text>
        </Pressable>
      </ScrollView>

      {isOrganizer && (
        <EditTripSheet
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEditSubmit}
          isPending={isMutationBusy(updateTrip)}
          trip={trip}
        />
      )}

      <TripHighlightSheet
        visible={highlightOpen}
        onClose={() => setHighlightOpen(false)}
        tripId={id!}
      />

      {exportOpen && (
        <TripExportSheet
          visible={exportOpen}
          onClose={() => setExportOpen(false)}
          tripId={id!}
        />
      )}

      <CalendarPickerSheet
        visible={isPickerVisible}
        onClose={closeCalendarPicker}
        calendars={calendars}
        isLoading={calendarLoading}
        onConfirm={confirmAddToCalendar}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconBadgePrimary: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeInfo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeWarning: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
});
