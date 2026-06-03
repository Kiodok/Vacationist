import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { upsertPushToken } from '@vacationist/api';
import { colors } from '@vacationist/ui';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await upsertPushToken(token, platform);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default-v2', {
        name: 'Vacationist',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: colors.primary,
        showBadge: true,
        enableVibrate: true,
      });
    }

    return token;
  } catch {
    return null;
  }
}
