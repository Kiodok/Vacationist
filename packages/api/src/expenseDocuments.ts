import { supabase } from './client';
import { uploadDocumentFile, getSignedDocumentUrl, deleteDocumentFile, buildExpenseDocumentPath } from './documentStorage';
import type { ExpenseDocument } from '@vacationist/types';

const BUCKET = 'expense-documents';

export async function getExpenseDocuments(expenseId: string): Promise<ExpenseDocument[]> {
  const { data, error } = await supabase
    .from('expense_documents')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ExpenseDocument[];
}

export async function uploadExpenseDocument(
  tripId: string,
  expenseId: string,
  fileData: Blob | ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<ExpenseDocument> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) throw new Error('Not authenticated');

  const path = buildExpenseDocumentPath(tripId, expenseId, userId, fileName);
  await uploadDocumentFile(BUCKET, path, fileData, mimeType);

  // trip_id is included only to satisfy the generated Insert type — a BEFORE INSERT trigger
  // (set_expense_document_trip_id) always overwrites it with the trusted value derived from
  // expense_id, so a client-supplied value here can never spoof RLS.
  const { data, error } = await supabase
    .from('expense_documents')
    .insert({ trip_id: tripId, expense_id: expenseId, uploaded_by: userId, storage_path: path, file_name: fileName, mime_type: mimeType })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ExpenseDocument;
}

export async function getExpenseDocumentUrl(storagePath: string, ttlSeconds?: number): Promise<string> {
  return getSignedDocumentUrl(BUCKET, storagePath, ttlSeconds);
}

export async function deleteExpenseDocument(documentId: string, storagePath: string): Promise<void> {
  await deleteDocumentFile(BUCKET, storagePath);
  const { error } = await supabase.from('expense_documents').delete().eq('id', documentId);
  if (error) throw error;
}
