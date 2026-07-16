import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SectionRow } from '@/src/components/SectionRow';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';

const SECTIONS: { key: string; title: string; rows: { icon: any; title: string; path: string }[] }[] = [
  {
    key: 'tools',
    title: 'Tools',
    rows: [
      { icon: 'chatbubbles-outline', title: 'Chat', path: '/chat' },
      { icon: 'document-text-outline', title: 'Notes', path: '/notes' },
      { icon: 'alarm-outline', title: 'Reminders', path: '/reminders' },
      { icon: 'git-branch-outline', title: 'Automations', path: '/automations' },
      { icon: 'storefront-outline', title: 'Marketplace', path: '/marketplace' },
      { icon: 'scan-outline', title: 'Scan & OCR', path: '/ocr' },
      { icon: 'phone-portrait-outline', title: 'Device Control', path: '/device' },
      { icon: 'analytics-outline', title: 'Daily Briefing', path: '/briefing' },
      { icon: 'link-outline', title: 'Integrations', path: '/settings/integrations' },
    ],
  },
  {
    key: 'preferences',
    title: 'Preferences',
    rows: [
      { icon: 'color-palette-outline', title: 'Appearance', path: '/settings/appearance' },
      { icon: 'mic-outline', title: 'Voice', path: '/settings/voice' },
      { icon: 'language-outline', title: 'Language', path: '/settings/language' },
      { icon: 'server-outline', title: 'AI Provider', path: '/settings/ai-provider' },
    ],
  },
  {
    key: 'privacy',
    title: 'Privacy & Permissions',
    rows: [
      { icon: 'shield-checkmark-outline', title: 'Permissions', path: '/settings/permissions' },
      { icon: 'lock-closed-outline', title: 'Privacy Policy', path: '/settings/privacy' },
      { icon: 'document-text-outline', title: 'Terms & Conditions', path: '/settings/terms' },
    ],
  },
  {
    key: 'about',
    title: 'About',
    rows: [
      { icon: 'information-circle-outline', title: 'About Hello Sara', path: '/settings/about' },
      { icon: 'help-buoy-outline', title: 'Support', path: '/settings/support' },
    ],
  },
];

export default function SettingsIndex() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="settings-screen">
      <AuroraBackground />
      <SettingsHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
          padding: spacing.lg, borderRadius: radius.lg,
          backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
        }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
            backgroundColor: palette.brandTertiary + '55',
          }}>
            <Text style={{ color: palette.brand, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
              {(user?.name?.[0] || 'S').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }} numberOfLines={1}>
              {user?.name || 'Guest'}
            </Text>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm }} numberOfLines={1}>
              {user?.email}
            </Text>
            <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 }}>
              Signed in via {user?.provider === 'google' ? 'Google' : 'Email'}
            </Text>
          </View>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.key} style={{ gap: spacing.sm }}>
            <Text style={{
              color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
              letterSpacing: 0.5, textTransform: 'uppercase', marginLeft: spacing.sm,
            }}>
              {section.title}
            </Text>
            <View style={{
              borderRadius: radius.lg, overflow: 'hidden',
              backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
            }}>
              {section.rows.map((r) => (
                <SectionRow
                  key={r.title}
                  icon={r.icon}
                  title={r.title}
                  onPress={() => router.push(r.path as any)}
                  testID={`settings-row-${r.title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                />
              ))}
            </View>
          </View>
        ))}

        <PrimaryButton
          label="Log out"
          variant="secondary"
          onPress={async () => { await logout(); router.replace('/auth'); }}
          testID="settings-logout-button"
        />
        <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: 'center' }}>
          Hello Sara · v1.0.0 · Phase 1 Foundation
        </Text>
      </ScrollView>
    </View>
  );
}
