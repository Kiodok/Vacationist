import { useTransferFlightDocuments, useUploadTransferFlightDocument, useDeleteTransferFlightDocument } from '../hooks/useTransferDocuments';
import { TicketsSection } from './TicketsSection';

interface FlightTicketsSectionProps {
  tripId: string;
  flightId: string;
  /** Every trip member, not just assigned passengers — a ticket can be attached before formal passenger assignment. */
  members: { user_id: string; name: string }[];
  currentUserId: string | undefined;
  /** Organizer — allowed to upload/replace/delete any member's ticket, not just their own. */
  isOrganizer: boolean;
}

export function FlightTicketsSection({ tripId, flightId, members, currentUserId, isOrganizer }: FlightTicketsSectionProps) {
  const { data: documents } = useTransferFlightDocuments(flightId);
  const uploadMutation = useUploadTransferFlightDocument(tripId, flightId);
  const deleteMutation = useDeleteTransferFlightDocument(flightId);

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
