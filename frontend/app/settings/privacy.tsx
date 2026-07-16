import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

const SECTIONS: { title: string; body: string }[] = [
  { title: 'What we collect', body: 'Hello Sara stores your account (name, email, profile picture), your preferences, and any conversations, memories, or reminders you create. Nothing is sold or shared with third-party ad networks — ever.' },
  { title: 'Conversations & Memory', body: 'When enabled, Sara stores your chat history and derived memories on your account so she can remember what matters to you. You can delete individual items or wipe everything from Settings.' },
  { title: 'Reminders', body: 'Reminders you set are stored on your account and only used to notify you at the requested time.' },
  { title: 'Location', body: 'Location is used only when you explicitly ask Sara about places, weather, or contextual reminders. It is not tracked in the background.' },
  { title: 'Email authorization', body: 'If you connect email, Sara accesses it only when you ask her to search, summarize, or send. You can revoke access from your provider at any time.' },
  { title: 'Contacts & Phone', body: 'Contacts are used to help Sara find people to call or message. Phone control commands are dispatched via your device APIs after your explicit confirmation.' },
  { title: 'Camera & Microphone', body: 'Camera runs only during scanning; microphone runs only during voice interaction. Neither is used for passive recording.' },
  { title: 'Web search', body: 'When you ask Sara to search the web, your query is sent to the search provider you have configured. Sara does not send private context unless you enable it.' },
  { title: 'AI processing', body: 'Sara is model-agnostic and connects only to open-source AI providers you configure (Ollama, llama.cpp, vLLM, LM Studio, OpenRouter). No conversation data is sent to closed AI providers by default.' },
  { title: 'Your controls', body: 'You can disable memory, clear history, revoke permissions, or delete your account at any time. When you delete your account, all associated data is removed within 30 days.' },
];

export default function PrivacyScreen() {
  const { palette, spacing, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="privacy-screen">
      <AuroraBackground />
      <SettingsHeader title="Privacy Policy" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 }}>
          Last updated: July 2026 · Hello Sara Phase 1 Foundation
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
