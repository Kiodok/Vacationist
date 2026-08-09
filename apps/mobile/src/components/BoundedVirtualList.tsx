import { View, ScrollView } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';

const DEFAULT_VIRTUALIZE_THRESHOLD = 20;
const DEFAULT_MAX_VIRTUALIZED_HEIGHT = 420;

interface BoundedVirtualListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactElement;
  /** Approximate row height in px — only used to size the virtualized box once `data.length` exceeds `virtualizeThreshold`. */
  itemHeight: number;
  /**
   * Below this count, renders as a plain unbounded `.map()` — identical
   * look and natural-height scroll behavior to a hand-written list, since
   * the overwhelming majority of trips have well under this many members.
   * At or above it, switches to a fixed-height virtualized FlashList so a
   * trip with hundreds of members never mounts hundreds of rows at once.
   */
  virtualizeThreshold?: number;
  /** Cap on the virtualized box height once virtualization kicks in. */
  maxVirtualizedHeight?: number;
  /**
   * Set this when the list is the primary scrollable content of a bottom
   * sheet / modal (i.e. it previously had its own `ScrollView` wrapper) —
   * below the threshold it renders inside a `ScrollView` (with `style`
   * acting as a maxHeight bound) instead of a plain `View`, so a
   * medium-sized list that overflows the sheet stays scrollable exactly
   * like before. Leave false (default) when this list already lives inside
   * an ancestor that scrolls — e.g. a page-level ScrollView — since nesting
   * two scrollables there would trigger RN's "VirtualizedLists should never
   * be nested" warning.
   */
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  ListEmptyComponent?: React.ReactElement | null;
}

/**
 * A member/row list that stays a plain `View` + `.map()` for small counts
 * (so it behaves exactly like the hand-written lists it replaces — natural
 * height, no virtualization overhead) and switches to a bounded, virtualized
 * FlashList once the row count crosses `virtualizeThreshold`. Use this for
 * any "pick a member" / "list of members" surface — split pickers,
 * passenger pickers, vote breakdowns, settlement lists, member management —
 * instead of an unconditional `.map()` inside a `ScrollView`, which mounts
 * every row unconditionally and janks or hangs at hundreds of members.
 */
export function BoundedVirtualList<T>({
  data,
  keyExtractor,
  renderItem,
  itemHeight,
  virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD,
  maxVirtualizedHeight = DEFAULT_MAX_VIRTUALIZED_HEIGHT,
  scrollable = false,
  style,
  ListEmptyComponent,
}: BoundedVirtualListProps<T>): React.ReactElement | null {
  if (data.length === 0) {
    return ListEmptyComponent ?? null;
  }

  if (data.length <= virtualizeThreshold) {
    const rows = data.map((item, index) => (
      <View key={keyExtractor(item, index)}>{renderItem(item, index)}</View>
    ));
    return scrollable ? (
      <ScrollView style={style} showsVerticalScrollIndicator={false}>
        {rows}
      </ScrollView>
    ) : (
      <View style={style}>{rows}</View>
    );
  }

  return (
    <View style={[{ height: Math.min(data.length * itemHeight, maxVirtualizedHeight) }, style]}>
      <FlashList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item, index }) => renderItem(item, index)}
      />
    </View>
  );
}
