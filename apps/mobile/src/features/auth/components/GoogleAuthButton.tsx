import { ActivityIndicator, NativeModules, Platform, View } from 'react-native';
import { useColorScheme } from 'nativewind';
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (loading) {
    return (
      <View
        style={{
          alignSelf: 'center',
          minWidth: 240,
          height: 48,
          borderRadius: 4,
          backgroundColor: isDark ? '#131314' : '#FFFFFF',
          borderWidth: 1,
          borderColor: isDark ? '#8E918F' : '#747775',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={isDark ? '#E3E3E3' : '#1F1F1F'} />
      </View>
    );
  }

  if (NativeButton) {
    const Btn = NativeButton;
    const btnColor = isDark ? Btn.Color.Dark : Btn.Color.Light;
    return (
      <Btn
        size={Btn.Size.Wide}
        color={btnColor}
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
