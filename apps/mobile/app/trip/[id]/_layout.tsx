import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { StatusBadge } from '../../../src/features/trips/components/StatusBadge';
import { ScreenErrorBoundary } from '../../../src/components/ScreenErrorBoundary';
import OverviewTab from './index';
import SettingsTab from './settings';

const TABS = ['Overview', 'Activities', 'Expenses', 'Shopping', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function TripDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trip, isLoading } = useTrip(id!);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  if (isLoading || !trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  function renderTab() {
    switch (activeTab) {
      case 'Overview':
        return <OverviewTab />;
      case 'Settings':
        return <SettingsTab />;
      default:
        return (
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-secondary text-body">
              {activeTab} coming soon
            </Text>
          </View>
        );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-md pt-md pb-sm">
        <View className="flex-row items-center gap-md mb-sm">
          <Pressable onPress={() => router.back()} className="p-xs">
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
          <StatusBadge status={trip.status} />
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-xs"
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`px-md py-sm rounded-full ${
                activeTab === tab ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text
                className={`text-body-small font-semibold ${
                  activeTab === tab ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <ScreenErrorBoundary>
        {renderTab()}
      </ScreenErrorBoundary>
    </SafeAreaView>
  );
}
