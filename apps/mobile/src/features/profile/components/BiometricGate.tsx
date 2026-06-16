import { Platform, View, Text, Pressable, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';

interface BiometricGateProps {
  children: React.ReactNode;
  unlocked: boolean;
  onUnlocked: () => void;
}

export function BiometricGate({ children, unlocked, onUnlocked }: BiometricGateProps) {
  const { t } = useTranslation('profile');
  async function handleUnlock() {
    // expo-local-authentication is not available on web — bypass the gate directly.
    if (Platform.OS === 'web') {
      onUnlocked();
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('biometric.prompt'),
      disableDeviceFallback: false,
      cancelLabel: t('biometric.cancel'),
    });

    if (result.success) {
      onUnlocked();
      return;
    }

    // Device has no biometrics or PIN configured — alert the user and grant access
    // since there is no credential to check against.
    if (result.error === 'not_enrolled' || result.error === 'not_available') {
      Alert.alert(
        t('biometric.noLockAlert.title'),
        t('biometric.noLockAlert.body'),
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
        <ThemedIcon name="lock-closed-outline" size={24} color={colors.primary} />
      </View>
      <View className="items-center gap-xs">
        <Text className="text-body text-text-primary font-semibold">{t('biometric.locked')}</Text>
        <Text className="text-body-small text-text-secondary text-center">
          {t('biometric.subtitle')}
        </Text>
      </View>
      <Pressable
        onPress={handleUnlock}
        className="min-h-[44px] px-lg rounded-sm bg-primary items-center justify-center"
      >
        <Text className="text-body text-white font-semibold">{t('biometric.verify')}</Text>
      </Pressable>
    </View>
  );
}
