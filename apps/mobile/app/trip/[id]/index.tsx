import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { ScrollView } from '@vacationist/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import { TripNotFoundError } from '@vacationist/api';
import { useQueryClient } from '@tanstack/react-query';
import { useTrip, useTripTabContent } from '../../../src/features/trips/hooks/useTrips';
import { useTripRealtime } from '../../../src/features/trips/hooks/useTripRealtime';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { setSentryTripContext, clearSentryTripContext } from '../../../src/utils/sentry';
import { StatusBadge } from '../../../src/features/trips/components/StatusBadge';
import { getEffectiveStatus } from '../../../src/features/trips/components/TripCard';
import { ScreenErrorBoundary } from '../../../src/components/ScreenErrorBoundary';
import { TripNotificationBell } from '../../../src/features/notifications/components/TripNotificationBell';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { TripTabContent } from '@vacationist/types';
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
import ChatTab from './chat';

const TABS = ['Overview', 'Chat', 'Prework', 'Base', 'Transfer', 'Expenses', 'Activities', 'Calendar', 'Stuff', 'Shopping', 'Notes', 'Settings'] as const;
type Tab = (typeof TABS)[number];

// Maps each tab to its TripTabContent flag for the "has data" border.
// Overview and Settings are never bordered — Overview is the trip itself
// (always "populated"), Settings holds no content. Calendar mirrors Activities
// since it renders the same activity rows in a different layout.
const TAB_CONTENT_KEY: Partial<Record<Tab, keyof TripTabContent>> = {
  Chat: 'chat',
  Prework: 'prework',
  Base: 'base',
  Transfer: 'transfer',
  Expenses: 'expenses',
  Activities: 'activities',
  Calendar: 'activities',
  Stuff: 'stuff',
  Shopping: 'shopping',
  Notes: 'notes',
};


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
      case 'Chat':        return t('tab.chat');
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
  const { data: tabContent } = useTripTabContent(id!);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialTab(tab));
  const tabBarRef = useRef<ScrollView>(null);
  const tabPositions = useRef<Partial<Record<Tab, number>>>({});
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const activeTabTextColor = isColorful ? colors.surface : '#ffffff';

  useEffect(() => {
    if (id && role) setSentryTripContext(id, role);
    return () => clearSentryTripContext();
  }, [id, role]);

  useEffect(() => {
    if (activeTab === 'Overview') return;
    requestAnimationFrame(() => {
      tabBarRef.current?.scrollTo({ x: tabPositions.current[activeTab] ?? 0, animated: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (newTab: Tab) => {
    // Only the active tab is ever mounted, so the tab-content flags can only go
    // stale while the user is looking at (and possibly adding to) the tab they're
    // about to leave. Invalidate here instead of polling in the background.
    if (newTab !== activeTab) {
      queryClient.invalidateQueries({ queryKey: ['trips', id, 'tab-content'] });
    }
    setActiveTab(newTab);
    tabBarRef.current?.scrollTo({ x: tabPositions.current[newTab] ?? 0, animated: true });
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
        return <OverviewTab onTabChange={(tab) => handleTabChange(tab as Tab)} />;
      case 'Chat':
        return <ChatTab />;
      case 'Prework':
        return <PreworkTab />;
      case 'Calendar':
        return <CalendarTab onTabChange={(tab) => handleTabChange(tab as Tab)} />;
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
            <ThemedIcon name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-heading-l text-text-primary" numberOfLines={1}>
              {trip.title}
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/(tabs)/calendar', params: { date: trip.start_date } } as never)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-body-small text-text-secondary">
                {dayjs(trip.start_date).format('D MMM')} – {dayjs(trip.end_date).format('D MMM YYYY')}
              </Text>
            </Pressable>
          </View>
          <TripNotificationBell tripId={id!} />
          <StatusBadge status={getEffectiveStatus(trip)} />
        </View>

        {/* Tab bar */}
        <ScrollView
          ref={tabBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-xs"
        >
          {TABS.map((tabKey) => {
            const isActive = activeTab === tabKey;
            const contentKey = TAB_CONTENT_KEY[tabKey];
            const hasData = !isActive && !!contentKey && !!tabContent?.[contentKey];
            return (
            <Pressable
              key={tabKey}
              onPress={() => handleTabChange(tabKey)}
              onLayout={(e) => { tabPositions.current[tabKey] = e.nativeEvent.layout.x; }}
              className={`px-md py-sm rounded-full ${
                isActive ? 'bg-primary' : 'bg-surface'
              }`}
              style={{
                // Always render a 1px border (transparent when not applicable) so
                // pill dimensions never shift as the has-data flags load in.
                borderWidth: 1,
                borderColor: hasData ? colors.textPrimary : 'transparent',
              }}
            >
              <Text
                className={`text-body-small font-semibold ${
                  isActive ? '' : 'text-text-secondary'
                }`}
                style={isActive ? { color: activeTabTextColor } : undefined}
              >
                {getTabLabel(tabKey)}
              </Text>
            </Pressable>
            );
          })}
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
