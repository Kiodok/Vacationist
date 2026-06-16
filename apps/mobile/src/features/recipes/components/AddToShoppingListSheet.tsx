import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { ShoppingListWithCounts } from '@vacationist/types';
import { colors , ThemedIcon } from '@vacationist/ui';

interface AddToShoppingListSheetProps {
  visible: boolean;
  onClose: () => void;
  shoppingLists: ShoppingListWithCounts[];
  defaultServings: number;
  onSubmit: (shoppingListId: string, targetServings: number) => void;
  isPending: boolean;
}

export function AddToShoppingListSheet({
  visible,
  onClose,
  shoppingLists,
  defaultServings,
  onSubmit,
  isPending,
}: AddToShoppingListSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('recipes');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [servings, setServings] = useState(defaultServings);

  const handleClose = () => {
    setSelectedListId(null);
    setServings(defaultServings);
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedListId || isPending) return;
    onSubmit(selectedListId, servings);
  };

  const activeLists = shoppingLists.filter((l) => !l.archived_at);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={handleClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[70%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">Add to Shopping List</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Cancel</Text>
            </Pressable>
          </View>

          <View className="gap-md">
            <View className="gap-xs">
              <Text className="text-label text-text-muted uppercase">{t('field.servings')}</Text>
              <View className="flex-row items-center gap-md">
                <Pressable
                  onPress={() => setServings((s) => Math.max(1, s - 1))}
                  className="w-[40px] h-[40px] rounded-sm bg-surface border border-border items-center justify-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-text-primary text-heading-m">-</Text>
                </Pressable>
                <Text className="text-text-primary text-body font-semibold min-w-[32px] text-center">
                  {servings}
                </Text>
                <Pressable
                  onPress={() => setServings((s) => s + 1)}
                  className="w-[40px] h-[40px] rounded-sm bg-surface border border-border items-center justify-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-text-primary text-heading-m">+</Text>
                </Pressable>
                {servings !== defaultServings && (
                  <Text className="text-body-small text-text-secondary">
                    {t('sheet.recipeDefault', { count: defaultServings })}
                  </Text>
                )}
              </View>
            </View>

            <View className="gap-xs">
              <Text className="text-label text-text-muted uppercase">Select a list</Text>
              {activeLists.length === 0 ? (
                <Text className="text-body-small text-text-secondary py-md text-center">
                  No shopping lists available. Create one first.
                </Text>
              ) : (
                <FlatList
                  data={activeLists}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 200 }}
                  renderItem={({ item }) => {
                    const selected = item.id === selectedListId;
                    return (
                      <Pressable
                        onPress={() => setSelectedListId(item.id)}
                        className={`flex-row items-center p-md rounded-md mb-xs border ${
                          selected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                        }`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                      >
                        <View className="flex-1">
                          <Text className="text-body text-text-primary" numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text className="text-body-small text-text-secondary">
                            {item.item_count} item{item.item_count !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {selected && (
                          <ThemedIcon name="checkmark-circle" size={22} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={!selectedListId || isPending}
              className={`items-center py-sm rounded-md ${
                !selectedListId || isPending ? 'bg-primary/30' : 'bg-primary'
              }`}
              style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-white text-body font-semibold">
                {isPending ? t('sheet.adding') : t('sheet.addIngredients')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
