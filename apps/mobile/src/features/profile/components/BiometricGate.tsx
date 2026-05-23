import { Platform, View, Text, Pressable, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

interface BiometricGateProps {
  children: React.ReactNode;
  unlocked: boolean;
  onUnlocked: () => void;
}

export function BiometricGate({ children, unlocked, onUnlocked }: BiometricGateProps) {
  async function handleUnlock() {
    // expo-local-authentication is not available on web — bypass the gate directly.
    if (Platform.OS === 'web') {
      onUnlocked();
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to view documents',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      onUnlocked();
      return;
    }

    // Device has no biometrics or PIN configured — alert the user and grant access
    // since there is no credential to check against.
    if (result.error === 'not_enrolled' || result.error === 'not_available') {
      Alert.alert(
        'No device lock set',
        'Your device has no PIN, password, or biometrics configured. Set up a device lock in Settings for better security.',
        [{ text: 'OK', onPress: onUnlocked }]
      );
    }
    // Other errors (user_cancel, system_cancel, lockout): stay locked — no action needed.
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <View className="bg-surface border border-border rounded-md p-lg items-center gap-md">
      <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
        <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
      </View>
      <View className="items-center gap-xs">
        <Text className="text-body text-text-primary font-semibold">Documents locked</Text>
        <Text className="text-body-small text-text-secondary text-center">
          Verify your identity to view travel document details
        </Text>
      </View>
      <Pressable
        onPress={handleUnlock}
        className="min-h-[44px] px-lg rounded-sm bg-primary items-center justify-center"
      >
        <Text className="text-body text-white font-semibold">Verify Identity</Text>
      </Pressable>
    </View>
  );
}
