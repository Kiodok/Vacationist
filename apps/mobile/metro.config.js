const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch workspace packages for hot-reload in dev only — in CI the watchers
// prevent the process from exiting after `expo export`, causing Vercel timeouts.
if (!process.env.CI) {
  config.watchFolders = [workspaceRoot];
}

// Resolve modules from both the app and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Required for sub-path package exports (e.g. @vercel/analytics/react)
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, {
  input: './global.css',
  configPath: './tailwind.config.js',
});
