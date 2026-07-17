// Expo config plugin for the Hello Sara native Android module.
// Adds SYSTEM_ALERT_WINDOW + FOREGROUND_SERVICE permissions, registers the
// wake-word foreground service, declares the overlay activity, copies the
// Kotlin sources into the generated project (this step was previously
// missing — the .kt files sat in plugins/ but never actually got built),
// adds the Porcupine wake-word SDK dependency, and injects the
// PICOVOICE_ACCESS_KEY (from your .env) as AndroidManifest meta-data.
//
// After adding this plugin to app.json, run `expo prebuild --clean` and
// build a dev client (`eas build --profile development`) to get the native
// wake-word listener + always-on-top mic bubble on Android.

const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withPlugins, withAppBuildGradle, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');

const ANDROID_PACKAGE_PATH = 'com/emergent/completepromptpdf/jvd1n5';

function addPermissions(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.RECORD_AUDIO',
    'android.permission.WAKE_LOCK',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.QUERY_ALL_PACKAGES',

  ]);
}

function addServiceAndActivity(config) {
  return withAndroidManifest(config, async (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;

    app.service = app.service || [];
    const already = app.service.find(
      (s) => s.$?.['android:name'] === '.WakeWordService',
    );
    if (!already) {
      app.service.push({
        $: {
          'android:name': '.WakeWordService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone',
        },
      });
    }

    app.activity = app.activity || [];
    const overlay = app.activity.find(
      (a) => a.$?.['android:name'] === '.OverlayActivity',
    );
    if (!overlay) {
      app.activity.push({
        $: {
          'android:name': '.OverlayActivity',
          'android:exported': 'false',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        },
      });
    }

    // Inject the Picovoice AccessKey as manifest meta-data so the native
    // service can read it at runtime without any JS bridge. Set
    // PICOVOICE_ACCESS_KEY in frontend/.env and re-run `expo prebuild`.
    app['meta-data'] = app['meta-data'] || [];
    const metaKey = 'com.hellosara.PICOVOICE_ACCESS_KEY';
    const existingMeta = app['meta-data'].find((m) => m.$?.['android:name'] === metaKey);
    const accessKey = process.env.PICOVOICE_ACCESS_KEY || '';
    if (existingMeta) {
      existingMeta.$['android:value'] = accessKey;
    } else {
      app['meta-data'].push({ $: { 'android:name': metaKey, 'android:value': accessKey } });
    }

    return cfg;
  });
}

// Copies WakeWordService.kt / OverlayActivity.kt into the generated
// android/app/src/main/java/.../ folder, and hey_sara.ppn (if the app owner
// has dropped one in ./android/assets/) into the app's assets folder.
// Without this step the .kt files never participate in the Gradle build.
function copyNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot; // .../android
      const pluginDir = __dirname;

      const javaDir = path.join(projectRoot, 'app/src/main/java', ANDROID_PACKAGE_PATH);
      fs.mkdirSync(javaDir, { recursive: true });
      for (const file of ['WakeWordService.kt', 'OverlayActivity.kt']) {
        const src = path.join(pluginDir, 'android', file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(javaDir, file));
        }
      }

      const ppnSrc = path.join(pluginDir, 'android/assets/hey_sara.ppn');
      if (fs.existsSync(ppnSrc)) {
        const assetsDir = path.join(projectRoot, 'app/src/main/assets');
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.copyFileSync(ppnSrc, path.join(assetsDir, 'hey_sara.ppn'));
      }

      return cfg;
    },
  ]);
}

// Adds the Porcupine wake-word SDK as a Gradle dependency.
function addPorcupineDependency(config) {
  return withAppBuildGradle(config, (cfg) => {
    const marker = "implementation 'ai.picovoice:porcupine-android:";
    if (!cfg.modResults.contents.includes(marker)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {\n    implementation 'ai.picovoice:porcupine-android:3.0.2'`,
      );
    }
    return cfg;
  });
}

module.exports = function withHelloSaraNative(config) {
  return withPlugins(config, [
    addPermissions,
    addServiceAndActivity,
    addPorcupineDependency,
    copyNativeSources, // must run after manifest/gradle mods so files land in the finished project
  ]);
};
