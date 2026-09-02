import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../../../components/SegmentedControl';

export type TransferSegment = 'All' | 'Flights' | 'Vehicles' | 'Rentals' | 'PublicTransport';
const SEGMENTS: TransferSegment[] = ['All', 'Flights', 'Vehicles', 'Rentals', 'PublicTransport'];

interface TransferSegmentedControlProps {
  activeSegment: TransferSegment;
  onSegmentChange: (segment: TransferSegment) => void;
}

export function TransferSegmentedControl({ activeSegment, onSegmentChange }: TransferSegmentedControlProps) {
  const { t } = useTranslation('transfer');

  const getLabel = (segment: TransferSegment): string => {
    switch (segment) {
      case 'All':             return t('segment.all');
      case 'Flights':         return t('segment.flights');
      case 'Vehicles':        return t('segment.vehicles');
      case 'Rentals':         return t('segment.rentals');
      case 'PublicTransport': return t('segment.publicTransport');
    }
  };

  return (
    <SegmentedControl
      segments={SEGMENTS.map((key) => ({ key, label: getLabel(key) }))}
      activeKey={activeSegment}
      onChange={(key) => onSegmentChange(key as TransferSegment)}
    />
  );
}
