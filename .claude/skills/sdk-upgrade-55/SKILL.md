---
name: sdk-upgrade-55
description: Reference for the Expo SDK 54→55 upgrade (forced by the Google Sign-In native module) — root package.json version alignment, hoisting verification, and babel-preset-expo gotchas. Use when debugging monorepo dependency hoisting or module resolution failures after a dependency change.
---

# Expo SDK 54 → 55 upgrade

Expo SDK was upgraded from 54 to 55 as part of the Google Sign-In migration (see [[auth-native-google-signin]]).

**Why:** The `@react-native-google-signin/google-signin` package pulled in SDK 55 dependencies, requiring a full upgrade.

**How to apply:**
- Root `package.json` dependencies must match the mobile workspace versions (`react@19.2.0`, `react-native@0.83.6`, `expo@^55.0.24`) — mismatched root versions prevent npm workspace hoisting and cause module resolution failures.
- After any dependency change, verify hoisting with `node -e "console.log(require('expo-router/package.json').version)"` from the repo root.
- `babel-preset-expo` must be explicitly installed (not auto-resolved in SDK 55 monorepos).
- `npx expo install --fix` aligns all Expo packages to the installed SDK version.
