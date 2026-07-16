import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AutomationsApi, ChatApi } from '@/src/api/client';
import { useTheme } from '@/src/theme/ThemeContext';
import { executeIntent, parseIntent } from '@/src/voice/commandRouter';
import { useTorch } from '@/src/voice/useTorch';
import {
  isRecognitionSupported, speak, startRecognition,
} from '@/src/voice/voice';
import { runWorkflow, WorkflowStep } from '@/src/voice/workflowRunner';

interface VoiceAutomation {
  workflow_id: string;
  name: string;
  phrase: string;
  steps: WorkflowStep[];
  enabled: boolean;
}

const HIDDEN_ON: string[] = ['/', '/auth', '/onboarding'];

export const FloatingAssistant: React.FC = () => {
  const { palette, radius, fontSize } = useTheme();
  const { controller: torch, PortalNode } = useTorch();
  const pathname = usePathname();
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [voiceAutomations, setVoiceAutomations] = useState<VoiceAutomation[]>([]);
  const stopRef = useRef<(() => void) | null>(null);

  const refreshAutomations = useCallback(async () => {
    try {
      const list = await AutomationsApi.list();
      const vs: VoiceAutomation[] = [];
      for (const w of list) {
        if (!w.enabled) continue;
        const t: string = w.trigger || '';
        if (t.toLowerCase().startsWith('voice:')) {
          vs.push({
            workflow_id: w.workflow_id,
            name: w.name,
            phrase: t.slice(6).trim().toLowerCase(),
            steps: w.steps || [],
            enabled: w.enabled,
          });
        }
      }
      setVoiceAutomations(vs);
    } catch {}
  }, []);

  useEffect(() => { refreshAutomations(); }, [refreshAutomations]);

  const scale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glow = useSharedValue(0);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.6,
    transform: [{ scale: 1 + glow.value * 0.35 }],
  }));

  useEffect(() => {
    glow.value = withTiming(listening ? 1 : 0, { duration: 400 });
  }, [listening, glow]);

  const handleChat = useCallback(async (text: string) => {
    setStatus('Thinking…');
    try {
      const res = await ChatApi.send([{ role: 'user', content: text }]);
      setStatus(res.reply.slice(0, 120));
      speak(res.reply);
    } catch (e: any) {
      setStatus(e?.detail || 'Could not reach your AI provider.');
    } finally {
      setTimeout(() => setStatus(null), 4000);
    }
  }, []);

  const run = useCallback(async (transcript: string) => {
    setStatus(`"${transcript}"`);
    const t = transcript.trim().toLowerCase();

    // 1) Voice-triggered automations get first dibs.
    const matched = voiceAutomations.find((a) => t === a.phrase || t.includes(a.phrase));
    if (matched) {
      setStatus(`Running "${matched.name}"…`);
      speak(`Running ${matched.name}.`);
      const { ran, skipped } = await runWorkflow(matched.steps, { torch, onChat: handleChat });
      setStatus(`${matched.name}: ${ran} step${ran === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}.`);
      setTimeout(() => setStatus(null), 3500);
      return;
    }

    // 2) Fall through to single-intent router.
    const intent = parseIntent(transcript);
    const res = await executeIntent(intent, { torch, onChat: handleChat });
    if (res.intent.type !== 'chat') {
      setStatus(res.message);
      setTimeout(() => setStatus(null), 3500);
    }
  }, [torch, handleChat, voiceAutomations]);

  const stopListening = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
    setPartial('');
  }, []);

  const startListening = useCallback(async () => {
    if (listening) return stopListening();
    setStatus(null);
    await refreshAutomations();
    if (!isRecognitionSupported()) {
      setStatus('Voice needs a native build. Opening Chat instead…');
      router.push({ pathname: '/chat', params: { autostart: '0' } });
      setTimeout(() => setStatus(null), 3500);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setListening(true);
    const stop = await startRecognition({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => { setPartial(''); setListening(false); run(t); },
      onError: (m) => { setStatus(m); setListening(false); setPartial(''); },
      onStateChange: (s) => { if (s === 'idle') setListening(false); },
    }, { interim: true, lang: 'en-US' });
    stopRef.current = stop;
  }, [listening, stopListening, run, refreshAutomations]);

  const onPressIn = () => { scale.value = withSpring(0.9); };
  const onPressOut = () => { scale.value = withSpring(1); };

  if (HIDDEN_ON.includes(pathname || '')) return null;

  return (
    <>
      <PortalNode />
      <View pointerEvents="box-none" style={styles.container}>
        {status || partial ? (
          <View style={[styles.bubble, { backgroundColor: palette.surfaceSecondary, borderColor: palette.border }]}>
            <Text style={{ color: palette.onSurface, fontSize: fontSize.sm }} numberOfLines={3}>
              {partial ? `“${partial}”` : status}
            </Text>
          </View>
        ) : null}
        <Animated.View style={[styles.glow, glowStyle, { backgroundColor: palette.brand, borderRadius: radius.pill }]} />
        <Animated.View style={buttonStyle}>
          <Pressable
            onPress={startListening}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            testID="floating-assistant-button"
            style={{
              width: 60, height: 60, borderRadius: 30, overflow: 'hidden',
              shadowColor: palette.brand, shadowOpacity: 0.6, shadowRadius: 18, elevation: 12,
            }}
          >
            <LinearGradient
              colors={[palette.brand, palette.brandSecondary]}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={listening ? 'stop' : 'mic'} size={26} color="#fff" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: Platform.select({ ios: 100, android: 90, default: 90 }),
    zIndex: 999,
    alignItems: 'flex-end',
    gap: 8,
  },
  bubble: {
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  glow: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 52,
    height: 52,
    opacity: 0.4,
  },
});
