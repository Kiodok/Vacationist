import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, GoogleSignInButton } from '@vacationist/ui';
import { useGuestUpgrade } from '../../auth/hooks/useGuestUpgrade';

interface GuestUpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function GuestUpgradeSheet({ visible, onClose }: GuestUpgradeSheetProps) {
  const [email, setEmail] = useState('');
  const { upgradeWithGoogle, upgradeWithMagicLink, isPending, error, magicLinkSent, clearError } =
    useGuestUpgrade();

  function handleClose() {
    setEmail('');
    clearError();
    onClose();
  }

  async function handleMagicLink() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    await upgradeWithMagicLink(trimmed);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
            {/* Drag handle */}
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between mb-lg">
              <Text className="text-heading-m text-text-primary font-semibold">
                Create your account
              </Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Text className="text-body text-text-secondary">Cancel</Text>
              </Pressable>
            </View>

            {/* Subtitle */}
            <Text className="text-body-small text-text-muted mb-lg">
              Link your guest session to a permanent account. Your trips and data will be preserved.
            </Text>

            {magicLinkSent ? (
              <View className="items-center gap-md py-lg">
                <Ionicons name="mail-outline" size={40} color={colors.primary} />
                <Text className="text-body text-text-primary font-semibold text-center">
                  Magic link sent!
                </Text>
                <Text className="text-body-small text-text-muted text-center">
                  Check your email and tap the link to complete sign-in.
                </Text>
                <Pressable onPress={handleClose} className="mt-sm">
                  <Text className="text-body text-text-secondary">Close</Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-md">
                {/* Google Sign-In */}
                <GoogleSignInButton
                  onPress={upgradeWithGoogle}
                  loading={isPending}
                  disabled={isPending}
                  logo={require('../../../../assets/images/google-g-logo.png')}
                />

                {/* Divider */}
                <View className="flex-row items-center gap-md">
                  <View className="flex-1 h-[1px] bg-border" />
                  <Text className="text-body-small text-text-muted">or</Text>
                  <View className="flex-1 h-[1px] bg-border" />
                </View>

                {/* Magic link email input */}
                <TextInput
                  className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
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
                  disabled={isPending || !email.trim()}
                  className={`min-h-[48px] rounded-sm items-center justify-center border border-border ${
                    isPending || !email.trim() ? 'opacity-50' : ''
                  }`}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-body text-text-primary font-semibold">
                      Send Magic Link
                    </Text>
                  )}
                </Pressable>

                {/* Error */}
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
