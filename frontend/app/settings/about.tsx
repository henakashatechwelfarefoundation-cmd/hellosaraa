import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SaraOrb } from '@/src/components/SaraOrb';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

export default function AboutScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="about-screen">
      <AuroraBackground />
      <SettingsHeader title="About" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl, alignItems: 'center' }}>
        <SaraOrb size={140} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: palette.onSurface, fontSize: fontSize.xxxl, fontWeight: fontWeight.bold }}>
            Hello Sara
          </Text>
          <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, marginTop: spacing.sm }}>
            Your personal AI companion
          </Text>
          <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: spacing.md }}>
            Version 1.0.0 · Phase 1 Foundation
          </Text>
        </View>
        <View style={{
          width: '100%', borderRadius: radius.lg,
          backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
          padding: spacing.lg, gap: spacing.md,
        }}>
          <Text style={{ color: palette.onSurface, fontSize: fontSize.base, lineHeight: 22 }}>
            Hello Sara is a private, model-agnostic AI companion. She works with your own open-source LLMs — no closed AI providers are involved.
          </Text>
          <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, lineHeight: 20 }}>
            This app is Phase 1 of an 8-phase roadmap. Voice, intelligence, productivity, personalization, and premium polish arrive in future updates without breaking your data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
