import { supabase } from './client';

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Path builders — centralized so the `{tripId}/.../{userId}/...` convention (required by the
 * expense-documents/transfer-documents storage.objects RLS policies, which read
 * `storage.foldername(name)[1]` as tripId and `[4]` as userId) is defined once instead of
 * hand-rolled at each call site. Purely path *construction* — actual reads/writes stay in
 * uploadDocumentFile/getSignedDocumentUrl/deleteDocumentFile above.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_KEY_SAFE = /[^A-Za-z0-9._-]+/g;

/** Makes a filename safe to use as a Supabase Storage object key. Storage rejects keys with
 * characters outside a restricted set — spaces are tolerated on some paths but non-ASCII
 * (`ä`, `ö`, `ü`, …) always yields `InvalidKey`. NFKD + stripping the combining marks turns
 * accented letters into their ASCII base. The original name is still kept verbatim in the
 * `file_name` DB column for display; only the storage key is sanitised. */
function toStorageSafeName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1) : '';
  const clean = (s: string): string =>
    s
      .normalize('NFKD')
      .replace(COMBINING_MARKS, '')
      .replace(NON_KEY_SAFE, '_')
      .replace(/_+/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '');
  const safeBase = clean(base).slice(0, 80) || 'file';
  const safeExt = clean(ext).slice(0, 12);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

/** `expense-documents` bucket path. Timestamp-prefixed: an expense can carry multiple documents
 * (receipt + warranty card, etc.), so nothing here should ever overwrite. */
export function buildExpenseDocumentPath(tripId: string, expenseId: string, userId: string, fileName: string): string {
  return `${tripId}/expenses/${expenseId}/${userId}/${Date.now()}_${toStorageSafeName(fileName)}`;
}

/** `transfer-documents` bucket path, shared by flight tickets and public-transport tickets — a
 * fixed path per (entity, user) pair, so a re-upload always overwrites the previous ticket via
 * `upsert: true`. `entityId` is a flight_id or public_transport_id; the two are independent UUID
 * spaces (never generated to collide), so sharing the literal `transfer` segment between them is
 * safe — RLS only inspects segment [1] (tripId) and [4] (userId), never [2]/[3]. */
export function buildTransferTicketPath(tripId: string, entityId: string, userId: string): string {
  return `${tripId}/transfer/${entityId}/${userId}/ticket`;
}

/** Uploads (or overwrites, with upsert: true) a document file to a private Storage bucket. */
export async function uploadDocumentFile(
  bucket: string,
  path: string,
  fileData: Blob | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, fileData, { contentType, upsert: true });
  if (error) throw error;
}

/** Mints a short-lived signed URL for a private document — never a public URL. Callers that hand
 * the link to the user for later use (e.g. embedded in a downloaded file) should pass a longer
 * `ttlSeconds` than the default in-app-viewing window. */
export async function getSignedDocumentUrl(bucket: string, path: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocumentFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
