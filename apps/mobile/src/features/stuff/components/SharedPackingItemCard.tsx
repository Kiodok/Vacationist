import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';
import type { SharedPackingItem } from '@vacationist/types';

interface SharedPackingItemCardProps {
  item: SharedPackingItem;
  memberNameMap: Map<string, string>;
  currentUserId: string | undefined;
  role: string | null | undefined;
  onClaim: () => void;
  onUnclaim: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const TYPE_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  i_got_it: { bg: 'bg-success/20', text: 'text-success', icon: 'checkmark-circle-outline' },
  who_has:  { bg: 'bg-warning/20', text: 'text-warning', icon: 'help-circle-outline' },
  everyone: { bg: 'bg-primary/20', text: 'text-primary', icon: 'people-outline' },
};

export function SharedPackingItemCard({ item, memberNameMap, currentUserId, role, onClaim, onUnclaim, onEdit, onDelete }: SharedPackingItemCardProps) {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const badge = TYPE_BADGE[item.item_type] ?? TYPE_BADGE.who_has;
  const typeLabel = t(`itemType.${item.item_type === 'i_got_it' ? 'iGotIt' : item.item_type === 'who_has' ? 'whoHas' : 'everyone'}` as const);
  const creatorName = memberNameMap.get(item.created_by) ?? '?';
  const claimerName = item.claimed_by ? memberNameMap.get(item.claimed_by) : null;

  const isCreator = item.created_by === currentUserId;
  const isClaimer = item.claimed_by === currentUserId;
  const isOrganizer = role === 'organizer';

  const canClaim = item.item_type === 'who_has' && !item.is_resolved && item.claimed_by === null && !isCreator;
  // Only who_has items can be unclaimed (claimer or creator); i_got_it can only be deleted
  const canUnclaim = item.item_type === 'who_has' && item.is_resolved && (isClaimer || isCreator);
  const canEdit = isCreator || isOrganizer;
  const canDelete = isCreator || isOrganizer;

  return (
    <View className="bg-surface rounded-md border border-border px-md py-sm gap-xs">
      {/* Header row */}
      <View className="flex-row items-center gap-xs flex-wrap">
        <View className={`flex-row items-center gap-xs px-sm py-xs rounded-full ${badge.bg}`}>
          <ThemedIcon name={badge.icon as any} size={12} color={colors.primary} />
          <Text className={`text-label font-medium ${badge.text}`}>{typeLabel}</Text>
        </View>
        {item.is_resolved && (
          <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-success/10">
            <Text className="text-label text-success">{t('label.resolved')}</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text className="text-body text-text-primary">{item.title}</Text>

      {/* Notes */}
      {item.notes ? (
        <Text className="text-body-small text-text-muted" numberOfLines={2}>{item.notes}</Text>
      ) : null}

      {/* Creator / claimer info */}
      <View className="flex-row items-center gap-xs flex-wrap">
        {item.item_type === 'i_got_it' && (
          <Text className="text-body-small text-text-secondary">
            {t('label.broughtBy', { name: creatorName })}
          </Text>
        )}
        {item.item_type === 'who_has' && !item.claimed_by && (
          <Text className="text-body-small text-text-secondary">
            {t('label.requestedBy', { name: creatorName })}
          </Text>
        )}
        {item.item_type === 'who_has' && claimerName && (
          <Text className="text-body-small text-success">
            {t('label.claimedBy', { name: claimerName })}
          </Text>
        )}
        {item.item_type === 'everyone' && (
          <Text className="text-body-small text-text-secondary">
            {t('label.addedBy', { name: creatorName })}
          </Text>
        )}
      </View>

      {/* Actions */}
      {confirmingDelete ? (
        <View className="flex-row items-center gap-sm mt-xs">
          <Text className="text-text-secondary text-body-small">{t('confirm.delete')}</Text>
          <Pressable
            onPress={() => { onDelete(); setConfirmingDelete(false); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.2)' })}
          >
            <Text className="text-danger text-body-small font-semibold">{t('confirm.deleteYes')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmingDelete(false)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 })}
          >
            <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row gap-sm mt-xs flex-wrap">
          {canClaim && (
            <Pressable
              onPress={onClaim}
              className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-success/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="hand-left-outline" size={14} color={colors.success} />
              <Text className="text-success text-body-small font-medium">{t('action.claim')}</Text>
            </Pressable>
          )}
          {canUnclaim && (
            <Pressable
              onPress={onUnclaim}
              className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="refresh-outline" size={14} color={colors.warning} />
              <Text className="text-warning text-body-small font-medium">{t('action.unclaim')}</Text>
            </Pressable>
          )}
          {canEdit && (
            <Pressable
              onPress={onEdit}
              className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="create-outline" size={14} color={colors.primary} />
              <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={() => setConfirmingDelete(true)}
              className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="trash-outline" size={14} color={colors.danger} />
              <Text className="text-danger text-body-small font-medium">{tCommon('button.delete')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
