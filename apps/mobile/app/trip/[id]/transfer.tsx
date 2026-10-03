import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity, SectionList, ActivityIndicator, Linking, RefreshControl, Switch, Platform } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type {
  TransferFlight, TransferFlightVote, TransferVehicle, TransferRental, TransferPublicTransport,
  VoteType, CreateTransferFlightInput, UpdateTransferFlightInput,
  CreateTransferVehicleInput, UpdateTransferVehicleInput,
  CreateTransferRentalInput, UpdateTransferRentalInput,
  CreateTransferPublicTransportInput, UpdateTransferPublicTransportInput,
  BookTransferFlightInput, Currency,
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
import { useTransferPublicTransport, useCreateTransferPublicTransport, useUpdateTransferPublicTransport, useDeleteTransferPublicTransport } from '../../../src/features/transfer/hooks/useTransferPublicTransport';
import { useTransferPublicTransportPassengers, useAddPublicTransportPassenger, useRemovePublicTransportPassenger } from '../../../src/features/transfer/hooks/useTransferPublicTransportPassengers';
import { useTransferRealtime } from '../../../src/features/transfer/hooks/useTransferRealtime';
import { computeFlightWinner } from '../../../src/features/transfer/utils/flightWinner';
import { TransferSegmentedControl } from '../../../src/features/transfer/components/TransferSegmentedControl';
import { AllTransfersView } from '../../../src/features/transfer/components/AllTransfersView';
import { FlightCard } from '../../../src/features/transfer/components/FlightCard';
import { FlightTicketsSection } from '../../../src/features/transfer/components/FlightTicketsSection';
import { VehicleCard } from '../../../src/features/transfer/components/VehicleCard';
import { RentalCard } from '../../../src/features/transfer/components/RentalCard';
import { PublicTransportCard } from '../../../src/features/transfer/components/PublicTransportCard';
import { PublicTransportTicketsSection } from '../../../src/features/transfer/components/PublicTransportTicketsSection';
import { VoteSheet } from '../../../src/features/activities/components/VoteSheet';
import { BookFlightSheet } from '../../../src/features/transfer/components/BookFlightSheet';
import { PassengerSelectSheet } from '../../../src/features/transfer/components/PassengerSelectSheet';
import { CreateFlightSheet } from '../../../src/features/transfer/components/CreateFlightSheet';
import { EditFlightSheet } from '../../../src/features/transfer/components/EditFlightSheet';
import { CreateVehicleSheet } from '../../../src/features/transfer/components/CreateVehicleSheet';
import { EditVehicleSheet } from '../../../src/features/transfer/components/EditVehicleSheet';
import { CreateRentalSheet } from '../../../src/features/transfer/components/CreateRentalSheet';
import { EditRentalSheet } from '../../../src/features/transfer/components/EditRentalSheet';
import { CreatePublicTransportSheet } from '../../../src/features/transfer/components/CreatePublicTransportSheet';
import { EditPublicTransportSheet } from '../../../src/features/transfer/components/EditPublicTransportSheet';
import { EmptyFlights } from '../../../src/features/transfer/components/EmptyFlights';
import { EmptyVehicles } from '../../../src/features/transfer/components/EmptyVehicles';
import { EmptyRentals } from '../../../src/features/transfer/components/EmptyRentals';
import { EmptyPublicTransport } from '../../../src/features/transfer/components/EmptyPublicTransport';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { safeScrollToSectionLocation, safeScrollToIndex } from '../../../src/utils/safeListScroll';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';
import { QueryErrorState } from '../../../src/components/QueryErrorState';
import { CreateExpenseSheet, type ExpensePrefill } from '../../../src/features/expenses/components/CreateExpenseSheet';
import { useCreateExpense } from '../../../src/features/expenses/hooks/useExpenses';
import { uploadExpenseDocument, getTransferFlightPassengers, getTransferFlightDocuments } from '@vacationist/api';
import { readFileAsArrayBuffer, type PickedDocumentFile } from '../../../src/utils/documentPicker';
import { createClientId } from '../../../src/utils/optimisticId';
import { useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '../../../src/stores/toastStore';
import type { CreateExpenseInput } from '@vacationist/types';

type Segment = 'All' | 'Flights' | 'Vehicles' | 'Rentals' | 'PublicTransport';

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
  const publicTransportListRef = useRef<FlashListRef<TransferPublicTransport>>(null);
  const flightScrollTargetRef = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);
  const flightScrollAttemptsRef = useRef(0);
  const vehicleScrollTargetRef = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);
  const vehicleScrollAttemptsRef = useRef(0);

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
  const createExpense = useCreateExpense();
  const queryClient = useQueryClient();
  const { t: tExpenses } = useTranslation('expenses');

  // Mirrors expenses.tsx's uploadStagedExpenseDocuments exactly (same accepted gap: lost if the
  // create mutation is queued offline and replays after the app was killed) — fires from the
  // create mutation's onSuccess, never in parallel with it, and surfaces a toast on failure
  // instead of swallowing it (code review 2026-10-03).
  const uploadStagedExpenseDocuments = async (expenseId: string, files: PickedDocumentFile[]) => {
    if (files.length === 0) return;
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const fileData = await readFileAsArrayBuffer(file.uri);
        return uploadExpenseDocument(tripId!, expenseId, fileData, file.fileName, file.mimeType);
      }),
    );
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'documents'] });
    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      useToastStore.getState().addToast('error', tExpenses('toast.stagedDocumentsFailed', { count: failedCount }));
    }
  };
  // v1.39.2 task 4: offered after booking a flight, or after a rental/public-transport entry's
  // price is first set (no Book/status step on those two) — accept links a split expense via
  // related_id so the cost analysis excludes the entity's own price and counts the expense
  // instead; dismiss/cancel leaves it unset, which is today's behavior.
  const [expensePrompt, setExpensePrompt] = useState<ExpensePrefill | null>(null);

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

  // Public transport
  const publicTransportQuery = useTransferPublicTransport(tripId!);
  const { data: publicTransport = [], refetch: refetchPublicTransport } = publicTransportQuery;
  const publicTransportUx = getQueryDisplayState(publicTransportQuery);
  const createPublicTransport = useCreateTransferPublicTransport();
  const updatePublicTransportMutation = useUpdateTransferPublicTransport();
  const deletePublicTransport = useDeleteTransferPublicTransport();

  // Sheet state
  const [showCreateFlight, setShowCreateFlight] = useState(false);
  const [editingFlight, setEditingFlight] = useState<TransferFlight | null>(null);
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<TransferVehicle | null>(null);
  const [showCreateRental, setShowCreateRental] = useState(false);
  const [editingRental, setEditingRental] = useState<TransferRental | null>(null);
  const [showCreatePublicTransport, setShowCreatePublicTransport] = useState(false);
  const [editingPublicTransport, setEditingPublicTransport] = useState<TransferPublicTransport | null>(null);

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
    if (rentals.some((r) => r.id === highlightId)) { setActiveSegment('Rentals'); return; }
    if (publicTransport.some((p) => p.id === highlightId)) setActiveSegment('PublicTransport');
  }, [highlightId, flightSections, vehicleSections, rentals, publicTransport]);

  useEffect(() => {
    if (!highlightId) return;
    const scrollTimer = setTimeout(() => {
      if (activeSegment === 'Flights') {
        for (let si = 0; si < flightSections.length; si++) {
          const ii = flightSections[si].data.findIndex((f) => f.id === highlightId);
          if (ii >= 0) {
            // +1: within a section, flat index 0 is the section header itself
            // (see VirtualizedSectionList.scrollToLocation) — data row n sits at n + 1.
            flightScrollTargetRef.current = { sectionIndex: si, itemIndex: ii + 1 };
            flightScrollAttemptsRef.current = 0;
            safeScrollToSectionLocation(flightListRef, flightSections, { sectionIndex: si, itemIndex: ii + 1, animated: true, viewOffset: 80 });
            break;
          }
        }
      } else if (activeSegment === 'Vehicles') {
        for (let si = 0; si < vehicleSections.length; si++) {
          const ii = vehicleSections[si].data.findIndex((v) => v.id === highlightId);
          if (ii >= 0) {
            vehicleScrollTargetRef.current = { sectionIndex: si, itemIndex: ii + 1 };
            vehicleScrollAttemptsRef.current = 0;
            safeScrollToSectionLocation(vehicleListRef, vehicleSections, { sectionIndex: si, itemIndex: ii + 1, animated: true, viewOffset: 80 });
            break;
          }
        }
      } else if (activeSegment === 'Rentals') {
        const idx = rentals.findIndex((r) => r.id === highlightId);
        if (idx >= 0) {
          safeScrollToIndex(rentalListRef, rentals.length, { index: idx, animated: true, viewOffset: 80 });
        }
      } else if (activeSegment === 'PublicTransport') {
        const idx = publicTransport.findIndex((p) => p.id === highlightId);
        if (idx >= 0) {
          safeScrollToIndex(publicTransportListRef, publicTransport.length, { index: idx, animated: true, viewOffset: 80 });
        }
      }
    }, 200);
    const clearTimer = setTimeout(() => setHighlightId(null), 5000);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, [highlightId, activeSegment, flightSections, vehicleSections, rentals, publicTransport]);

  const isLoading =
    (activeSegment === 'All' && (flightsUx.showSkeleton || vehiclesUx.showSkeleton || rentalsUx.showSkeleton || publicTransportUx.showSkeleton)) ||
    (activeSegment === 'Flights' && flightsUx.showSkeleton) ||
    (activeSegment === 'Vehicles' && vehiclesUx.showSkeleton) ||
    (activeSegment === 'Rentals' && rentalsUx.showSkeleton) ||
    (activeSegment === 'PublicTransport' && publicTransportUx.showSkeleton);

  const showOfflineEmpty =
    (activeSegment === 'All' && (flightsUx.showOfflineEmpty || vehiclesUx.showOfflineEmpty || rentalsUx.showOfflineEmpty || publicTransportUx.showOfflineEmpty)) ||
    (activeSegment === 'Flights' && flightsUx.showOfflineEmpty) ||
    (activeSegment === 'Vehicles' && vehiclesUx.showOfflineEmpty) ||
    (activeSegment === 'Rentals' && rentalsUx.showOfflineEmpty) ||
    (activeSegment === 'PublicTransport' && publicTransportUx.showOfflineEmpty);

  const showError =
    (activeSegment === 'All' && (flightsUx.showError || vehiclesUx.showError || rentalsUx.showError || publicTransportUx.showError)) ||
    (activeSegment === 'Flights' && flightsUx.showError) ||
    (activeSegment === 'Vehicles' && vehiclesUx.showError) ||
    (activeSegment === 'Rentals' && rentalsUx.showError) ||
    (activeSegment === 'PublicTransport' && publicTransportUx.showError);

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

  // v1.39.2 task 4: rentals have no Book/status step, so the "record as expense?" prompt's
  // equivalent moment is the price going from unset/zero to a positive value — only prompt once
  // (the "was unset before" check), not on every subsequent edit. Public transport NEVER
  // triggers this prompt (Tech Lead follow-up, 2026-10-03) — ridership is often unknown or still
  // changing at the moment a PT entry's price is set, so prompting immediately was premature,
  // unwanted UX. See §3 of the cost-analysis doc in software_engineering_guide.md: PT prices are
  // now excluded from the cost analysis entirely instead (same treatment as
  // `activities.cost_estimate`), since removing this prompt also removes the only mechanism that
  // ever populated `expenses.related_id` for a PT entity.
  //
  // `priceSignal` only gates whether we prompt at all (the entity has SOME price set);
  // `prefillAmount` is what goes in the form. `price_per_person` is a PER-PERSON rate, not the
  // group total the cost-analysis RPC actually excludes once this expense is linked
  // (`price × participant_count`) — prefilling the bare per-person number read as authoritative
  // (the banner says it "replaces" the booking's price) and was easy to miss correcting. Flights
  // now compute the real group total via `computeFlightGroupTotal` below (passengers are
  // assignable before Book as of the same follow-up, so a non-zero count is the common case) —
  // `prefillAmount` is `undefined` only when no passengers/tickets are assigned yet. Rentals have
  // no per-person ambiguity at all — `price_total` already IS the group total (summed directly by
  // the RPC, never multiplied) — so rentals always prefill it.
  const promptExpenseForEntity = (title: string, priceSignal: number, prefillAmount: number | undefined, currencyCode: Currency, id: string) => {
    if (priceSignal > 0) {
      setExpensePrompt({
        title,
        amount: prefillAmount,
        currency: currencyCode,
        relatedType: 'transport',
        relatedId: id,
        banner: tExpenses('create.linkedToBookingBanner', { title }),
      });
    }
  };

  // Mirrors get_trip_cost_summary's flight participant math — price_per_person ×
  // COUNT(DISTINCT user_id) over transfer_flight_passengers ∪ transfer_documents (ticket
  // holders) — so the booking prompt prefills the real group total instead of the bare
  // per-person rate. Flight passengers are now assignable before Book (20261003140000), so a
  // non-zero count is the common case by the time this fires. Resolves to undefined on fetch
  // failure or an empty union — never blocks the prompt.
  const computeFlightGroupTotal = async (flightId: string, perPersonPrice: number): Promise<number | undefined> => {
    try {
      const [passengers, documents] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['transfer-flights', flightId, 'passengers'],
          queryFn: () => getTransferFlightPassengers(flightId),
        }),
        queryClient.fetchQuery({
          queryKey: ['transfer-flights', flightId, 'documents'],
          queryFn: () => getTransferFlightDocuments(flightId),
        }),
      ]);
      const uniqueUserIds = new Set([...passengers, ...documents].map((row) => row.user_id));
      return uniqueUserIds.size > 0 ? Number((perPersonPrice * uniqueUserIds.size).toFixed(2)) : undefined;
    } catch {
      return undefined;
    }
  };

  const handleCreateRental = (input: CreateTransferRentalInput) => {
    setShowCreateRental(false);
    // Rentals have no per-person ambiguity — price_total already is the group total (see
    // promptExpenseForEntity's doc comment) — safe to prefill directly.
    createRental.mutate({ tripId: tripId!, input }, {
      onSuccess: (rental) => promptExpenseForEntity(rental.title, Number(input.price_total ?? 0), Number(input.price_total ?? 0), rental.currency, rental.id),
    });
  };

  const handleUpdateRental = (input: UpdateTransferRentalInput) => {
    if (!editingRental) return;
    const hadNoPrice = !(Number(editingRental.price_total ?? 0) > 0);
    const rentalId = editingRental.id;
    // input.title is the just-submitted value — editingRental.title is only a fallback for an
    // old/partial payload that happens to omit it (code review 2026-10-03: using the stale
    // pre-edit title unconditionally showed the OLD name in the prompt banner when a save
    // renamed the rental and set its price in the same edit).
    const title = input.title ?? editingRental.title;
    const rentalCurrency = input.currency ?? editingRental.currency;
    setEditingRental(null);
    updateRentalMutation.mutate({ rentalId, tripId: tripId!, input }, {
      onSuccess: () => { if (hadNoPrice) promptExpenseForEntity(title, Number(input.price_total ?? 0), Number(input.price_total ?? 0), rentalCurrency, rentalId); },
    });
  };

  const handleCreatePublicTransport = (input: CreateTransferPublicTransportInput) => {
    setShowCreatePublicTransport(false);
    // No booking-prompt for PT (Tech Lead follow-up, 2026-10-03) — see promptExpenseForEntity's
    // doc comment. Its price is excluded from the cost analysis entirely instead.
    createPublicTransport.mutate({ tripId: tripId!, input });
  };

  const handleUpdatePublicTransport = (input: UpdateTransferPublicTransportInput) => {
    if (!editingPublicTransport) return;
    const ptId = editingPublicTransport.id;
    setEditingPublicTransport(null);
    // No booking-prompt for PT here either — see handleCreatePublicTransport's comment.
    updatePublicTransportMutation.mutate({ publicTransportId: ptId, tripId: tripId!, input });
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
        <OfflineEmptyState onRetry={() => { refetchFlights(); refetchVehicles(); refetchRentals(); refetchPublicTransport(); }} />
      </View>
    );
  }

  if (showError) {
    return (
      <View className="flex-1">
        <TransferSegmentedControl activeSegment={activeSegment} onSegmentChange={setActiveSegment} />
        <QueryErrorState onRetry={() => { refetchFlights(); refetchVehicles(); refetchRentals(); refetchPublicTransport(); }} />
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
          publicTransport={publicTransport}
          isRefreshing={flightsUx.refreshing || vehiclesUx.refreshing || rentalsUx.refreshing || publicTransportUx.refreshing}
          onRefresh={() => { refetchFlights(); refetchVehicles(); refetchRentals(); refetchPublicTransport(); }}
          onFlightPress={(id) => { setHighlightId(id); setActiveSegment('Flights'); }}
          onVehiclePress={(id) => { setHighlightId(id); setActiveSegment('Vehicles'); }}
          onRentalPress={(id) => { setHighlightId(id); setActiveSegment('Rentals'); }}
          onPublicTransportPress={(id) => { setHighlightId(id); setActiveSegment('PublicTransport'); }}
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
            onScrollToIndexFailed={(info) => {
              const target = flightScrollTargetRef.current;
              if (!target || flightScrollAttemptsRef.current >= 3) return;
              flightScrollAttemptsRef.current += 1;
              flightListRef.current?.getScrollResponder()?.scrollTo({
                y: Math.max(0, info.averageItemLength * info.index - 80),
                animated: false,
              });
              setTimeout(() => {
                safeScrollToSectionLocation(flightListRef, flightSections, { ...target, animated: false, viewOffset: 80 });
              }, 80);
            }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 88 }}
            renderSectionHeader={({ section }) => renderDirectionHeader(section.title, section.key ?? '')}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <FlightCardWithVotes
                  flight={item}
                  tripId={tripId!}
                  currentUserId={user?.id}
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
                  onBook={(input) => bookFlight.mutate(
                    { flightId: item.id, tripId: tripId!, input },
                    // Prefill is computed from real assigned passengers/tickets now that
                    // flight passengers are assignable before Book (20261003140000, 2026-10-03
                    // follow-up) — see computeFlightGroupTotal's doc comment.
                    {
                      onSuccess: async () => {
                        const perPersonPrice = Number(item.price_per_person ?? 0);
                        const prefillAmount = await computeFlightGroupTotal(item.id, perPersonPrice);
                        promptExpenseForEntity(item.title, perPersonPrice, prefillAmount, item.currency, item.id);
                      },
                    },
                  )}
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
            onScrollToIndexFailed={(info) => {
              const target = vehicleScrollTargetRef.current;
              if (!target || vehicleScrollAttemptsRef.current >= 3) return;
              vehicleScrollAttemptsRef.current += 1;
              vehicleListRef.current?.getScrollResponder()?.scrollTo({
                y: Math.max(0, info.averageItemLength * info.index - 80),
                animated: false,
              });
              setTimeout(() => {
                safeScrollToSectionLocation(vehicleListRef, vehicleSections, { ...target, animated: false, viewOffset: 80 });
              }, 80);
            }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 88 }}
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
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 88 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <RentalCardExpanded
                rental={item}
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

      {/* Public Transport */}
      {activeSegment === 'PublicTransport' && (
        publicTransport.length === 0 ? (
          <View className="flex-1 px-md">
            <EmptyPublicTransport />
          </View>
        ) : (
          <FlashList
            ref={publicTransportListRef}
            data={publicTransport}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 88 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <PublicTransportCardExpanded
                entry={item}
                tripId={tripId!}
                role={role}
                members={members}
                currentUserId={user?.id}
                highlight={item.id === highlightId}
                onEdit={() => setEditingPublicTransport(item)}
                onDelete={() => deletePublicTransport.mutate({ publicTransportId: item.id, tripId: tripId! })}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={publicTransportUx.refreshing}
                onRefresh={refetchPublicTransport}
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
            else if (activeSegment === 'Rentals') setShowCreateRental(true);
            else setShowCreatePublicTransport(true);
          }}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 4, ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }, default: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } }) }}
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
      <CreatePublicTransportSheet
        visible={showCreatePublicTransport}
        onClose={() => setShowCreatePublicTransport(false)}
        onSubmit={handleCreatePublicTransport}
        isPending={isMutationBusy(createPublicTransport)}
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
      {editingPublicTransport && (
        <EditPublicTransportSheet
          visible={!!editingPublicTransport}
          onClose={() => setEditingPublicTransport(null)}
          onSubmit={handleUpdatePublicTransport}
          isPending={isMutationBusy(updatePublicTransportMutation)}
          entry={editingPublicTransport}
          currency={currency}
          tripStartDate={trip?.start_date ?? undefined}
          tripEndDate={trip?.end_date ?? undefined}
        />
      )}

      {/* members defaults to [] (truthy, unlike accommodations.tsx's undefined-while-loading
          `members`), so this needs an explicit length check to actually gate on "loaded" —
          otherwise a prompt that fires before useTripMembers resolves mounts the sheet with an
          empty member list, producing an unsubmittable zero-split expense (code review
          2026-10-03). */}
      {expensePrompt && user?.id && members.length > 0 && (
        <CreateExpenseSheet
          visible={!!expensePrompt}
          onClose={() => setExpensePrompt(null)}
          onSubmit={(input: CreateExpenseInput, stagedFiles: PickedDocumentFile[]) => {
            setExpensePrompt(null);
            createExpense.mutate(
              { tripId: tripId!, input, id: createClientId() },
              { onSuccess: (expenseId) => { void uploadStagedExpenseDocuments(expenseId, stagedFiles); } },
            );
          }}
          isPending={isMutationBusy(createExpense)}
          members={members}
          currentUserId={user.id}
          currency={currency}
          tripId={tripId!}
          prefill={expensePrompt}
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
  const removeVote = useRemoveTransferFlightVote();
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
  // 2026-10-03 follow-up: passengers can now be assigned before booking (organizer-only, still —
  // no self-join for flights, unlike PT/vehicles), so the Book-time prompt can prefill a real
  // group total. See the 20261003140000 migration.
  const canManagePassengers = role === 'organizer';

  const isDiscuss = votes.some((v) => v.vote === 'group_blocker') && flight.voting_open;
  const canActOnDiscuss = isDiscuss && (role === 'organizer' || flight.created_by === currentUserId);

  const handleCastVote = (vote: VoteType) => {
    setShowVoteSheet(false);
    castVote.mutate({ vote, flightId: flight.id, tripId });
  };

  const handleRemoveVote = () => {
    setShowVoteSheet(false);
    removeVote.mutate({ flightId: flight.id, tripId });
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

      {passengers.length > 0 && (
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

      <FlightTicketsSection
        tripId={tripId}
        flightId={flight.id}
        members={(members ?? []).map((m) => ({ user_id: m.user_id, name: m.user.name }))}
        currentUserId={currentUserId}
        isOrganizer={role === 'organizer'}
      />

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
        direction={flight.direction}
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
          disabled={isMutationBusy(leaveVehicleMutation)}
          className="flex-row items-center gap-xs px-md py-xs rounded-sm bg-danger/10"
        >
          <ThemedIcon name="exit-outline" size={14} color={colors.danger} />
          <Text className="text-danger text-body-small font-medium">{t('action.leave')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => joinVehicleMutation.mutate()}
          disabled={isMutationBusy(joinVehicleMutation)}
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
  role,
  currentUserId,
  highlight,
  onEdit,
  onDelete,
}: {
  rental: TransferRental;
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
      onPress={hasDetail ? () => setShowDetail(!showDetail) : undefined}
      detail={detailContent}
      highlight={highlight}
    />
  );
}

// ─── PublicTransportCardExpanded ───────────────────────────────────────────────

function PublicTransportCardExpanded({
  entry,
  tripId,
  role,
  members,
  currentUserId,
  highlight,
  onEdit,
  onDelete,
}: {
  entry: TransferPublicTransport;
  tripId: string;
  role: string | null | undefined;
  members: ReturnType<typeof useTripMembers>['data'] & {};
  currentUserId: string | undefined;
  highlight?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("transfer");
  const { t: tCommon } = useTranslation("common");
  const [showDetail, setShowDetail] = useState(highlight ?? false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showPassengerSheet, setShowPassengerSheet] = useState(false);

  const { data: passengers = [] } = useTransferPublicTransportPassengers(entry.id);
  const addPassenger = useAddPublicTransportPassenger(tripId, entry.id);
  const removePassenger = useRemovePublicTransportPassenger(tripId, entry.id);

  const canEdit = role === 'organizer' || (role === 'participant' && entry.created_by === currentUserId);
  const canDelete = role === 'organizer' || (role === 'participant' && entry.created_by === currentUserId);
  // Vehicle model: the entry's creator or an organizer manages the whole list; anyone else can
  // only join/leave themselves.
  const canManagePassengers = role === 'organizer' || entry.created_by === currentUserId;
  const currentPassengerIds = passengers.map((p) => p.user_id);
  const isPassenger = currentUserId ? currentPassengerIds.includes(currentUserId) : false;

  const handlePassengerConfirm = (userIds: string[]) => {
    setShowPassengerSheet(false);
    const toAdd = userIds.filter((id) => !currentPassengerIds.includes(id));
    const toRemove = currentPassengerIds.filter((id) => !userIds.includes(id));
    toAdd.forEach((userId) => addPassenger.mutate(userId));
    toRemove.forEach((userId) => removePassenger.mutate(userId));
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {entry.notes && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.notes')}</Text>
          <Text className="text-body-small text-text-secondary">{entry.notes}</Text>
        </View>
      )}

      {passengers.length > 0 && (
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

      <PublicTransportTicketsSection
        tripId={tripId}
        publicTransportId={entry.id}
        members={(members ?? []).map((m) => ({ user_id: m.user_id, name: m.user.name }))}
        currentUserId={currentUserId}
        isOrganizer={role === 'organizer'}
      />

      {currentUserId && (
        <View className="flex-row justify-end border-t border-border pt-xs">
          {isPassenger ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => removePassenger.mutate(currentUserId)}
              disabled={isMutationBusy(removePassenger)}
              className="flex-row items-center gap-xs px-md py-xs rounded-sm bg-danger/10"
            >
              <ThemedIcon name="exit-outline" size={14} color={colors.danger} />
              <Text className="text-danger text-body-small font-medium">{t('action.leave')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => addPassenger.mutate(currentUserId)}
              disabled={isMutationBusy(addPassenger)}
              className="flex-row items-center gap-xs px-md py-xs rounded-sm bg-success/10"
            >
              <ThemedIcon name="enter-outline" size={14} color={colors.success} />
              <Text className="text-success text-body-small font-medium">{t('action.join')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View className="gap-sm mt-xs">
        {confirmingDelete ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.removePublicTransport')}</Text>
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

  return (
    <>
      <PublicTransportCard
        entry={entry}
        onPress={() => setShowDetail(!showDetail)}
        detail={detailContent}
        highlight={highlight}
      />

      <PassengerSelectSheet
        visible={showPassengerSheet}
        onClose={() => setShowPassengerSheet(false)}
        members={members ?? []}
        selectedUserIds={currentPassengerIds}
        onConfirm={handlePassengerConfirm}
        isPending={isMutationBusy(addPassenger) || isMutationBusy(removePassenger)}
      />
    </>
  );
}
