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
 * robot glyph on release builds. This plugin fixes both contributing causes:
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
 *     same robot fallback on several launchers. Shipping a raster PNG (xxxhdpi, 192px = 48dp)
 *     removes that path entirely, independently of cause 1.
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

      // 1. Ship the raster at xxxhdpi (Android downscales for lower densities).
      const drawableDir = path.join(resDir, 'drawable-xxxhdpi');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(PNG_SOURCE, path.join(drawableDir, 'ic_shortcut_expense.png'));

      // 2. Remove any stale vector from an earlier prebuild without --clean, so the
      //    default-config vector can't win over the xxxhdpi raster on some devices.
      const staleVector = path.join(resDir, 'drawable', 'ic_shortcut_expense.xml');
      if (fs.existsSync(staleVector)) fs.rmSync(staleVector);

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
