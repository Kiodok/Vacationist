import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Sharing from 'expo-sharing';
import type { HighlightFormat } from '@vacationist/types';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { useToastStore } from '../../../stores/toastStore';
import { useHighlightCandidates } from '../hooks/useTripHighlightData';
import { useHighlightSelection } from '../hooks/useHighlightSelection';
import { buildRenderData } from '../utils/highlightSelection';
import { HighlightCard } from './HighlightCard';
import { HighlightContentPicker } from './HighlightContentPicker';

// Gate on the native module before requiring the JS module. Without this check,
// require('react-native-view-shot') calls TurboModuleRegistry.getEnforcing('RNViewShot')
// at import time and triggers Metro's reportFatalError when the native module is
// absent (e.g. an OTA update on a binary that predates the dependency), causing a
// red screen that cannot be caught. requireOptionalNativeModule returns null safely.
type CaptureRefFn = (ref: React.RefObject<View | null>, options?: { format?: string; quality?: number }) => Promise<string>;
const _viewShotNative = requireOptionalNativeModule('RNViewShot');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const captureRef: CaptureRefFn | null = _viewShotNative ? require('react-native-view-shot').captureRef as CaptureRefFn : null;

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

  const { candidates, isLoaded } = useHighlightCandidates(tripId);
  const {
    selection,
    format,
    setFormat,
    toggleItem,
    setAccommodation,
    toggleMembers,
    toggleStats,
    toggleShoppingStat,
    resetToDefaults,
    canAdd,
    wasTrimmed,
    slotsUsed,
    slotBudget,
  } = useHighlightSelection(tripId, candidates, isLoaded);

  const cardRef = useRef<View>(null);
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [isCapturing, setIsCapturing] = useState(false);

  // Start over at the selection step every time the sheet opens
  useEffect(() => {
    if (visible) setStep('select');
  }, [visible]);

  // Single render model feeding BOTH the off-screen capture surface and the
  // preview card — the shared image always matches the preview by construction.
  const renderData = useMemo(
    () => (candidates && selection ? buildRenderData(candidates, selection) : null),
    [candidates, selection],
  );

  const cardWidth = Math.min(screenWidth - 48, 360);
  const buttonTextColor = theme === 'colorful' ? colors.surface : '#FFFFFF';

  // Pre-resolve toast strings so they can be used inside async callbacks
  const toastShared = t('toast.highlightShared');
  const toastDownloaded = t('toast.highlightDownloaded');
  const toastFailed = t('toast.highlightFailed');
  const dialogTitle = t('highlights.title');

  async function handleShare() {
    if (!captureRef || !cardRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1.0 });

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
        onClose();
        addToast('success', toastDownloaded);
      } else {
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          onClose();
          addToast('error', toastFailed);
          return;
        }
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
        onClose();
        addToast('success', toastShared);
      }
    } catch (e) {
      console.error('[TripHighlightSheet] capture/share failed:', e);
      onClose();
      addToast('error', toastFailed);
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <>
      {/* Off-screen capture surface — must be outside the Modal so react-native-view-shot
          can reach it via the main activity window. Android Modal renders in a separate
          native window; captureRef cannot find views inside it. */}
      {renderData && (
        <View
          ref={cardRef}
          collapsable={false}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: -(cardWidth + 100) }}
        >
          <HighlightCard data={renderData} format={format} width={cardWidth} />
        </View>
      )}

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

            <View className="flex-row items-center gap-sm mb-xs">
              {step === 'preview' && (
                <Pressable
                  onPress={() => setStep('select')}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <ThemedIcon name="chevron-back" size={22} color={colors.primary} />
                </Pressable>
              )}
              <Text className="text-heading-m text-text-primary">{t('highlights.title')}</Text>
            </View>
            <Text className="text-body-small text-text-secondary mb-md">
              {step === 'select' ? t('highlights.selectContent') : t('highlights.subtitle')}
            </Text>

            {step === 'select' ? (
              <>
                {/* Format toggle */}
                <View className="flex-row gap-sm mb-sm">
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
                {wasTrimmed && (
                  <Text className="text-body-small text-warning mb-sm">{t('highlights.autoTrimmed')}</Text>
                )}

                {/* Budget indicator — pinned above the scrollable picker */}
                {selection && (
                  <View className="mb-sm">
                    <View className="flex-row items-center justify-between mb-xs">
                      <Text className="text-body-small text-text-secondary">
                        {t('highlights.slotsUsed', { used: slotsUsed, total: slotBudget })}
                      </Text>
                      <Pressable onPress={resetToDefaults} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                        <Text className="text-body-small text-primary font-semibold">
                          {t('highlights.resetDefaults')}
                        </Text>
                      </Pressable>
                    </View>
                    <View className="h-[6px] rounded-full bg-surface border border-border overflow-hidden">
                      <View
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.round((slotsUsed / slotBudget) * 100))}%` }}
                      />
                    </View>
                    {slotsUsed >= slotBudget && (
                      <Text className="text-body-small text-text-muted mt-xs">{t('highlights.spaceFull')}</Text>
                    )}
                  </View>
                )}

                <ScrollView showsVerticalScrollIndicator={false} className="mb-lg">
                  {candidates && selection ? (
                    <HighlightContentPicker
                      candidates={candidates}
                      selection={selection}
                      canAdd={canAdd}
                      onToggleItem={toggleItem}
                      onSetAccommodation={setAccommodation}
                      onToggleMembers={toggleMembers}
                      onToggleStats={toggleStats}
                      onToggleShoppingStat={toggleShoppingStat}
                    />
                  ) : (
                    <View className="items-center py-xl">
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )}
                </ScrollView>

                {/* Continue to preview */}
                <Pressable
                  onPress={() => setStep('preview')}
                  disabled={!renderData}
                  className="py-md rounded-md bg-primary items-center"
                  style={({ pressed }) => ({ opacity: pressed || !renderData ? 0.6 : 1 })}
                >
                  <View className="flex-row items-center gap-sm">
                    <Text className="font-semibold text-body" style={{ color: buttonTextColor }}>{t('highlights.previewButton')}</Text>
                    <ThemedIcon name="chevron-forward" size={18} color={buttonTextColor} />
                  </View>
                </Pressable>
              </>
            ) : (
              <>
                {/* Card preview — display only, captured from the off-screen surface above */}
                <ScrollView showsVerticalScrollIndicator={false} className="mb-lg">
                  {renderData ? (
                    <View style={{ alignItems: 'center' }}>
                      <HighlightCard data={renderData} format={format} width={cardWidth} />
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
                  disabled={!renderData || isCapturing || !captureRef}
                  className="py-md rounded-md bg-primary items-center"
                  style={({ pressed }) => ({ opacity: pressed || !renderData || isCapturing || !captureRef ? 0.6 : 1 })}
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
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
