import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotificationPreferences';
import type { UpdateNotificationPreferencesInput } from '@vacationist/types';
import { colors } from '@vacationist/ui';

interface NotificationPreferencesSectionProps {
  tripId: string;
}

export function NotificationPreferencesSection({ tripId }: NotificationPreferencesSectionProps) {
  const { t } = useTranslation('notifications');
  const { data: prefs, isLoading } = useNotificationPreferences(tripId);
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

  if (isLoading) {
    return (
      <View className="py-lg items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!prefs) return null;

  return (
    <View className="gap-sm">
      <Text className="text-label-m text-text-secondary uppercase tracking-widest px-xs">
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
              trackColor={{ false: '#3A3A3A', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>
    </View>
  );
}
