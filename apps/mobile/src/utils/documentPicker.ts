import * as DocumentPicker from 'expo-document-picker';

// Matches the 10 MB file_size_limit on the expense-documents / transfer-documents Storage buckets.
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class DocumentTooLargeError extends Error {
  constructor() {
    super('DOCUMENT_TOO_LARGE');
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

/** Reads a picked file's URI into an ArrayBuffer suitable for supabase.storage upload — same fetch()-based approach already used for avatar uploads on both native and web. */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}
