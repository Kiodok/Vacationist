import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { Button, GoogleSignInButton, Input } from '@vacationist/ui';
import { signInWithMagicLink } from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';
import { useGoogleSignIn } from '../../src/features/auth/hooks/useGoogleSignIn';

export default function LoginScreen() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const { signIn: handleGoogleSignIn, loading: googleLoading } =
    useGoogleSignIn((msg) => addToast('error', msg));

  async function handleMagicLink() {
    setEmailError('');
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setMagicLinkLoading(true);
    try {
      const redirectTo = makeRedirectUri();
      await signInWithMagicLink(trimmed, redirectTo);
      router.push({
        pathname: '/(auth)/magic-link-sent',
        params: { email: trimmed },
      });
    } catch {
      addToast('error', 'Failed to send magic link. Please try again.');
    } finally {
      setMagicLinkLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-lg"
      >
        <View className="items-center mb-3xl">
          <Text className="text-heading-xl text-text-primary">Vacationist</Text>
          <Text className="text-body text-text-secondary mt-sm">
            Plan trips together
          </Text>
        </View>

        <View className="gap-md">
          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={magicLinkLoading}
          />

          <View className="flex-row items-center gap-md my-sm">
            <View className="flex-1 h-[1px] bg-border" />
            <Text className="text-body-small text-text-muted">
              or continue with email
            </Text>
            <View className="flex-1 h-[1px] bg-border" />
          </View>

          <Input
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={handleMagicLink}
          />

          <Button
            label="Send Magic Link"
            variant="secondary"
            onPress={handleMagicLink}
            loading={magicLinkLoading}
            disabled={googleLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
