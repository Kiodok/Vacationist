import { ActivityIndicator, Image, ImageSourcePropType, Pressable, Text, View } from 'react-native';

interface GoogleSignInButtonProps {
  onPress: () => void;
  logo?: ImageSourcePropType;
  loading?: boolean;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, logo, loading = false, disabled = false }: GoogleSignInButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          height: 48,
          borderRadius: 4,
          backgroundColor: '#131314',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          gap: 12,
        },
        isDisabled && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
            {logo ? (
              <Image source={logo} style={{ width: 20, height: 20 }} resizeMode="contain" />
            ) : (
              // Replace with: logo={require('path/to/google-g-logo.png')}
              // Download the official white Google G from https://developers.google.com/identity/branding-guidelines
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>G</Text>
            )}
          </View>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '500',
              letterSpacing: 0.25,
            }}
          >
            Continue with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}
