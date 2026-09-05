import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

// Matches the 10 MB file_size_limit on the expense-documents / transfer-documents Storage buckets.
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class DocumentTooLargeError extends Error {
  constructor() {
    super('DOCUMENT_TOO_LARGE');
  }
}

export class CameraPermissionDeniedError extends Error {
  constructor() {
    super('CAMERA_PERMISSION_DENIED');
  }
}

export interface PickedDocumentFile {
  uri: string;
  fileName: string;
  mimeType: string;
}

/** Opens the system file/photo picker restricted to images + PDF. Returns null if cancelled. */
export async function pickDocumentFile(): Promise<PickedDocumentFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new DocumentTooLargeError();
  }

  return {
    uri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
  };
}

/** Opens the device camera to capture a receipt/document photo. Returns null if cancelled.
 * Throws CameraPermissionDeniedError if permission is refused — same permission-then-launch
 * shape as the existing avatar picker (apps/mobile/app/(tabs)/profile.tsx's handleAvatarChange)
 * for consistency, just via expo-image-picker's camera entry point instead of its library one
 * (no new native dependency — expo-image-picker is already installed for avatar upload). */
export async function pickDocumentFromCamera(): Promise<PickedDocumentFile | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new CameraPermissionDeniedError();
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new DocumentTooLargeError();
  }

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

/** Reads a picked file's URI into an ArrayBuffer suitable for supabase.storage upload — same fetch()-based approach already used for avatar uploads on both native and web. */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}
