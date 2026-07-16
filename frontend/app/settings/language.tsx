import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProfileApi, SettingsApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
];

export default function LanguageScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [lang, setLang] = useState('en');

  useEffect(() => {
    SettingsApi.get().then((s) => setLang(s.language)).catch(() => {});
  }, []);

  const choose = async (code: string) => {
    setLang(code);
    try {
      await SettingsApi.update({ language: code });
      await ProfileApi.update({ language: code });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="language-screen">
      <AuroraBackground />
      <SettingsHeader title="Language" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        {LANGS.map((l) => {
          const active = lang === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => choose(l.code)}
              testID={`language-option-${l.code}`}
              style={{
                flexDirection: 'row', alignItems: 'center',
                padding: spacing.lg, borderRadius: radius.md,
                backgroundColor: palette.surfaceSecondary,
                borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                borderColor: active ? palette.brand : palette.border,
              }}
            >
              <Text style={{ flex: 1, color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium }}>
                {l.label}
              </Text>
              {active ? <Ionicons name="checkmark-circle" size={22} color={palette.brand} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
