import { FlatList, View, Text, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
import { TripCard } from '../../src/features/trips/components/TripCard';
import { EmptyTrips } from '../../src/features/trips/components/EmptyTrips';
import { useSignOut } from '../../src/features/auth/hooks/useSignOut';
import { useAuthStore } from '../../src/stores/authStore';
import type { Trip } from '@vacationist/types';

export default function TripsScreen() {
  const router = useRouter();
  const { data: trips, isLoading, isFetching, refetch } = useTrips();
  const user = useAuthStore((s) => s.user);
  const { handleSignOut } = useSignOut();

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: handleSignOut },
    ]);
  }

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
        <Pressable onPress={confirmSignOut} className="w-[40px] h-[40px] rounded-full bg-surface items-center justify-center overflow-hidden">
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} className="w-full h-full" />
          ) : (
            <Ionicons name="person" size={20} color="#FFFFFF" />
          )}
        </Pressable>
        <Text className="text-heading-xl text-text-primary">Trips</Text>
        <View className="w-[40px]" />
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

      <Pressable
        onPress={handleCreateTrip}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}
