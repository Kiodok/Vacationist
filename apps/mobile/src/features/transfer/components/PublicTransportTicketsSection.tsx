import { usePublicTransportDocuments, useUploadPublicTransportDocument, useDeletePublicTransportDocument } from '../hooks/useTransferDocuments';
import { TicketsSection } from './TicketsSection';

interface PublicTransportTicketsSectionProps {
  tripId: string;
  publicTransportId: string;
  /** Every trip member — a ticket can be attached by anyone, no passenger-assignment concept for public transport. */
  members: { user_id: string; name: string }[];
  currentUserId: string | undefined;
  /** Organizer — allowed to upload/replace/delete any member's ticket, not just their own. */
  isOrganizer: boolean;
}

export function PublicTransportTicketsSection({ tripId, publicTransportId, members, currentUserId, isOrganizer }: PublicTransportTicketsSectionProps) {
  const { data: documents } = usePublicTransportDocuments(publicTransportId);
  const uploadMutation = useUploadPublicTransportDocument(tripId, publicTransportId);
  const deleteMutation = useDeletePublicTransportDocument(publicTransportId);

  return (
    <TicketsSection
      documents={documents}
      uploadMutation={uploadMutation}
      deleteMutation={deleteMutation}
      members={members}
      currentUserId={currentUserId}
      isOrganizer={isOrganizer}
    />
  );
}
