import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dayjs, formatCurrency } from '@vacationist/utils';
import type { TransferFlight, TransferVehicle, TransferRental, Currency } from '@vacationist/types';
import { colors, METADATA_ICON_COLORS } from '@vacationist/ui';

export interface AllTransfersViewProps {
  flights: TransferFlight[];
  vehicles: TransferVehicle[];
  rentals: TransferRental[];
  currency: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onFlightPress?: (id: string) => void;
  onVehiclePress?: (id: string) => void;
  onRentalPress?: (id: string) => void;
}

function formatDatetime(value: string | null): string | null {
  if (!value) return null;
  const d = dayjs.utc(value.replace(' ', 'T'));
  if (!d.isValid()) return null;
  return d.format('D MMM, HH:mm');
}

function SectionHeader({
  icon,
  title,
  count,
  isWinner = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  count: number;
  isWinner?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-xs pt-md pb-sm px-xs">
      <Ionicons name={icon} size={16} color={isWinner ? colors.success : colors.primary} />
      <Text className={`text-body font-semibold ${isWinner ? 'text-success' : 'text-text-primary'}`}>{title}</Text>
      <Text className="text-body-small text-text-muted">({count})</Text>
      {isWinner && (
        <View className="px-xs py-[2px] rounded-full bg-success/20 ml-xs">
          <Text className="text-success text-label font-semibold">✓</Text>
        </View>
      )}
    </View>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const { t } = useTranslation('transfer');
  if (direction === 'outbound-return') {
    return (
      <View className="px-sm py-xs rounded-full bg-success/10">
        <Text className="text-label font-medium text-success">{t('direction.both')}</Text>
      </View>
    );
  }
  return (
    <View className={`px-sm py-xs rounded-full ${direction === 'outbound' ? 'bg-primary/10' : 'bg-warning/10'}`}>
      <Text className={`text-label font-medium ${direction === 'outbound' ? 'text-primary' : 'text-warning'}`}>
        {direction === 'outbound' ? t('direction.outbound') : t('direction.return')}
      </Text>
    </View>
  );
}

function FlightStatusBadge({ status, votingOpen }: { status: string; votingOpen: boolean }) {
  const { t } = useTranslation('transfer');
  if (votingOpen) {
    return (
      <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10">
        <View className="w-[6px] h-[6px] rounded-full bg-primary" />
        <Text className="text-primary text-label font-medium" numberOfLines={1}>{t('all.status.voting')}</Text>
      </View>
    );
  }
  const cfg: Record<string, { bg: string; text: string; key: 'all.status.suggested' | 'all.status.booked' | 'all.status.done' }> = {
    suggested: { bg: 'bg-primary/10', text: 'text-primary', key: 'all.status.suggested' },
    booked: { bg: 'bg-success/10', text: 'text-success', key: 'all.status.booked' },
    completed: { bg: 'bg-border/50', text: 'text-text-muted', key: 'all.status.done' },
  };
  const c = cfg[status] ?? cfg.suggested;
  return (
    <View className={`px-sm py-xs rounded-full ${c.bg}`}>
      <Text className={`${c.text} text-label font-medium`} numberOfLines={1}>{t(c.key)}</Text>
    </View>
  );
}

function FlightSummaryCard({ flight, currency }: { flight: TransferFlight; currency: string }) {
  const { t } = useTranslation('transfer');
  const departureFormatted = formatDatetime(flight.departure_time);
  const arrivalFormatted = formatDatetime(flight.arrival_time);
  const returnDepartureFormatted = formatDatetime(flight.return_departure_time);
  const returnArrivalFormatted = formatDatetime(flight.return_arrival_time);
  const isRoundTrip = flight.direction === 'outbound-return';
  const outPrefix = isRoundTrip ? `${t('all.direction.outPrefix')} ` : '';
  const retPrefix = `${t('all.direction.retPrefix')} `;

  return (
    <View className="bg-surface border border-border rounded-md p-md gap-sm mb-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-xs mr-sm">
          <Text className="text-body font-semibold text-text-primary" numberOfLines={2}>
            {flight.title}
          </Text>
          {flight.airline && (
            <Text className="text-body-small text-text-secondary">{flight.airline}</Text>
          )}
        </View>
        <FlightStatusBadge status={flight.status} votingOpen={flight.voting_open} />
      </View>

      {(flight.departure_airport || flight.arrival_airport) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="airplane-outline" size={14} color={METADATA_ICON_COLORS.airplane.color} />
          <Text className="text-body-small text-text-secondary">
            {outPrefix}{[flight.departure_airport, flight.arrival_airport].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}
      {(departureFormatted || arrivalFormatted) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="time-outline" size={14} color={METADATA_ICON_COLORS.time.color} />
          <Text className="text-body-small text-text-secondary">
            {outPrefix}{[departureFormatted, arrivalFormatted].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}

      {isRoundTrip && (flight.return_departure_airport || flight.return_arrival_airport) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="return-up-back-outline" size={14} color={METADATA_ICON_COLORS.return.color} />
          <Text className="text-body-small text-text-secondary">
            {retPrefix}{[flight.return_departure_airport, flight.return_arrival_airport].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}
      {isRoundTrip && (returnDepartureFormatted || returnArrivalFormatted) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="time-outline" size={14} color={METADATA_ICON_COLORS.time.color} />
          <Text className="text-body-small text-text-secondary">
            {retPrefix}{[returnDepartureFormatted, returnArrivalFormatted].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}

      {flight.status === 'booked' && (flight.flight_number || flight.booking_reference) && (
        <View className="flex-row gap-md flex-wrap">
          {flight.flight_number && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="barcode-outline" size={14} color={METADATA_ICON_COLORS.barcode.color} />
              <Text className="text-body-small text-text-secondary">{flight.flight_number}</Text>
            </View>
          )}
          {flight.booking_reference && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="receipt-outline" size={14} color={METADATA_ICON_COLORS.receipt.color} />
              <Text className="text-body-small text-text-secondary">{flight.booking_reference}</Text>
            </View>
          )}
        </View>
      )}

      <View className="flex-row items-center justify-between">
        {flight.price_per_person != null ? (
          <Text className="text-body-small text-text-secondary">
            {formatCurrency(Number(flight.price_per_person), currency as Currency)} {t('all.perPerson')}
          </Text>
        ) : <View />}
        <DirectionBadge direction={flight.direction} />
      </View>
    </View>
  );
}

function VehicleSummaryCard({ vehicle }: { vehicle: TransferVehicle }) {
  return (
    <View className="bg-surface border border-border rounded-md p-md gap-sm mb-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-body font-semibold text-text-primary flex-1 mr-sm" numberOfLines={1}>
          {vehicle.title}
        </Text>
        <DirectionBadge direction={vehicle.direction} />
      </View>
      {vehicle.notes ? (
        <Text className="text-body-small text-text-secondary">
          {vehicle.notes}
        </Text>
      ) : null}
    </View>
  );
}

function RentalSummaryCard({ rental, currency }: { rental: TransferRental; currency: string }) {
  return (
    <View className="bg-surface border border-border rounded-md p-md gap-sm mb-sm">
      <Text className="text-body font-semibold text-text-primary" numberOfLines={1}>
        {rental.title}
      </Text>
      {rental.company && (
        <Text className="text-body-small text-text-secondary">{rental.company}</Text>
      )}
      {(rental.pickup_location || rental.dropoff_location) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="location-outline" size={14} color={METADATA_ICON_COLORS.location.color} />
          <Text className="text-body-small text-text-secondary" numberOfLines={1}>
            {[rental.pickup_location, rental.dropoff_location].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}
      {(rental.pickup_date || rental.dropoff_date) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="calendar-outline" size={14} color={METADATA_ICON_COLORS.calendar.color} />
          <Text className="text-body-small text-text-secondary">
            {[
              rental.pickup_date ? dayjs(rental.pickup_date).format('D MMM') : null,
              rental.dropoff_date ? dayjs(rental.dropoff_date).format('D MMM') : null,
            ].filter(Boolean).join(' – ')}
          </Text>
        </View>
      )}
      {(rental.booking_reference || rental.price_total != null) && (
        <View className="flex-row gap-md flex-wrap">
          {rental.booking_reference && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="receipt-outline" size={14} color={METADATA_ICON_COLORS.receipt.color} />
              <Text className="text-body-small text-text-secondary">{rental.booking_reference}</Text>
            </View>
          )}
          {rental.price_total != null && (
            <Text className="text-body-small text-text-secondary">
              {formatCurrency(Number(rental.price_total), currency as Currency)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function AllTransfersView({
  flights,
  vehicles,
  rentals,
  currency,
  isRefreshing,
  onRefresh,
  onFlightPress,
  onVehiclePress,
  onRentalPress,
}: AllTransfersViewProps) {
  const { t } = useTranslation('transfer');
  const allEmpty = flights.length === 0 && vehicles.length === 0 && rentals.length === 0;

  if (allEmpty) {
    return (
      <View className="flex-1 items-center justify-center px-xl gap-sm">
        <Ionicons name="airplane-outline" size={40} color={colors.textMuted} />
        <Text className="text-body text-text-secondary text-center">{t('all.empty.title')}</Text>
        <Text className="text-body-small text-text-muted text-center">{t('all.empty.sub')}</Text>
      </View>
    );
  }

  const bookedFlights = flights.filter((f) => f.status === 'booked');
  const displayFlights = bookedFlights.length > 0 ? bookedFlights : flights;

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {displayFlights.length > 0 && (
        <>
          <SectionHeader
            icon="airplane-outline"
            title={t('segment.flights')}
            count={displayFlights.length}
            isWinner={bookedFlights.length > 0}
          />
          {displayFlights.map((f) => (
            <Pressable key={f.id} onPress={() => onFlightPress?.(f.id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <FlightSummaryCard flight={f} currency={currency} />
            </Pressable>
          ))}
        </>
      )}
      {vehicles.length > 0 && (
        <>
          <SectionHeader icon="car-outline" title={t('segment.vehicles')} count={vehicles.length} />
          {vehicles.map((v) => (
            <Pressable key={v.id} onPress={() => onVehiclePress?.(v.id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <VehicleSummaryCard vehicle={v} />
            </Pressable>
          ))}
        </>
      )}
      {rentals.length > 0 && (
        <>
          <SectionHeader icon="car-sport-outline" title={t('segment.rentals')} count={rentals.length} />
          {rentals.map((r) => (
            <Pressable key={r.id} onPress={() => onRentalPress?.(r.id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
              <RentalSummaryCard rental={r} currency={currency} />
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
