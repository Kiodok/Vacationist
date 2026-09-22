import { TouchableOpacity, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon } from '@vacationist/ui';
import type { IoniconsName } from '@vacationist/ui';

export interface TripMenuItem {
  key: string;
  label: string;
  icon: IoniconsName;
  /** The tab holds content — same signal as the outlined border on its pill. */
  hasData: boolean;
}

interface TripMenuTabProps {
  items: TripMenuItem[];
  onSelect: (key: string) => void;
}

/**
 * Body of the native-only "Menu" pill: every other section as a full-width button, one under the
 * other, so a phone user sees all twelve at once instead of swiping the pill bar. Web never shows
 * this tab — its pill bar already fits.
 */
export function TripMenuTab({ items, onSelect }: TripMenuTabProps) {
  const { t } = useTranslation('trips');

  return (
    // No ScrollView: the twelve rows SHARE the screen height (flex: 1 each), so they are as tall as this device allows
    // and the list never scrolls — a taller phone gets taller buttons, a shorter one slightly shorter.
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 }}>
      {items.map((item) => (
        // TouchableOpacity + a STATIC style object on purpose: a Pressable with a function-style `style` mixed
        // with a NativeWind className did not apply `minHeight` reliably on Android (same class of bug as the
        // `pressable-flex-android` skill), which is why the rows kept coming out short however high it was set. `flex: 1` is safe here (static style).
        <TouchableOpacity
          key={item.key}
          onPress={() => onSelect(item.key)}
          activeOpacity={0.7}
          className="bg-surface border border-border rounded-md"
          style={{
            flex: 1,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <ThemedIcon name={item.icon} size={24} color={colors.textSecondary} />
          <Text className="flex-1 text-body text-text-primary" numberOfLines={1}>
            {item.label}
          </Text>
          {item.hasData && (
            <View
              className="w-[8px] h-[8px] rounded-full"
              style={{ backgroundColor: colors.textPrimary }}
              accessibilityLabel={t('menu.hasContent')}
            />
          )}
          <ThemedIcon name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
