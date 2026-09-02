import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

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
  // Use expo-sharing's own exported API, not the raw native module. This expo-sharing version
  // (SDK 55) doesn't define `isAvailableAsync` on the native module at all — the package
  // function has the correct `return true` fallback for native, the earlier hand-rolled
  // `requireOptionalNativeModule('ExpoSharing').isAvailableAsync` check was always undefined and
  // made every shareFile() call a silent no-op on device.
  try {
    if (!(await Sharing.isAvailableAsync())) return 'dismissed';
    await Sharing.shareAsync(options.fileUri, {
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

/**
 * Delivers a file the app already has in memory as base64 (e.g. a PDF returned by an Edge
 * Function). Web: browser download via a blob. Native: write to the cache dir then hand to the
 * OS share sheet (Save to Files / etc.), same as downloadRemoteFile.
 */
export async function deliverBase64File(filename: string, base64: string, mimeType: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return 'dismissed';
    try {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
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
    await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return shareFile({ fileUri: localUri, mimeType, dialogTitle: filename });
  } catch {
    return 'dismissed';
  }
}
