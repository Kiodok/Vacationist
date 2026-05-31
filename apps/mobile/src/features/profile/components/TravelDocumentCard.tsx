import { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TravelDocument } from '@vacationist/types';
import dayjs from 'dayjs';
import { colors } from '@vacationist/ui';

interface TravelDocumentCardProps {
  document: TravelDocument;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

const DOCUMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  passport: 'book-outline',
  id_card: 'card-outline',
};

function maskNumber(n: string): string {
  if (n.length <= 4) return '****';
  return '****' + n.slice(-4);
}

function expiryColor(expiryDate: string | null): string {
  if (!expiryDate) return colors.textMuted;
  const monthsLeft = dayjs(expiryDate).diff(dayjs(), 'month');
  if (monthsLeft < 0) return colors.danger;
  if (monthsLeft < 6) return colors.warning;
  return colors.textMuted;
}

export function TravelDocumentCard({ document, onEdit, onDelete, isDeleting }: TravelDocumentCardProps) {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation("common");
  const [revealed, setRevealed] = useState(false);

  const DOCUMENT_LABELS: Record<string, string> = {
    passport: t('docType.passport'),
    id_card: t('docType.idCard'),
  };

  // Auto-hide the document number after 30 seconds to limit exposure on an unattended screen.
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), 30_000);
    return () => clearTimeout(timer);
  }, [revealed]);

  function handleDelete() {
    Alert.alert(
      t('doc.delete.title'),
      t('doc.delete.confirm', { type: DOCUMENT_LABELS[document.document_type] }),
      [
        { text: tCommon('button.cancel'), style: 'cancel' },
        { text: tCommon('button.delete'), style: 'destructive', onPress: onDelete },
      ]
    );
  }

  const docNumber = revealed ? document.document_number : maskNumber(document.document_number);
  const expColor = expiryColor(document.expiry_date);

  return (
    <View className="bg-surface border border-border rounded-md p-md gap-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-sm">
          <Ionicons
            name={DOCUMENT_ICONS[document.document_type] ?? 'document-outline'}
            size={20}
            color={colors.primary}
          />
          <Text className="text-body text-text-primary font-semibold">
            {DOCUMENT_LABELS[document.document_type]}
          </Text>
        </View>
        <View className="flex-row gap-sm">
          <Pressable onPress={onEdit} hitSlop={8}>
            <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={handleDelete} disabled={isDeleting} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <View className="gap-xs">
        <View className="flex-row justify-between">
          <Text className="text-body-small text-text-secondary">{t('docField.legalName')}</Text>
          <Text className="text-body-small text-text-primary">{document.full_legal_name}</Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-body-small text-text-secondary">{t('docField.documentNo')}</Text>
          <View className="flex-row items-center gap-xs">
            <Text className="text-body-small text-text-primary font-mono">{docNumber}</Text>
            <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={8}>
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {document.date_of_birth && (
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('docField.dateOfBirth')}</Text>
            <Text className="text-body-small text-text-primary">{document.date_of_birth}</Text>
          </View>
        )}

        {(document.nationality || document.issuing_country) && (
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('docField.nationality')}</Text>
            <Text className="text-body-small text-text-primary">
              {[document.nationality, document.issuing_country].filter(Boolean).join(' / ')}
            </Text>
          </View>
        )}

        {document.expiry_date && (
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('docField.expires')}</Text>
            <Text className="text-body-small font-medium" style={{ color: expColor }}>
              {document.expiry_date}
            </Text>
          </View>
        )}

        {document.notes && (
          <Text className="text-body-small text-text-muted mt-xs">{document.notes}</Text>
        )}
      </View>
    </View>
  );
}
