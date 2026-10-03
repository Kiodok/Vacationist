import { getActivityDocumentUrl } from '@vacationist/api';
import { useActivityDocuments, useUploadActivityDocument, useDeleteActivityDocument } from '../hooks/useActivityDocuments';
import { TicketsSection } from '../../transfer/components/TicketsSection';

interface ActivityDocumentsSectionProps {
  tripId: string;
  activityId: string;
  /** Every trip member — activities have no passenger/attendee concept. */
  members: { user_id: string; name: string }[];
  currentUserId: string | undefined;
  /** Organizer — allowed to upload/replace/delete any member's document, not just their own. */
  isOrganizer: boolean;
}

export function ActivityDocumentsSection({ tripId, activityId, members, currentUserId, isOrganizer }: ActivityDocumentsSectionProps) {
  const { data: documents } = useActivityDocuments(activityId);
  const uploadMutation = useUploadActivityDocument(tripId, activityId);
  const deleteMutation = useDeleteActivityDocument(activityId);

  return (
    <TicketsSection
      documents={documents}
      uploadMutation={uploadMutation}
      deleteMutation={deleteMutation}
      members={members}
      currentUserId={currentUserId}
      isOrganizer={isOrganizer}
      namespace="activities"
      getDocumentUrl={getActivityDocumentUrl}
    />
  );
}
