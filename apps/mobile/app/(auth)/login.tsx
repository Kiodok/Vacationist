import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { Button, Input } from '@vacationist/ui';
import {
  getGoogleOAuthUrl,
  signInWithMagicLink,
  setSessionFromUrl,
} from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const redirectTo = makeRedirectUri();
      const url = await getGoogleOAuthUrl(redirectTo);

      if (Platform.OS === 'web') {
        // On web, redirect the page directly — the popup approach via
        // openAuthSessionAsync is unreliable (popup blocked, session
        // completion not detected). After OAuth, the page reloads with
        // tokens in the URL hash and useAuthInit picks them up.
        window.location.href = url;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
      if (result.type === 'success') {
        await setSessionFromUrl(result.url);
      }
    } catch {
      addToast('error', 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

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
          <Button
            label="Continue with Google"
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
