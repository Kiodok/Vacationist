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
          borderWidth: 1,
          borderColor: '#8E918F',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          gap: 12,
        },
        isDisabled && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#E3E3E3" />
      ) : (
        <>
          <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
            {logo ? (
              <Image source={logo} style={{ width: 20, height: 20 }} resizeMode="contain" />
            ) : (
              // Provide logo={require('./path/to/google-g.png')} — download from
              // https://developers.google.com/identity/branding-guidelines
              <Text style={{ color: '#E3E3E3', fontSize: 14, fontWeight: '700' }}>G</Text>
            )}
          </View>
          <Text
            style={{
              color: '#E3E3E3',
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
