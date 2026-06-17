import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

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
  // Dynamic import prevents requireNativeModule('ExpoSharing') from running at
  // module load time — which crashes during server-side static web rendering and
  // on binaries built before expo-sharing was linked. Treat a missing native
  // module as "not available" rather than an error, so callers see 'dismissed'.
  let Sharing: typeof import('expo-sharing');
  try {
    Sharing = await import('expo-sharing');
  } catch {
    return 'dismissed';
  }
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) return 'dismissed';
  await Sharing.shareAsync(options.fileUri, {
    mimeType: options.mimeType,
    dialogTitle: options.dialogTitle,
  });
  return 'shared';
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
