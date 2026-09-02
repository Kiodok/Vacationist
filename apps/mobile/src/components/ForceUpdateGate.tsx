import { useEffect, useState } from 'react';
import { BackHandler, Linking, Modal, Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ExpoInAppUpdates from 'expo-in-app-updates';
import { Button, useThemeColors , ThemedIcon } from '@vacationist/ui';
import { useAppForeground } from '../hooks/useAppForeground';
import { checkNativeUpdate, setNativeUpdateGateActive } from '../utils/nativeUpdateChecker';
import { STORE_URL } from '../utils/storeUrl';

export function ForceUpdateGate() {
  const { t } = useTranslation('common');
  const colors = useThemeColors();
  const [updateRequired, setUpdateRequired] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);

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
    setOpenFailed(false);

    // iOS has no real in-app update flow (unlike Android's Play Core API) — the App Store
    // owns that entirely. expo-in-app-updates' iOS startUpdate() tries to present
    // SKStoreProductViewController on the same root view controller this gate's own
    // <Modal> is already presented on; iOS silently refuses the second present() and still
    // resolves the promise as success, so the try/catch below never sees a rejection and
    // the button looks like it does nothing. Skip the native module on iOS entirely and go
    // straight to the store listing, the same path openStoreReviewOrFallback() already uses
    // successfully.
    if (Platform.OS === 'ios') {
      try {
        await Linking.openURL(STORE_URL);
      } catch {
        setOpenFailed(true);
      }
      return;
    }

    try {
      await ExpoInAppUpdates.startUpdate(true);
    } catch {
      try {
        await Linking.openURL(STORE_URL);
      } catch {
        setOpenFailed(true);
      }
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
            <ThemedIcon name="arrow-up-circle-outline" size={44} color={colors.primary} />
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
          {openFailed && (
            // Rendered inline rather than via useToastStore: this <Modal> is its own
            // native view controller stack on iOS, so a toast fired from ToastContainer
            // (a sibling in app/_layout.tsx) would be painted underneath and never seen.
            <Text className="text-body text-danger text-center">
              {t('forceUpdate.openStoreFailed')}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
