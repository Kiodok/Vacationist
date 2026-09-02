import { supabase } from './client';
import { uploadDocumentFile, getSignedDocumentUrl, deleteDocumentFile, buildTransferTicketPath } from './documentStorage';
import type { TransferDocument } from '@vacationist/types';

const BUCKET = 'transfer-documents';

export async function getTransferFlightDocuments(flightId: string): Promise<TransferDocument[]> {
  const { data, error } = await supabase
    .from('transfer_documents')
    .select('*')
    .eq('flight_id', flightId);

  if (error) throw error;
  return (data ?? []) as unknown as TransferDocument[];
}

/**
 * Uploads (or replaces) a passenger's ticket for one flight-direction row. `passengerUserId` is
 * who the ticket belongs to; the uploader (from the session) may be the organizer uploading on
 * that passenger's behalf. Fixed storage path — an upload always overwrites the previous ticket.
 */
export async function uploadTransferFlightDocument(
  tripId: string,
  flightId: string,
  passengerUserId: string,
  fileData: Blob | ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<TransferDocument> {
  const { data: { session } } = await supabase.auth.getSession();
  const uploadedBy = session?.user.id;
  if (!uploadedBy) throw new Error('Not authenticated');

  const path = buildTransferTicketPath(tripId, flightId, passengerUserId);
  await uploadDocumentFile(BUCKET, path, fileData, mimeType);

  // trip_id is included only to satisfy the generated Insert type — a BEFORE INSERT trigger
  // (set_transfer_document_trip_id) always overwrites it with the trusted value derived from
  // flight_id, so a client-supplied value here can never spoof RLS.
  const { data, error } = await supabase
    .from('transfer_documents')
    .upsert(
      { trip_id: tripId, flight_id: flightId, user_id: passengerUserId, uploaded_by: uploadedBy, storage_path: path, file_name: fileName, mime_type: mimeType },
      { onConflict: 'flight_id,user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferDocument;
}

export async function getTransferDocumentUrl(storagePath: string, ttlSeconds?: number): Promise<string> {
  return getSignedDocumentUrl(BUCKET, storagePath, ttlSeconds);
}

export async function deleteTransferFlightDocument(documentId: string, storagePath: string): Promise<void> {
  await deleteDocumentFile(BUCKET, storagePath);
  const { error } = await supabase.from('transfer_documents').delete().eq('id', documentId);
  if (error) throw error;
}

// --- Public transport tickets — same table/bucket, keyed by public_transport_id instead of flight_id ---

export async function getPublicTransportDocuments(publicTransportId: string): Promise<TransferDocument[]> {
  const { data, error } = await supabase
    .from('transfer_documents')
    .select('*')
    .eq('public_transport_id', publicTransportId);

  if (error) throw error;
  return (data ?? []) as unknown as TransferDocument[];
}

export async function uploadPublicTransportDocument(
  tripId: string,
  publicTransportId: string,
  passengerUserId: string,
  fileData: Blob | ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<TransferDocument> {
  const { data: { session } } = await supabase.auth.getSession();
  const uploadedBy = session?.user.id;
  if (!uploadedBy) throw new Error('Not authenticated');

  const path = buildTransferTicketPath(tripId, publicTransportId, passengerUserId);
  await uploadDocumentFile(BUCKET, path, fileData, mimeType);

  const { data, error } = await supabase
    .from('transfer_documents')
    .upsert(
      { trip_id: tripId, public_transport_id: publicTransportId, user_id: passengerUserId, uploaded_by: uploadedBy, storage_path: path, file_name: fileName, mime_type: mimeType },
      { onConflict: 'public_transport_id,user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferDocument;
}

export async function deletePublicTransportDocument(documentId: string, storagePath: string): Promise<void> {
  await deleteDocumentFile(BUCKET, storagePath);
  const { error } = await supabase.from('transfer_documents').delete().eq('id', documentId);
  if (error) throw error;
}
