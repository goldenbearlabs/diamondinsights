const { getDefaultConfig } = require('expo/metro-config');
module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  // allow CommonJS extensions
  config.resolver.sourceExts.push('cjs');
  return config;
})();
