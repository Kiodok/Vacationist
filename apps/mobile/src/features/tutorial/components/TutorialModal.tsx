import { useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Dimensions, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ThemedIcon, colors, useResolvedTheme } from '@vacationist/ui';

const SLIDES = [
  { titleKey: 'slide1.title', descKey: 'slide1.description', icon: 'earth-outline' },
  { titleKey: 'slide2.title', descKey: 'slide2.description', icon: 'thumbs-up-outline' },
  { titleKey: 'slide3.title', descKey: 'slide3.description', icon: 'calendar-outline' },
  { titleKey: 'slide4.title', descKey: 'slide4.description', icon: 'wallet-outline' },
  { titleKey: 'slide5.title', descKey: 'slide5.description', icon: 'bag-check-outline' },
] as const;

interface TutorialModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function TutorialModal({ visible, onDismiss }: TutorialModalProps) {
  const { t } = useTranslation('tutorial');
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideHeight, setSlideHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { width } = Dimensions.get('window');
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === SLIDES.length - 1;

  function goNext() {
    if (isLast) {
      onDismiss();
      return;
    }
    const next = activeIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  }

  function goBack() {
    if (isFirst) return;
    const prev = activeIndex - 1;
    flatListRef.current?.scrollToIndex({ index: prev, animated: true });
    setActiveIndex(prev);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {/* Back / Skip */}
        <View className="flex-row items-center justify-between px-lg pt-md">
          {!isFirst ? (
            <Pressable onPress={goBack} hitSlop={8} className="flex-row items-center gap-xs">
              <ThemedIcon name="chevron-back-outline" size={18} color={colors.textSecondary} />
              <Text className="text-body text-text-secondary">{t('back')}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text className="text-body text-text-secondary">{t('skip')}</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={{ flex: 1 }}
          onLayout={(e) => setSlideHeight(e.nativeEvent.layout.height)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => (
            <View
              style={{ width, height: slideHeight || undefined }}
              className="items-center justify-center px-xl gap-xl"
            >
              <View
                className="w-[88px] h-[88px] rounded-full bg-primary-muted items-center justify-center"
                style={
                  isColorful && Platform.OS === 'web'
                    ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } as object
                    : undefined
                }
              >
                <ThemedIcon name={item.icon as any} size={44} color={colors.primary} />
              </View>

              <Text className="text-heading-l text-text-primary text-center">
                {t(item.titleKey as any)}
              </Text>

              <Text className="text-body text-text-secondary text-center leading-relaxed">
                {t(item.descKey as any)}
              </Text>
            </View>
          )}
        />

        {/* Dot indicators */}
        <View className="flex-row items-center justify-center gap-sm pb-lg">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width: i === activeIndex ? 20 : 8,
                height: 8,
                backgroundColor: i === activeIndex ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <View className="px-lg pb-md">
          <Pressable
            onPress={goNext}
            className="bg-primary rounded-lg items-center justify-center py-md"
          >
            <Text
              className="text-body font-semibold"
              style={{ color: isColorful ? colors.surface : '#ffffff' }}
            >
              {isLast ? t('getStarted') : t('next')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
