import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import { TripNotFoundError } from '@vacationist/api';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripRealtime } from '../../../src/features/trips/hooks/useTripRealtime';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { setSentryTripContext, clearSentryTripContext } from '../../../src/utils/sentry';
import { StatusBadge } from '../../../src/features/trips/components/StatusBadge';
import { ScreenErrorBoundary } from '../../../src/components/ScreenErrorBoundary';
import { TripNotificationBell } from '../../../src/features/notifications/components/TripNotificationBell';
import { colors } from '@vacationist/ui';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';
import OverviewTab from './overview';
import PreworkTab from './prework';
import ActivitiesTab from './activities';
import AccommodationsTab from './accommodations';
import TransferTab from './transfer';
import ExpensesTab from './expenses';
import ShoppingTab from './shopping';
import StuffTab from './stuff';
import SettingsTab from './settings';
import CalendarTab from './calendar';
import NotesTab from './notes';

const TABS = ['Overview', 'Prework', 'Base', 'Transfer', 'Expenses', 'Activities', 'Calendar', 'Stuff', 'Shopping', 'Notes', 'Settings'] as const;
type Tab = (typeof TABS)[number];


function getInitialTab(paramTab?: string): Tab {
  if (TABS.includes(paramTab as Tab)) return paramTab as Tab;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (TABS.includes(urlTab as Tab)) return urlTab as Tab;
  }
  return 'Overview';
}

export default function TripDetailScreen() {
  const { t } = useTranslation('trips');

  const getTabLabel = (tabKey: Tab): string => {
    switch (tabKey) {
      case 'Overview':    return t('tab.overview');
      case 'Prework':     return t('tab.prework');
      case 'Base':        return t('tab.base');
      case 'Transfer':    return t('tab.transfer');
      case 'Expenses':    return t('tab.expenses');
      case 'Activities':  return t('tab.activities');
      case 'Calendar':    return t('tab.calendar');
      case 'Stuff':       return t('tab.stuff');
      case 'Shopping':    return t('tab.shopping');
      case 'Notes':       return t('tab.notes');
      case 'Settings':    return t('tab.settings');
    }
  };
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tripQuery = useTrip(id!);
  const { data: trip, isError, error, refetch } = tripQuery;
  const ux = getQueryDisplayState(tripQuery);
  const authLoading = useAuthStore((s) => s.isLoading);
  useTripRealtime(id!);
  const { data: role } = useCurrentMemberRole(id!);
  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialTab(tab));

  useEffect(() => {
    if (id && role) setSentryTripContext(id, role);
    return () => clearSentryTripContext();
  }, [id, role]);

  const handleTabChange = (newTab: Tab) => {
    setActiveTab(newTab);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      url.searchParams.set('tab', newTab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (ux.showSkeleton || authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
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

  if (isError || !trip) {
    const isNotMember = error instanceof TripNotFoundError;
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-md gap-md">
        <Text className="text-text-secondary text-body text-center">
          {isNotMember ? t('error.notFound') : t('error.loadFailed')}
        </Text>
        <Pressable
          onPress={() => isNotMember ? router.replace('/(tabs)') : router.back()}
          className="px-lg py-sm rounded-md bg-surface border border-border"
        >
          <Text className="text-text-primary text-body">
            {isNotMember ? t('error.goHome') : t('error.goBack')}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function renderTab() {
    switch (activeTab) {
      case 'Overview':
        return <OverviewTab />;
      case 'Prework':
        return <PreworkTab />;
      case 'Calendar':
        return <CalendarTab />;
      case 'Activities':
        return <ActivitiesTab />;
      case 'Base':
        return <AccommodationsTab />;
      case 'Transfer':
        return <TransferTab />;
      case 'Expenses':
        return <ExpensesTab />;
      case 'Stuff':
        return <StuffTab />;
      case 'Shopping':
        return <ShoppingTab />;
      case 'Notes':
        return <NotesTab />;
      case 'Settings':
        return <SettingsTab />;
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-md pt-md pb-sm">
        <View className="flex-row items-center gap-md mb-sm">
          <Pressable onPress={() => router.replace('/(tabs)')} className="p-xs">
            <Ionicons name="arrow-back" size={24} color="#F2F2F2" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-heading-l text-text-primary" numberOfLines={1}>
              {trip.title}
            </Text>
            <Text className="text-body-small text-text-secondary">
              {dayjs(trip.start_date).format('D MMM')} – {dayjs(trip.end_date).format('D MMM YYYY')}
            </Text>
          </View>
          <TripNotificationBell tripId={id!} />
          <StatusBadge status={trip.status} />
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-xs"
        >
          {TABS.map((tabKey) => (
            <Pressable
              key={tabKey}
              onPress={() => handleTabChange(tabKey)}
              className={`px-md py-sm rounded-full ${
                activeTab === tabKey ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-body-small font-semibold ${
                  activeTab === tabKey ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {getTabLabel(tabKey)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Tab content — flex: 1 ensures bounded height so Pressables inside ScrollViews register touches */}
      <View style={{ flex: 1 }}>
        <ScreenErrorBoundary>
          {renderTab()}
        </ScreenErrorBoundary>
      </View>
    </SafeAreaView>
  );
}
