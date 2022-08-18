// Learn more https://docs.expo.io/guides/customizing-metro
/*const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);*/
/*const { getDefaultConfig } = require('metro-config');
module.exports = (async () => {
    const defaultConfig = await getDefaultConfig();
    const { assetExts } = defaultConfig.resolver;
    return {
        resolver: {
            // Add bin to assetExts
            assetExts: [...assetExts, 'bin'],
        }
    };
})();*/
const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push('bin');
defaultConfig.resolver.assetExts.push('db');

module.exports = defaultConfig;
