const { withDangerousMod } = require('expo/config-plugins');
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
 * `res.getIdentifier(name, "drawable"|"mipmap", packageName)` with `name` coming from JS — so
 * the resource name `ic_shortcut_expense` exists only in the JS bundle, never in dex or XML.
 *
 * v1.33.0 shipped this drawable as a `<vector>` and it still rendered as the launcher's generic
 * robot glyph on release builds. v1.33.1/v1.34.0 fixed two contributing causes (R8 shrinking via
 * keep.xml below; cross-process VectorDrawable inflation via a raster PNG) but it STILL failed on
 * real Play Store production installs while working on EAS `development`/`preview` APKs and on
 * iOS — because of a third, Play-Store-specific cause:
 *
 *  1. **R8 resource shrinking.** `enableShrinkResourcesInReleaseBuilds: true` (app.config.ts)
 *     runs R8's resource shrinker on every release build. Its default "safe" mode keeps
 *     resources whose names appear as string constants in *compiled* code; a name that only
 *     exists in the JS bundle is not covered, so the drawable is stripped, `getIdentifier`
 *     returns 0, and the launcher falls back to its robot. `res/raw/keep.xml` with `tools:keep`
 *     pins it. This isn't speculative — `expo-dev-launcher` and `expo-dev-menu` ship the exact
 *     same `res/raw/keep.xml` mechanism (in their `debug` source set) for their own
 *     JS-referenced, Metro-bundled drawables, for exactly this reason. Ours goes in `main` so it
 *     applies to release; a release variant then contains this one app-level keep.xml and no other.
 *  2. **Cross-process VectorDrawable inflation.** `Icon.createWithResource` hands the resource id
 *     to the *launcher's* process; a VectorDrawable inflated there is a well-known source of the
 *     same robot fallback on several launchers. Shipping a raster PNG removes that path entirely,
 *     independently of cause 1.
 *  3. **Play Store per-device density-split App Bundles (the actual remaining cause).**
 *     `eas.json`: `development`/`preview` build a universal `apk` (`buildType: "apk"`) — every
 *     resource ships in every install, regardless of density, so the icon "worked" in every build
 *     anyone locally tested. `production` builds an `app-bundle` (`.aab`); Google Play's
 *     bundletool then generates a device-specific APK per install, and BY DEFAULT splits
 *     resources by screen density — a device's split APK contains only resources qualified for
 *     ITS density bucket (plus density-*independent* ones), not resources from a different
 *     density-qualified folder. The icon was shipped ONLY in `drawable-xxxhdpi/`, so any real
 *     device whose density split isn't exactly xxxhdpi (a large share of the install base — many
 *     mid-range phones and most tablets) received a Play-generated APK that never contained this
 *     drawable at all, regardless of R8/keep.xml (both of those only decide whether a resource
 *     *present in the build* survives shrinking — they can't restore a resource bundletool never
 *     included in a given device's split in the first place). Fixed by shipping the PNG in the
 *     density-*independent* default `res/drawable/` folder instead of a density-qualified one —
 *     bundletool always includes density-independent resources in every device split, and Android
 *     already handles a single fixed-size raster used only via `Icon.createWithResource` (never
 *     inflated at arbitrary layout sizes) correctly without needing per-density variants.
 *     Forward-thinking: any FUTURE resource referenced only by a runtime/JS name string (this
 *     app's other instance of that pattern — see `[[android-runtime-resource-shrinking]]`) must
 *     go in a density-independent folder for the same reason, not just get R8-keep-listed.
 */
const PNG_SOURCE = path.join(__dirname, '..', 'assets', 'images', 'ic_shortcut_expense.png');

const KEEP_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@drawable/ic_shortcut_expense" />
`;

module.exports = function withQuickActionIcon(config) {
  return withDangerousMod(config, [
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

      // 1. Ship the raster in the density-INDEPENDENT default `drawable/` folder, not a
      //    density-qualified one (e.g. `drawable-xxxhdpi/`) — a Play Store production build is an
      //    App Bundle, and bundletool's per-device split only includes a density-qualified
      //    resource in the split matching that exact density, silently omitting it from every
      //    other device's split. A density-independent resource is included in every split
      //    regardless of device density. See the module doc comment (cause 3) for the full story.
      const drawableDir = path.join(resDir, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(PNG_SOURCE, path.join(drawableDir, 'ic_shortcut_expense.png'));

      // 2. Remove stale artifacts from an earlier prebuild without --clean (either the original
      //    v1.33.0 vector, or this plugin's own former xxxhdpi-qualified raster) so nothing can
      //    shadow or duplicate the density-independent raster above.
      const staleVector = path.join(resDir, 'drawable', 'ic_shortcut_expense.xml');
      if (fs.existsSync(staleVector)) fs.rmSync(staleVector);
      const staleXxxhdpiPng = path.join(resDir, 'drawable-xxxhdpi', 'ic_shortcut_expense.png');
      if (fs.existsSync(staleXxxhdpiPng)) fs.rmSync(staleXxxhdpiPng);

      // 3. Keep rule so R8 resource shrinking can't strip the runtime-only reference.
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
        if (!existing.includes('@drawable/ic_shortcut_expense')) {
          const keepAttr = /tools:keep\s*=\s*(["'])([^"']*)\1/;
          if (!keepAttr.test(existing)) {
            throw new Error(
              `withQuickActionIcon: an existing ${keepFile} has no recognisable tools:keep ` +
                `attribute to merge "@drawable/ic_shortcut_expense" into. Merge it by hand.`,
            );
          }
          const merged = existing.replace(
            keepAttr,
            (_, q, list) => `tools:keep=${q}${list ? `${list},` : ''}@drawable/ic_shortcut_expense${q}`,
          );
          fs.writeFileSync(keepFile, merged);
        }
      }

      return config;
    },
  ]);
};
