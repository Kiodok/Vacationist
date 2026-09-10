---
name: sheet-swipe-to-dismiss
description: Use before creating or editing ANY bottom sheet / modal surface in apps/mobile, or when asked "what's in v1.38.0" / "how does swipe-to-close work". Every sheet's panel must be a <SwipeToDismiss> and its one outermost scrollable a <SheetScrollArea>. Also records the react-native-gesture-handler install (v1.38.0, FULL build).
---

# Bottom-sheet swipe-down-to-dismiss (Phase 20 / v1.38.0)

`software_engineering_guide.md` §18 has always specified sheets as "Drag-to-dismiss: enabled".
Until v1.38.0 that was fiction — all 56 sheets drew the grabber pill but had no gesture. v1.38.0
made it real across every sheet at once.

## The rule

Every React Native `<Modal transparent animationType="slide">` bottom sheet in `apps/mobile`
wraps its panel in **`<SwipeToDismiss>`** (`apps/mobile/src/components/SwipeToDismiss.tsx`), and
its single outermost scrollable in **`<SheetScrollArea>`** (`apps/mobile/src/components/SheetScrollArea.tsx`).

```tsx
<Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
  {/* optional <KeyboardAvoidingView behavior="padding" className="flex-1"> stays */}
  <SwipeToDismiss
    onDismiss={handleClose}   // the sheet's LOCAL close (resets form etc.) — NEVER the raw onClose prop
    className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]"
    style={{ paddingBottom: Math.max(insets.bottom, 32) }}
  >
    <View className="items-center mb-md"><View className="w-[36px] h-[4px] rounded-full bg-border" /></View>
    {/* header + body */}
    <SheetScrollArea>
      <ScrollView …>{/* … */}</ScrollView>
    </SheetScrollArea>
  </SwipeToDismiss>
</Modal>
```

`<SwipeToDismiss>` replaces the old copy-pasted `<View className="flex-1 justify-end"> + scrim
<Pressable> + panel <View>` scaffold. Move the panel's `className` and `style` onto it verbatim,
**minus** any `isColorful && Platform.OS === 'web'` boxShadow — the component applies that itself.

**Why:** one place owns the gesture, the scrim fade, the Modal-content `GestureHandlerRootView`,
and the colorful web shadow. The gap it closed (spec says drag-to-dismiss, reality had none) had
been open since the design system was written.

**How to apply:**
- **`onDismiss` = the local close handler.** Most sheets have `const handleClose = () => { reset(); onClose(); }`.
  Passing the raw `onClose` leaks form state between openings.
- **`<SheetScrollArea>`'s direct child must be the scrollable** (`ScrollView` / `FlatList` /
  `Animated.ScrollView`), not a wrapper `View` — RNGH `Gesture.Native()` needs the native
  component as the direct child. Wrap only the ONE outermost scrollable; nested/horizontal
  scrollers inside it are already covered (`failOffsetX([-20,20])` protects horizontal ones).
- **Lists built on `BoundedVirtualList` need no wrapper** — it self-registers `<SheetScrollArea>`
  internally on whichever branch it renders.
- **Sheets with no scrollable** need only `<SwipeToDismiss>`.
- **`max-h-[NN%]` (85–92%) is required** on the panel `className` — without it a tall sheet's
  grabber scrolls off the top of the screen and the gesture becomes unreachable.
- **Down-only.** `Gesture.Pan().activeOffsetY(10)` (single positive number = down-only in RNGH);
  an upward drag does nothing. Dismiss decision is the pure `shouldDismissSheet` in
  `apps/mobile/src/utils/sheetGesture.ts` (distance `> min(120, panelHeight*0.3)` OR velocity
  `> 800`), unit-tested in `sheetGesture.test.ts` — extend those tests, not a component test
  (there is no component-test harness — see [[offline-ux-patterns]] for the same constraint).
- **Native only.** `SwipeToDismiss.web.tsx` / `SheetScrollArea.web.tsx` are plain passthroughs;
  web keeps tap-scrim / Cancel dismissal and RNGH stays out of the (already heavy) web bundle.
- **Excluded from the gesture, by Tech Lead decision:** `ForceUpdateGate`, `OfflineReauthGate`,
  `TutorialModal` (all deliberately non-dismissible, swallow Android back), and
  `DateTimePickerField`'s iOS tray (the native date wheel owns vertical drag). Don't add
  `<SwipeToDismiss>` to those.

## react-native-gesture-handler (new native dependency)

v1.38.0 installed `react-native-gesture-handler@~2.30.0` (`npx expo install`, the SDK 55 pin — no
`app.config.ts` plugin entry needed). `GestureHandlerRootView` is mounted once at
`app/_layout.tsx` via `src/components/GestureRoot.tsx` (+ `.web.tsx` no-op). **This is a native
module → FULL Play + App Store build, never an OTA** — which is why the JS-only [[v1-37-3-batch]]
memory work, sitting in the same uncommitted pile, also became a `1.38.0` full build.

RNGH facts worth keeping (verified against the 2.x docs, not the current v3 docs):
- `.activeOffsetY(10)` (bare positive number) is **down-only**, not ±10. `[-10, 10]` for both ways.
- Gestures inside an RN `<Modal>` need a `GestureHandlerRootView` **inside the Modal content** on
  Android — `SwipeToDismiss` renders its own; on web the app-level root is an ancestor so the
  nested one is ignored (RNGH uses only the top-most root), keeping `pan` + `SheetScrollArea`'s
  native gesture in one root so their relation holds.
- Passing a **plain RN ScrollView ref** into a gesture relation silently no-ops (no `handlerTag`).
  `SheetScrollArea` relates to the `pan` **gesture object** via context, not a ref.
- `scheduleOnRN` (from `react-native-worklets`) not `runOnJS` (deprecated in Reanimated 4).

## Remaining

Dev build done (Android) — **on-device basic drag confirmed working** ("works like a charm").
Still worth a fuller pass before the production rollout: ScrollView hand-off, nested sheets
(CurrencyPicker-in-CreateExpense), keyboard-open, all 4 themes, `>20`-row list in a sheet, offline.
Then `git commit`; production build + submit + staged rollout (Play 10→50→100, App Store phased);
iOS dev build + test.

**The dev-client rebuild is mandatory after installing RNGH** — the old binary throws
`Invariant Violation: RNGestureHandlerModule could not be found` at `_layout.tsx` eval time, which
cascades to "every route missing default export" + "No QueryClient set". No code/cache fix; only
`npm run build:dev` → install the new APK.

Related: [[v1-37-3-batch]], [[offline-ux-patterns]], [[horizontal-scrollview-height]],
[[pressable-flex-android]], [[no-branches-main-only]].
