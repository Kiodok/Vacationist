const { withDangerousMod, withAndroidManifest, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Ships the drawable for the runtime "Add Expense" home-screen quick action
 * (useAppIconQuickAction.ts → `icon: 'ic_shortcut_expense'`; iOS uses the SF Symbol
 * `dollarsign.circle.fill` and needs no asset).
 *
 * expo-quick-actions@6 has no supported prop for a home-screen *shortcut* drawable on Android
 * (its `androidIcons` prop generates alternate app icons; the static-actions mod is disabled).
 * On Android the library resolves the `icon` string at runtime via
 * `res.getIdentifier(name, "drawable", packageName)` and then, if that misses,
 * `res.getIdentifier(name, "mipmap", packageName)` — so the resource name `ic_shortcut_expense`
 * exists only in the JS bundle, never in dex or XML.
 *
 * ── History (four failed rounds before this one) ─────────────────────────────────────────────
 * The icon rendered as the launcher's generic robot glyph on real Play Store production installs
 * while working on EAS `development`/`preview` APKs and on iOS. Each round fixed a real
 * contributing cause but not the whole thing:
 *
 *  1. v1.33.0 shipped it as a `<vector>` → robot. (Cross-process VectorDrawable inflation in the
 *     launcher process is a known robot-fallback source.) Fixed by shipping a raster PNG.
 *  2. v1.33.1 added `res/raw/keep.xml` with `tools:keep="@drawable/ic_shortcut_expense"` because
 *     `enableShrinkResourcesInReleaseBuilds: true` (app.config.ts) runs R8's resource shrinker,
 *     whose "safe" mode only protects names that appear as string constants in *compiled* code —
 *     a JS-only name is not covered. Still robot on production.
 *  3. v1.34.0 moved the PNG from the density-qualified `drawable-xxxhdpi/` to the
 *     density-independent `drawable/` folder, because `production` builds an App Bundle and
 *     Play's bundletool splits resources by screen density BY DEFAULT — a device whose density
 *     split isn't exactly xxxhdpi got a generated APK that never contained the drawable. Still
 *     robot on production (per the v1.34.1 bug report: Play Store `.aab`, generic placeholder).
 *  4. v1.34.1 — **ship the icon as a `mipmap` resource, not a `drawable`.** This is Google's own
 *     documented workaround for "a resource referenced only via `getIdentifier` gets stripped":
 *       - The resource shrinker's `ResourceUsageAnalyzer` **never removes `mipmap`-type
 *         resources** — the whole `mipmap` type is treated as reachable, because launcher icons
 *         live there and are only referenced from the manifest. So R8 can't strip it regardless
 *         of `keep.xml`.
 *       - bundletool always includes a density-independent `mipmap/` resource in every device
 *         split, same as it does for `ic_launcher` — so cause 3 cannot recur.
 *       - `expo-quick-actions` already probes the `mipmap` type as its fallback, so the JS
 *         `icon: 'ic_shortcut_expense'` string keeps working with zero client change.
 *     A single fixed-size raster used only via `Icon.createWithResource` (never inflated at
 *     arbitrary layout sizes) needs no per-density variants, so `mipmap/` (no `-anydpi`, no
 *     density qualifier) is correct.
 *
 *  5. v1.34.2 — round 4 was built as a real `production` `.aab`, uploaded to Play, installed on
 *     device: STILL a plain generic shortcut glyph, i.e. `loadIconRes` still returned 0, i.e.
 *     `res.getIdentifier("ic_shortcut_expense", "mipmap"/"drawable", pkg)` still found nothing.
 *     So neither the `mipmap` type nor a `res/raw/keep.xml` entry is sufficient here: what every
 *     round 1–4 had in common is that `ic_shortcut_expense` was referenced ONLY from the JS
 *     bundle and `res/raw/keep.xml` — never from a *compiled* reference. `keep.xml` steers R8's
 *     resource shrinker but does not pin a resource into bundletool's base module, and nothing
 *     was telling bundletool this resource is reachable, so Play's per-device APK generation
 *     could (and evidently did) drop it.
 *
 *     **Fix: add a compiled reference from the merged AndroidManifest** —
 *     `<meta-data android:name="…" android:resource="@mipmap/ic_shortcut_expense"/>` on
 *     `<application>`. A manifest resource reference is a GC root for R8's resource shrinker AND
 *     is pinned by bundletool into the base "master" split installed on every device — the exact
 *     same guarantee `@mipmap/ic_launcher` gets from `<application android:icon>`. The
 *     `<meta-data>` is inert (nothing reads it); it exists purely to make the resource real.
 *     The runtime `res.getIdentifier(…, "mipmap", …)` call in expo-quick-actions is unchanged —
 *     it now simply always resolves because the resource is provably in the installed APK.
 *
 *     (The fully static `res/xml/shortcuts.xml` route — a truly compile-time icon, no
 *     `getIdentifier` at all — is NOT viable with expo-quick-actions@6.0.2: `withAndroidStaticActions`
 *     is commented out in its plugin, and its Kotlin `convertShortcutIntent` reads `shortcut_data`
 *     via `getParcelableExtra`, while a static `<extra>` can only carry a String — so a static
 *     shortcut would launch the app but never fire `onQuickAction`, i.e. never navigate to Add
 *     Expense. It would also always be visible, breaking the "clear the shortcut when there's no
 *     active trip" behaviour the dynamic `QuickActions.setItems([])` call gives us.)
 *
 * Forward-thinking: ANY future Android resource referenced only by a runtime/JS name string
 * (see `.claude/skills/android-runtime-resource-shrinking/SKILL.md`) needs a compiled reference
 * — the surest being a `<meta-data android:resource>` on `<application>` — in addition to living
 * in a density-independent `mipmap/` folder. Folder choice + `keep.xml` alone have now failed
 * four times on real Play Store production installs.
 *
 * The `res/raw/keep.xml` entry below is kept as cheap, self-documenting insurance.
 */
const ICON_RESOURCE = '@mipmap/ic_shortcut_expense';
const MANIFEST_META_DATA_NAME = 'com.vacationist.mobile.quickactions.KEEP_SHORTCUT_ICON';
const PNG_SOURCE = path.join(__dirname, '..', 'assets', 'images', 'ic_shortcut_expense.png');

const KEEP_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@mipmap/ic_shortcut_expense" />
`;

module.exports = function withQuickActionIcon(config) {
  // (a) Ship the raster + keep.xml (rounds 1–4).
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      // Fail loud at prebuild time if the committed source asset is missing (e.g. committed
      // without `git add`), rather than letting fs.copyFileSync throw a bare ENOENT deep in
      // the EAS build log.
      if (!fs.existsSync(PNG_SOURCE)) {
        throw new Error(
          `withQuickActionIcon: missing source asset ${PNG_SOURCE}. It must be committed to the repo.`,
        );
      }

      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
      );

      // 1. Ship the raster in the density-INDEPENDENT `mipmap/` folder — no density variants to
      //    be split out, and paired with the manifest reference added in (b) below.
      const mipmapDir = path.join(resDir, 'mipmap');
      fs.mkdirSync(mipmapDir, { recursive: true });
      fs.copyFileSync(PNG_SOURCE, path.join(mipmapDir, 'ic_shortcut_expense.png'));

      // 2. Remove stale artifacts from an earlier prebuild without --clean — any of this
      //    plugin's former locations (v1.33.0 vector, v1.33.1 xxxhdpi raster, v1.34.0
      //    density-independent drawable raster) so nothing shadows or duplicates the mipmap.
      for (const stale of [
        path.join(resDir, 'drawable', 'ic_shortcut_expense.xml'),
        path.join(resDir, 'drawable', 'ic_shortcut_expense.png'),
        path.join(resDir, 'drawable-xxxhdpi', 'ic_shortcut_expense.png'),
      ]) {
        if (fs.existsSync(stale)) fs.rmSync(stale);
      }

      // 3. Redundant-but-documented keep rule (mipmaps are never shrunk; kept as insurance).
      const rawDir = path.join(resDir, 'raw');
      fs.mkdirSync(rawDir, { recursive: true });
      const keepFile = path.join(rawDir, 'keep.xml');
      if (!fs.existsSync(keepFile)) {
        fs.writeFileSync(keepFile, KEEP_XML);
      } else {
        // Some other plugin already wrote keep.xml (none does today). Merge our resource into
        // its tools:keep list. If we can't confidently do that, throw — a silent no-op here
        // would surface only as a stripped icon in a release build, the worst place to debug it.
        const existing = fs.readFileSync(keepFile, 'utf8');
        if (!existing.includes('@mipmap/ic_shortcut_expense')) {
          const keepAttr = /tools:keep\s*=\s*(["'])([^"']*)\1/;
          if (!keepAttr.test(existing)) {
            throw new Error(
              `withQuickActionIcon: an existing ${keepFile} has no recognisable tools:keep ` +
                `attribute to merge "@mipmap/ic_shortcut_expense" into. Merge it by hand.`,
            );
          }
          const merged = existing.replace(
            keepAttr,
            (_, q, list) => `tools:keep=${q}${list ? `${list},` : ''}@mipmap/ic_shortcut_expense${q}`,
          );
          fs.writeFileSync(keepFile, merged);
        }
      }

      return config;
    },
  ]);

  // (b) Round 5: a COMPILED reference to the icon from the merged AndroidManifest. This is the
  //     piece rounds 1–4 never had — it makes `@mipmap/ic_shortcut_expense` a GC root for R8's
  //     resource shrinker AND pins it into bundletool's base "master" split (installed on every
  //     device), the same treatment `@mipmap/ic_launcher` gets. The <meta-data> is inert; it
  //     exists only so the resource is provably present when expo-quick-actions calls
  //     `res.getIdentifier("ic_shortcut_expense", "mipmap", packageName)` at runtime.
  config = withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(app, MANIFEST_META_DATA_NAME);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      MANIFEST_META_DATA_NAME,
      ICON_RESOURCE,
      'resource',
    );
    return config;
  });

  return config;
};
