import { useMemo } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { PreworkFilter } from '@vacationist/types';
import { useAuthStore } from '../../../src/stores/authStore';
import { useCurrentMemberRole, useTripMembers } from '../../../src/features/trips/hooks/useMembers';
import {
  usePreworkPreferences,
  useMyPreworkPreferences,
  useUpsertPreworkPreferences,
  useDeletePreworkPreferences,
} from '../../../src/features/prework/hooks/usePrework';
import { usePreworkRealtime } from '../../../src/features/prework/hooks/usePreworkRealtime';
import { aggregateFilters, getRecommendedLabels } from '../../../src/features/prework/utils/aggregateFilters';
import { MyPreferencesSection } from '../../../src/features/prework/components/MyPreferencesSection';
import { GroupSummarySection } from '../../../src/features/prework/components/GroupSummarySection';
import { EmptyPrework } from '../../../src/features/prework/components/EmptyPrework';
import { colors } from '@vacationist/ui';

export default function PreworkTab() {
  const { t } = useTranslation('prework');
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: members } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const { data: allPreferences, isLoading: isLoadingAll } = usePreworkPreferences(tripId!);
  const { data: myPreferences, isLoading: isLoadingMy } = useMyPreworkPreferences(tripId!);
  const upsertMutation = useUpsertPreworkPreferences(tripId!);
  const deleteMutation = useDeletePreworkPreferences(tripId!);
  usePreworkRealtime(tripId!);

  const totalMembers = members?.length ?? 0;

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (members) {
      for (const m of members) {
        map[m.user_id] = m.user.name;
      }
    }
    return map;
  }, [members]);

  const aggregated = useMemo(() => {
    if (!allPreferences) return [];
    return aggregateFilters(allPreferences);
  }, [allPreferences]);

  const myFilters: PreworkFilter[] = myPreferences?.filters ?? [];
  const hasAnyPreferences = (allPreferences?.length ?? 0) > 0;

  const recommendedLabels = useMemo(() => {
    if (!allPreferences) return [];
    return getRecommendedLabels(allPreferences, user?.id, myFilters.map((f) => f.label));
  }, [allPreferences, user?.id, myFilters]);

  const organizerDescription = useMemo(() => {
    if (!members || !allPreferences) return null;
    const organizerIds = new Set(
      members.filter((m) => m.role === 'organizer').map((m) => m.user_id)
    );
    for (const pref of allPreferences) {
      if (organizerIds.has(pref.user_id) && pref.description?.trim()) {
        return pref.description.trim();
      }
    }
    return null;
  }, [members, allPreferences]);

  const isOrganizer = role === 'organizer';

  const handleSave = (filters: PreworkFilter[], description: string) => {
    upsertMutation.mutate({ filters, description });
  };

  const handleClear = () => {
    deleteMutation.mutate();
  };

  if (isLoadingAll || isLoadingMy) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const webStyle = Platform.OS === 'web' ? { maxWidth: 600, width: '100%' as const, alignSelf: 'center' as const } : undefined;

  const myDescription = myPreferences?.description ?? '';

  if (!hasAnyPreferences && myFilters.length === 0) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-md py-md gap-lg"
          contentContainerStyle={webStyle}
          keyboardShouldPersistTaps="handled"
        >
          <EmptyPrework />
          <MyPreferencesSection
            initialFilters={myFilters}
            initialDescription={myDescription}
            showDescription={isOrganizer}
            recommendedLabels={recommendedLabels}
            onSave={handleSave}
            onClear={handleClear}
            isSaving={upsertMutation.isPending}
            isClearing={deleteMutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-md py-md gap-xl"
        contentContainerStyle={webStyle}
        keyboardShouldPersistTaps="handled"
      >
        {organizerDescription && !isOrganizer && (
          <View className="bg-surface-elevated rounded-md px-md py-sm gap-xs border border-border">
            <Text className="text-label text-text-muted uppercase">{t('group.contextLabel')}</Text>
            <Text className="text-body text-text-primary">{organizerDescription}</Text>
          </View>
        )}

        <MyPreferencesSection
          initialFilters={myFilters}
          initialDescription={myDescription}
          showDescription={isOrganizer}
          recommendedLabels={recommendedLabels}
          onSave={handleSave}
          onClear={handleClear}
          isSaving={upsertMutation.isPending}
          isClearing={deleteMutation.isPending}
        />

        <GroupSummarySection
          aggregated={aggregated}
          totalMembers={totalMembers}
          memberNames={memberNames}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
