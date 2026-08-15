---
name: kav-statusbar-offset
description: Use when adding or fixing a KeyboardAvoidingView below a header on Android — keyboardVerticalOffset must add StatusBar.currentHeight to the measureInWindow Y on every screen type (virtual tabs and standalone SafeAreaView screens alike), not just some of them.
---

# KeyboardAvoidingView StatusBar offset (Android)

Always use `y + StatusBar.currentHeight` on Android for `keyboardVerticalOffset`, regardless of whether the screen is a virtual tab or a standalone `SafeAreaView` screen.

**Why:** On Android, `measureInWindow` returns Y in the *window* coordinate space (origin = below the status bar). `KeyboardAvoidingView`'s `keyboardVerticalOffset` must be relative to the *physical screen top* (above the status bar). The gap is exactly `StatusBar.currentHeight`. This applies to ALL screens — the distinction between virtual tabs and standalone screens does not matter.

**How to apply:** The standard pattern for any screen with a KAV below a header:

```tsx
const kavContainerRef = useRef<View>(null);
const [kavOffset, setKavOffset] = useState(0);
const handleKavLayout = useCallback(() => {
  kavContainerRef.current?.measureInWindow((_x, y) => {
    const statusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
    setKavOffset(y + statusBar);
  });
}, []);

// Wrap KAV:
<View ref={kavContainerRef} onLayout={handleKavLayout} collapsable={false} className="flex-1">
  <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={kavOffset} className="flex-1">
    ...
  </KeyboardAvoidingView>
</View>
```

A previous incorrect analysis claimed standalone `SafeAreaView` screens needed only `y` (no StatusBar). This was wrong — confirmed broken in the shopping-list and recipe screens, fixed by adding `StatusBar.currentHeight`. Don't reintroduce that distinction.
