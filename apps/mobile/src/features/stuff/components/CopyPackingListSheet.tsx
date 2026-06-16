import { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import { colors , ThemedIcon } from '@vacationist/ui';
import { useTrips } from '../../trips/hooks/useTrips';
import { useCopyPackingList } from '../hooks/usePackingItems';
import { isMutationBusy } from '../../../utils/mutationStatus';

interface CopyPackingListSheetProps {
  visible: boolean;
  currentTripId: string;
  onClose: () => void;
}

export function CopyPackingListSheet({ visible, currentTripId, onClose }: CopyPackingListSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const { data: trips, isLoading } = useTrips();
  const copyList = useCopyPackingList();
  const [query, setQuery] = useState('');

  const today = dayjs().format('YYYY-MM-DD');

  const eligibleTrips = (trips ?? []).filter((trip) =>
    trip.id !== currentTripId &&
    (trip.status === 'planning' || trip.status === 'active') &&
    trip.end_date >= today,
  );

  const filteredTrips = query.trim()
    ? eligibleTrips.filter((trip) =>
        trip.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : eligibleTrips;

  const handleCopy = (targetTripId: string) => {
    copyList.mutate(
      { sourceTripId: currentTripId, targetTripId },
      { onSuccess: () => { setQuery(''); onClose(); } },
    );
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-sm">
            <Text className="text-heading-m text-text-primary">{t('copyToTrip.title')}</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          {/* Search bar */}
          {!isLoading && eligibleTrips.length > 0 && (
            <View className="flex-row items-center bg-surface border border-border rounded-sm px-md mb-md gap-sm">
              <ThemedIcon name="search-outline" size={16} color="#5C5C5C" />
              <TextInput
                className="flex-1 py-sm text-text-primary text-body"
                placeholderTextColor="#5C5C5C"
                placeholder={t('copyToTrip.search')}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
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
          ) : filteredTrips.length === 0 ? (
            <View className="py-xl items-center gap-sm">
              <ThemedIcon name="map-outline" size={32} color="#5C5C5C" />
              <Text className="text-text-secondary text-body">
                {query.trim() ? t('copyToTrip.noResults', { query }) : t('copyToTrip.noTrips')}
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <View className="gap-sm">
                {filteredTrips.map((trip) => (
                  <Pressable
                    key={trip.id}
                    onPress={() => handleCopy(trip.id)}
                    disabled={isMutationBusy(copyList)}
                    className="bg-surface rounded-md border border-border px-md py-sm flex-row items-center justify-between"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className="flex-1">
                      <Text className="text-body text-text-primary" numberOfLines={1}>{trip.title}</Text>
                      <Text className="text-body-small text-text-secondary">
                        {dayjs(trip.start_date).format('D MMM')} – {dayjs(trip.end_date).format('D MMM YYYY')}
                      </Text>
                    </View>
                    <ThemedIcon name="chevron-forward" size={16} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
