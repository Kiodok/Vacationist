const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * expo-quick-actions@6 has no supported prop for a home-screen *shortcut* drawable on Android
 * (its `androidIcons` prop generates alternate app icons; the static-actions mod is disabled).
 * On Android the library resolves an `icon` string via
 * `res.getIdentifier(name, "drawable"|"mipmap", packageName)`, so it needs a real resource in
 * the app's res/. This plugin drops one monochrome cash/banknote vector drawable at
 * res/drawable/ic_shortcut_expense.xml — referenced as `icon: 'ic_shortcut_expense'` from
 * useAppIconQuickAction.ts (iOS uses the SF Symbol `dollarsign.circle.fill` instead).
 */
const VECTOR_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24"
    android:tint="#6C63FF">
  <path
      android:fillColor="#FFFFFF"
      android:pathData="M19,14V8c0,-1.1,-0.9,-2,-2,-2H3C1.9,6,1,6.9,1,8v6c0,1.1,0.9,2,2,2h14C18.1,16,19,15.1,19,14zM10,14c-1.66,0,-3,-1.34,-3,-3s1.34,-3,3,-3s3,1.34,3,3S11.66,14,10,14zM23,7v11c0,1.1,-0.9,2,-2,2H4c0,-0.55,0,-1.45,0,-2h17V7C22.55,7,23,7,23,7z"/>
</vector>
`;

module.exports = function withQuickActionIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const drawableDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'drawable',
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, 'ic_shortcut_expense.xml'), VECTOR_XML);
      return config;
    },
  ]);
};
