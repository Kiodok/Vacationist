import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity, SectionList, ActivityIndicator, Linking, RefreshControl, Switch } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type {
  TransferFlight, TransferFlightVote, TransferVehicle, TransferRental,
  VoteType, CreateTransferFlightInput, UpdateTransferFlightInput,
  CreateTransferVehicleInput, UpdateTransferVehicleInput,
  CreateTransferRentalInput, UpdateTransferRentalInput,
  BookTransferFlightInput,
} from '@vacationist/types';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useCurrentMemberRole, useTripMembers } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTransferFlights, useCreateTransferFlight, useUpdateTransferFlight, useDeleteTransferFlight, useCloseTransferFlightVoting, useReopenTransferFlightVoting, useBookTransferFlight } from '../../../src/features/transfer/hooks/useTransferFlights';
import { useTransferFlightVotes, useCastTransferFlightVote, useRemoveTransferFlightVote } from '../../../src/features/transfer/hooks/useTransferFlightVotes';
import { useTransferFlightPassengers, useSetTransferFlightPassengers } from '../../../src/features/transfer/hooks/useTransferFlightPassengers';
import { useTransferVehicles, useCreateTransferVehicle, useUpdateTransferVehicle, useDeleteTransferVehicle } from '../../../src/features/transfer/hooks/useTransferVehicles';
import { useTransferVehiclePassengers, useAddTransferVehiclePassenger, useRemoveTransferVehiclePassenger, useUpdateTransferVehiclePassenger, useJoinVehicle, useLeaveVehicle } from '../../../src/features/transfer/hooks/useTransferVehiclePassengers';
import { useTransferRentals, useCreateTransferRental, useUpdateTransferRental, useDeleteTransferRental } from '../../../src/features/transfer/hooks/useTransferRentals';
import { useTransferRealtime } from '../../../src/features/transfer/hooks/useTransferRealtime';
import { computeFlightWinner } from '../../../src/features/transfer/utils/flightWinner';
import { TransferSegmentedControl } from '../../../src/features/transfer/components/TransferSegmentedControl';
import { AllTransfersView } from '../../../src/features/transfer/components/AllTransfersView';
import { FlightCard } from '../../../src/features/transfer/components/FlightCard';
import { VehicleCard } from '../../../src/features/transfer/components/VehicleCard';
import { RentalCard } from '../../../src/features/transfer/components/RentalCard';
import { VoteSheet } from '../../../src/features/activities/components/VoteSheet';
import { BookFlightSheet } from '../../../src/features/transfer/components/BookFlightSheet';
import { PassengerSelectSheet } from '../../../src/features/transfer/components/PassengerSelectSheet';
import { CreateFlightSheet } from '../../../src/features/transfer/components/CreateFlightSheet';
import { EditFlightSheet } from '../../../src/features/transfer/components/EditFlightSheet';
import { CreateVehicleSheet } from '../../../src/features/transfer/components/CreateVehicleSheet';
import { EditVehicleSheet } from '../../../src/features/transfer/components/EditVehicleSheet';
import { CreateRentalSheet } from '../../../src/features/transfer/components/CreateRentalSheet';
import { EditRentalSheet } from '../../../src/features/transfer/components/EditRentalSheet';
import { EmptyFlights } from '../../../src/features/transfer/components/EmptyFlights';
import { EmptyVehicles } from '../../../src/features/transfer/components/EmptyVehicles';
import { EmptyRentals } from '../../../src/features/transfer/components/EmptyRentals';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';

type Segment = 'All' | 'Flights' | 'Vehicles' | 'Rentals';

