import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { TransferFlight, TransferVehicle, TransferRental } from '@vacationist/types';
import { colors } from '@vacationist/ui';

export interface AllTransfersViewProps {
  flights: TransferFlight[];
  vehicles: TransferVehicle[];
  rentals: TransferRental[];
  currency: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDatetime(value: string | null): string | null {
  if (!value) return null;
  const match = value.replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${parseInt(match[3])} ${MONTHS[parseInt(match[2]) - 1]}, ${match[4]}:${match[5]}`;
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
          <Text className="text-success text-label font-semibold">Winner</Text>
        </View>
      )}
    </View>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  if (direction === 'outbound-return') {
    return (
      <View className="px-sm py-xs rounded-full bg-success/10">
        <Text className="text-label font-medium text-success">Both</Text>
      </View>
    );
  }
  return (
    <View className={`px-sm py-xs rounded-full ${direction === 'outbound' ? 'bg-primary/10' : 'bg-warning/10'}`}>
      <Text className={`text-label font-medium ${direction === 'outbound' ? 'text-primary' : 'text-warning'}`}>
        {direction === 'outbound' ? 'Outbound' : 'Return'}
      </Text>
    </View>
  );
}

function FlightStatusBadge({ status, votingOpen }: { status: string; votingOpen: boolean }) {
  if (votingOpen) {
    return (
      <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10">
        <View className="w-[6px] h-[6px] rounded-full bg-primary" />
        <Text className="text-primary text-label font-medium">Voting</Text>
      </View>
    );
  }
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    suggested: { bg: 'bg-primary/10', text: 'text-primary', label: 'Suggested' },
    booked: { bg: 'bg-success/10', text: 'text-success', label: 'Booked' },
    completed: { bg: 'bg-border/50', text: 'text-text-muted', label: 'Done' },
  };
  const c = cfg[status] ?? cfg.suggested;
  return (
    <View className={`px-sm py-xs rounded-full ${c.bg}`}>
      <Text className={`${c.text} text-label font-medium`}>{c.label}</Text>
    </View>
  );
}

function FlightSummaryCard({ flight, currency }: { flight: TransferFlight; currency: string }) {
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';
  const departureFormatted = formatDatetime(flight.departure_time);
  const arrivalFormatted = formatDatetime(flight.arrival_time);
  const returnDepartureFormatted = formatDatetime(flight.return_departure_time);
  const returnArrivalFormatted = formatDatetime(flight.return_arrival_time);
  const isRoundTrip = flight.direction === 'outbound-return';

  return (
    <View className="bg-surface border border-border rounded-md p-md gap-sm mb-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-xs mr-sm">
          <Text className="text-body font-semibold text-text-primary" numberOfLines={1}>
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
          <Ionicons name="airplane-outline" size={14} color="#A0A0A0" />
          <Text className="text-body-small text-text-secondary">
            {isRoundTrip ? 'Out: ' : ''}{[flight.departure_airport, flight.arrival_airport].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}
      {(departureFormatted || arrivalFormatted) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="time-outline" size={14} color="#A0A0A0" />
          <Text className="text-body-small text-text-secondary">
            {isRoundTrip ? 'Out: ' : ''}{[departureFormatted, arrivalFormatted].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}

      {isRoundTrip && (flight.return_departure_airport || flight.return_arrival_airport) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="return-up-back-outline" size={14} color="#A0A0A0" />
          <Text className="text-body-small text-text-secondary">
            {'Ret: '}{[flight.return_departure_airport, flight.return_arrival_airport].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}
      {isRoundTrip && (returnDepartureFormatted || returnArrivalFormatted) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="time-outline" size={14} color="#A0A0A0" />
          <Text className="text-body-small text-text-secondary">
            {'Ret: '}{[returnDepartureFormatted, returnArrivalFormatted].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}

      {flight.status === 'booked' && (flight.flight_number || flight.booking_reference) && (
        <View className="flex-row gap-md flex-wrap">
          {flight.flight_number && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="barcode-outline" size={14} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">{flight.flight_number}</Text>
            </View>
          )}
          {flight.booking_reference && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="receipt-outline" size={14} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">{flight.booking_reference}</Text>
            </View>
          )}
        </View>
      )}

      <View className="flex-row items-center justify-between">
        {flight.price_per_person != null ? (
          <Text className="text-body-small text-text-secondary">
            {currencySymbol}{Number(flight.price_per_person).toFixed(2)} / person
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
        <Text className="text-body-small text-text-secondary" numberOfLines={2}>
          {vehicle.notes}
        </Text>
      ) : null}
    </View>
  );
}

function RentalSummaryCard({ rental, currency }: { rental: TransferRental; currency: string }) {
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';
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
          <Ionicons name="location-outline" size={14} color="#A0A0A0" />
          <Text className="text-body-small text-text-secondary" numberOfLines={1}>
            {[rental.pickup_location, rental.dropoff_location].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}
      {(rental.pickup_date || rental.dropoff_date) && (
        <View className="flex-row items-center gap-xs">
          <Ionicons name="calendar-outline" size={14} color="#A0A0A0" />
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
              <Ionicons name="receipt-outline" size={14} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">{rental.booking_reference}</Text>
            </View>
          )}
          {rental.price_total != null && (
            <Text className="text-body-small text-text-secondary">
              {currencySymbol}{Number(rental.price_total).toFixed(2)}
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
}: AllTransfersViewProps) {
  const allEmpty = flights.length === 0 && vehicles.length === 0 && rentals.length === 0;

  if (allEmpty) {
    return (
      <View className="flex-1 items-center justify-center px-xl gap-sm">
        <Ionicons name="airplane-outline" size={40} color="#5C5C5C" />
        <Text className="text-body text-text-secondary text-center">No transfers planned yet.</Text>
        <Text className="text-body-small text-text-muted text-center">
          Switch to Flights, Vehicles or Rentals to get started.
        </Text>
      </View>
    );
  }

  // A booked flight is the confirmed winner for its direction. If any flight is
  // booked, show only booked flights; otherwise show everything (voting in progress
  // or no winner determined yet). Vehicles and rentals have no voting, always show all.
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
            title="Flights"
            count={displayFlights.length}
            isWinner={bookedFlights.length > 0}
          />
          {displayFlights.map((f) => (
            <FlightSummaryCard key={f.id} flight={f} currency={currency} />
          ))}
        </>
      )}
      {vehicles.length > 0 && (
        <>
          <SectionHeader icon="car-outline" title="Vehicles" count={vehicles.length} />
          {vehicles.map((v) => (
            <VehicleSummaryCard key={v.id} vehicle={v} />
          ))}
        </>
      )}
      {rentals.length > 0 && (
        <>
          <SectionHeader icon="car-sport-outline" title="Rentals" count={rentals.length} />
          {rentals.map((r) => (
            <RentalSummaryCard key={r.id} rental={r} currency={currency} />
          ))}
        </>
      )}
    </ScrollView>
  );
}
