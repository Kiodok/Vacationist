import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AccessibleMemberDocument } from '@vacationist/types';
import { MemberAvatar } from '../../trips/components/MemberAvatar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors } from '@vacationist/ui';

dayjs.extend(relativeTime);

const DOCUMENT_LABELS: Record<string, string> = {
  passport: 'Passport',
  id_card: 'ID Card',
};

interface MemberDocumentsSheetProps {
  visible: boolean;
  onClose: () => void;
  documents: AccessibleMemberDocument[];
  isLoading: boolean;
}

function groupByUser(docs: AccessibleMemberDocument[]) {
  const map = new Map<string, { name: string; avatar: string | null; docs: AccessibleMemberDocument[] }>();
  for (const doc of docs) {
    if (!map.has(doc.user_id)) {
      map.set(doc.user_id, { name: doc.user_name, avatar: doc.user_avatar, docs: [] });
    }
    map.get(doc.user_id)!.docs.push(doc);
  }
  return Array.from(map.values());
}

export function MemberDocumentsSheet({ visible, onClose, documents, isLoading }: MemberDocumentsSheetProps) {
  const insets = useSafeAreaInsets();
  const groups = groupByUser(documents);

  const earliestExpiry = documents.reduce<string | null>((min, d) => {
    if (!min) return d.grant_expires_at;
    return d.grant_expires_at < min ? d.grant_expires_at : min;
  }, null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-heading-m text-text-primary font-semibold">Member Documents</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {earliestExpiry && (
            <View className="bg-warning/10 border border-warning/30 rounded-sm px-md py-xs mb-md flex-row items-center gap-xs">
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text className="text-body-small text-warning">
                Access expires {dayjs(earliestExpiry).fromNow()}
              </Text>
            </View>
          )}

          {isLoading ? (
            <View className="py-xl items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : groups.length === 0 ? (
            <View className="py-xl items-center gap-sm">
              <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text className="text-body text-text-muted text-center">
                No members have granted access yet
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-lg pb-md">
                {groups.map((group) => (
                  <View key={group.name} className="gap-sm">
                    <View className="flex-row items-center gap-sm">
                      <MemberAvatar name={group.name} avatarUrl={group.avatar} size="sm" />
                      <Text className="text-body text-text-primary font-semibold">{group.name}</Text>
                    </View>

                    {group.docs.map((doc) => (
                      <View key={doc.document_type} className="bg-surface border border-border rounded-md p-md gap-xs ml-md">
                        <Text className="text-label text-text-muted uppercase mb-xs">
                          {DOCUMENT_LABELS[doc.document_type]}
                        </Text>

                        <Row label="Legal name" value={doc.full_legal_name} />
                        <Row label="Document no." value={doc.document_number} mono />
                        {doc.date_of_birth && <Row label="Date of birth" value={doc.date_of_birth} />}
                        {doc.nationality && <Row label="Nationality" value={doc.nationality} />}
                        {doc.issuing_country && <Row label="Issued by" value={doc.issuing_country} />}
                        {doc.expiry_date && <Row label="Expires" value={doc.expiry_date} />}
                        {doc.notes && (
                          <Text className="text-body-small text-text-muted mt-xs">{doc.notes}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
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
