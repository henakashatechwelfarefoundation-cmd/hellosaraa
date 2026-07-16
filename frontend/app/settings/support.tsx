import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SectionRow } from '@/src/components/SectionRow';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

export default function SupportScreen() {
  const { palette, spacing, fontSize, radius } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="support-screen">
      <AuroraBackground />
      <SettingsHeader title="Support" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
          We are here to help. Reach out any time.
        </Text>
        <View style={{
          borderRadius: radius.lg, overflow: 'hidden',
          backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
        }}>
          <SectionRow
            icon="mail-outline"
            title="Email support"
            subtitle="support@hellosara.app"
            onPress={() => Linking.openURL('mailto:support@hellosara.app')}
            testID="support-email"
          />
          <SectionRow
            icon="chatbubble-ellipses-outline"
            title="Feedback"
            subtitle="Tell us what to build next"
            onPress={() => Linking.openURL('mailto:feedback@hellosara.app')}
            testID="support-feedback"
          />
          <SectionRow
            icon="bug-outline"
            title="Report a bug"
            subtitle="We'll get it fixed"
            onPress={() => Linking.openURL('mailto:bugs@hellosara.app')}
            testID="support-bug"
          />
        </View>
      </ScrollView>
    </View>
  );
}
