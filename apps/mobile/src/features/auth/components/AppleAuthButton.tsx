import { ActivityIndicator, Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useResolvedTheme } from '@vacationist/ui';

interface AppleAuthButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

// Apple's App Store Guidelines require the proprietary AppleAuthenticationButton component for
// starting the auth flow — no custom-styled button is permitted (unlike Google's button, which
// only recommends its own asset). buttonStyle is chosen per app theme, not per NativeWind
// dark/light class, since the app has a fourth "colorful" mode (see CLAUDE.md's Theme & Design
// Modes section) that plain light/dark branching would get wrong: BLACK gives the strongest,
// most reliable contrast against the colorful palette's orange background/surface tones
// (#FDA444 / #FECE8A), matching the same "boost contrast, don't rely on the default" rule
// CLAUDE.md documents for vote borders and primary-button text in colorful mode.
export function AppleAuthButton({ onPress, loading = false, disabled = false }: AppleAuthButtonProps) {
  const theme = useResolvedTheme();

  if (Platform.OS !== 'ios') return null;

  // Same theme->color split used for the real button below (dark gets the WHITE Apple
  // button style, light/colorful get BLACK) — kept in one place so the loading skeleton
  // never mismatches the button it's standing in for.
  const isDarkButton = theme === 'dark';

  if (loading) {
    return (
      <View
        style={{
          alignSelf: 'center',
          width: 240,
          height: 48,
          borderRadius: 6,
          backgroundColor: isDarkButton ? '#FFFFFF' : '#000000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={isDarkButton ? '#000000' : '#FFFFFF'} />
      </View>
    );
  }

  const buttonStyle = isDarkButton
    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;

  return (
    <View
      pointerEvents={disabled ? 'none' : 'auto'}
      style={{ alignSelf: 'center', opacity: disabled ? 0.6 : 1 }}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={buttonStyle}
        cornerRadius={6}
        style={{ width: 240, height: 48 }}
        onPress={onPress}
      />
    </View>
  );
}
