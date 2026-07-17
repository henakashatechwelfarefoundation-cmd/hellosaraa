# Hello Sara — Native Android Module (Wake-word + System Overlay)

This folder is an Expo **config plugin** scaffold. It doesn't run in Expo Go —
after adding it you must build a native dev/prod client.

## What it adds
- Permissions: `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE(_MICROPHONE)`,
  `RECORD_AUDIO`, `WAKE_LOCK`, `POST_NOTIFICATIONS`.
- Foreground `WakeWordService` — keeps the mic hot for a wake-word
  ("Hello Sara" / "Hey Sara"), detected fully on-device via OpenWakeWord's
  ONNX pipeline (ONNX Runtime for Android). No license key, no cloud calls.
- `OverlayActivity` — always-on-top mic bubble that follows the user across
  other apps and deep-links back into `/chat?autostart=1` on tap.

## How to enable
1. Add the plugin to `app.json` (already added in this project).
2. Get the 3 ONNX model files and place them in
   `frontend/plugins/hello-sara-native/android/assets/`:
   - `melspectrogram.onnx` and `embedding_model.onnx` — shared files, same
     for every wake word, no training needed. Download directly:
     https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/melspectrogram.onnx
     https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/embedding_model.onnx
   - `hey_sara.onnx` — the only custom part. Train it with OpenWakeWord's
     training pipeline (https://github.com/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb),
     which synthesizes training clips via TTS + augmentation — no manual
     audio recording required. Export to ONNX and save it here.
3. Build:
   ```bash
   npx expo prebuild --clean
   eas build --profile development --platform android
   ```
   The plugin automatically: copies `WakeWordService.kt` /
   `OverlayActivity.kt` into the generated project, adds the ONNX Runtime
   Android Gradle dependency, and copies the 3 `.onnx` files into the app's
   assets.
4. On first launch, the app prompts for "Display over other apps" and
   microphone permission. Once granted, saying "Hello Sara" or "Hey Sara"
   from anywhere launches `frontend://chat?autostart=1` — the same trigger
   as before, which the rest of the app (speech recognition auto-start,
   command router, AI, TTS) already handles unchanged.

## Tuning
In `WakeWordService.kt`:
- `DETECTION_THRESHOLD` (default 0.5) — raise it if you get false triggers,
  lower it if it's not catching real "Hello Sara" calls.
- `HITS_TO_TRIGGER` (default 2) — how many consecutive high-confidence
  80ms frames are needed before firing, a debounce against one-off spikes.
- `COOLDOWN_MS` (default 3000) — minimum gap between two triggers.

## Still a real limitation
This is genuinely untestable without a physical Android device, a real
build, and your trained `hey_sara.onnx` — I've implemented OpenWakeWord's
documented pipeline shapes faithfully, but exact tensor input/output names
can shift slightly between ONNX export versions. If inference throws a
shape-mismatch error, check `melSession.inputNames` / `embedSession.inputNames`
against what your specific exported models expect — only the three small
`extract...()` helpers at the bottom of `WakeWordService.kt` would need
adjusting, nothing else in the pipeline.

## Why not shipped inside Expo Go?
Expo Go is a shared client — it cannot host custom native code. Every part of
this feature (foreground mic, ONNX Runtime, TYPE_APPLICATION_OVERLAY window)
requires the real APK from your Expo account. Everything else in Hello Sara
already works in Expo Go.
