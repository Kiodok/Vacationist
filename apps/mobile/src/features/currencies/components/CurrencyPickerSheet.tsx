import { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView, TextInput, Platform, KeyboardAvoidingView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { useCurrencies } from '../hooks/useCurrencies';

const PINNED = ['EUR', 'USD', 'GBP', 'CHF'];

interface CurrencyPickerSheetProps {
  visible: boolean;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  onClose: () => void;
  /** Only show currencies the FX feed can currently convert (e.g. for "Show in X"). Defaults to false — all active currencies are selectable for entry/base-currency purposes. */
  onlyRateAvailable?: boolean;
}

export function CurrencyPickerSheet({ visible, selectedCode, onSelect, onClose, onlyRateAvailable = false }: CurrencyPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation('common');
  const { data: currencies, isLoading } = useCurrencies();
  const [query, setQuery] = useState('');

  const eligible = (currencies ?? []).filter((c) => !onlyRateAvailable || c.is_rate_available);

  const filtered = query.trim()
    ? eligible.filter(
        (c) =>
          c.code.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : eligible;

  const pinned = filtered.filter((c) => PINNED.includes(c.code)).sort((a, b) => PINNED.indexOf(a.code) - PINNED.indexOf(b.code));
  const rest = filtered.filter((c) => !PINNED.includes(c.code));
  const ordered = [...pinned, ...rest];

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = (code: string) => {
    onSelect(code);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
        <View
          className="bg-surface-elevated rounded-t-lg px-md pt-md"
          style={{
            paddingBottom: Math.max(insets.bottom, 32),
            ...(isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : {}),
          }}
        >
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-heading-m text-text-primary">{t('field.currencyLabel')}</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          {!isLoading && eligible.length > 0 && (
            <View className="flex-row items-center bg-surface border border-border rounded-sm px-md mb-md gap-sm">
              <ThemedIcon name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                className="flex-1 py-sm text-text-primary text-body"
                placeholderTextColor={colors.textMuted}
                placeholder={t('field.currencySearch')}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          )}

          {isLoading ? (
            <View className="py-xl items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : ordered.length === 0 ? (
            <View className="py-xl items-center gap-sm">
              <ThemedIcon name="cash-outline" size={32} color={colors.textMuted} />
              <Text className="text-text-secondary text-body">{t('field.currencyNoResults')}</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <View className="gap-sm">
                {ordered.map((c) => {
                  const isSelected = c.code === selectedCode;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => handleSelect(c.code)}
                      className="rounded-md border px-md py-sm flex-row items-center justify-between"
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: isSelected ? (isColorful ? `${colors.primary}1A` : `${colors.primary}1A`) : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected && isColorful ? 2 : 1,
                      })}
                    >
                      <View className="flex-1 flex-row items-center gap-sm">
                        <Text className={`text-body font-semibold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>{c.code}</Text>
                        <Text className="text-body-small text-text-secondary flex-1" numberOfLines={1}>{c.name}</Text>
                        {!c.is_rate_available && (
                          <Text className="text-label text-text-muted">{t('field.currencyNoConversion')}</Text>
                        )}
                      </View>
                      {isSelected && <ThemedIcon name="checkmark" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {!isLoading && ordered.length > 0 && (
            <Pressable onPress={() => Linking.openURL('https://www.exchangerate-api.com')} className="mt-sm">
              <Text className="text-label text-text-muted text-center underline">{t('field.ratesAttribution')}</Text>
            </Pressable>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
