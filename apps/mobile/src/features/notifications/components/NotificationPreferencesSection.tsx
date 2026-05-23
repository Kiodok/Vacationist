import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../hooks/useNotificationPreferences';
import type { UpdateNotificationPreferencesInput } from '@vacationist/types';
import { colors } from '@vacationist/ui';

const PREFERENCE_ROWS: { key: keyof UpdateNotificationPreferencesInput; label: string }[] = [
  { key: 'new_activity',    label: 'New activities' },
  { key: 'vote_update',     label: 'Vote results' },
  { key: 'expense_change',  label: 'Expense updates' },
  { key: 'new_member',      label: 'New members' },
  { key: 'schedule_change', label: 'Schedule changes' },
  { key: 'reminder',        label: 'Reminders & nudges' },
];

interface NotificationPreferencesSectionProps {
  tripId: string;
}

export function NotificationPreferencesSection({ tripId }: NotificationPreferencesSectionProps) {
  const { data: prefs, isLoading } = useNotificationPreferences(tripId);
  const { mutate: updatePrefs } = useUpdateNotificationPreferences(tripId);

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
        Push Notifications
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
