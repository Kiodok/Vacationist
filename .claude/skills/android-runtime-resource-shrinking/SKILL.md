---
name: android-runtime-resource-shrinking
description: Use whenever an Android resource is referenced only by a runtime name string (Resources.getIdentifier with a name passed from JS / the JS bundle) — e.g. expo-quick-actions shortcut icons, dynamic app icons. This app has R8 resource shrinking on; a JS-only resource name can be stripped in release builds, and if it lives in a density-qualified `drawable-*` folder, Play's bundletool per-device density split omits it from most devices. The "Add Expense" quick-action icon took FOUR fix rounds (vector→raster PNG, res/raw/keep.xml, move to density-independent `drawable/`) and each round fixed a real cause but the icon still showed the generic placeholder on Play Store production `.aab` installs. Round 4 (v1.34.1): ship the resource as a `mipmap/` resource, not a `drawable/` — the mipmap type is categorically exempt from R8 resource shrinking AND always packaged in every bundletool device split, and expo-quick-actions already falls back to the mipmap type. Forward rule: put ANY runtime/JS-name-referenced Android resource straight into a density-independent `mipmap/` folder — sidesteps R8 shrinking, bundletool density-splitting and the need for keep.xml at once. Also covers preferring raster PNG over vector for anything Icon.createWithResource hands to the launcher, and (weaker, unconfirmed) OEM launchers caching a dynamic shortcut icon by (packageName, shortcutId) — bump the shortcut id + clean reinstall test.
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

## An unconfirmed second theory, tried first (2026-09-05, v1.34.0)

Even after the fix above (raster PNG + `keep.xml`) shipped and was confirmed correct on
inspection, the "Add Expense" quick-action icon STILL showed the OS robot glyph on device. Leading
suspect at the time: several OEM launchers (Samsung One UI, MIUI, etc.) snapshot a dynamic
shortcut's icon bitmap **keyed by `(packageName, shortcutId)`** the first time it's created, and
don't reliably redraw it on a same-id `ShortcutManager(Compat).setDynamicShortcuts` call after an
in-place app **update** — only a fresh shortcut id, or a clean uninstall/reinstall, forces the
launcher to re-fetch the icon. Applied as a defensive fix: bumped the shortcut id itself
(`ADD_EXPENSE_ACTION_ID` in `useAppIconQuickAction.ts`, `'add-expense'` → `'add-expense-v2'`) —
cheap, safe, still worth keeping as insurance against this failure mode even though it turned out
not to be the actual cause of the reported bug (below).

## Round 3 (2026-09-05): Play Store's per-device density-split App Bundle — real, but STILL not enough

The Tech Lead's actual test matrix was the key: the icon worked on an EAS `development` build
*and* on iOS production, but failed specifically on **Android production installed from the Play
Store**, across multiple real devices. That pattern rules out R8 shrinking (a `development` build
has R8 off entirely, but so did `preview` — and `preview` also worked) and rules out the OEM
shortcut-caching theory (that would affect a `development`-build device too, since caching is
per-device, not per-distribution-channel). It points at exactly one thing that differs between
`development`/`preview` and `production`: **`eas.json`'s `android.buildType`** —
`development`/`preview` build a universal `apk` (every resource ships to every install
unconditionally), while `production` builds an `app-bundle` (`.aab`), uploaded to Play Console.
Google Play's bundletool then generates a **device-specific APK per install** from that bundle,
and **splits resources by screen density by default**: a device's generated APK contains only the
resources qualified for *that device's own* density bucket (plus density-*independent* ones) —
never resources from a different density-qualified folder. `withQuickActionIcon.js` shipped the
icon **only** in `drawable-xxxhdpi/`. Any real device whose Play-assigned density split wasn't
exactly xxxhdpi (a large share of the install base) received a Play-generated APK that never
contained the drawable **at all** — not stripped by R8, simply never included in that split.
Neither `keep.xml` nor the raster-PNG fix could ever have caught this: both only decide whether a
resource *present in a build* survives shrinking; neither can restore a resource bundletool never
packaged into a given device's split in the first place.

