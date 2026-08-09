import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Vacationist',
  slug: 'vacationist',
  version: '1.29.3',
  orientation: 'default',
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
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vacationist.mobile',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundImage: './assets/images/adaptive-icon-background.png',
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
    [
      'expo-splash-screen',
      {
        // Android's native SplashScreen API (12+) only supports a solid background
        // color plus a small centered icon — no full-bleed image — so it gets a
        // glyph-only asset. iOS's storyboard has no such limit, so it gets the
        // full gradient background from play-store/icon.svg for a true full-bleed look.
        android: {
          image: './assets/images/splash-icon-android.png',
          resizeMode: 'contain',
          backgroundColor: '#18162D',
        },
        ios: {
          image: './assets/images/splash-icon-ios.png',
          resizeMode: 'cover',
          backgroundColor: '#18162D',
        },
      },
    ],
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
    'expo-sharing',
    [
      'expo-build-properties',
      {
        android: {
          targetSdkVersion: 36,
          compileSdkVersion: 36,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
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
