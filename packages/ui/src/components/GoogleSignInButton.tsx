import { Image, Pressable } from 'react-native';
import { useColorScheme } from 'nativewind';

// Official Google Sign-In button assets (rounded, "Sign in with Google")
// Source: developers.google.com/identity/branding-guidelines
// Copied to flat paths to avoid Metro's @-in-directory-name resolution issue
const darkAsset = require('../assets/google-btn-dark.png');
const lightAsset = require('../assets/google-btn-light.png');

interface GoogleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, disabled = false }: GoogleSignInButtonProps) {
  const { colorScheme } = useColorScheme();
  const source = colorScheme === 'dark' ? darkAsset : lightAsset;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
      style={({ pressed }) => ({
        opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        alignSelf: 'stretch',
        height: 48,
      })}
    >
      <Image source={source} style={{ width: '100%', height: 48 }} resizeMode="stretch" />
    </Pressable>
  );
}
