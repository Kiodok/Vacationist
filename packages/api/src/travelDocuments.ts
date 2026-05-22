import { supabase } from './client';
import type {
  TravelDocument,
  DocumentAccessRequest,
  AccessibleMemberDocument,
  ActiveGrant,
  UpsertTravelDocumentInput,
} from '@vacationist/types';

// ─── Own documents ──────────────────────────────────────────────────────────

export async function getMyTravelDocuments(): Promise<TravelDocument[]> {
  const { data, error } = await supabase.rpc('get_my_travel_documents');
  if (error) throw error;
  return ((data ?? []) as unknown) as TravelDocument[];
}

export async function upsertTravelDocument(
  input: UpsertTravelDocumentInput
): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_travel_document', {
    p_document_type:   input.document_type,
    p_full_legal_name: input.full_legal_name,
    p_document_number: input.document_number,
    p_date_of_birth:   input.date_of_birth   ?? undefined,
    p_nationality:     input.nationality     ?? undefined,
    p_issuing_country: input.issuing_country ?? undefined,
    p_expiry_date:     input.expiry_date     ?? undefined,
    p_notes:           input.notes           ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteTravelDocument(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_travel_document', {
    p_document_id: documentId,
  });
  if (error) throw error;
}

// ─── Access request system ──────────────────────────────────────────────────

export async function createDocumentAccessRequest(
  tripId: string,
  durationMinutes: number
): Promise<string> {
  const { data, error } = await supabase.rpc('create_document_access_request', {
    p_trip_id:          tripId,
    p_duration_minutes: durationMinutes,
  });
  if (error) throw error;
  return data as string;
}

export async function respondToDocumentAccessRequest(
  requestId: string,
  granted: boolean
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_document_access_request', {
    p_request_id: requestId,
    p_granted:    granted,
  });
  if (error) throw error;
}

export async function getMyPendingAccessRequests(): Promise<DocumentAccessRequest[]> {
  const { data, error } = await supabase.rpc('get_my_pending_access_requests');
  if (error) throw error;
  return ((data ?? []) as unknown) as DocumentAccessRequest[];
}

export async function getAccessibleMemberDocuments(
  tripId: string
): Promise<AccessibleMemberDocument[]> {
  const { data, error } = await supabase.rpc('get_accessible_member_documents', {
    p_trip_id: tripId,
  });
  if (error) throw error;
  return ((data ?? []) as unknown) as AccessibleMemberDocument[];
}

export async function revokeDocumentAccess(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_document_access', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function getMyActiveGrants(): Promise<ActiveGrant[]> {
  const { data, error } = await supabase.rpc('get_my_active_grants');
  if (error) throw error;
  return ((data ?? []) as unknown) as ActiveGrant[];
}
