import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@vacationist/ui';

export default function MagicLinkSentScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-lg">
      <View className="items-center gap-lg">
        <View className="w-[64px] h-[64px] rounded-full bg-primary-muted items-center justify-center">
          <Ionicons name="mail-outline" size={32} color="#6C63FF" />
        </View>

        <Text className="text-heading-l text-text-primary text-center">
          Check your email
        </Text>

        <Text className="text-body text-text-secondary text-center">
          We sent a sign-in link to{'\n'}
          <Text className="text-text-primary font-semibold">{email}</Text>
        </Text>

        <Text className="text-body-small text-text-muted text-center mt-sm">
          Click the link in your email to sign in.{'\n'}
          It may take a minute to arrive.
        </Text>

        <Button
          label="Back to login"
          variant="ghost"
          onPress={() => router.back()}
          className="mt-lg"
        />
      </View>
    </SafeAreaView>
  );
}
