import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotificationPreferences';
import type { UpdateNotificationPreferencesInput } from '@vacationist/types';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface NotificationPreferencesSectionProps {
  tripId: string;
}

export function NotificationPreferencesSection({ tripId }: NotificationPreferencesSectionProps) {
  const { t } = useTranslation('notifications');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: prefs, isLoading, fetchStatus } = useNotificationPreferences(tripId);
  const { mutate: updatePrefs } = useUpdateNotificationPreferences(tripId);

  const PREFERENCE_ROWS: { key: keyof UpdateNotificationPreferencesInput; label: string }[] = [
    { key: 'new_activity',    label: t('preferences.newActivities') },
    { key: 'vote_update',     label: t('preferences.voteResults') },
    { key: 'expense_change',  label: t('preferences.expenseUpdates') },
    { key: 'new_member',      label: t('preferences.newMembers') },
    { key: 'schedule_change', label: t('preferences.scheduleChanges') },
    { key: 'reminder',        label: t('preferences.reminders') },
    { key: 'shared_packing',  label: t('preferences.sharedPacking') },
  ];

  if (isLoading && fetchStatus === 'fetching') {
    return (
      <View className="py-lg items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // No cached data while offline (fetch paused) — hide the section instead of
  // spinning forever; it reappears once the preferences can be fetched.
  if (!prefs) return null;

  return (
    <View className="gap-sm">
      <Text className="text-label text-text-muted uppercase mb-sm">
        {t('preferences.title')}
      </Text>
      <View className="bg-surface border border-border rounded-md overflow-hidden">
        {PREFERENCE_ROWS.map(({ key, label }, idx) => (
          <View
            key={key}
            className={`flex-row items-center justify-between px-md py-sm ${
              idx < PREFERENCE_ROWS.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <Text className="text-body-default text-text-primary">{label}</Text>
            <Switch
              value={prefs[key] ?? true}
              onValueChange={(val) => updatePrefs({ [key]: val })}
              trackColor={{ false: '#3A3A3A', true: isColorful ? colors.background : colors.primary }}
              thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
