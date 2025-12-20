// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],      // ← 이 프리셋이 지금 없어서 에러였음
    plugins: ['react-native-reanimated/plugin'], // 항상 마지막
  };
};
