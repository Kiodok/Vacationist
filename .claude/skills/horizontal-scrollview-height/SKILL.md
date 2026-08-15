---
name: horizontal-scrollview-height
description: Use when a horizontal ScrollView (pill bar, tab bar, chip row) inside a flex:1 parent has children stretching to fill the full parent height instead of hugging their intrinsic size — React Native fix via flexGrow:0.
---

# Horizontal ScrollView height fix

Horizontal `ScrollView` components in React Native expand to fill their parent's height by default, causing children (pills, tabs, buttons) to stretch vertically.

**Why:** A `ScrollView` participates in flex layout like any view — without a height constraint it grows to fill the parent. Children then stretch to fill the ScrollView's height.

**How to apply:** Any time a horizontal pill/tab/chip bar inside a `flex: 1` parent has stretched items, add `style={{ flexGrow: 0 }}` to the `ScrollView`. This restricts the ScrollView to its intrinsic height (tallest child + padding) and stops the stretching.

```tsx
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={{ flexGrow: 0 }}   // ← prevents vertical expansion
  contentContainerClassName="flex-row gap-xs px-md pt-sm pb-xs"
>
  {/* pills */}
</ScrollView>
```

Note: `alignSelf: 'flex-start'` on individual children does NOT fix this — the root cause is the ScrollView container itself being too tall.
