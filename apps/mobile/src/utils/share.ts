import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as FileSystem from 'expo-file-system/legacy';

type SharingNativeModule = {
  isAvailableAsync(): Promise<boolean>;
  shareAsync(url: string, options: { mimeType?: string; dialogTitle?: string; UTI?: string }): Promise<void>;
};
const ExpoSharing = requireOptionalNativeModule<SharingNativeModule>('ExpoSharing');

export type ShareResult = 'shared' | 'copied' | 'dismissed' | 'downloaded';

export interface ShareTextOptions {
  text: string;
  title?: string;
}

export interface ShareFileOptions {
  fileUri: string;
  mimeType: string;
  dialogTitle?: string;
}

export async function shareText(options: ShareTextOptions): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    await Clipboard.setStringAsync(options.text);
    return 'copied';
  }
  try {
    const result = await Share.share({
      message: options.text,
      ...(options.title ? { title: options.title } : {}),
    });
    return result.action === Share.sharedAction ? 'shared' : 'dismissed';
  } catch {
    return 'dismissed';
  }
}

export async function shareFile(options: ShareFileOptions): Promise<ShareResult> {
  if (!ExpoSharing?.isAvailableAsync) return 'dismissed';
  try {
    const isAvailable = await ExpoSharing.isAvailableAsync();
    if (!isAvailable) return 'dismissed';
    await ExpoSharing.shareAsync(options.fileUri, {
      mimeType: options.mimeType,
      dialogTitle: options.dialogTitle,
    });
    return 'shared';
  } catch {
    return 'dismissed';
  }
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a remote file (e.g. a signed Storage URL) to the user's device. Web triggers a
 * browser download via a blob + `<a download>` (same trick as downloadTextFile, generalized to
 * binary content); native downloads to the cache dir then hands off to the OS share sheet via
 * shareFile — there's no direct "save to device" API without extra permissions, so the share
 * sheet (Save to Files / Photos, etc.) is the standard Expo pattern for this.
 */
export async function downloadRemoteFile(url: string, filename: string, mimeType: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return 'dismissed';
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      return 'downloaded';
    } catch {
      return 'dismissed';
    }
  }

  if (!FileSystem.cacheDirectory) return 'dismissed';
  try {
    const localUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.downloadAsync(url, localUri);
    return shareFile({ fileUri: localUri, mimeType, dialogTitle: filename });
  } catch {
    return 'dismissed';
  }
}
