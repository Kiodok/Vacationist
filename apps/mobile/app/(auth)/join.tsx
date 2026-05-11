import { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@vacationist/ui';
import { signInAnonymously, redeemInviteToken } from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoinAsGuest() {
    setNameError('');
    const trimmed = name.trim();

    if (!trimmed) {
      setNameError('Please enter your name');
      return;
    }

    if (trimmed.length > 100) {
      setNameError('Name is too long');
      return;
    }

    setLoading(true);
    try {
      await signInAnonymously({ name: trimmed });

      if (token) {
        try {
          const tripId = await redeemInviteToken(token);
          router.replace({ pathname: '/trip/[id]', params: { id: tripId } } as never);
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Invalid invite link';
          addToast('error', message);
          setLoading(false);
          return;
        }
      }
    } catch {
      addToast('error', 'Failed to join. Please try again.');
      setLoading(false);
    }
  }

  function handleSignInInstead() {
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-lg">
      <View className="items-center gap-lg">
        <View className="w-[64px] h-[64px] rounded-full bg-primary-muted items-center justify-center">
          <Ionicons name="people-outline" size={32} color="#6C63FF" />
        </View>

        <Text className="text-heading-l text-text-primary text-center">
          You've been invited!
        </Text>

        <Text className="text-body text-text-secondary text-center">
          Enter your name to join as a guest.{'\n'}
          You can create a full account later.
        </Text>

        <View className="w-full gap-md mt-md">
          <Input
            label="Your name"
            placeholder="e.g. Marco"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
            error={nameError}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="go"
            onSubmitEditing={handleJoinAsGuest}
          />

          <Button
            label="Join as Guest"
            onPress={handleJoinAsGuest}
            loading={loading}
          />

          <Button
            label="Sign in with an account instead"
            variant="ghost"
            onPress={handleSignInInstead}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
