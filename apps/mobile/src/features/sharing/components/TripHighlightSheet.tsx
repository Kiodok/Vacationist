import { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type ViewShotType from 'react-native-view-shot';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { useToastStore } from '../../../stores/toastStore';
import { useTripHighlightData } from '../hooks/useTripHighlightData';
import { HighlightCard } from './HighlightCard';
import type { HighlightFormat } from './HighlightCard';

// Lazy-load to prevent a fatal crash on binaries that predate this native module.
// TurboModuleRegistry.getEnforcing("RNViewShot") throws synchronously at require-time
// when the module is missing, so a static import would kill the app on old builds.
// eslint-disable-next-line @typescript-eslint/no-require-imports
let ViewShot: typeof ViewShotType | null = null;
try { ViewShot = require('react-native-view-shot').default; } catch { /* binary lacks RNViewShot */ }

interface TripHighlightSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
}

export function TripHighlightSheet({ visible, onClose, tripId }: TripHighlightSheetProps) {
  const { t } = useTranslation('sharing');
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const theme = useResolvedTheme();
  const addToast = useToastStore((s) => s.addToast);
  const { data } = useTripHighlightData(tripId);
  const viewShotRef = useRef<ViewShotType>(null);
  const [format, setFormat] = useState<HighlightFormat>('square');
  const [isCapturing, setIsCapturing] = useState(false);

  const cardWidth = Math.min(screenWidth - 48, 360);
  const buttonTextColor = theme === 'colorful' ? colors.surface : '#FFFFFF';

  // Pre-resolve toast strings so they can be used inside async callbacks
  const toastShared = t('toast.highlightShared');
  const toastDownloaded = t('toast.highlightDownloaded');
  const toastFailed = t('toast.highlightFailed');
  const dialogTitle = t('highlights.title');

  async function handleShare() {
    if (!ViewShot || !viewShotRef.current?.capture || isCapturing) return;
    setIsCapturing(true);
    try {
      const uri = await viewShotRef.current.capture();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trip-highlights.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('success', toastDownloaded);
      } else {
        const Sharing = await import('expo-sharing');
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          addToast('error', toastFailed);
          return;
        }
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
        addToast('success', toastShared);
      }
    } catch {
      addToast('error', toastFailed);
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View
          className="bg-surface-elevated rounded-t-lg px-md pt-md"
          style={{ paddingBottom: Math.max(insets.bottom, 32), maxHeight: '92%' }}
        >
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <Text className="text-heading-m text-text-primary mb-xs">{t('highlights.title')}</Text>
          <Text className="text-body-small text-text-secondary mb-md">{t('highlights.subtitle')}</Text>

          {/* Format toggle */}
          <View className="flex-row gap-sm mb-lg">
            {(['square', 'story'] as HighlightFormat[]).map((fmt) => (
              <Pressable
                key={fmt}
                onPress={() => setFormat(fmt)}
                className={`px-md py-sm rounded-full ${format === fmt ? 'bg-primary' : 'bg-surface'}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text
                  className={`text-body-small font-semibold ${format !== fmt ? 'text-text-secondary' : ''}`}
                  style={format === fmt ? { color: buttonTextColor } : undefined}
                >
                  {fmt === 'square' ? t('highlights.squareFormat') : t('highlights.storyFormat')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Card preview */}
          <ScrollView showsVerticalScrollIndicator={false} className="mb-lg">
            {data ? (
              <View style={{ alignItems: 'center' }}>
                {ViewShot ? (
                  <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
                    <HighlightCard data={data} format={format} width={cardWidth} />
                  </ViewShot>
                ) : (
                  <HighlightCard data={data} format={format} width={cardWidth} />
                )}
              </View>
            ) : (
              <View className="items-center py-xl">
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </ScrollView>

          {/* Share button */}
          <Pressable
            onPress={handleShare}
            disabled={!data || isCapturing || !ViewShot}
            className="py-md rounded-md bg-primary items-center"
            style={({ pressed }) => ({ opacity: pressed || !data || isCapturing || !ViewShot ? 0.6 : 1 })}
          >
            {isCapturing ? (
              <View className="flex-row items-center gap-sm">
                <ActivityIndicator size="small" color={buttonTextColor} />
                <Text className="font-semibold text-body" style={{ color: buttonTextColor }}>{t('highlights.capturing')}</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-sm">
                <ThemedIcon name="share-social-outline" size={18} color={buttonTextColor} />
                <Text className="font-semibold text-body" style={{ color: buttonTextColor }}>{t('highlights.shareButton')}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
