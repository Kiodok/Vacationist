import { useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon } from '@vacationist/ui';
import { GoogleAuthButton } from '../../auth/components/GoogleAuthButton';
import { useGuestUpgrade } from '../../auth/hooks/useGuestUpgrade';
import { TurnstileWidget } from '../../auth/components/TurnstileWidget';

interface GuestUpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function GuestUpgradeSheet({ visible, onClose }: GuestUpgradeSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const turnstileToken = useRef<string | undefined>(undefined);
  const { upgradeWithGoogle, upgradeWithMagicLink, isPending, error, magicLinkSent, clearError } =
    useGuestUpgrade();

  function handleClose() {
    setEmail('');
    clearError();
    setCaptchaReady(false);
    setCaptchaError(false);
    turnstileToken.current = undefined;
    onClose();
  }

  async function handleMagicLink() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !captchaReady) return;
    const success = await upgradeWithMagicLink(trimmed, turnstileToken.current);
    if (success) turnstileToken.current = undefined;
  }

  const magicLinkDisabled = isPending || !email.trim() || !captchaReady;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            {/* Drag handle */}
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between mb-lg">
              <Text className="text-heading-m text-text-primary font-semibold">
                {t('guest.sheet.title')}
              </Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            {/* Subtitle */}
            <Text className="text-body-small text-text-muted mb-lg">
              {t('guest.sheet.subtitle')}
            </Text>

            {magicLinkSent ? (
              <View className="items-center gap-md py-lg">
                <ThemedIcon name="mail-outline" size={40} color={colors.primary} />
                <Text className="text-body text-text-primary font-semibold text-center">
                  {t('guest.sheet.sent')}
                </Text>
                <Text className="text-body-small text-text-muted text-center">
                  {t('guest.sheet.sentInstruction')}
                </Text>
                <Pressable onPress={handleClose} className="mt-sm">
                  <Text className="text-body text-text-secondary">{t('guest.sheet.close')}</Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-md">
                {/* Google Sign-In */}
                <GoogleAuthButton
                  onPress={upgradeWithGoogle}
                  loading={isPending}
                  disabled={isPending}
                />

                {/* Divider */}
                <View className="flex-row items-center gap-md">
                  <View className="flex-1 h-[1px] bg-border" />
                  <Text className="text-body-small text-text-muted">{t('guest.sheet.or')}</Text>
                  <View className="flex-1 h-[1px] bg-border" />
                </View>

                {/* Magic link email input */}
                <TextInput
                  className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('guest.sheet.emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="go"
                  onSubmitEditing={handleMagicLink}
                  editable={!isPending}
                />

                <Pressable
                  onPress={handleMagicLink}
                  disabled={magicLinkDisabled}
                  className={`min-h-[48px] rounded-sm items-center justify-center border border-border ${
                    magicLinkDisabled ? 'opacity-50' : ''
                  }`}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-body text-text-primary font-semibold">
                      {t('guest.sheet.sendLink')}
                    </Text>
                  )}
                </Pressable>

                <TurnstileWidget
                  onToken={(token) => {
                    turnstileToken.current = token;
                    setCaptchaReady(true);
                    setCaptchaError(false);
                  }}
                  onExpired={() => {
                    turnstileToken.current = undefined;
                    setCaptchaReady(false);
                  }}
                  onError={() => {
                    setCaptchaReady(false);
                    setCaptchaError(true);
                  }}
                />

                {/* Captcha error */}
                {captchaError && (
                  <Text className="text-body-small text-danger text-center">
                    {tCommon('captcha.error')}
                  </Text>
                )}

                {/* Auth error from hook */}
                {error && (
                  <Text className="text-body-small text-danger text-center">{error}</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
