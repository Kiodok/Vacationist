import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HighlightSelection } from '@vacationist/types';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type {
  CandidateItem,
  HighlightCandidates,
  PickableKind,
  SelectableKind,
} from '../utils/highlightSelection';

interface HighlightContentPickerProps {
  candidates: HighlightCandidates;
  selection: HighlightSelection;
  canAdd: (kind: SelectableKind) => boolean;
  onToggleItem: (kind: PickableKind, id: string) => void;
  onSetAccommodation: (id: string | null) => void;
  onToggleMembers: () => void;
  onToggleStats: () => void;
  onToggleShoppingStat: () => void;
}

interface CheckRowProps {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  checkColor: string;
}

function CheckRow({ label, selected, disabled, onPress, checkColor }: CheckRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center px-md py-sm rounded-md border ${
        selected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
      }`}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <View
        className={`w-[20px] h-[20px] rounded-sm border-2 items-center justify-center mr-md ${
          selected ? 'bg-primary border-primary' : 'border-border'
        }`}
      >
        {selected && <ThemedIcon name="checkmark" size={14} color={checkColor} />}
      </View>
      <Text className="text-body text-text-primary flex-1" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HighlightContentPicker({
  candidates,
  selection,
  canAdd,
  onToggleItem,
  onSetAccommodation,
  onToggleMembers,
  onToggleStats,
  onToggleShoppingStat,
}: HighlightContentPickerProps) {
  const { t } = useTranslation('sharing');
  const theme = useResolvedTheme();
  const checkColor = theme === 'colorful' ? colors.surface : '#FFFFFF';

  const pickableGroups: { kind: PickableKind; title: string; items: CandidateItem[]; ids: string[] }[] = [
    { kind: 'activity', title: t('highlights.picker.activities'), items: candidates.activities, ids: selection.activityIds },
    { kind: 'flight', title: t('highlights.picker.flights'), items: candidates.flights, ids: selection.flightIds },
    { kind: 'vehicle', title: t('highlights.picker.vehicles'), items: candidates.vehicles, ids: selection.vehicleIds },
    { kind: 'rental', title: t('highlights.picker.rentals'), items: candidates.rentals, ids: selection.rentalIds },
    { kind: 'recipe', title: t('highlights.picker.recipes'), items: candidates.recipes, ids: selection.recipeIds },
  ];

  return (
    <View>
      {/* Accommodation — single select, tap again to remove */}
      {candidates.accommodations.length > 0 && (
        <View className="mb-md">
          <Text className="text-body-small font-semibold text-text-secondary mb-xs">
            {t('highlights.picker.accommodation')}
          </Text>
          <View className="gap-xs">
            {candidates.accommodations.map((item) => {
              const selected = selection.accommodationId === item.id;
              return (
                <CheckRow
                  key={item.id}
                  label={item.label}
                  selected={selected}
                  disabled={!selected && selection.accommodationId === null && !canAdd('accommodation')}
                  onPress={() => onSetAccommodation(selected ? null : item.id)}
                  checkColor={checkColor}
                />
              );
            })}
          </View>
        </View>
      )}

      {pickableGroups.map(
        (group) =>
          group.items.length > 0 && (
            <View key={group.kind} className="mb-md">
              <Text className="text-body-small font-semibold text-text-secondary mb-xs">
                {group.title}
              </Text>
              <View className="gap-xs">
                {group.items.map((item) => {
                  const selected = group.ids.includes(item.id);
                  return (
                    <CheckRow
                      key={item.id}
                      label={item.label}
                      selected={selected}
                      disabled={!selected && !canAdd(group.kind)}
                      onPress={() => onToggleItem(group.kind, item.id)}
                      checkColor={checkColor}
                    />
                  );
                })}
              </View>
            </View>
          ),
      )}

      {/* Extras */}
      <View className="mt-sm mb-md">
        <Text className="text-body-small font-semibold text-text-secondary mb-xs">
          {t('highlights.picker.extras')}
        </Text>
        <View className="gap-xs">
          <CheckRow
            label={t('highlights.picker.membersRow')}
            selected={selection.showMembers}
            disabled={!selection.showMembers && !canAdd('members')}
            onPress={onToggleMembers}
            checkColor={checkColor}
          />
          <CheckRow
            label={t('highlights.picker.statsRow')}
            selected={selection.showStats}
            disabled={!selection.showStats && !canAdd('stats')}
            onPress={onToggleStats}
            checkColor={checkColor}
          />
          {selection.showStats && candidates.shoppingItemCount > 0 && (
            <CheckRow
              label={t('highlights.picker.shoppingStat')}
              selected={selection.showShoppingStat}
              disabled={false}
              onPress={onToggleShoppingStat}
              checkColor={checkColor}
            />
          )}
        </View>
      </View>
    </View>
  );
}
