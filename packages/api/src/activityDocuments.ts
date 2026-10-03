import { supabase } from './client';
import { getUserIdOfflineSafe, trustEmptyList } from './session';
import { uploadDocumentFile, getSignedDocumentUrl, deleteDocumentFile, buildActivityDocumentPath } from './documentStorage';
import type { ActivityDocument } from '@vacationist/types';

const BUCKET = 'activity-documents';

export async function getActivityDocuments(activityId: string): Promise<ActivityDocument[]> {
  const { data, error } = await supabase
    .from('activity_documents')
    .select('*')
    .eq('activity_id', activityId);

  if (error) throw error;
  return trustEmptyList((data ?? []) as unknown as ActivityDocument[]);
}

/**
 * Uploads (or replaces) a member's document for one activity. `memberUserId` is who the document
 * belongs to; the uploader (from the session) may be the organizer uploading on that member's
 * behalf. Fixed storage path — an upload always overwrites the previous document. Same shape as
 * uploadTransferFlightDocument in transferDocuments.ts.
 */
export async function uploadActivityDocument(
  tripId: string,
  activityId: string,
  memberUserId: string,
  fileData: Blob | ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<ActivityDocument> {
  const uploadedBy = await getUserIdOfflineSafe();

  const path = buildActivityDocumentPath(tripId, activityId, memberUserId);
  await uploadDocumentFile(BUCKET, path, fileData, mimeType);

  // trip_id is included only to satisfy the generated Insert type — a BEFORE INSERT trigger
  // (set_activity_document_trip_id) always overwrites it with the trusted value derived from
  // activity_id, so a client-supplied value here can never spoof RLS.
  const { data, error } = await supabase
    .from('activity_documents')
    .upsert(
      { trip_id: tripId, activity_id: activityId, user_id: memberUserId, uploaded_by: uploadedBy, storage_path: path, file_name: fileName, mime_type: mimeType },
      { onConflict: 'activity_id,user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ActivityDocument;
}

export async function getActivityDocumentUrl(storagePath: string, ttlSeconds?: number): Promise<string> {
  return getSignedDocumentUrl(BUCKET, storagePath, ttlSeconds);
}

export async function deleteActivityDocument(documentId: string, storagePath: string): Promise<void> {
  await deleteDocumentFile(BUCKET, storagePath);
  const { error } = await supabase.from('activity_documents').delete().eq('id', documentId);
  if (error) throw error;
}
