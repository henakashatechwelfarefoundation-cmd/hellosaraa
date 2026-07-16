import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

const SECTIONS = [
  { title: 'Acceptance', body: 'By using Hello Sara you agree to these terms. If you do not agree, please stop using the app.' },
  { title: 'Your consent', body: 'Sara only accesses features (microphone, calendar, contacts, phone, email, camera) after you explicitly grant permission. You may revoke any permission from your device settings at any time.' },
  { title: 'Memory & History', body: 'You can disable memory and history in Settings. Doing so pauses new writes and does not delete existing entries — use the "Clear all" action if you also want to erase past data.' },
  { title: 'Data ownership', body: 'You own your data. You may export or delete your account at any time. Deleting your account removes your data within 30 days.' },
  { title: 'Model-agnostic AI', body: 'Sara uses only the open-source AI providers you configure. We do not proxy your conversations through closed AI services.' },
  { title: 'Availability', body: 'The service is provided "as is" without warranties. We work hard to keep it reliable, but downtime, model errors, or misinterpretations can occur.' },
  { title: 'Limitation of liability', body: 'To the extent permitted by law, we are not liable for indirect damages resulting from your use of the app.' },
  { title: 'Changes', body: 'We may update these terms. You will be notified in-app the next time you sign in. Continued use means acceptance.' },
];

export default function TermsScreen() {
  const { palette, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="terms-screen">
      <AuroraBackground />
      <SettingsHeader title="Terms & Conditions" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
          Last updated: July 2026
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={{ gap: spacing.sm }}>
            <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
              {s.title}
            </Text>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 }}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
