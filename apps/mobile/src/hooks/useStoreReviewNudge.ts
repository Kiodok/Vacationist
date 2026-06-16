import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { storage } from '../utils/mmkvStorage';
import { getEffectiveStatus } from '../features/trips/components/TripCard';
import type { Trip } from '@vacationist/types';

const REVIEW_PROMPTED_TRIPS_KEY = 'review_prompted_trips';
const REVIEW_LAST_PROMPTED_KEY = 'review_last_prompted';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type TripWithCount = Trip & { member_count: number };

export function useStoreReviewNudge(trips: TripWithCount[] | undefined) {
  useEffect(() => {
    if (Platform.OS === 'web' || !trips || trips.length === 0) return;

    const trigger = async () => {
      const lastPrompted = storage.getNumber(REVIEW_LAST_PROMPTED_KEY);
      if (lastPrompted && Date.now() - lastPrompted < THIRTY_DAYS_MS) return;

      const promptedRaw = storage.getString(REVIEW_PROMPTED_TRIPS_KEY);
      const prompted: string[] = promptedRaw ? (JSON.parse(promptedRaw) as string[]) : [];

      const eligible = trips.find(
        (t) => getEffectiveStatus(t) === 'completed' && !prompted.includes(t.id),
      );
      if (!eligible) return;

      const available = await StoreReview.isAvailableAsync();
      if (!available) return;

      storage.set(REVIEW_PROMPTED_TRIPS_KEY, JSON.stringify([...prompted, eligible.id]));
      storage.set(REVIEW_LAST_PROMPTED_KEY, Date.now());

      await StoreReview.requestReview();
    };

    const timer = setTimeout(trigger, 3000);
    return () => clearTimeout(timer);
  }, [trips]);
}
