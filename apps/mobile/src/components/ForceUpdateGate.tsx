import { useEffect, useState } from 'react';
import { BackHandler, Linking, Modal, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoInAppUpdates from 'expo-in-app-updates';
import { Button, useThemeColors } from '@vacationist/ui';
import { useAppForeground } from '../hooks/useAppForeground';
import { checkNativeUpdate, setNativeUpdateGateActive } from '../utils/nativeUpdateChecker';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.vacationist.mobile';

export function ForceUpdateGate() {
  const { t } = useTranslation('common');
  const colors = useThemeColors();
  const [updateRequired, setUpdateRequired] = useState(false);

  async function runCheck() {
    const result = await checkNativeUpdate();
    if (result === true) setUpdateRequired(true);
    else if (result === false) setUpdateRequired(false);
    // null (cooldown skip or network error) → leave current state unchanged
    // so a transient failure never silently dismisses the blocking modal.
  }

  // Initial check on mount — reuses the in-flight promise started at module
  // scope in nativeUpdateChecker.ts to minimise splash-to-modal latency.
  useEffect(() => {
    runCheck();
  }, []);

  // Keep the module-level gate flag in sync so updateChecker.ts can skip OTA
  // bundle reloads while the native update modal is blocking the app.
  useEffect(() => {
    setNativeUpdateGateActive(updateRequired);
  }, [updateRequired]);

  // Always register the foreground listener (not gated on updateRequired) so a
  // new Store version released while the app is backgrounded is detected on the
  // next foreground event, not only on the next cold launch. The 5-minute
  // cooldown inside checkNativeUpdate throttles Play Core calls during normal
  // use; the cooldown is bypassed when the gate is active.
  useAppForeground(runCheck, true);

  // Block the Android hardware back button while the modal is visible.
  useEffect(() => {
    if (!updateRequired) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [updateRequired]);

  // Hoisted above the early return so it is always defined before JSX uses it.
  async function handleUpdate() {
    try {
      await ExpoInAppUpdates.startUpdate(true);
    } catch {
      Linking.openURL(PLAY_STORE_URL);
    }
  }

  if (!updateRequired) return null;

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View className="flex-1 bg-background items-center justify-center px-xl">
        <View className="items-center gap-lg w-full">
          <View className="w-[80px] h-[80px] rounded-full bg-primary/10 items-center justify-center">
            <Ionicons name="arrow-up-circle-outline" size={44} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-text-primary text-center">
            {t('forceUpdate.title')}
          </Text>
          <Text className="text-body text-text-secondary text-center leading-relaxed">
            {t('forceUpdate.message')}
          </Text>
          <Button
            label={t('forceUpdate.button')}
            onPress={handleUpdate}
            variant="primary"
            className="w-full mt-md"
          />
        </View>
      </View>
    </Modal>
  );
}
