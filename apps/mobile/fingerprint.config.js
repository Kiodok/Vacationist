/** @type {import('@expo/fingerprint').Config} */
const config = {
  ignorePaths: [
    // EAS generates these via prebuild; locally they don't exist
    'android/**/*',
    'ios/**/*',
    // Monorepo root node_modules are hoisted locally but resolved differently on EAS
    '../../node_modules/**',
  ],
};

module.exports = config;
