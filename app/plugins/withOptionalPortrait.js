const { withAndroidManifest } = require("@expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = manifest["uses-feature"] || [];
    const existing = features.find((f) => f && f.$ && f.$["android:name"] === FEATURE);
    if (existing) {
      existing.$["android:required"] = "false";
    } else {
      features.push({ $: { "android:name": FEATURE, "android:required": "false" } });
      manifest["uses-feature"] = features;
    }
    return cfg;
  });
};
