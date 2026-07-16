import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SectionRow } from '@/src/components/SectionRow';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

export default function VoiceScreen() {
  const { palette, spacing, fontSize, radius } = useTheme();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    SettingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const update = async (patch: Record<string, unknown>) => {
    setSettings((s: any) => ({ ...s, ...patch }));
    try { await SettingsApi.update(patch); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="voice-screen">
      <AuroraBackground />
      <SettingsHeader title="Voice" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
          Voice interaction options. Real speech recognition arrives in Phase 2 — these preferences are saved and applied then.
        </Text>
        <View style={{
          borderRadius: radius.lg, overflow: 'hidden',
          backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
        }}>
          <SectionRow
            icon="ear-outline"
            title="Wake word"
            subtitle="Trigger Sara hands-free"
            toggle={{ value: !!settings?.voice_wake_word_enabled, onChange: (v) => update({ voice_wake_word_enabled: v }) }}
            testID="voice-wakeword-toggle"
          />
          <SectionRow
            icon="volume-high-outline"
            title="Voice output"
            subtitle="Sara speaks her replies"
            toggle={{ value: !!settings?.voice_output_enabled, onChange: (v) => update({ voice_output_enabled: v }) }}
            testID="voice-output-toggle"
          />
          <SectionRow
            icon="pulse-outline"
            title="Haptics"
            subtitle="Feedback on interactions"
            toggle={{ value: !!settings?.haptics_enabled, onChange: (v) => update({ haptics_enabled: v }) }}
            testID="voice-haptics-toggle"
          />
        </View>
      </ScrollView>
    </View>
  );
}