export default function TransferTab() {
  const { id: tripId, highlightId: highlightIdParam } = useLocalSearchParams<{ id: string; highlightId?: string }>();
  const user = useAuthStore((s) => s.user);
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: trip } = useTrip(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const { data: members = [] } = useTripMembers(tripId!);
  const currency = trip?.base_currency ?? 'EUR';

  const [activeSegment, setActiveSegment] = useState<Segment>('All');
  const [highlightId, setHighlightId] = useState<string | null>(highlightIdParam ?? null);

  const flightListRef = useRef<SectionList<TransferFlight>>(null);
  const vehicleListRef = useRef<SectionList<TransferVehicle>>(null);
  const rentalListRef = useRef<FlashListRef<TransferRental>>(null);

  // Flights
  const flightsQuery = useTransferFlights(tripId!);
  const { data: flights = [], refetch: refetchFlights } = flightsQuery;
  const flightsUx = getQueryDisplayState(flightsQuery);
  const createFlight = useCreateTransferFlight();
  const updateFlightMutation = useUpdateTransferFlight();
  const deleteFlight = useDeleteTransferFlight();
  const closeFlightVoting = useCloseTransferFlightVoting();
  const reopenFlightVoting = useReopenTransferFlightVoting();
  const bookFlight = useBookTransferFlight();
  useTransferRealtime(tripId!);

  // Vehicles
  const vehiclesQuery = useTransferVehicles(tripId!);
  const { data: vehicles = [], refetch: refetchVehicles } = vehiclesQuery;
  const vehiclesUx = getQueryDisplayState(vehiclesQuery);
  const createVehicle = useCreateTransferVehicle();
  const updateVehicleMutation = useUpdateTransferVehicle();
  const deleteVehicle = useDeleteTransferVehicle();

  // Rentals
  const rentalsQuery = useTransferRentals(tripId!);
  const { data: rentals = [], refetch: refetchRentals } = rentalsQuery;
  const rentalsUx = getQueryDisplayState(rentalsQuery);
  const createRental = useCreateTransferRental();
  const updateRentalMutation = useUpdateTransferRental();
  const deleteRental = useDeleteTransferRental();

  // Sheet state
  const [showCreateFlight, setShowCreateFlight] = useState(false);
  const [editingFlight, setEditingFlight] = useState<TransferFlight | null>(null);
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TransferVehicle | null>(null);
  const [showCreateRental, setShowCreateRental] = useState(false);
  const [editingRental, setEditingRental] = useState<TransferRental | null>(null);

  // Compute all votes for winner detection (we get votes per flight inside each card)
  const allFlightIds = useMemo(() => flights.map((f) => f.id), [flights]);

  const { t } = useTranslation('transfer');

  // SectionList data
  const flightSections = useMemo(() => {
    const both = flights.filter((f) => f.direction === 'outbound-return');
    const outbound = flights.filter((f) => f.direction === 'outbound');
    const ret = flights.filter((f) => f.direction === 'return');
    const sections: { key: string; title: string; data: TransferFlight[] }[] = [];
    if (both.length > 0) sections.push({ key: 'outbound-return', title: t('direction.both'), data: both });
    if (outbound.length > 0) sections.push({ key: 'outbound', title: t('direction.outbound'), data: outbound });
    if (ret.length > 0) sections.push({ key: 'return', title: t('direction.return'), data: ret });
    return sections;
  }, [flights, t]);

  const vehicleSections = useMemo(() => {
    const both = vehicles.filter((v) => v.direction === 'outbound-return');
    const outbound = vehicles.filter((v) => v.direction === 'outbound');
    const ret = vehicles.filter((v) => v.direction === 'return');
    const sections: { key: string; title: string; data: TransferVehicle[] }[] = [];
    if (both.length > 0) sections.push({ key: 'outbound-return', title: t('direction.both'), data: both });
    if (outbound.length > 0) sections.push({ key: 'outbound', title: t('direction.outbound'), data: outbound });
    if (ret.length > 0) sections.push({ key: 'return', title: t('direction.return'), data: ret });
    return sections;
  }, [vehicles, t]);

  // Auto-switch to the segment that contains the highlighted item so the scroll effect can fire.
  useEffect(() => {
    if (!highlightId) return;
    for (const s of flightSections) {
      if (s.data.some((f) => f.id === highlightId)) { setActiveSegment('Flights'); return; }
    }
    for (const s of vehicleSections) {
      if (s.data.some((v) => v.id === highlightId)) { setActiveSegment('Vehicles'); return; }
    }
    if (rentals.some((r) => r.id === highlightId)) setActiveSegment('Rentals');
  }, [highlightId, flightSections, vehicleSections, rentals]);

  useEffect(() => {
    if (!highlightId) return;
    const scrollTimer = setTimeout(() => {
      if (activeSegment === 'Flights') {
        for (let si = 0; si < flightSections.length; si++) {
          const ii = flightSections[si].data.findIndex((f) => f.id === highlightId);
          if (ii >= 0) {
            flightListRef.current?.scrollToLocation({ sectionIndex: si, itemIndex: ii, animated: true, viewOffset: 80 });
            break;
          }
        }
      } else if (activeSegment === 'Vehicles') {
        for (let si = 0; si < vehicleSections.length; si++) {
          const ii = vehicleSections[si].data.findIndex((v) => v.id === highlightId);
          if (ii >= 0) {
            vehicleListRef.current?.scrollToLocation({ sectionIndex: si, itemIndex: ii, animated: true, viewOffset: 80 });
            break;
          }
        }
      } else if (activeSegment === 'Rentals') {
        const idx = rentals.findIndex((r) => r.id === highlightId);
        if (idx >= 0) {
          rentalListRef.current?.scrollToIndex({ index: idx, animated: true, viewOffset: 80 });
        }
      }
    }, 200);
    const clearTimer = setTimeout(() => setHighlightId(null), 5000);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, [highlightId, activeSegment, flightSections, vehicleSections, rentals]);

  const isLoading =
    (activeSegment === 'All' && (flightsUx.showSkeleton || vehiclesUx.showSkeleton || rentalsUx.showSkeleton)) ||
    (activeSegment === 'Flights' && flightsUx.showSkeleton) ||
    (activeSegment === 'Vehicles' && vehiclesUx.showSkeleton) ||
    (activeSegment === 'Rentals' && rentalsUx.showSkeleton);

  const showOfflineEmpty =
    (activeSegment === 'All' && (flightsUx.showOfflineEmpty || vehiclesUx.showOfflineEmpty || rentalsUx.showOfflineEmpty)) ||
    (activeSegment === 'Flights' && flightsUx.showOfflineEmpty) ||
    (activeSegment === 'Vehicles' && vehiclesUx.showOfflineEmpty) ||
    (activeSegment === 'Rentals' && rentalsUx.showOfflineEmpty);

  const handleCreateFlight = (input: CreateTransferFlightInput) => {
    setShowCreateFlight(false);
    createFlight.mutate({ tripId: tripId!, input });
  };

  const handleUpdateFlight = (input: UpdateTransferFlightInput) => {
    if (!editingFlight) return;
    setEditingFlight(null);
    updateFlightMutation.mutate({ flightId: editingFlight.id, tripId: tripId!, input });
  };

  const handleCreateVehicle = (input: CreateTransferVehicleInput) => {
    setShowCreateVehicle(false);
    createVehicle.mutate({ tripId: tripId!, input });
  };

  const handleUpdateVehicle = (input: UpdateTransferVehicleInput) => {
    if (!editingVehicle) return;
    setEditingVehicle(null);
    updateVehicleMutation.mutate({ vehicleId: editingVehicle.id, tripId: tripId!, input });
  };

  const handleCreateRental = (input: CreateTransferRentalInput) => {
    setShowCreateRental(false);
    createRental.mutate({ tripId: tripId!, input });
  };

  const handleUpdateRental = (input: UpdateTransferRentalInput) => {
    if (!editingRental) return;
    setEditingRental(null);
    updateRentalMutation.mutate({ rentalId: editingRental.id, tripId: tripId!, input });
  };

  const renderDirectionHeader = (title: string, sectionKey: string) => {
    const isBoth = sectionKey === 'outbound-return';
    const isReturn = sectionKey === 'return';
    const iconName = isBoth ? 'swap-horizontal-outline' : isReturn ? 'return-up-back-outline' : 'airplane-outline';
    const iconColor = isBoth ? colors.success : isReturn ? colors.warning : colors.primary;
    const textClass = isBoth ? 'text-success' : isReturn ? 'text-warning' : 'text-primary';
    return (
      <View className="flex-row items-center gap-xs pt-md pb-sm px-xs">
        <ThemedIcon name={iconName} size={16} color={iconColor} />
        <Text className={`text-body font-semibold ${textClass}`}>{title}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1">
        <TransferSegmentedControl activeSegment={activeSegment} onSegmentChange={setActiveSegment} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (showOfflineEmpty) {
    return (
      <View className="flex-1">
        <TransferSegmentedControl activeSegment={activeSegment} onSegmentChange={setActiveSegment} />
        <OfflineEmptyState onRetry={() => { refetchFlights(); refetchVehicles(); refetchRentals(); }} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <TransferSegmentedControl activeSegment={activeSegment} onSegmentChange={setActiveSegment} />

      {/* All */}
      {activeSegment === 'All' && (
        <AllTransfersView
          flights={flights}
          vehicles={vehicles}
          rentals={rentals}
          currency={currency}
          isRefreshing={flightsUx.refreshing || vehiclesUx.refreshing || rentalsUx.refreshing}
          onRefresh={() => { refetchFlights(); refetchVehicles(); refetchRentals(); }}
          onFlightPress={(id) => { setHighlightId(id); setActiveSegment('Flights'); }}
          onVehiclePress={(id) => { setHighlightId(id); setActiveSegment('Vehicles'); }}
          onRentalPress={(id) => { setHighlightId(id); setActiveSegment('Rentals'); }}
        />
      )}

      {/* Flights */}
      {activeSegment === 'Flights' && (
        flights.length === 0 ? (
          <View className="flex-1 px-md">
            <EmptyFlights />
          </View>
        ) : (
          <SectionList
            ref={flightListRef}
            sections={flightSections}
            keyExtractor={(item) => item.id}
            removeClippedSubviews={false}
            stickySectionHeadersEnabled={false}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderSectionHeader={({ section }) => renderDirectionHeader(section.title, section.key ?? '')}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <FlightCardWithVotes
                  flight={item}
                  tripId={tripId!}
                  currentUserId={user?.id}
                  currency={currency}
                  role={role}
                  members={members}
                  allFlightIds={allFlightIds}
                  flightsInDirection={flights.filter((f) => f.direction === item.direction)}
                  highlight={item.id === highlightId}
                  onEdit={() => setEditingFlight(item)}
                  onDelete={() => deleteFlight.mutate({ flightId: item.id, tripId: tripId! })}
                  onCloseVoting={() => closeFlightVoting.mutate({ flightId: item.id, tripId: tripId! })}
                  onReopenVoting={() => reopenFlightVoting.mutate({ flightId: item.id, tripId: tripId! })}
                  onToggleAutoClose={(val) => updateFlightMutation.mutate({ flightId: item.id, tripId: tripId!, input: { auto_close: val } })}
                  onBook={(input) => bookFlight.mutate({ flightId: item.id, tripId: tripId!, input })}
                />
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={flightsUx.refreshing}
                onRefresh={refetchFlights}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )
      )}

      {/* Vehicles */}
      {activeSegment === 'Vehicles' && (
        vehicles.length === 0 ? (
          <View className="flex-1 px-md">
            <EmptyVehicles />
          </View>
        ) : (
          <SectionList
            ref={vehicleListRef}
            sections={vehicleSections}
            keyExtractor={(item) => item.id}
            removeClippedSubviews={false}
            stickySectionHeadersEnabled={false}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderSectionHeader={({ section }) => renderDirectionHeader(section.title, section.key ?? '')}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <VehicleCardWithPassengers
                  vehicle={item}
                  tripId={tripId!}
                  currentUserId={user?.id}
                  role={role}
                  members={members}
                  highlight={item.id === highlightId}
                  onEdit={() => setEditingVehicle(item)}
                  onDelete={() => deleteVehicle.mutate({ vehicleId: item.id, tripId: tripId! })}
                />
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={vehiclesUx.refreshing}
                onRefresh={refetchVehicles}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )
      )}

      {/* Rentals */}
      {activeSegment === 'Rentals' && (
        rentals.length === 0 ? (
          <View className="flex-1 px-md">
            <EmptyRentals />
          </View>
        ) : (
          <FlashList
            ref={rentalListRef}
            data={rentals}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <RentalCardExpanded
                rental={item}
                currency={currency}
                role={role}
                currentUserId={user?.id}
                highlight={item.id === highlightId}
                onEdit={() => setEditingRental(item)}
                onDelete={() => deleteRental.mutate({ rentalId: item.id, tripId: tripId! })}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={rentalsUx.refreshing}
                onRefresh={refetchRentals}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )
      )}

      {/* FAB — hidden on All overview */}
      {activeSegment !== 'All' && (
        <Pressable
          onPress={() => {
            if (activeSegment === 'Flights') setShowCreateFlight(true);
            else if (activeSegment === 'Vehicles') setShowCreateVehicle(true);
            else setShowCreateRental(true);
          }}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
        </Pressable>
      )}

      {/* Create sheets */}
      <CreateFlightSheet
        visible={showCreateFlight}
        onClose={() => setShowCreateFlight(false)}
        onSubmit={handleCreateFlight}
        isPending={isMutationBusy(createFlight)}
        currency={currency}
        tripStartDate={trip?.start_date ?? undefined}
        tripEndDate={trip?.end_date ?? undefined}
      />
      <CreateVehicleSheet
        visible={showCreateVehicle}
        onClose={() => setShowCreateVehicle(false)}
        onSubmit={handleCreateVehicle}
        isPending={isMutationBusy(createVehicle)}
      />
      <CreateRentalSheet
        visible={showCreateRental}
        onClose={() => setShowCreateRental(false)}
        onSubmit={handleCreateRental}
        isPending={isMutationBusy(createRental)}
        currency={currency}
        tripStartDate={trip?.start_date ?? undefined}
        tripEndDate={trip?.end_date ?? undefined}
      />

      {/* Edit sheets */}
      {editingFlight && (
        <EditFlightSheet
          visible={!!editingFlight}
          onClose={() => setEditingFlight(null)}
          onSubmit={handleUpdateFlight}
          isPending={isMutationBusy(updateFlightMutation)}
          flight={editingFlight}
          currency={currency}
          tripStartDate={trip?.start_date ?? undefined}
          tripEndDate={trip?.end_date ?? undefined}
        />
      )}
      {editingVehicle && (
        <EditVehicleSheet
          visible={!!editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSubmit={handleUpdateVehicle}
          isPending={isMutationBusy(updateVehicleMutation)}
          vehicle={editingVehicle}
        />
      )}
      {editingRental && (
        <EditRentalSheet
          visible={!!editingRental}
          onClose={() => setEditingRental(null)}
          onSubmit={handleUpdateRental}
          isPending={isMutationBusy(updateRentalMutation)}
          rental={editingRental}
          currency={currency}
          tripStartDate={trip?.start_date ?? undefined}
          tripEndDate={trip?.end_date ?? undefined}
        />
      )}
    </View>
  );
}

// ─── FlightCardWithVotes ─────────────────────────────────────────────────────

function FlightCardWithVotes({
  flight,
  tripId,
  currentUserId,
  currency,
  role,
  members,
  allFlightIds,
  flightsInDirection,
  highlight,
  onEdit,
  onDelete,
  onCloseVoting,
  onReopenVoting,
  onToggleAutoClose,
  onBook,
}: {
  flight: TransferFlight;
  tripId: string;
  currentUserId: string | undefined;
  currency: string;
  role: string | null | undefined;
  members: ReturnType<typeof useTripMembers>['data'] & {};
  allFlightIds: string[];
  flightsInDirection: TransferFlight[];
  highlight?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCloseVoting: () => void;
  onReopenVoting: () => void;
  onToggleAutoClose: (autoClose: boolean) => void;
  onBook: (input: BookTransferFlightInput) => void;
}) {
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation("common");
  const { data: votes = [] } = useTransferFlightVotes(flight.id);
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: passengers = [] } = useTransferFlightPassengers(flight.id);
  const castVote = useCastTransferFlightVote();
  const removeVote = useRemoveTransferFlightVote(tripId, flight.id);
  const setPassengers = useSetTransferFlightPassengers(tripId, flight.id);

  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(highlight ?? false);
  const [showBookSheet, setShowBookSheet] = useState(false);
  const [showPassengerSheet, setShowPassengerSheet] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCloseVoting, setConfirmingCloseVoting] = useState(false);

  const memberMap = useMemo(
    () => new Map((members ?? []).map((m) => [m.user_id, m.user.name])),
    [members],
  );

  // Compute per-direction winner using only this flight's direction peers
  const votesByFlightId = useMemo(() => ({ [flight.id]: votes }), [flight.id, votes]);
  const directionFlightVotes = useMemo(() => {
    const result: Record<string, TransferFlightVote[]> = {};
    for (const f of flightsInDirection) {
      result[f.id] = f.id === flight.id ? votes : [];
    }
    return result;
  }, [flightsInDirection, flight.id, votes]);

  const winnerIds = useMemo(
    () => computeFlightWinner(flightsInDirection, directionFlightVotes),
    [flightsInDirection, directionFlightVotes],
  );
  const isWinner = winnerIds[flight.direction] === flight.id;

  const canEdit = role === 'organizer' || (role === 'participant' && flight.created_by === currentUserId);
  const canDelete = role === 'organizer' || (role === 'participant' && flight.created_by === currentUserId);
  const canCloseVoting = role === 'organizer' && flight.voting_open;
  const canReopenVoting = role === 'organizer' && !flight.voting_open;
  const canBook = role === 'organizer' && !flight.voting_open && flight.status !== 'booked';
  const canManagePassengers = role === 'organizer' && flight.status === 'booked';

  const isDiscuss = votes.some((v) => v.vote === 'group_blocker') && flight.voting_open;
  const canActOnDiscuss = isDiscuss && (role === 'organizer' || flight.created_by === currentUserId);

  const handleCastVote = (vote: VoteType) => {
    setShowVoteSheet(false);
    castVote.mutate({ vote, flightId: flight.id, tripId });
  };

  const handleRemoveVote = () => {
    setShowVoteSheet(false);
    removeVote.mutate(undefined);
  };

  const handleBook = (input: BookTransferFlightInput) => {
    onBook(input);
    setShowBookSheet(false);
  };

  const currentPassengerIds = passengers.map((p) => p.user_id);

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {flight.notes && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.notes')}</Text>
          <Text className="text-body-small text-text-secondary">{flight.notes}</Text>
        </View>
      )}
      {flight.external_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(flight.external_url!)}
          className="flex-row items-center gap-xs"
        >
          <ThemedIcon name="link-outline" size={14} color={colors.primary} />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {flight.external_url}
          </Text>
        </TouchableOpacity>
      )}

      {flight.status === 'booked' && passengers.length > 0 && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{t('action.passengers')}</Text>
          <View className="flex-row flex-wrap gap-xs">
            {passengers.map((p) => {
              const member = (members ?? []).find((m) => m.user_id === p.user_id);
              return (
                <View key={p.user_id} className="px-sm py-xs rounded-full bg-surface border border-border">
                  <Text className="text-body-small text-text-secondary">{member?.user?.name ?? t('label.unknown')}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {role === 'organizer' && flight.voting_open && (
        <View className="flex-row items-center justify-between py-xs border-t border-border mt-xs">
          <Text className="text-body-small text-text-secondary">{t('flight.field.autoClose')}</Text>
          <Switch
            value={flight.auto_close}
            onValueChange={onToggleAutoClose}
            trackColor={{ false: '#3E3E3E', true: isColorful ? colors.surface : colors.primary }}
            thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
            ios_backgroundColor="#3E3E3E"
          />
        </View>
      )}

      <View className="gap-sm mt-xs">
        {confirmingCloseVoting ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.closeVoting')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onCloseVoting(); setConfirmingCloseVoting(false); }}
              className="px-sm py-xs rounded-sm bg-warning/20"
            >
              <Text className="text-warning text-body-small font-semibold">{tCommon('button.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCloseVoting(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : confirmingDelete ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.removeFlight')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-sm py-xs rounded-sm bg-danger/20"
            >
              <Text className="text-danger text-body-small font-semibold">{t('confirm.removeYes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-sm flex-wrap">
            {canEdit && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </TouchableOpacity>
            )}
            {canActOnDiscuss && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-success/10"
              >
                <ThemedIcon name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text className="text-success text-body-small font-medium">{t('action.markAsPlanned')}</Text>
              </TouchableOpacity>
            )}
            {canActOnDiscuss && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <ThemedIcon name="close-circle-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.cancelFlight')}</Text>
              </TouchableOpacity>
            )}
            {!isDiscuss && canCloseVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
              >
                <ThemedIcon name="lock-closed-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">{t('action.endVoting')}</Text>
              </TouchableOpacity>
            )}
            {canReopenVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onReopenVoting}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="lock-open-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.reopenVoting')}</Text>
              </TouchableOpacity>
            )}
            {canBook && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowBookSheet(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-success/10"
              >
                <ThemedIcon name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text className="text-success text-body-small font-medium">{t('action.book')}</Text>
              </TouchableOpacity>
            )}
            {canManagePassengers && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowPassengerSheet(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="people-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.passengers')}</Text>
              </TouchableOpacity>
            )}
            {!isDiscuss && canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <ThemedIcon name="trash-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.remove')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  ) : undefined;

  return (
    <>
      <FlightCard
        flight={flight}
        votes={votes}
        currentUserId={currentUserId}
        currency={currency}
        isWinner={isWinner}
        onPress={() => setShowDetail(!showDetail)}
        onVotePress={() => setShowVoteSheet(true)}
        detail={detailContent}
        highlight={highlight}
      />

      <VoteSheet
        visible={showVoteSheet}
        onClose={() => setShowVoteSheet(false)}
        votes={votes}
        currentUserId={currentUserId}
        votingOpen={flight.voting_open}
        onCastVote={handleCastVote}
        onRemoveVote={handleRemoveVote}
        isPending={isMutationBusy(castVote)}
        memberMap={memberMap}
      />

      <BookFlightSheet
        visible={showBookSheet}
        onClose={() => setShowBookSheet(false)}
        onSubmit={handleBook}
        isPending={false}
      />

      <PassengerSelectSheet
        visible={showPassengerSheet}
        onClose={() => setShowPassengerSheet(false)}
        members={members ?? []}
        selectedUserIds={currentPassengerIds}
        onConfirm={(userIds) => {
          setShowPassengerSheet(false);
          setPassengers.mutate(userIds);
        }}
        isPending={isMutationBusy(setPassengers)}
      />
    </>
  );
}

// ─── VehicleCardWithPassengers ────────────────────────────────────────────────

function VehicleCardWithPassengers({
  vehicle,
  tripId,
  currentUserId,
  role,
  members,
  highlight,
  onEdit,
  onDelete,
}: {
  vehicle: TransferVehicle;
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  members: ReturnType<typeof useTripMembers>['data'] & {};
  highlight?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("transfer");
  const { t: tCommon } = useTranslation("common");
  const { data: passengers = [] } = useTransferVehiclePassengers(vehicle.id);
  const addPassenger = useAddTransferVehiclePassenger(tripId, vehicle.id);
  const removePassenger = useRemoveTransferVehiclePassenger(tripId, vehicle.id);
  const updatePassenger = useUpdateTransferVehiclePassenger(tripId, vehicle.id);
  const joinVehicleMutation = useJoinVehicle(tripId, vehicle.id);
  const leaveVehicleMutation = useLeaveVehicle(tripId, vehicle.id);

  const [showDetail, setShowDetail] = useState(highlight ?? false);
  const [showPassengerSheet, setShowPassengerSheet] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canEdit = role === 'organizer' || (role === 'participant' && vehicle.created_by === currentUserId);
  const canDelete = role === 'organizer' || (role === 'participant' && vehicle.created_by === currentUserId);
  const canManagePassengers = role === 'organizer' || (role === 'participant' && vehicle.created_by === currentUserId);
  const hasDetail = canEdit || canDelete || canManagePassengers;
  const isPassenger = currentUserId ? passengers.some((p) => p.user_id === currentUserId) : false;

  const currentPassengerIds = passengers.map((p) => p.user_id);
  const driverUserIds = passengers.filter((p) => p.is_driver).map((p) => p.user_id);

  const handlePassengerConfirm = (userIds: string[]) => {
    const toAdd = userIds.filter((id) => !currentPassengerIds.includes(id));
    const toRemove = currentPassengerIds.filter((id) => !userIds.includes(id));
    const mutations = [
      ...toAdd.map((userId) => addPassenger.mutateAsync({ userId, isDriver: false })),
      ...toRemove.map((userId) => removePassenger.mutateAsync(userId)),
    ];
    Promise.all(mutations).then(() => setShowPassengerSheet(false)).catch(() => {});
  };

  const handleDriverToggle = (userId: string, isDriver: boolean) => {
    updatePassenger.mutate({ userId, isDriver });
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      <View className="gap-sm">
        {confirmingDelete ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.removeVehicle')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-sm py-xs rounded-sm bg-danger/20"
            >
              <Text className="text-danger text-body-small font-semibold">{t('confirm.removeYes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-sm flex-wrap">
            {canEdit && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </TouchableOpacity>
            )}
            {canManagePassengers && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowPassengerSheet(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="people-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.passengers')}</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <ThemedIcon name="trash-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.remove')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  ) : undefined;

  const joinLeaveButton = (
    <View className="border-t border-border px-md py-xs flex-row justify-end">
      {isPassenger ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => leaveVehicleMutation.mutate()}
          disabled={leaveVehicleMutation.isPending}
          className="flex-row items-center gap-xs px-md py-xs rounded-sm bg-danger/10"
        >
          <ThemedIcon name="exit-outline" size={14} color={colors.danger} />
          <Text className="text-danger text-body-small font-medium">{t('action.leave')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => joinVehicleMutation.mutate()}
          disabled={joinVehicleMutation.isPending}
          className="flex-row items-center gap-xs px-md py-xs rounded-sm bg-success/10"
        >
          <ThemedIcon name="enter-outline" size={14} color={colors.success} />
          <Text className="text-success text-body-small font-medium">{t('action.join')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <>
      <VehicleCard
        vehicle={vehicle}
        passengers={passengers}
        members={members ?? []}
        onPress={hasDetail ? () => setShowDetail(!showDetail) : undefined}
        detail={hasDetail ? detailContent : undefined}
        highlight={highlight}
        joinAction={joinLeaveButton}
      />

      <PassengerSelectSheet
        visible={showPassengerSheet}
        onClose={() => setShowPassengerSheet(false)}
        members={members ?? []}
        selectedUserIds={currentPassengerIds}
        onConfirm={handlePassengerConfirm}
        isPending={isMutationBusy(addPassenger) || isMutationBusy(removePassenger)}
        showDriverToggle
        driverUserIds={driverUserIds}
        onDriverToggle={handleDriverToggle}
      />
    </>
  );
}

// ─── RentalCardExpanded ───────────────────────────────────────────────────────

function RentalCardExpanded({
  rental,
  currency,
  role,
  currentUserId,
  highlight,
  onEdit,
  onDelete,
}: {
  rental: TransferRental;
  currency: string;
  role: string | null | undefined;
  currentUserId: string | undefined;
  highlight?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("transfer");
  const { t: tCommon } = useTranslation("common");
  const [showDetail, setShowDetail] = useState(highlight ?? false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canEdit = role === 'organizer' || (role === 'participant' && rental.created_by === currentUserId);
  const canDelete = role === 'organizer' || (role === 'participant' && rental.created_by === currentUserId);
  const hasDetail = !!rental.notes || canEdit || canDelete;

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {rental.notes && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.notes')}</Text>
          <Text className="text-body-small text-text-secondary">{rental.notes}</Text>
        </View>
      )}

      <View className="gap-sm mt-xs">
        {confirmingDelete ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.removeRental')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-sm py-xs rounded-sm bg-danger/20"
            >
              <Text className="text-danger text-body-small font-semibold">{t('confirm.removeYes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-sm flex-wrap">
            {canEdit && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <ThemedIcon name="trash-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.remove')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  ) : undefined;

  return (
    <RentalCard
      rental={rental}
      currency={currency}
      onPress={hasDetail ? () => setShowDetail(!showDetail) : undefined}
      detail={detailContent}
      highlight={highlight}
    />
  );
}
