# Hello Sara — Native Android Module (Wake-word + System Overlay)

This folder is an Expo **config plugin** scaffold. It doesn't run in Expo Go —
after adding it you must build a native dev/prod client.

## What it adds
- Permissions: `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE(_MICROPHONE)`,
  `RECORD_AUDIO`, `WAKE_LOCK`, `POST_NOTIFICATIONS`.
- Foreground `WakeWordService` — keeps the mic hot for a wake-word ("Hey Sara").
- `OverlayActivity` — always-on-top mic bubble that follows the user across
  other apps and deep-links back into `/chat?autostart=1` on tap.

## How to enable
1. Add the plugin to `app.json` (already added in this project).
2. Get a free AccessKey from https://console.picovoice.ai (no credit card),
   put it in `frontend/.env` as `PICOVOICE_ACCESS_KEY=...`.
3. On the same Picovoice Console, go to Porcupine → train a custom
   keyword → type "Hey Sara" → platform: Android → download the `.ppn`
   file. Save it as `frontend/plugins/hello-sara-native/android/assets/hey_sara.ppn`.
4. Build:
   ```bash
   npx expo prebuild --clean
   eas build --profile development --platform android
   ```
   The plugin now automatically: copies `WakeWordService.kt` /
   `OverlayActivity.kt` into the generated project (this step was missing
   before — those files never actually compiled), adds the Porcupine
   Gradle dependency, copies `hey_sara.ppn` into the app's assets, and
   injects your `PICOVOICE_ACCESS_KEY` into the manifest.
5. On first launch, the app prompts for "Display over other apps" and
   microphone permission. Once granted, saying "Hey Sara" from anywhere
   launches `frontend://chat?autostart=1`.

## Still a real limitation
This is genuinely untestable without a physical Android device and a real
build — I can write and reason about this code, but the actual accuracy of
wake-word detection (false positives/negatives, battery impact) can only
be judged by building and testing it yourself. Start with the default
sensitivity (0.6 in `WakeWordService.kt`) and adjust after trying it.

## Why not shipped inside Expo Go?
Expo Go is a shared client — it cannot host custom native code. Every part of
this feature (foreground mic, TYPE_APPLICATION_OVERLAY window, Kotlin service)
requires the real APK from your Expo account. Everything else in Hello Sara
already works in Expo Go.
