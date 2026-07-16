/**
 * Voice service — thin, model-agnostic wrapper around device STT + TTS.
 *
 * STT: expo-speech-recognition (open-source on-device recognition).
 * TTS: expo-speech (native platform TTS).
 *
 * Graceful fallback: if STT modules are missing (Expo Go without config plugin),
 * the caller can detect via `isRecognitionSupported()` and switch to text input.
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// expo-speech-recognition is a config-plugin module. In Expo Go it may be
// unavailable at runtime; wrap the import so this file never blows up.
let ESR: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ESR = require('expo-speech-recognition');
} catch {
  ESR = null;
}

export interface VoiceRecognizerCallbacks {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onStateChange?: (state: 'idle' | 'listening' | 'stopping') => void;
}

export function isRecognitionSupported(): boolean {
  if (!ESR) return false;
  // On web the native module is not present.
  if (Platform.OS === 'web') return false;
  return typeof ESR.ExpoSpeechRecognitionModule?.start === 'function';
}

export async function requestPermissions(): Promise<boolean> {
  if (!isRecognitionSupported()) return false;
  try {
    const res = await ESR.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return !!res?.granted;
  } catch {
    return false;
  }
}

/**
 * Start listening. Returns a `stop` function. All state changes go through cb.
 * Safe to call even if unsupported — will trigger onError and return a noop.
 */
export async function startRecognition(
  cb: VoiceRecognizerCallbacks,
  opts: { lang?: string; interim?: boolean } = {},
): Promise<() => void> {
  if (!isRecognitionSupported()) {
    cb.onError?.('Voice recognition is not available in this build.');
    return () => {};
  }

  const granted = await requestPermissions();
  if (!granted) {
    cb.onError?.('Microphone permission was denied.');
    return () => {};
  }

  const module = ESR.ExpoSpeechRecognitionModule;
  const listeners: { remove(): void }[] = [];

  const sub = (event: string, handler: (e: any) => void) => {
    const l = ESR.addSpeechRecognitionListener?.(event, handler);
    if (l?.remove) listeners.push(l);
  };

  sub('result', (e: any) => {
    const results = e?.results;
    if (!results?.length) return;
    const text = results.map((r: any) => r.transcript || '').join(' ').trim();
    if (!text) return;
    if (e.isFinal) cb.onFinal(text);
    else cb.onPartial?.(text);
  });
  sub('error', (e: any) => {
    cb.onError?.(e?.message || 'Recognition error');
  });
  sub('end', () => {
    cb.onStateChange?.('idle');
  });
  sub('start', () => {
    cb.onStateChange?.('listening');
  });

  try {
    await module.start({
      lang: opts.lang || 'en-US',
      interimResults: !!opts.interim,
      continuous: false,
    });
  } catch (e: any) {
    cb.onError?.(e?.message || 'Failed to start recognition');
  }

  return () => {
    try { module.stop(); } catch {}
    for (const l of listeners) l.remove();
  };
}

// ---- TTS ----
export interface SpeakOptions {
  language?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onDone?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!text) return;
  Speech.speak(text, {
    language: opts.language || 'en-US',
    rate: opts.rate ?? 1.0,
    pitch: opts.pitch ?? 1.0,
    onStart: opts.onStart,
    onDone: opts.onDone,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
