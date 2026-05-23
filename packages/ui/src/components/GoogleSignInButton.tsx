import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, loading = false, disabled = false }: GoogleSignInButtonProps) {
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
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
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
