---
name: android-runtime-resource-shrinking
description: Use whenever an Android resource is referenced only by a runtime name string (Resources.getIdentifier with a name passed from JS / the JS bundle) — e.g. expo-quick-actions shortcut icons, dynamic app icons. This app has R8 resource shrinking on; its default "safe" mode only protects names that appear as string constants in COMPILED code, so a JS-only name can be stripped in release builds unless pinned with a res/raw/keep.xml tools:keep entry. Works in dev/debug, can vanish in preview/production EAS builds. Also covers preferring a raster PNG over a vector for launcher/notification icons.
---

# Runtime-referenced Android resources must be kept via keep.xml

`apps/mobile/app.config.ts` → `expo-build-properties` →
`android.enableShrinkResourcesInReleaseBuilds: true` (on since July 2026). R8's resource shrinker
keeps resources it sees referenced from compiled code, XML, or the manifest. Its default **"safe"
mode** additionally keeps resources whose names appear as **string constants in compiled code**
(the `Resources.getIdentifier` defensive heuristic). A resource whose name exists **only as a
string in the JS bundle** — passed from JS through the RN bridge into `getIdentifier` — is not a
compiled string constant, so safe mode does not protect it and it can be stripped (or dummied) in
a release build.

**Why:** it resolves fine in a debug/dev-client build and in a plugin's prebuild output, so it
looks completely working right up until the shipped preview/production artifact — the most
expensive place to catch it (one full EAS build per iteration).

**Precedent:** `expo-dev-launcher` / `expo-dev-menu` ship `android/src/debug/res/raw/keep.xml`
with `tools:keep` lists of their own JS-referenced Metro-bundled `@drawable/...` assets — Expo
itself relies on this mechanism, confirming safe mode does not auto-retain JS-only-referenced
drawables. Theirs are `debug`-only (dev-client UI); a resource that ships in **release** needs its
keep entry in the `main` source set, which is where this repo's plugin writes it — so a release
variant carries exactly one app-level `keep.xml` and the `debug` ones never collide with it.

**Concrete instance (v1.33.1):** the "Add Expense" home-screen quick action. `expo-quick-actions`
runs `res.getIdentifier("ic_shortcut_expense", "drawable", packageName)` with the name passed from
`useAppIconQuickAction.ts`. The v1.33.0 fix shipped the drawable as a `<vector>` and it still
rendered as the launcher robot on device builds. Two contributing causes, both fixed in v1.33.1:
this shrinking gap (→ `keep.xml`) **and** cross-process VectorDrawable inflation (→ raster PNG, see
below). Cheap post-hoc check: `unzip -l` the last v1.33.0 APK, see if the drawable is present and
non-empty. See [[v1-33-0-batch]].

## How to apply

- Any plugin that ships an Android resource referenced only by a runtime/JS name string must
  **also** write `android/app/src/main/res/raw/keep.xml`:
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <resources xmlns:tools="http://schemas.android.com/tools"
      tools:keep="@drawable/that_resource" />
  ```
  If `keep.xml` already exists, merge into its `tools:keep` comma-separated list — don't clobber.
- Do **not** set `tools:shrinkMode` — the default `safe` mode is what everything else relies on.
- Prefer a raster PNG over a `<vector>` for any resource handed to another process via
  `Icon.createWithResource` (launcher shortcut icons, notification small-icons) — cross-process
  VectorDrawable inflation is a separate, independent cause of the same robot fallback.
- Reference implementation doing both: `apps/mobile/plugins/withQuickActionIcon.js`.
- Verify without a device: `cd apps/mobile && npx expo prebuild -p android --clean`, confirm the
  PNG + `res/raw/keep.xml` landed, then `rm -rf apps/mobile/android` (it's gitignored).

Cross-reference: [[commit-discipline]] (stage, don't commit until the Tech Lead device-tests).
