import { useEffect, useRef } from 'react';
import { Text, Pressable } from 'react-native';
import { ScrollView } from '@vacationist/ui';
import { colors, ThemedIcon, useResolvedTheme, type IoniconsName } from '@vacationist/ui';

export interface SegmentedControlSegment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: SegmentedControlSegment[];
  activeKey: string;
  onChange: (key: string) => void;
  /** Optional trailing icon button (e.g. Prework's "add topic"). */
  trailingAction?: { icon: IoniconsName; onPress: () => void };
}

/**
 * Shared horizontal pill/segment bar. Always horizontally scrollable (so an overflowing set of
 * segments — e.g. Transfer's five, "Öffentliche Verkehrsmittel" included — is always reachable)
 * and auto-scrolls the active pill into view when it changes, mirroring the outer trip tab bar
 * in app/trip/[id]/index.tsx. `flexGrow: 0` keeps the pills hugging their intrinsic height
 * inside flex:1 parents (see the horizontal-scrollview-height skill).
 */
export function SegmentedControl({ segments, activeKey, onChange, trailingAction }: SegmentedControlProps) {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});

  const scrollActiveIntoView = (animated: boolean) => {
    const x = positions.current[activeKey];
    if (x == null) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated });
  };

  // On activeKey change (tap / deep-link). Also fired from each pill's onLayout below, so a
  // segment that starts active but off-screen (e.g. deep-linked into the 5th Transfer segment)
  // scrolls into view once its position is known — the effect alone runs before any onLayout.
  useEffect(() => {
    scrollActiveIntoView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerClassName="flex-row gap-xs px-md pt-sm pb-xs"
    >
      {segments.map((segment) => {
        const isActive = segment.key === activeKey;
        return (
          <Pressable
            key={segment.key}
            onPress={() => onChange(segment.key)}
            onLayout={(e) => {
              positions.current[segment.key] = e.nativeEvent.layout.x;
              if (segment.key === activeKey) scrollActiveIntoView(false);
            }}
            className={`px-md py-sm rounded-full ${isActive ? 'bg-primary' : 'bg-surface border border-border'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              className={`text-body-small font-semibold ${isActive ? 'text-white' : 'text-text-secondary'}`}
              style={isActive && isColorful ? { color: colors.surface } : undefined}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}

      {trailingAction && (
        <Pressable
          onPress={trailingAction.onPress}
          className="px-sm py-sm rounded-full bg-surface border border-border items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <ThemedIcon name={trailingAction.icon} size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </ScrollView>
  );
}
