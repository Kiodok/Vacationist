import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PreworkFilter } from '@vacationist/types';
import { upsertPreworkPreferencesSchema } from '@vacationist/types';
import { PreworkFilterRow } from './PreworkFilterRow';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';

interface MyPreferencesSectionProps {
  initialFilters: PreworkFilter[];
  recommendedLabels: string[];
  onSave: (filters: PreworkFilter[]) => void;
  onClear: () => void;
  isSaving: boolean;
  isClearing: boolean;
}

export function MyPreferencesSection({
  initialFilters,
  recommendedLabels,
  onSave,
  onClear,
  isSaving,
  isClearing,
}: MyPreferencesSectionProps) {
  const { t } = useTranslation('prework');
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [filters, setFilters] = useState<PreworkFilter[]>(initialFilters);
  const [newLabel, setNewLabel] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
    setIsDirty(false);
  }, [initialFilters]);

  const creditSum = filters.reduce((sum, f) => sum + f.weight, 0);
  const hasZeroCredit = filters.some((f) => f.weight < 1);
  const hasEmptyLabel = filters.some((f) => !f.label.trim());
  const exceedsMax = creditSum > 100;
  const hasFilterErrors = filters.length > 0 && (exceedsMax || hasZeroCredit || hasEmptyLabel);
  const hasContent = filters.length > 0;
  const canSave = isDirty && hasContent && !hasFilterErrors;

  const addFilter = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || trimmed.length > 100) return;

    const exists = filters.some(
      (f) => f.label.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;

    setFilters((prev) => [...prev, { label: trimmed, weight: 0 }]);
    setIsDirty(true);
  };

  const handleAddFilter = () => {
    addFilter(newLabel);
    setNewLabel('');
  };

  const handleChangeLabel = (index: number, label: string) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, label } : f)));
    setIsDirty(true);
  };

  const handleChangeWeight = (index: number, weight: number) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, weight } : f)));
    setIsDirty(true);
  };

  const handleRemove = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleSave = () => {
    const result = upsertPreworkPreferencesSchema.safeParse({ filters });
    if (!result.success) return;
    onSave(filters);
  };

  const handleClear = () => {
    onClear();
    setFilters([]);
    setIsDirty(false);
  };

  const visibleRecommendations = recommendedLabels.filter(
    (label) => !filters.some((f) => f.label.trim().toLowerCase() === label.trim().toLowerCase())
  );

  return (
    <View className="gap-md">
      <Text className="text-heading-m text-text-primary">{t('my.title')}</Text>

      {filters.length === 0 ? (
        <Text className="text-body-small text-text-secondary">
          {t('my.emptyHint')}
        </Text>
      ) : (
        <View className="gap-sm">
          {filters.map((filter, index) => (
            <PreworkFilterRow
              key={index}
              label={filter.label}
              weight={filter.weight}
              onChangeLabel={(l) => handleChangeLabel(index, l)}
              onChangeWeight={(w) => handleChangeWeight(index, w)}
              onRemove={() => handleRemove(index)}
              hasError={filter.weight < 1}
            />
          ))}

          {/* Credit sum indicator */}
          <View className="flex-row items-center justify-between px-xs">
            <Text className="text-body-small text-text-secondary">{t('my.creditsUsed')}</Text>
            <Text
              className={`text-body font-semibold ${
                exceedsMax
                  ? 'text-danger'
                  : hasZeroCredit
                    ? 'text-warning'
                    : 'text-success'
              }`}
            >
              {creditSum} / 100
            </Text>
          </View>
          {exceedsMax && (
            <Text className="text-label text-danger px-xs">
              {t('my.exceedsMax')}
            </Text>
          )}
          {hasZeroCredit && !exceedsMax && (
            <Text className="text-label text-warning px-xs">
              {t('my.zeroCredit')}
            </Text>
          )}
        </View>
      )}

      {/* Recommended filters from other members */}
      {visibleRecommendations.length > 0 && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{t('my.fromOthers')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-xs">
            {visibleRecommendations.map((label) => (
              <Pressable
                key={label}
                onPress={() => addFilter(label)}
                className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10 border border-primary/20"
              >
                <ThemedIcon name="add-circle-outline" size={14} color={colors.primary} />
                <Text className="text-body-small text-primary">{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Add filter input */}
      <View className="flex-row items-center gap-sm">
        <TextInput
          value={newLabel}
          onChangeText={setNewLabel}
          placeholder={t('my.placeholder')}
          placeholderTextColor="#5C5C5C"
          maxLength={100}
          onSubmitEditing={handleAddFilter}
          returnKeyType="done"
          className="flex-1 text-body text-text-primary bg-surface rounded-md px-md py-sm border border-border"
        />
        <Pressable
          onPress={handleAddFilter}
          disabled={!newLabel.trim()}
          className={`px-md py-sm rounded-md ${
            newLabel.trim() ? 'bg-primary' : 'bg-surface border border-border'
          }`}
        >
          <ThemedIcon
            name="add"
            size={20}
            color={newLabel.trim() ? (isColorful ? colors.surface : '#FFFFFF') : '#5C5C5C'}
          />
        </Pressable>
      </View>

      {/* Action buttons */}
      <View className="flex-row gap-sm">
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSaving}
          className={`flex-1 flex-row items-center justify-center gap-xs py-sm rounded-md ${
            canSave ? 'bg-primary' : 'bg-surface border border-border'
          }`}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={isColorful ? colors.surface : '#FFFFFF'} />
          ) : (
            <>
              <ThemedIcon
                name="checkmark-circle-outline"
                size={18}
                color={canSave ? (isColorful ? colors.surface : '#FFFFFF') : '#5C5C5C'}
              />
              <Text
                className={`text-body font-semibold ${canSave ? '' : 'text-text-muted'}`}
                style={canSave ? { color: isColorful ? colors.surface : '#FFFFFF' } : undefined}
              >
                {tCommon('button.save')}
              </Text>
            </>
          )}
        </Pressable>

        {initialFilters.length > 0 && (
          <Pressable
            onPress={handleClear}
            disabled={isClearing}
            className="px-md py-sm rounded-md bg-danger/10"
          >
            {isClearing ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text className="text-danger text-body font-medium">{tCommon('button.remove')}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
