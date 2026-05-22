import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import { TripNotFoundError } from '@vacationist/api';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripRealtime } from '../../../src/features/trips/hooks/useTripRealtime';
import { useAuthStore } from '../../../src/stores/authStore';
import { StatusBadge } from '../../../src/features/trips/components/StatusBadge';
import { ScreenErrorBoundary } from '../../../src/components/ScreenErrorBoundary';
import { TripNotificationBell } from '../../../src/features/notifications/components/TripNotificationBell';
import OverviewTab from './overview';
import PreworkTab from './prework';
import ActivitiesTab from './activities';
import AccommodationsTab from './accommodations';
import TransferTab from './transfer';
import ExpensesTab from './expenses';
import ShoppingTab from './shopping';
import RecipesTab from './recipes';
import SettingsTab from './settings';
import CalendarTab from './calendar';
import NotesTab from './notes';

const TABS = ['Overview', 'Prework', 'Base', 'Transfer', 'Activities', 'Calendar', 'Expenses', 'Shopping', 'Recipes', 'Notes', 'Settings'] as const;
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
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { data: trip, isLoading, isError, error } = useTrip(id!);
  const authLoading = useAuthStore((s) => s.isLoading);
  useTripRealtime(id!);
  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialTab(tab));

  const handleTabChange = (newTab: Tab) => {
    setActiveTab(newTab);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      url.searchParams.set('tab', newTab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (isLoading || authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  if (isError || !trip) {
    const isNotMember = error instanceof TripNotFoundError;
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-md gap-md">
        <Text className="text-text-secondary text-body text-center">
          {isNotMember
            ? "This trip doesn't exist or you don't have access to it."
            : 'Failed to load trip.'}
        </Text>
        <Pressable
          onPress={() => isNotMember ? router.replace('/(tabs)') : router.back()}
          className="px-lg py-sm rounded-md bg-surface border border-border"
        >
          <Text className="text-text-primary text-body">
            {isNotMember ? 'Go to home' : 'Go back'}
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
      case 'Shopping':
        return <ShoppingTab />;
      case 'Recipes':
        return <RecipesTab />;
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
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => handleTabChange(t)}
              className={`px-md py-sm rounded-full ${
                activeTab === t ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-body-small font-semibold ${
                  activeTab === t ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {t}
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
