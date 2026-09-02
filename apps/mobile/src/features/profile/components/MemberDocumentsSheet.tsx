import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { AccessibleMemberDocument, DocumentType } from '@vacationist/types';
import { dayjs } from '@vacationist/utils';
import { colors, ThemedIcon } from '@vacationist/ui';
import { MemberAvatar } from '../../trips/components/MemberAvatar';
import { useMemberDocumentAccessList, useRevealMemberDocuments } from '../hooks/useMemberDocumentAccessList';

interface MemberDocumentsSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  isOrganizer: boolean;
}

export function MemberDocumentsSheet({ visible, onClose, tripId, isOrganizer }: MemberDocumentsSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('profile');
  const { data: entries = [], isLoading } = useMemberDocumentAccessList(tripId, isOrganizer && visible);
  const revealMutation = useRevealMemberDocuments();

  // Decrypted documents live only in local state, keyed by member id, and are wiped whenever the
  // sheet closes — never cached (see the 4-Layer PII pattern in the engineering guide).
  const [revealed, setRevealed] = useState<Record<string, AccessibleMemberDocument[]>>({});

  useEffect(() => {
    if (!visible) setRevealed({});
  }, [visible]);

  const DOC_LABEL: Record<DocumentType, string> = {
    passport: t('memberDocs.passport'),
    id_card: t('memberDocs.idCard'),
  };

  // Group the flat (member, document_type) list by member.
  const members = Array.from(
    entries.reduce((map, e) => {
      const g = map.get(e.user_id) ?? { user_id: e.user_id, name: e.user_name, avatar: e.user_avatar, docTypes: [] as DocumentType[], activatedAt: e.activated_at, expiresAt: e.expires_at, deadline: e.grant_deadline };
      g.docTypes.push(e.document_type);
      map.set(e.user_id, g);
      return map;
    }, new Map<string, { user_id: string; name: string; avatar: string | null; docTypes: DocumentType[]; activatedAt: string | null; expiresAt: string | null; deadline: string }>()).values(),
  );

  const handleReveal = (memberUserId: string) => {
    if (revealed[memberUserId]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[memberUserId];
        return next;
      });
      return;
    }
    revealMutation.mutate(
      { tripId, memberUserId },
      { onSuccess: (docs) => setRevealed((prev) => ({ ...prev, [memberUserId]: docs })) },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-heading-m text-text-primary font-semibold">{t('memberDocs.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <ThemedIcon name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text className="text-body-small text-text-muted mb-md">{t('memberDocs.timerHint')}</Text>

          {isLoading ? (
            <View className="py-xl items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : members.length === 0 ? (
            <View className="py-xl items-center gap-sm">
              <ThemedIcon name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text className="text-body text-text-muted text-center">{t('memberDocs.empty')}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-md pb-md">
                {members.map((m) => {
                  const isRevealed = !!revealed[m.user_id];
                  const isRevealing = revealMutation.isPending && revealMutation.variables?.memberUserId === m.user_id;
                  // Plain fromNow, not safeFromNow — these are FUTURE timestamps and safeFromNow
                  // clamps anything after `now` back to `now` (it's a past-only clock-skew guard).
                  const statusText = m.activatedAt && m.expiresAt
                    ? t('memberDocs.expiresIn', { time: dayjs(m.expiresAt).fromNow() })
                    : `${t('memberDocs.notOpened')} · ${t('memberDocs.autoExpires', { time: dayjs(m.deadline).fromNow() })}`;

                  return (
                    <View key={m.user_id} className="bg-surface border border-border rounded-md p-md gap-sm">
                      <View className="flex-row items-center gap-sm">
                        <MemberAvatar name={m.name} avatarUrl={m.avatar} size="sm" />
                        <View className="flex-1">
                          <Text className="text-body text-text-primary font-semibold">{m.name}</Text>
                          <Text className="text-label text-text-muted">
                            {m.docTypes.map((d) => DOC_LABEL[d]).join(' · ')}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleReveal(m.user_id)}
                          disabled={isRevealing}
                          className="px-md rounded-sm bg-primary/10 items-center justify-center"
                          style={{ minHeight: 40 }}
                        >
                          {isRevealing ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Text className="text-body-small text-primary font-semibold">
                              {isRevealed ? t('memberDocs.hide') : t('memberDocs.view')}
                            </Text>
                          )}
                        </Pressable>
                      </View>

                      <View className="flex-row items-center gap-xs">
                        <ThemedIcon name="time-outline" size={13} color={colors.textMuted} />
                        <Text className="text-label text-text-muted">{statusText}</Text>
                      </View>

                      {isRevealed && (
                        <View className="gap-sm border-t border-border pt-sm">
                          {revealed[m.user_id].map((doc) => (
                            <View key={doc.document_type} className="gap-xs">
                              <Text className="text-label text-text-muted uppercase">{DOC_LABEL[doc.document_type]}</Text>
                              <Row label={t('memberDocs.legalName')} value={doc.full_legal_name} />
                              <Row label={t('memberDocs.documentNo')} value={doc.document_number} mono />
                              {doc.date_of_birth && <Row label={t('memberDocs.dateOfBirth')} value={doc.date_of_birth} />}
                              {doc.nationality && <Row label={t('memberDocs.nationality')} value={doc.nationality} />}
                              {doc.issuing_country && <Row label={t('memberDocs.issuedBy')} value={doc.issuing_country} />}
                              {doc.expiry_date && <Row label={t('memberDocs.expiryDate')} value={doc.expiry_date} />}
                              {doc.notes && <Text className="text-body-small text-text-muted mt-xs">{doc.notes}</Text>}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-body-small text-text-secondary">{label}</Text>
      <Text className={`text-body-small text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</Text>
    </View>
  );
}
