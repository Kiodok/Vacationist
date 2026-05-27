const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages so Metro hot-reloads when they change
config.watchFolders = [workspaceRoot];

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
