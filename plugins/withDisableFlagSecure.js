const { withMainActivity } = require("@expo/config-plugins");

function disableFlagSecureAndroid(mainActivity) {
  const src = mainActivity.modResults.contents;

  // Kotlin
  if (mainActivity.modResults.language === "kt") {
    if (src.includes("WindowManager.LayoutParams.FLAG_SECURE")) return mainActivity;

    const importNeedle = /import\s+android\.os\.Bundle\s*\n/;
    const withImport = importNeedle.test(src)
      ? src.replace(
          importNeedle,
          (m) => `${m}import android.view.WindowManager\n`
        )
      : src;

    // Try to inject right after super.onCreate(...)
    const superNeedle = /super\.onCreate\([^)]+\)\s*\n/;
    if (superNeedle.test(withImport)) {
      mainActivity.modResults.contents = withImport.replace(
        superNeedle,
        (m) =>
          `${m}    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)\n`
      );
      return mainActivity;
    }

    return mainActivity;
  }

  // Java
  if (mainActivity.modResults.language === "java") {
    if (src.includes("WindowManager.LayoutParams.FLAG_SECURE")) return mainActivity;

    const importNeedle = /import\s+android\.os\.Bundle;\s*\n/;
    const withImport = importNeedle.test(src)
      ? src.replace(importNeedle, (m) => `${m}import android.view.WindowManager;\n`)
      : src;

    const superNeedle = /super\.onCreate\([^)]+\);\s*\n/;
    if (superNeedle.test(withImport)) {
      mainActivity.modResults.contents = withImport.replace(
        superNeedle,
        (m) =>
          `${m}    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);\n`
      );
      return mainActivity;
    }

    return mainActivity;
  }

  return mainActivity;
}

module.exports = function withDisableFlagSecure(config) {
  return withMainActivity(config, (mainActivity) => disableFlagSecureAndroid(mainActivity));
};

