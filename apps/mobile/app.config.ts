import type { ExpoConfig, ConfigContext } from 'expo/config';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Vacationist',
  slug: 'vacationist',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'vacationist',
  userInterfaceStyle: 'dark',
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
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-updates',
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        color: '#6C63FF',
        defaultChannel: 'default',
        sounds: [],
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: googleWebClientId
          ? `com.googleusercontent.apps.${googleWebClientId.split('.')[0]}`
          : undefined,
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
