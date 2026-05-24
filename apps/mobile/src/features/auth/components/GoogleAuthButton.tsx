import { ActivityIndicator, NativeModules, Platform, View } from 'react-native';
import { GoogleSignInButton } from '@vacationist/ui';

// Guard: only load the native module when RNGoogleSignin is present.
// In Expo Go the native module is absent (use a dev-client build instead).
// In dev-client, preview, and production builds it is always linked.
const isNativeAvailable = Platform.OS !== 'web' && !!NativeModules.RNGoogleSignin;

type NativeButtonType = typeof import('@react-native-google-signin/google-signin').GoogleSigninButton;
let NativeButton: NativeButtonType | null = null;

if (isNativeAvailable) {
  try {
    const mod = require('@react-native-google-signin/google-signin');
    NativeButton = mod.GoogleSigninButton as NativeButtonType;
  } catch {
    // Silently fall back to the styled button
  }
}

interface GoogleAuthButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function GoogleAuthButton({ onPress, loading = false, disabled = false }: GoogleAuthButtonProps) {
  if (loading) {
    return (
      <View
        style={{
          alignSelf: 'center',
          minWidth: 240,
          height: 48,
          borderRadius: 4,
          backgroundColor: '#131314',
          borderWidth: 1,
          borderColor: '#8E918F',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#E3E3E3" />
      </View>
    );
  }

  if (NativeButton) {
    const Btn = NativeButton;
    return (
      <Btn
        size={Btn.Size.Wide}
        color={Btn.Color.Dark}
        onPress={onPress}
        disabled={disabled}
        style={{ alignSelf: 'center', height: 48 }}
      />
    );
  }

  // Fallback when native module is unavailable (Expo Go / web)
  return (
    <View style={{ alignItems: 'center' }}>
      <GoogleSignInButton onPress={onPress} disabled={disabled} />
    </View>
  );
}
