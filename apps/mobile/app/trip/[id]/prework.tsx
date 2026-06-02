import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PreworkFilter, PreworkTopic, UpdatePreworkTopicInput, CreatePreworkTopicInput } from '@vacationist/types';
import { useAuthStore } from '../../../src/stores/authStore';
import { useCurrentMemberRole, useTripMembers } from '../../../src/features/trips/hooks/useMembers';
import { usePreworkTopics, useCreatePreworkTopic, useUpdatePreworkTopic, useDeletePreworkTopic } from '../../../src/features/prework/hooks/usePreworkTopics';
import {
  useTopicPreferences,
  useMyTopicPreferences,
  useUpsertTopicPreferences,
  useDeleteTopicPreferences,
  useResetTopicPreferences,
} from '../../../src/features/prework/hooks/usePrework';
import {
  usePreworkRealtime,
  usePreworkTopicsRealtime,
} from '../../../src/features/prework/hooks/usePreworkRealtime';
import { aggregateFilters, getRecommendedLabels } from '../../../src/features/prework/utils/aggregateFilters';
import { PreworkSegmentedControl } from '../../../src/features/prework/components/PreworkSegmentedControl';
import { MyPreferencesSection } from '../../../src/features/prework/components/MyPreferencesSection';
import { GroupSummarySection } from '../../../src/features/prework/components/GroupSummarySection';
import { EmptyPrework } from '../../../src/features/prework/components/EmptyPrework';
import { EmptyTopics } from '../../../src/features/prework/components/EmptyTopics';
import { CreateTopicSheet } from '../../../src/features/prework/components/CreateTopicSheet';
import { EditTopicSheet } from '../../../src/features/prework/components/EditTopicSheet';
import { colors } from '@vacationist/ui';

