import { useTranslation } from 'react-i18next';
import { getTransferDocumentUrl } from '@vacationist/api';
import type { TransferFlight } from '@vacationist/types';
import { useTransferFlightDocuments, useUploadTransferFlightDocument, useDeleteTransferFlightDocument } from '../hooks/useTransferDocuments';
import { TicketsSection } from './TicketsSection';

interface FlightTicketsSectionProps {
  tripId: string;
  flightId: string;
  /** v1.39.6: a round-trip flight (`'outbound-return'`) renders separate outbound/return ticket
   * sections; any other direction renders a single unlabeled section, same as before this feature. */
  direction: TransferFlight['direction'];
  /** Every trip member, not just assigned passengers — a ticket can be attached before formal passenger assignment. */
  members: { user_id: string; name: string }[];
  currentUserId: string | undefined;
  /** Organizer — allowed to upload/replace/delete any member's ticket, not just their own. */
  isOrganizer: boolean;
}

export function FlightTicketsSection({ tripId, flightId, direction, members, currentUserId, isOrganizer }: FlightTicketsSectionProps) {
  const { t } = useTranslation('transfer');
  const { data: documents } = useTransferFlightDocuments(flightId);
  const uploadMutation = useUploadTransferFlightDocument(tripId, flightId);
  const deleteMutation = useDeleteTransferFlightDocument(tripId, flightId);

  if (direction === 'outbound-return') {
    return (
      <>
        <TicketsSection
          documents={documents}
          uploadMutation={uploadMutation}
          deleteMutation={deleteMutation}
          members={members}
          currentUserId={currentUserId}
          isOrganizer={isOrganizer}
          getDocumentUrl={getTransferDocumentUrl}
          leg="outbound"
          label={t('field.ticketOutbound')}
        />
        <TicketsSection
          documents={documents}
          uploadMutation={uploadMutation}
          deleteMutation={deleteMutation}
          members={members}
          currentUserId={currentUserId}
          isOrganizer={isOrganizer}
          getDocumentUrl={getTransferDocumentUrl}
          leg="return"
          label={t('field.ticketReturn')}
        />
      </>
    );
  }

  return (
    <TicketsSection
      documents={documents}
      uploadMutation={uploadMutation}
      deleteMutation={deleteMutation}
      members={members}
      currentUserId={currentUserId}
      isOrganizer={isOrganizer}
      getDocumentUrl={getTransferDocumentUrl}
    />
  );
}
