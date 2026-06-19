import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';
import type { AggregatedFilter } from '../utils/aggregateFilters';

interface MemberNameMap {
  [userId: string]: string;
}

interface GroupSummarySectionProps {
  aggregated: AggregatedFilter[];
  totalMembers: number;
  memberNames: MemberNameMap;
}

export function GroupSummarySection({ aggregated, totalMembers, memberNames }: GroupSummarySectionProps) {
  const { t } = useTranslation('prework');
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  if (aggregated.length === 0) {
    return (
      <View className="gap-md">
        <Text className="text-heading-m text-text-primary">{t('group.title')}</Text>
        <Text className="text-body-small text-text-secondary">{t('group.empty')}</Text>
      </View>
    );
  }

  const maxCredits = Math.max(...aggregated.map((f) => f.totalCredits), 1);

  return (
    <View className="gap-md">
      <View className="flex-row items-center justify-between">
        <Text className="text-heading-m text-text-primary">{t('group.title')}</Text>
        <Text className="text-body-small text-text-secondary">
          {t('group.memberCount', { count: totalMembers })}
        </Text>
      </View>

      <View className="gap-sm">
        {aggregated.map((filter) => {
          const isExpanded = expandedLabel === filter.label;
          const barWidth = Math.max((filter.totalCredits / maxCredits) * 100, 4);

          return (
            <Pressable
              key={filter.label}
              onPress={() => setExpandedLabel(isExpanded ? null : filter.label)}
              className="bg-surface rounded-md border border-border overflow-hidden"
            >
              <View className="px-md py-sm gap-xs">
                <View className="flex-row items-start justify-between gap-sm">
                  <Text className="text-body text-text-primary flex-1">
                    {filter.label}
                  </Text>
                  <View className="flex-row items-center gap-xs flex-shrink-0">
                    <Text className="text-label text-text-muted">
                      {filter.memberCount}/{totalMembers}
                    </Text>
                    <Text className="text-body font-semibold text-primary">
                      {filter.totalCredits}
                    </Text>
                    <ThemedIcon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textMuted}
                    />
                  </View>
                </View>

                {/* Credit bar */}
                <View className="h-[4px] bg-surface-elevated rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </View>
              </View>

              {/* Expanded breakdown */}
              {isExpanded && (
                <View className="border-t border-border px-md py-sm gap-xs">
                  {filter.breakdown.map((entry) => (
                    <View key={entry.userId} className="flex-row items-center justify-between">
                      <Text className="text-body-small text-text-secondary" numberOfLines={1}>
                        {memberNames[entry.userId] ?? 'Unknown'}
                      </Text>
                      <Text className="text-body-small text-text-primary font-medium">
                        {entry.weight}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