**Fix:** ship the icon in the density-**independent** default `res/drawable/` folder instead of a
density-qualified one (`drawable-xxxhdpi/`, `drawable-hdpi/`, etc.). Bundletool always includes
density-independent resources in every device's split, regardless of that device's density —
exactly the same reasoning R8's `keep.xml` uses ("must survive whatever splitting/shrinking Google
does downstream, unconditionally"), just applied to Play's bundle splitting instead of R8. A
resource used only via `Icon.createWithResource` for a fixed-size shortcut/notification icon
(never inflated at arbitrary layout sizes by a normal Android View) has no need for multiple
density variants anyway, so this has no downside.

**Verify without a device:** `cd apps/mobile && npx expo prebuild -p android --clean`, confirm
`android/app/src/main/res/drawable/ic_shortcut_expense.png` (not `drawable-xxxhdpi/`) plus
`res/raw/keep.xml`, then `rm -rf apps/mobile/android` (gitignored). This does NOT catch the actual
Play-splitting bug itself (that only manifests through bundletool's real per-device split
generation, which happens on Play's infrastructure, not in a local prebuild) — it only confirms
the resource is in the right *folder*. The Play Store production install test is what actually
proves the fix.

## Round 4 (2026-09-05, v1.34.1) — the density-independent `drawable/` fix ALSO failed: ship it as a `mipmap`

The Tech Lead re-tested a Play Store production `.aab` carrying the round-3 fix
(density-independent `res/drawable/ic_shortcut_expense.png`). **Still the generic placeholder**
(not the app's own launcher icon → `getIdentifier` still returning `0`). So `drawable/` — even
unqualified — is not safe enough here.

**Fix: ship the resource as a `mipmap/` resource, not a `drawable/`.** This is Google's own
documented workaround for "a resource referenced only via `getIdentifier` gets stripped":
- R8's resource shrinker (`ResourceUsageAnalyzer`) **never removes `mipmap`-type resources** —
  the entire `mipmap` type is treated as reachable, because launcher icons live there and are
  only referenced from the manifest. `keep.xml` becomes unnecessary (kept as insurance,
  repointed at `@mipmap/...`).
- bundletool always includes a density-independent `mipmap/` resource in every device split
  (identical treatment to `ic_launcher`), so the round-3 density-split failure cannot recur.
- `expo-quick-actions` `loadIconRes` (`ExpoQuickActionsModule.kt`) probes the `drawable` type
  first, then falls back to `mipmap` — so the JS `icon: 'ic_shortcut_expense'` string is
  unchanged.

`apps/mobile/plugins/withQuickActionIcon.js` now writes `res/mipmap/ic_shortcut_expense.png`
(was `res/drawable/`), still cleans up every stale prior location, and the shortcut id was
bumped `add-expense-v2` → `add-expense-v3`. Verify without a device:
`npx expo prebuild -p android --clean` → confirm `android/app/src/main/res/mipmap/ic_shortcut_expense.png`.
Still pending a real Play Store production install to confirm — three prior "confirmed" root
causes were each wrong or incomplete, so treat round 4 as unconfirmed until a device test.

**Lesson (the general, forward-thinking one):** for ANY Android resource referenced only by a
runtime/JS name string — the same class this whole skill file is about — put it **straight into a
density-independent `mipmap/` folder**. That sidesteps R8 resource shrinking, bundletool
per-device density splitting, AND the need for a `keep.xml`, all in one move. A density-qualified
`drawable-*` folder is a landmine invisible in every locally-testable build (debug,
`development`/`preview` APK) that only detonates on real Play Store production installs, on a
subset of devices — and even a *density-independent* `drawable/` proved insufficient here.

**Also still true, keep as defensive insurance (weaker, unconfirmed theory):** a shortcut-icon fix
that looks correct in the built APK can still separately fail purely from OEM launcher-side
caching of a *previous* broken icon under the same shortcut id. When validating a fix to an
*already-shipped* shortcut's icon, test with a clean **uninstall+reinstall**, never just an
in-place update — an update is exactly the scenario this caching bug (if real) would hide behind.

Cross-reference: [[commit-discipline]] (stage, don't commit until the Tech Lead device-tests).
