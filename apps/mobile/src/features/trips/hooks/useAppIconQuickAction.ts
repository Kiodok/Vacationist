import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import type { Action as QuickAction } from 'expo-quick-actions';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { i18n, useLocale } from '@vacationist/i18n';
import type { Trip } from '@vacationist/types';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { useTrips } from './useTrips';
import { resolveActiveTrip } from '../utils/resolveActiveTrip';

const ADD_EXPENSE_ACTION_ID = 'add-expense';
// iOS: SF Symbol (no asset needed, available since iOS 13). Android: a raster drawable shipped
// by ./plugins/withQuickActionIcon.js (plus a res/raw/keep.xml rule, since it's referenced only
// by this runtime name string and R8 resource shrinking would otherwise strip it). A cash glyph
// either way, replacing the OS-default shortcut icon.
const EXPENSE_ICON = Platform.OS === 'ios' ? 'symbol:dollarsign.circle.fill' : 'ic_shortcut_expense';

/**
 * Registers (and keeps registered) the app-icon "Add Expense" dynamic home-screen quick action
 * (task 16) — safely a no-op on web, since expo-quick-actions ships a web stub where
 * setItems/addListener do nothing.
 *
 * The target trip is deliberately NOT baked into the shortcut's own params at registration
 * time — resolveActiveTrip runs fresh against the trips cache the moment the action actually
 * fires (handleAction below), not at whatever earlier point the shortcut was last registered.
 * A trip that was "active" at last app launch may no longer be by the time the user actually
 * taps the shortcut days later, so baking in a stale id would silently route to the wrong trip.
 */
export function useAppIconQuickAction(enabled: boolean) {
  const { data: trips } = useTrips();
  const queryClient = useQueryClient();
  const router = useRouter();
  // useLocale() re-renders on language change (react-i18next's own subscription under the
  // hood) — included so the registration effect below re-fires and re-sets the shortcut's
  // title with a freshly translated string whenever the user changes locale, not just at
  // next launch/foreground.
  const { locale } = useLocale();

  const registerShortcut = () => {
    if (!enabled) return;
    const hasTarget = !!trips && resolveActiveTrip(trips) !== null;
    // No ongoing/upcoming/other non-terminal trip at all — clear any previously-registered
    // shortcut rather than leaving one that would resolve to nothing when tapped.
    QuickActions.setItems(
      hasTarget
        ? [{ id: ADD_EXPENSE_ACTION_ID, title: i18n.t('common:quickAction.addExpense'), icon: EXPENSE_ICON }]
        : [],
    ).catch(() => {});
  };

  useEffect(() => {
    registerShortcut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trips, locale]);

  // Re-registers whenever the app returns to the foreground, so a trip that started/ended
  // while backgrounded is reflected without needing a full relaunch.
  useAppForeground(registerShortcut, enabled);

  const handleAction = (action: QuickAction) => {
    if (action.id !== ADD_EXPENSE_ACTION_ID) return;
    const cachedTrips = queryClient.getQueryData<Trip[]>(['trips']);
    const target = cachedTrips ? resolveActiveTrip(cachedTrips) : null;
    if (!target) return;
    // Same ?tab= + highlight-style query param convention used throughout the app
    // (resolveNotificationPath.ts) rather than a direct file-route — index.tsx owns the tab
    // bar/trip header chrome that a direct navigation to expenses.tsx would skip.
    router.push(`/trip/${target.id}?tab=Expenses&quickAction=addExpense` as never);
  };

  const handledInitialRef = useRef(false);

  // Cold start: the app was launched *by* tapping the shortcut, so no addListener event ever
  // fires for it (nothing was listening yet, since the app process didn't exist) —
  // QuickActions.initial carries that same action exactly once. Gated on the *reactive* `trips`
  // value rather than fired unconditionally the moment this effect first runs: auth session
  // resolution and TanStack Query's persisted-cache hydration are both async and may not have
  // populated the trips cache yet on a true cold start, which would otherwise make
  // resolveActiveTrip return null and silently drop the exact tap that launched the app. This
  // effect simply re-fires (still guarded by the ref, so it only ever acts once) each time
  // `trips` changes, until it has actually loaded.
  useEffect(() => {
    if (!enabled || handledInitialRef.current || !QuickActions.initial || !trips) return;
    handledInitialRef.current = true;
    handleAction(QuickActions.initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trips]);

  useEffect(() => {
    if (!enabled) return;
    const sub = QuickActions.addListener(handleAction);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
