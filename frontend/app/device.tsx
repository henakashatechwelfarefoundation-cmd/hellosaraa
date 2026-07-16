import { Ionicons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeviceApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { DeviceStatusBar } from '@/src/components/DeviceStatusBar';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';
import { useTorch } from '@/src/voice/useTorch';

/**
 * Device Control (Phase 4).
 *
 * Real, working actions:
 *   - "Call" / "SMS" / "Email" / "WhatsApp" -> Linking intents
 *   - Flashlight on/off                     -> useTorch (expo-camera torch)
 *   - Brightness up/down                    -> expo-brightness
 *   - Wi-Fi / Bluetooth / DND               -> opens the matching Android
 *     system-settings screen. Android does not let a normal third-party app
 *     flip these switches directly (no Google-approved public API for it
 *     without Device Admin/Accessibility) — this is the closest real action:
 *     one tap gets the user to the exact right toggle instead of nothing.
 *
 * Still genuinely unavailable on a normal build: volume control (no
 * library for it in this project yet) and true screen lock (requires a
 * Device Admin native module) — both still log the intent and say so.
 */

interface Action {
  key: string;
  icon: any;
  label: string;
  category: 'communication' | 'device' | 'alarm';
  execute?: () => void | Promise<void>;
  requiresNative?: boolean;
}

export default function DeviceControlScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const { controller: torch, PortalNode } = useTorch();

  useEffect(() => {
    Brightness.requestPermissionsAsync().catch(() => {});
  }, []);

  const log = async (action: string, status: string, payload: object = {}) => {
    try { await DeviceApi.logCommand({ action, payload, status }); } catch {}
  };

  const openLink = async (url: string, action: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        await log(action, 'executed', { url });
      } else {
        await log(action, 'unsupported', { url });
        Alert.alert('Not supported', 'Your device cannot open this link.');
      }
    } catch {
      await log(action, 'failed', { url });
    }
  };

  const stub = async (action: string, label: string) => {
    setBusy(action);
    await log(action, 'unsupported');
    setTimeout(() => setBusy(null), 400);
    Alert.alert(
      'Requires native build',
      `"${label}" needs a development build to execute on your device. The intent has been logged.`,
    );
  };

  // Real alarm/timer via Android's built-in AlarmClock intents — opens the
  // Clock app's native "set alarm"/"set timer" screen. No extra permission
  // beyond what's already declared, and no third-party app required.
  const setAlarm = async () => {
    if (Platform.OS !== 'android') return stub('alarm_set', 'Set alarm');
    setBusy('alarm_set');
    try {
      await Linking.sendIntent('android.intent.action.SET_ALARM', [
        { key: 'android.intent.extra.alarm.SKIP_UI', value: 'false' },
      ]);
      await log('alarm_set', 'executed');
    } catch {
      await log('alarm_set', 'failed');
      Alert.alert('Could not open alarm', 'Your device does not support this action.');
    } finally {
      setBusy(null);
    }
  };

  const setTimer = async () => {
    if (Platform.OS !== 'android') return stub('timer_set', 'Set timer');
    setBusy('timer_set');
    try {
      await Linking.sendIntent('android.intent.action.SET_TIMER', [
        { key: 'android.intent.extra.alarm.SKIP_UI', value: 'false' },
      ]);
      await log('timer_set', 'executed');
    } catch {
      await log('timer_set', 'failed');
      Alert.alert('Could not open timer', 'Your device does not support this action.');
    } finally {
      setBusy(null);
    }
  };

  const setFlashlight = async (on: boolean) => {
    const action = on ? 'flashlight_on' : 'flashlight_off';
    setBusy(action);
    try {
      torch.setOn(on);
      await log(action, 'executed');
    } catch {
      await log(action, 'failed');
      Alert.alert('Could not control flashlight', 'Camera permission is needed for the flashlight.');
    } finally {
      setBusy(null);
    }
  };

  const adjustBrightness = async (direction: 'up' | 'down') => {
    const action = direction === 'up' ? 'brightness_up' : 'brightness_down';
    setBusy(action);
    try {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status !== 'granted') {
        await log(action, 'unsupported');
        Alert.alert('Permission needed', 'Allow brightness control in system settings to use this.');
        return;
      }
      const current = await Brightness.getBrightnessAsync();
      const next = Math.min(1, Math.max(0, current + (direction === 'up' ? 0.15 : -0.15)));
      await Brightness.setBrightnessAsync(next);
      await log(action, 'executed', { value: next });
    } catch {
      await log(action, 'failed');
    } finally {
      setBusy(null);
    }
  };

  // Android blocks third-party apps from silently flipping Wi-Fi/Bluetooth/DND
  // (no public API for it without Device Admin/Accessibility permissions —
  // Google itself doesn't allow it). The closest real, honest action is
  // jumping straight to the right system-settings screen.
  const openSystemSettings = async (action: 'wifi_toggle' | 'bluetooth_toggle' | 'dnd_toggle') => {
    setBusy(action);
    try {
      if (Platform.OS === 'android') {
        const activity = action === 'wifi_toggle'
          ? 'android.settings.WIFI_SETTINGS'
          : action === 'bluetooth_toggle'
            ? 'android.settings.BLUETOOTH_SETTINGS'
            : 'android.settings.ZEN_MODE_SETTINGS';
        await IntentLauncher.startActivityAsync(activity);
        await log(action, 'executed');
      } else {
        await Linking.openSettings();
        await log(action, 'executed');
      }
    } catch {
      await log(action, 'failed');
      Alert.alert('Could not open settings', 'Your device does not support this action.');
    } finally {
      setBusy(null);
    }
  };

  const ACTIONS: Action[] = [
    { key: 'call', icon: 'call', label: 'Call someone', category: 'communication', execute: () => openLink('tel:', 'call') },
    { key: 'sms', icon: 'chatbubble', label: 'Send SMS', category: 'communication', execute: () => openLink('sms:', 'sms') },
    { key: 'email', icon: 'mail', label: 'Send email', category: 'communication', execute: () => openLink('mailto:', 'email') },
    { key: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', category: 'communication', execute: () => openLink('whatsapp://send?text=', 'whatsapp') },
    { key: 'flashlight_on', icon: 'flashlight', label: 'Flashlight on', category: 'device', execute: () => setFlashlight(true) },
    { key: 'flashlight_off', icon: 'flashlight-outline' as any, label: 'Flashlight off', category: 'device', execute: () => setFlashlight(false) },
    { key: 'brightness_up', icon: 'sunny', label: 'Brightness up', category: 'device', execute: () => adjustBrightness('up') },
    { key: 'brightness_down', icon: 'moon', label: 'Brightness down', category: 'device', execute: () => adjustBrightness('down') },
    { key: 'volume_up', icon: 'volume-high', label: 'Volume up', category: 'device', requiresNative: true },
    { key: 'volume_down', icon: 'volume-low', label: 'Volume down', category: 'device', requiresNative: true },
    { key: 'volume_mute', icon: 'volume-mute', label: 'Mute', category: 'device', requiresNative: true },
    { key: 'wifi_toggle', icon: 'wifi', label: 'Wi-Fi settings', category: 'device', execute: () => openSystemSettings('wifi_toggle') },
    { key: 'bluetooth_toggle', icon: 'bluetooth', label: 'Bluetooth settings', category: 'device', execute: () => openSystemSettings('bluetooth_toggle') },
    { key: 'alarm_set', icon: 'alarm', label: 'Set alarm', category: 'alarm', execute: setAlarm },
    { key: 'timer_set', icon: 'timer', label: 'Set timer', category: 'alarm', execute: setTimer },
    { key: 'dnd_toggle', icon: 'moon-outline', label: 'Do Not Disturb settings', category: 'device', execute: () => openSystemSettings('dnd_toggle') },
    { key: 'lock_screen', icon: 'lock-closed', label: 'Lock screen', category: 'device', requiresNative: true },
  ];

  const grouped: Record<string, Action[]> = { communication: [], device: [], alarm: [] };
  for (const a of ACTIONS) grouped[a.category].push(a);
  const groupTitles: Record<string, string> = {
    communication: 'Communication',
    device: 'Device Controls',
    alarm: 'Alarms & Timers',
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="device-screen">
      <AuroraBackground />
      <PortalNode />
      <SettingsHeader title="Device Control" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: 100 }}>
        <DeviceStatusBar />
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }}>
          Trigger phone controls by tap or by voice. A few actions (volume, true screen lock) still
          need a native module that doesn't exist here yet — those log the intent and say so.
        </Text>

        {Object.entries(grouped).map(([cat, list]) => (
          <View key={cat} style={{ gap: spacing.sm }}>
            <Text style={{
              color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
              letterSpacing: 0.5, textTransform: 'uppercase', marginLeft: spacing.sm,
            }}>
              {groupTitles[cat]}
            </Text>
            <View style={{
              flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
            }}>
              {list.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => (a.execute ? a.execute() : stub(a.key, a.label))}
                  disabled={busy === a.key}
                  testID={`device-action-${a.key}`}
                  style={{
                    width: '47%', padding: spacing.lg, borderRadius: radius.md,
                    backgroundColor: palette.surfaceSecondary,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
                    gap: spacing.sm,
                    opacity: busy === a.key ? 0.6 : 1,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: palette.brandTertiary + '40',
                  }}>
                    <Ionicons name={a.icon} size={20} color={palette.brand} />
                  </View>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                    {a.label}
                  </Text>
                  {a.requiresNative ? (
                    <Text style={{
                      color: palette.onSurfaceTertiary, fontSize: 10, fontWeight: fontWeight.medium,
                      backgroundColor: palette.surfaceTertiary,
                      alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                    }}>
                      Needs native build
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
