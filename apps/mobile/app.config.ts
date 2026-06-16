import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Vacationist',
  slug: 'vacationist',
  version: '1.18.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'vacationist',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    url: 'https://u.expo.dev/a1dc4172-7c41-4aa9-a44d-afb1a0088278',
  },
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0F0F0F',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vacationist.mobile',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0F0F0F',
    },
    // @ts-expect-error — SDK 55 property, types not yet updated
    edgeToEdgeEnabled: true,
    package: 'com.vacationist.mobile',
    googleServicesFile: './google-services.json',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'vacationist.app',
            pathPrefix: '/join',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-updates',
    'expo-localization',
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    [
      'expo-calendar',
      {
        calendarPermission: 'Allow Vacationist to add your trip dates to your calendar.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Vacationist to access your photos to set a profile picture.',
        cameraPermission: 'Allow Vacationist to use your camera to take a profile picture.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#6C63FF',
        defaultChannel: 'default-v2',
        sounds: [],
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          'com.googleusercontent.apps.632483929424-80snbqvfadb86eiidc4sfbee8nm30naj',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'vacationist',
        project: 'react-native',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          targetSdkVersion: 36,
          compileSdkVersion: 36,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'a1dc4172-7c41-4aa9-a44d-afb1a0088278',
    },
  },
  experiments: {
    typedRoutes: true,
  },
});
