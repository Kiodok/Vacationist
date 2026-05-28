import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, colors } from '@vacationist/ui';

export default function MagicLinkSentScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-lg">
      <View className="items-center gap-lg">
        <View className="w-[64px] h-[64px] rounded-full bg-primary-muted items-center justify-center">
          <Ionicons name="mail-outline" size={32} color={colors.primary} />
        </View>

        <Text className="text-heading-l text-text-primary text-center">
          {t('magicLink.title')}
        </Text>

        <Text className="text-body text-text-secondary text-center">
          {t('magicLink.sentTo')}{'\n'}
          <Text className="text-text-primary font-semibold">{email}</Text>
        </Text>

        <Text className="text-body-small text-text-muted text-center mt-sm">
          {t('magicLink.instruction')}
        </Text>

        <Button
          label={t('magicLink.back')}
          variant="ghost"
          onPress={() => router.back()}
          className="mt-lg"
        />
      </View>
    </SafeAreaView>
  );
}