export default function PreworkTab() {
  const { t } = useTranslation('prework');
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: members } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const isOrganizer = role === 'organizer';

  // Topics
  const { data: topics, isLoading: isLoadingTopics } = usePreworkTopics(tripId!);
  const createTopicMutation = useCreatePreworkTopic(tripId!);
  const updateTopicMutation = useUpdatePreworkTopic(tripId!);
  const deleteTopicMutation = useDeletePreworkTopic(tripId!);
  usePreworkTopicsRealtime(tripId!);

  // Active topic state
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [editingTopic, setEditingTopic] = useState<PreworkTopic | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Auto-select first topic when topics load or change
  useEffect(() => {
    if (!topics || topics.length === 0) {
      setActiveTopicId(null);
      return;
    }
    // Keep current selection if still valid
    if (activeTopicId && topics.some((t) => t.id === activeTopicId)) return;
    setActiveTopicId(topics[0].id);
  }, [topics, activeTopicId]);

  // Reset confirm state when switching topics
  useEffect(() => {
    setConfirmingReset(false);
  }, [activeTopicId]);

  const activeTopic = topics?.find((t) => t.id === activeTopicId) ?? null;

  // Topic-scoped preference data — activeTopicId ?? '' keeps hook call count stable;
  // enabled: !!activeTopicId prevents firing until a topic is selected
  const { data: topicPreferences, isLoading: isLoadingPrefs } = useTopicPreferences(activeTopicId ?? '');
  const { data: myTopicPreferences, isLoading: isLoadingMyPrefs } = useMyTopicPreferences(activeTopicId ?? '');
  const upsertMutation = useUpsertTopicPreferences(activeTopicId ?? '', tripId!);
  const deleteMutation = useDeleteTopicPreferences(activeTopicId ?? '');
  const resetMutation = useResetTopicPreferences(activeTopicId ?? '');
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
    if (!topicPreferences) return [];
    return aggregateFilters(topicPreferences);
  }, [topicPreferences]);

  const myFilters: PreworkFilter[] = myTopicPreferences?.filters ?? [];
  const hasAnyPreferences = (topicPreferences?.length ?? 0) > 0;

  const recommendedLabels = useMemo(() => {
    if (!topicPreferences) return [];
    const seeded = activeTopic?.seeded_labels ?? [];
    const fromMembers = getRecommendedLabels(topicPreferences, user?.id, myFilters.map((f) => f.label));
    const combined = [...seeded, ...fromMembers];
    const seen = new Set<string>();
    return combined.filter((label) => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [topicPreferences, user?.id, myFilters, activeTopic]);

  const handleSave = (filters: PreworkFilter[]) => {
    upsertMutation.mutate({ filters });
  };

  const handleClear = () => {
    deleteMutation.mutate();
  };

  const handleResetAll = () => {
    resetMutation.mutate(undefined, {
      onSuccess: () => setConfirmingReset(false),
      onError: () => setConfirmingReset(false),
    });
  };

  const handleCreateTopic = (input: CreatePreworkTopicInput) => {
    createTopicMutation.mutate(input, {
      onSuccess: (newTopic) => {
        setShowCreateTopic(false);
        setActiveTopicId(newTopic.id);
      },
    });
  };

  const handleUpdateTopic = (topicId: string, input: UpdatePreworkTopicInput) => {
    updateTopicMutation.mutate({ topicId, input }, {
      onSuccess: () => setEditingTopic(null),
    });
  };

  const handleDeleteTopic = (topicId: string) => {
    deleteTopicMutation.mutate(topicId, {
      onSuccess: () => setEditingTopic(null),
    });
  };

  const webStyle = Platform.OS === 'web'
    ? { maxWidth: 600, width: '100%' as const, alignSelf: 'center' as const }
    : undefined;

  if (isLoadingTopics) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const noTopics = !topics || topics.length === 0;

  return (
    <View className="flex-1">
      {/* Segmented control — always visible, even when empty (shows "+" for organizer) */}
      {(!noTopics || isOrganizer) && (
        <PreworkSegmentedControl
          topics={topics ?? []}
          activeTopicId={activeTopicId}
          onTopicChange={setActiveTopicId}
          onAddTopic={isOrganizer ? () => setShowCreateTopic(true) : undefined}
        />
      )}

      {/* Empty topics state */}
      {noTopics && (
        <EmptyTopics
          isOrganizer={isOrganizer}
          onCreateTopic={() => setShowCreateTopic(true)}
        />
      )}

      {/* Active topic content */}
      {!noTopics && activeTopic && (
        <>
          {isLoadingPrefs || isLoadingMyPrefs ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
              <ScrollView
                className="flex-1"
                contentContainerClassName="px-md py-md gap-xl"
                contentContainerStyle={webStyle}
                keyboardShouldPersistTaps="handled"
              >
                {/* Topic header — description banner + organizer edit button */}
                {activeTopic.description && !isOrganizer && (
                  <View className="bg-surface-elevated rounded-md px-md py-sm gap-xs border border-border">
                    <Text className="text-label text-text-muted uppercase">{t('group.contextLabel')}</Text>
                    <Text className="text-body text-text-primary">{activeTopic.description}</Text>
                  </View>
                )}

                {isOrganizer && (
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 gap-xs">
                      {activeTopic.description ? (
                        <>
                          <Text className="text-label text-text-muted uppercase">{t('group.contextLabel')}</Text>
                          <Text className="text-body text-text-secondary">{activeTopic.description}</Text>
                        </>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => setEditingTopic(activeTopic)}
                      className="flex-row items-center gap-xs px-sm py-xs rounded-md bg-surface border border-border ml-sm"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
                      <Text className="text-body-small text-text-secondary">{t('topic.editButton')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Preferences editor */}
                {!hasAnyPreferences && myFilters.length === 0 ? (
                  <>
                    <EmptyPrework />
                    <MyPreferencesSection
                      initialFilters={myFilters}
                      recommendedLabels={recommendedLabels}
                      onSave={handleSave}
                      onClear={handleClear}
                      isSaving={upsertMutation.isPending}
                      isClearing={deleteMutation.isPending}
                    />
                  </>
                ) : (
                  <>
                    <MyPreferencesSection
                      initialFilters={myFilters}
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
                  </>
                )}

                {/* Reset topic (organizer only) */}
                {isOrganizer && hasAnyPreferences && (
                  <View>
                    {confirmingReset ? (
                      <View className="gap-sm">
                        <Text className="text-body-small text-text-secondary">{t('resetAll.confirmMessage')}</Text>
                        <View className="flex-row gap-sm">
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleResetAll}
                            disabled={resetMutation.isPending}
                            className="flex-1 py-sm rounded-md bg-danger/20 items-center"
                          >
                            {resetMutation.isPending ? (
                              <ActivityIndicator size="small" color={colors.danger} />
                            ) : (
                              <Text className="text-danger text-body-small font-semibold">{t('resetAll.confirmAction')}</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setConfirmingReset(false)}
                            disabled={resetMutation.isPending}
                            className="flex-1 py-sm rounded-md bg-surface border border-border items-center"
                          >
                            <Text className="text-text-secondary text-body-small">{t('resetAll.cancel')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setConfirmingReset(true)}
                        className="py-sm rounded-md bg-danger/10 items-center"
                      >
                        <Text className="text-danger text-body font-medium">{t('resetAll.button')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </>
      )}

      {/* Sheets */}
      <CreateTopicSheet
        visible={showCreateTopic}
        onClose={() => setShowCreateTopic(false)}
        onSubmit={handleCreateTopic}
        isPending={createTopicMutation.isPending}
      />
      <EditTopicSheet
        topic={editingTopic}
        visible={editingTopic !== null}
        onClose={() => setEditingTopic(null)}
        onSubmit={handleUpdateTopic}
        onDelete={handleDeleteTopic}
        isSaving={updateTopicMutation.isPending}
        isDeleting={deleteTopicMutation.isPending}
      />
    </View>
  );
}
