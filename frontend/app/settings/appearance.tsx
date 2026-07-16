import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';
import { ThemeName } from '@/src/theme/palettes';

const OPTIONS: { key: ThemeName; label: string; description: string; icon: any }[] = [
  { key: 'dark', label: 'Dark', description: 'Deep neutrals with brand glow.', icon: 'moon-outline' },
  { key: 'amoled', label: 'AMOLED', description: 'True-black for OLED battery savings.', icon: 'contrast-outline' },
  { key: 'light', label: 'Light', description: 'Clean daylight surfaces.', icon: 'sunny-outline' },
];

export default function AppearanceScreen() {
  const { palette, spacing, fontSize, fontWeight, radius, themeName, setTheme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="appearance-screen">
      <AuroraBackground />
      <SettingsHeader title="Appearance" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
          Pick a theme. AMOLED is identical to Dark but uses pure black surfaces to save battery on OLED screens.
        </Text>
        {OPTIONS.map((o) => {
          const active = themeName === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setTheme(o.key)}
              testID={`theme-option-${o.key}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
                padding: spacing.lg, borderRadius: radius.lg,
                backgroundColor: palette.surfaceSecondary,
                borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                borderColor: active ? palette.brand : palette.border,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
                backgroundColor: palette.brandTertiary + '40',
              }}>
                <Ionicons name={o.icon} size={22} color={palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                  {o.label}
                </Text>
                <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
                  {o.description}
                </Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={palette.brand} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
