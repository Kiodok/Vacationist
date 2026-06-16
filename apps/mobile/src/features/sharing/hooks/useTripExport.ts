import { useState, useMemo } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { generateTripMarkdown, computeSettlements } from '@vacationist/utils';
import type { TripMarkdownMember } from '@vacationist/utils';
import { useTrip } from '../../trips/hooks/useTrips';
import { useTripMembers } from '../../trips/hooks/useMembers';
import { useActivities } from '../../activities/hooks/useActivities';
import { useAccommodations } from '../../accommodations/hooks/useAccommodations';
import { useTransferFlights } from '../../transfer/hooks/useTransferFlights';
import { useTransferVehicles } from '../../transfer/hooks/useTransferVehicles';
import { useTransferRentals } from '../../transfer/hooks/useTransferRentals';
import { useShoppingLists } from '../../shopping/hooks/useShoppingLists';
import { useAllTripShoppingItems } from '../../shopping/hooks/useShoppingItems';
import { useNotes } from '../../notes/hooks/useNotes';
import { useTripBalances } from '../../expenses/hooks/useExpenses';
import { shareFile, downloadTextFile } from '../../../utils/share';
import { useToastStore } from '../../../stores/toastStore';
import { i18n } from '@vacationist/i18n';

export function useTripExport(tripId: string) {
  const { data: trip } = useTrip(tripId);
  const { data: members = [] } = useTripMembers(tripId);
  const { data: activities = [] } = useActivities(tripId);
  const { data: accommodations = [] } = useAccommodations(tripId);
  const { data: flights = [] } = useTransferFlights(tripId);
  const { data: vehicles = [] } = useTransferVehicles(tripId);
  const { data: rentals = [] } = useTransferRentals(tripId);
  const { data: shoppingLists = [] } = useShoppingLists(tripId);
  const { data: shoppingItems = [] } = useAllTripShoppingItems(tripId);
  const { data: notes = [] } = useNotes(tripId);
  const { data: balances = [] } = useTripBalances(tripId);

  const addToast = useToastStore((s) => s.addToast);
  const [isExporting, setIsExporting] = useState(false);

  const isReady = !!trip;

  const markdownMembers = useMemo(
    (): TripMarkdownMember[] =>
      members.map((m) => ({ user_id: m.user_id, role: m.role, user: { name: m.user.name } })),
    [members],
  );

  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, m.user.name));
    return map;
  }, [members]);

  async function exportTrip(includeExpenses: boolean): Promise<boolean> {
    if (!trip || isExporting) return false;
    setIsExporting(true);

    try {
      const settlements = includeExpenses ? computeSettlements(balances) : [];

      const markdown = generateTripMarkdown(
        {
          trip,
          members: markdownMembers,
          activities,
          accommodations,
          flights,
          vehicles,
          rentals,
          shoppingLists,
          shoppingItems,
          notes,
          expenses: includeExpenses
            ? { balances, settlements, currency: trip.base_currency, memberNames }
            : undefined,
        },
        { includeExpenses },
      );

      const slug = trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const filename = `${slug}-export.md`;

      if (Platform.OS === 'web') {
        downloadTextFile(filename, markdown, 'text/markdown');
        addToast('success', i18n.t('sharing:toast.exportDownloaded'));
      } else {
        const uri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
        await FileSystem.writeAsStringAsync(uri, markdown, { encoding: FileSystem.EncodingType.UTF8 });
        const result = await shareFile({ fileUri: uri, mimeType: 'text/markdown', dialogTitle: filename });
        if (result === 'shared') {
          addToast('success', i18n.t('sharing:toast.exportShared'));
        }
      }
      return true;
    } catch {
      addToast('error', i18n.t('sharing:toast.exportFailed'));
      return false;
    } finally {
      setIsExporting(false);
    }
  }

  return { isReady, isExporting, exportTrip };
}
