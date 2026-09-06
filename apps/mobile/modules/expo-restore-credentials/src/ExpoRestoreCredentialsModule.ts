import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ExpoRestoreCredentialsModule extends NativeModule {
  isSupported(): boolean;
  createRestoreKey(registrationJson: string): Promise<string>;
  getRestoreKey(authenticationJson: string): Promise<string | null>;
  clearRestoreKey(): Promise<void>;
}

// Android-only native module (expo-module.config.json declares only the android platform).
// requireOptionalNativeModule returns null (instead of throwing) on iOS / web / a build where
// the native side didn't link — ../index.ts treats null as "not supported".
export default requireOptionalNativeModule<ExpoRestoreCredentialsModule>('ExpoRestoreCredentials');
