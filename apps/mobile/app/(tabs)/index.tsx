import { FlatList, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
import { TripCard } from '../../src/features/trips/components/TripCard';
import { EmptyTrips } from '../../src/features/trips/components/EmptyTrips';
import type { Trip } from '@vacationist/types';

export default function TripsScreen() {
  const router = useRouter();
  const { data: trips, isLoading, isFetching, refetch } = useTrips();

  function handleCreateTrip() {
    router.push('/trip/create' as never);
  }

  function handleTripPress(tripId: string) {
    router.push({ pathname: '/trip/[id]', params: { id: tripId } } as never);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
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
      <View className="flex-row items-center justify-between px-md pt-md pb-sm">
        <Text className="text-heading-xl text-text-primary">Trips</Text>
        <Pressable
          onPress={handleCreateTrip}
          className="w-[40px] h-[40px] rounded-full bg-primary items-center justify-center"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item as Trip & { member_count: number }}
            onPress={() => handleTripPress(item.id)}
          />
        )}
        contentContainerClassName="px-md gap-sm pb-lg"
        onRefresh={refetch}
        refreshing={isFetching && !isLoading}
      />
    </SafeAreaView>
  );
}
