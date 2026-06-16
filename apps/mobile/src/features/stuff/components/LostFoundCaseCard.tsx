import { useState } from 'react';
import { Animated, Platform, View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { LostFoundCase, LostFoundCaseType } from '@vacationist/types';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface LostFoundCaseCardProps {
  lostFoundCase: LostFoundCase;
  memberNameMap: Map<string, string>;
  currentUserId: string | undefined;
  role: string | null | undefined;
  onResolve: () => void;
  onUnresolve: () => void;
  onEdit: () => void;
  onDelete: () => void;
  highlight?: boolean;
}

const CASE_TYPE_STYLE: Record<LostFoundCaseType, { bg: string; text: string; emoji: string }> = {
  lost_unknown:      { bg: 'bg-danger/20',   text: 'text-danger',   emoji: '❓' },
  lost_known:        { bg: 'bg-warning/20',  text: 'text-warning',  emoji: '🔎' },
  found_unknown:     { bg: 'bg-primary/20',  text: 'text-primary',  emoji: '📦' },
  found_owner_known: { bg: 'bg-success/20',  text: 'text-success',  emoji: '✅' },
};

const CASE_TYPE_LABEL_KEY: Record<LostFoundCaseType, 'caseType.lostUnknown' | 'caseType.lostKnown' | 'caseType.foundUnknown' | 'caseType.foundOwnerKnown'> = {
  lost_unknown:      'caseType.lostUnknown',
  lost_known:        'caseType.lostKnown',
  found_unknown:     'caseType.foundUnknown',
  found_owner_known: 'caseType.foundOwnerKnown',
};

export function LostFoundCaseCard({ lostFoundCase: c, memberNameMap, currentUserId, role, onResolve, onUnresolve, onEdit, onDelete, highlight }: LostFoundCaseCardProps) {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { animatedBorderColor } = useHighlightAnimation(highlight, colors.border);

  const style = CASE_TYPE_STYLE[c.case_type];
  const caseTypeLabel = t(CASE_TYPE_LABEL_KEY[c.case_type]);
  const creatorName = memberNameMap.get(c.created_by) ?? '?';
  const targetName = c.target_user ? memberNameMap.get(c.target_user) ?? '?' : null;

  // Can resolve/revert: reporter, organizer, the named target person, or anyone when target is unknown (null)
  const isInvolved =
    c.created_by === currentUserId ||
    role === 'organizer' ||
    c.target_user === currentUserId ||
    c.target_user === null;
  const canResolve = !c.is_resolved && isInvolved;
  const canUnresolve = c.is_resolved && isInvolved;
  const canEdit = c.created_by === currentUserId || role === 'organizer';
  const canDelete = c.created_by === currentUserId || role === 'organizer';

  return (
    <Animated.View
      className={`bg-surface rounded-md px-md py-sm gap-xs ${c.is_resolved ? 'opacity-60' : ''}`}
      style={{
        borderWidth: 1,
        borderColor: animatedBorderColor,
        ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}),
        ...(isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : {}),
      }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-xs flex-wrap">
        <View className={`flex-row items-center gap-xs px-sm py-xs rounded-full ${style.bg}`}>
          <Text style={{ fontSize: 12 }}>{style.emoji}</Text>
          <Text className={`text-label font-medium ${style.text}`}>{caseTypeLabel}</Text>
        </View>
        {c.is_resolved && (
          <View className="px-sm py-xs rounded-full bg-success/10">
            <Text className="text-label text-success">{t('label.resolved')}</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text className="text-body text-text-primary font-medium">{c.title}</Text>

      {/* Description */}
      {c.description ? (
        <Text className="text-body-small text-text-secondary" numberOfLines={3}>{c.description}</Text>
      ) : null}

      {/* Meta */}
      <View className="gap-xs">
        <Text className="text-body-small text-text-muted">{t('label.reportedBy', { name: creatorName })}</Text>
        {targetName && (
          <Text className="text-body-small text-text-muted">{t('label.involving', { name: targetName })}</Text>
        )}
      </View>

      {/* Actions */}
      {confirmingDelete ? (
        <View className="flex-row items-center gap-sm mt-xs">
          <Text className="text-text-secondary text-body-small">{t('confirm.deleteCase')}</Text>
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
        (canEdit || canResolve || canUnresolve || canDelete) && (
          <View className="flex-row gap-sm mt-xs flex-wrap">
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
            {canResolve && (
              <Pressable
                onPress={onResolve}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-success/10"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <ThemedIcon name="checkmark-outline" size={14} color={colors.success} />
                <Text className="text-success text-body-small font-medium">{t('action.resolve')}</Text>
              </Pressable>
            )}
            {canUnresolve && (
              <Pressable
                onPress={onUnresolve}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <ThemedIcon name="refresh-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">{t('action.unresolve')}</Text>
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
        )
      )}
    </Animated.View>
  );
}
