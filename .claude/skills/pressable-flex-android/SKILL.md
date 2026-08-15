---
name: pressable-flex-android
description: Use when building a flex row of equal-width pressable children (e.g. segmented controls, button groups) — Pressable with a function-based style prop does not reliably apply flex:1 during Android's layout pass; use TouchableOpacity with a static style object instead.
---

# Pressable flex:1 breaks on Android

On Android, `Pressable` with a function-based `style` prop (`style={({ pressed }) => ({ flex: 1, ... })}`) does not reliably apply `flex: 1` during the layout pass. Children end up hugging their content width instead of distributing evenly.

**Why:** Android's layout engine evaluates flex during the initial layout pass, but the function-based style is evaluated at render time — the two don't sync reliably on Android.

**How to apply:** For any flex row where children should share equal width, use `TouchableOpacity` with a static style object instead of `Pressable` with a function style. If `pressed` feedback is needed, use `activeOpacity` on `TouchableOpacity`.
