import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

interface Perm {
  icon: any;
  title: string;
  description: string;
  phase: string;
}

const PERMS: Perm[] = [
  { icon: 'mic-outline', title: 'Microphone', description: 'Voice conversations with Sara.', phase: 'Phase 2' },
  { icon: 'location-outline', title: 'Location', description: 'Weather, nearby places, contextual reminders.', phase: 'Phase 4' },
  { icon: 'call-outline', title: 'Phone & SMS', description: 'Make calls and send messages by voice.', phase: 'Phase 4' },
  { icon: 'people-outline', title: 'Contacts', description: 'Find people to call, message, or remember.', phase: 'Phase 4' },
  { icon: 'calendar-outline', title: 'Calendar', description: 'Read and schedule events.', phase: 'Phase 5' },
  { icon: 'mail-outline', title: 'Email', description: 'Read, draft, and search email (with your approval).', phase: 'Phase 5' },
  { icon: 'camera-outline', title: 'Camera', description: 'Scan documents, receipts, QR codes.', phase: 'Phase 5' },
  { icon: 'notifications-outline', title: 'Notifications', description: 'Timely reminders and daily briefings.', phase: 'Phase 6' },
];

export default function PermissionsScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="permissions-screen">
      <AuroraBackground />
      <SettingsHeader title="Permissions" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }}>
          Sara asks for permissions only when needed. You can revoke them anytime from your device settings.
        </Text>
        {PERMS.map((p) => (
          <View
            key={p.title}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
              padding: spacing.lg, borderRadius: radius.md,
              backgroundColor: palette.surfaceSecondary,
              borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
              backgroundColor: palette.brandTertiary + '40',
            }}>
              <Ionicons name={p.icon} size={20} color={palette.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                {p.title}
              </Text>
              <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
                {p.description}
              </Text>
            </View>
            <Text style={{
              color: palette.onSurfaceTertiary, fontSize: fontSize.sm,
              backgroundColor: palette.surfaceTertiary, paddingHorizontal: spacing.sm, paddingVertical: 2,
              borderRadius: radius.sm,
            }}>
              {p.phase}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
