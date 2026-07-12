import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HighlightFormat } from '@vacationist/types';
import { dayjs } from '@vacationist/utils';
import { useThemeColors } from '@vacationist/ui';
import type { CardSection, HighlightRenderData } from '../utils/highlightSelection';

export type { HighlightFormat };

interface HighlightCardProps {
  data: HighlightRenderData;
  format: HighlightFormat;
  width: number;
}

export function HighlightCard({ data, format, width }: HighlightCardProps) {
  const { t } = useTranslation('sharing');
  const colors = useThemeColors();
  const height = format === 'square' ? width : Math.round(width * (16 / 9));

  const startFormatted = dayjs(data.startDate).format('D MMM');
  const endFormatted = dayjs(data.endDate).format('D MMM YYYY');

  const sectionLabels: Record<CardSection, string> = {
    activities: t('highlights.topActivities'),
    transfers: t('highlights.section.transfers'),
    recipes: t('highlights.section.recipes'),
  };

  const s = useMemo(() => StyleSheet.create({
    card: {
      width,
      height,
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 24,
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    accentBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: colors.primary,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    header: {
      marginTop: 8,
    },
    title: {
      fontSize: format === 'square' ? 26 : 30,
      fontWeight: '800',
      color: colors.textPrimary,
      lineHeight: format === 'square' ? 32 : 38,
      marginBottom: 6,
    },
    dates: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: format === 'square' ? 6 : 8,
    },
    accommodationText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    sectionSpacing: {
      marginTop: format === 'square' ? 8 : 16,
    },
    itemsContainer: {
      gap: format === 'square' ? 3 : 4,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    itemDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    itemText: {
      fontSize: 13,
      lineHeight: format === 'square' ? 17 : 18,
      color: colors.textPrimary,
      fontWeight: '500',
      flexShrink: 1,
    },
    footer: {
      gap: 8,
    },
    membersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
    },
    memberBadge: {
      backgroundColor: colors.primaryMuted,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    memberName: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    stats: {
      flexDirection: 'row',
      gap: 12,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    statNumber: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    branding: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    brandingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    brandingText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
  }), [colors, format, width, height]);

  return (
    <View style={s.card}>
      <View style={s.accentBar} />

      <View style={s.header}>
        <Text style={s.title} numberOfLines={2}>
          {data.tripTitle}
        </Text>
        <Text style={s.dates}>
          {startFormatted} – {endFormatted}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {data.accommodationName && (
          <View>
            <Text style={s.sectionLabel}>{t('highlights.accommodation')}</Text>
            <Text style={s.accommodationText} numberOfLines={1}>
              {data.accommodationName}
            </Text>
          </View>
        )}

        {data.sections.map((section, sectionIndex) => (
          <View
            key={section.key}
            style={sectionIndex > 0 || data.accommodationName ? s.sectionSpacing : undefined}
          >
            <Text style={s.sectionLabel}>{sectionLabels[section.key]}</Text>
            <View style={s.itemsContainer}>
              {section.items.map((label, i) => (
                <View key={i} style={s.itemRow}>
                  <View style={s.itemDot} />
                  <Text style={s.itemText} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={s.footer}>
        {data.stats && (
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statNumber}>{data.stats.durationDays}</Text>
              <Text style={s.statLabel}>{t('highlights.days')}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statNumber}>{data.stats.memberCount}</Text>
              <Text style={s.statLabel}>{t('highlights.members')}</Text>
            </View>
            {data.stats.shoppingItemCount !== null && (
              <View style={s.stat}>
                <Text style={s.statNumber}>{data.stats.shoppingItemCount}</Text>
                <Text style={s.statLabel}>{t('highlights.shoppingItems')}</Text>
              </View>
            )}
          </View>
        )}

        {data.memberFirstNames && (
          <View style={s.membersRow}>
            {data.memberFirstNames.map((name, i) => (
              <View key={i} style={s.memberBadge}>
                <Text style={s.memberName}>{name}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.branding}>
          <View style={s.brandingDot} />
          <Text style={s.brandingText}>{t('highlights.poweredBy')}</Text>
        </View>
      </View>
    </View>
  );
}
