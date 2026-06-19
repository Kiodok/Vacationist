import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { Button } from '@vacationist/ui';
import { getTripInviteStats } from '@vacationist/api';
import { useTrip, useDeleteTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useRemoveMember, useLeaveTrip, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useActiveInvites, useCreateInvite, useRevokeInvite } from '../../../src/features/trips/hooks/useInvites';
import { MemberAvatar } from '../../../src/features/trips/components/MemberAvatar';
import { useAuthStore } from '../../../src/stores/authStore';
import { useToastStore } from '../../../src/stores/toastStore';
import { useCreateDocumentAccessRequest } from '../../../src/features/profile/hooks/useDocumentAccessRequests';
import { useAccessibleMemberDocuments } from '../../../src/features/profile/hooks/useAccessibleMemberDocuments';
import { DocumentAccessRequestSheet } from '../../../src/features/profile/components/DocumentAccessRequestSheet';
import { MemberDocumentsSheet } from '../../../src/features/profile/components/MemberDocumentsSheet';
import { NotificationPreferencesSection } from '../../../src/features/notifications/components/NotificationPreferencesSection';
import { NudgeSheet } from '../../../src/features/notifications/components/NudgeSheet';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';

export default function SettingsTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tripId = id!;
  const currentUser = useAuthStore((s) => s.user);

  const { data: trip } = useTrip(tripId);
  const { data: role } = useCurrentMemberRole(tripId);
  const { data: members } = useTripMembers(tripId);
  const { data: invites } = useActiveInvites(tripId);
  const deleteTrip = useDeleteTrip();
  const removeMember = useRemoveMember(tripId);
  const leaveTrip = useLeaveTrip(tripId);
  const createInvite = useCreateInvite(tripId);
  const revokeInvite = useRevokeInvite(tripId);

  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { t } = useTranslation('trips');
  const { t: tCommon } = useTranslation("common");
  const { t: tProfile } = useTranslation("profile");
  const isOrganizer = role === 'organizer';
  const addToast = useToastStore((s) => s.addToast);

  const ROLE_LABELS: Record<string, string> = {
    organizer: t('role.organizer'),
    participant: t('role.participant'),
    guest: t('role.guest'),
  };

  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [requestDocVisible, setRequestDocVisible] = useState(false);
  const [viewDocsVisible, setViewDocsVisible] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);

  const createAccessRequest = useCreateDocumentAccessRequest();
  const { data: memberDocuments = [], isLoading: memberDocsLoading } = useAccessibleMemberDocuments(tripId, isOrganizer);

  const hasActiveDocs = memberDocuments.length > 0;

  async function handleCreateInvite() {
    try {
      const [result, stats] = await Promise.all([
        createInvite.mutateAsync({ expires_in: '7d' }),
        getTripInviteStats(tripId),
      ]);
      const link = `https://vacationist.app/join?token=${result.token}`;
      const memberCount = members?.length ?? 1;

      const lines: string[] = [
        t('invite.share.header', { name: currentUser?.name ?? 'Someone', trip: trip?.title ?? 'my trip' }),
        '',
        t('invite.share.peoplePlanning', { count: memberCount }),
        '',
      ];
      if (stats.accommodationCount > 0) {
        lines.push(t('invite.share.voteAccommodations', { count: stats.accommodationCount }));
      }
      if (stats.activityCount > 0) {
        lines.push(t('invite.share.voteActivities', { count: stats.activityCount }));
      }
      lines.push(t('invite.share.packingList'));
      lines.push(t('invite.share.splitExpenses'));
      lines.push(t('invite.share.shoppingLists'));
      lines.push('');
      lines.push(t('invite.share.noAccountRequired'));
      lines.push('');
      lines.push(link);

      const shareMessage = lines.join('\n');

      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(shareMessage);
        addToast('success', t('toast.inviteCopied'));
      } else {
        await Share.share({
          message: shareMessage,
          url: link,
        });
      }
    } catch {
      // onError toast shown by useCreateInvite; share sheet dismissal is not an error
    }
  }

  if (!trip) return null;

  return (
    <>
    <ScrollView style={{ flex: 1 }} contentContainerClassName="px-md py-md gap-lg">
      {/* Members section */}
      <View>
        <Text className="text-label text-text-muted uppercase mb-sm">{t('settings.members')}</Text>
        <View className="bg-surface border border-border rounded-md">
          {members?.map((member, index) => {
            const canRemove = isOrganizer && member.user_id !== currentUser?.id;
            const isPending = pendingRemovalId === member.user_id;
            const isRemoving = removeMember.isPending && isPending;

            return (
              <View
                key={member.id}
                className={`flex-row items-center p-md gap-md ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <MemberAvatar
                  name={member.user.name}
                  avatarUrl={member.user.avatar_url}
                  size="md"
                />
                <View className="flex-1">
                  <Text className="text-body text-text-primary">{member.user.name}</Text>
                  <Text className="text-body-small text-text-secondary">
                    {ROLE_LABELS[member.role]}
                  </Text>
                </View>

                {canRemove && !isPending && (
                  <Pressable
                    onPress={() => setPendingRemovalId(member.user_id)}
                    hitSlop={12}
                    style={{ padding: 4 }}
                  >
                    <ThemedIcon name="close-circle-outline" size={22} color={colors.danger} />
                  </Pressable>
                )}

                {canRemove && isPending && (
                  <View className="flex-row gap-xs items-center">
                    {isRemoving ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setPendingRemovalId(null)}
                          hitSlop={8}
                          className="px-sm py-xs rounded-sm bg-surface-elevated"
                        >
                          <Text className="text-body-small text-text-secondary">{tCommon('button.cancel')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            removeMember.mutate(member.user_id, {
                              onSettled: () => setPendingRemovalId(null),
                            });
                          }}
                          hitSlop={8}
                          className="px-sm py-xs rounded-sm bg-danger"
                        >
                          <Text className="text-body-small text-white font-semibold">{tCommon('button.remove')}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Invite section */}
      {isOrganizer && (
        <View>
          <Text className="text-label text-text-muted uppercase mb-sm">{t('settings.inviteLink')}</Text>
          <View className="bg-surface border border-border rounded-md p-md gap-md">
            <Button
              label={t('settings.generateInvite')}
              variant="secondary"
              onPress={handleCreateInvite}
              loading={createInvite.isPending}
              icon={<ThemedIcon name="link-outline" size={18} color={colors.primary} />}
            />

            {invites && invites.length > 0 && (
              <View className="gap-sm">
                <Text className="text-body-small text-text-secondary">{t('settings.activeInvites')}</Text>
                {invites.map((invite) => (
                  <View
                    key={invite.id}
                    className="flex-row items-center justify-between bg-surface-elevated rounded-sm p-sm"
                  >
                    <View className="flex-1">
                      <Text className="text-body-small text-text-primary" numberOfLines={1}>
                        ...{invite.token.slice(-8)}
                      </Text>
                      <Text className="text-label text-text-muted">
                        {t('settings.inviteUses', { useCount: invite.use_count, maxUses: invite.max_uses != null ? `/${invite.max_uses}` : '' })}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => revokeInvite.mutate(invite.id)}
                      className="p-xs"
                    >
                      <ThemedIcon name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Member documents (organizer only) */}
      {isOrganizer && (
        <View>
          <Text className="text-label text-text-muted uppercase mb-sm">{t('settings.memberDocuments')}</Text>
          <View className="bg-surface border border-border rounded-md p-md gap-md">
            <Text className="text-body-small text-text-secondary">
              {tProfile('accessRequest.howItWorksBody')}
            </Text>
            <View className="flex-row gap-sm">
              <View className="flex-1">
                <Button
                  label={t('settings.requestDocuments')}
                  variant="secondary"
                  onPress={() => setRequestDocVisible(true)}
                  loading={createAccessRequest.isPending}
                  icon={<ThemedIcon name="shield-checkmark-outline" size={18} color={colors.primary} />}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={t('settings.viewDocuments')}
                  variant="secondary"
                  onPress={() => setViewDocsVisible(true)}
                  icon={<ThemedIcon name="document-text-outline" size={18} color={hasActiveDocs ? colors.success : colors.primary} />}
                  className={hasActiveDocs ? 'border-success' : ''}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Push Notification Preferences */}
      {Platform.OS !== 'web' && (
        <NotificationPreferencesSection tripId={tripId} />
      )}

      {/* Organizer nudge */}
      {isOrganizer && Platform.OS !== 'web' && (
        <View>
          <Text className="text-label text-text-muted uppercase mb-sm">{t('settings.nudge')}</Text>
          <View className="bg-surface border border-border rounded-md p-md">
            <Text className="text-body-small text-text-secondary mb-md">
              {t('settings.nudgeDescription')}
            </Text>
            <Button
              label={t('settings.sendNudge')}
              variant="secondary"
              onPress={() => setNudgeVisible(true)}
              icon={<ThemedIcon name="megaphone-outline" size={18} color={colors.primary} />}
            />
          </View>
        </View>
      )}

      {/* Danger zone */}
      <View>
        <Text className="text-label text-text-muted uppercase mb-sm">{t('settings.dangerZone')}</Text>
        <View className="gap-sm">

          {/* Leave Trip */}
          {!isOrganizer && !pendingLeave && (
            isColorful ? (
              <Pressable
                onPress={() => setPendingLeave(true)}
                hitSlop={8}
                className="min-h-[48px] rounded-md px-lg items-center justify-center flex-row gap-sm bg-transparent border border-danger"
              >
                <ThemedIcon name="exit-outline" size={18} color={colors.danger} />
                <Text className="text-body text-danger font-semibold">{t('settings.leaveTrip')}</Text>
              </Pressable>
            ) : (
              <Button
                label={t('settings.leaveTrip')}
                variant="secondary"
                onPress={() => setPendingLeave(true)}
                icon={<ThemedIcon name="exit-outline" size={18} color={colors.primary} />}
              />
            )
          )}
          {!isOrganizer && pendingLeave && (
            <View className="rounded-md border border-danger p-md gap-sm">
              <Text className="text-body-small text-text-secondary">
                {t('settings.leaveConfirm')}
              </Text>
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => setPendingLeave(false)}
                  className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                  disabled={leaveTrip.isPending}
                >
                  <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await leaveTrip.mutateAsync();
                      router.replace('/(tabs)');
                    } catch {
                      setPendingLeave(false);
                      // onError toast shown by useLeaveTrip
                    }
                  }}
                  className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                  disabled={leaveTrip.isPending}
                >
                  {leaveTrip.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-body text-white font-semibold">{t('settings.leaveTrip')}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Delete Trip */}
          {isOrganizer && !pendingDelete && (
            <Pressable
              onPress={() => setPendingDelete(true)}
              className="min-h-[48px] rounded-md border border-danger items-center justify-center flex-row gap-sm"
            >
              <ThemedIcon name="trash-outline" size={18} color={colors.danger} />
              <Text className="text-body text-danger font-semibold">{t('settings.deleteTrip')}</Text>
            </Pressable>
          )}
          {isOrganizer && pendingDelete && (
            <View className="rounded-md border border-danger p-md gap-sm">
              <Text className="text-body-small text-text-secondary">
                {t('settings.deleteConfirm')}
              </Text>
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => setPendingDelete(false)}
                  className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                  disabled={deleteTrip.isPending}
                >
                  <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await deleteTrip.mutateAsync(tripId);
                      router.replace('/(tabs)');
                    } catch {
                      setPendingDelete(false);
                      // onError toast shown by useDeleteTrip
                    }
                  }}
                  className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                  disabled={deleteTrip.isPending}
                >
                  {deleteTrip.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-body text-white font-semibold">{tCommon('button.delete')}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

        </View>
      </View>
    </ScrollView>

    <DocumentAccessRequestSheet
      visible={requestDocVisible}
      onClose={() => setRequestDocVisible(false)}
      onSubmit={(durationMinutes) =>
        createAccessRequest.mutate(
          { tripId, durationMinutes },
          { onSuccess: () => setRequestDocVisible(false) }
        )
      }
      isPending={isMutationBusy(createAccessRequest)}
    />

    <MemberDocumentsSheet
      visible={viewDocsVisible}
      onClose={() => setViewDocsVisible(false)}
      documents={memberDocuments}
      isLoading={memberDocsLoading}
    />

    <NudgeSheet
      tripId={tripId}
      tripName={trip?.title ?? ''}
      visible={nudgeVisible}
      onClose={() => setNudgeVisible(false)}
    />
    </>
  );
}
