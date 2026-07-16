import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BriefingApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { MicButton } from '@/src/components/MicButton';
import { SaraOrb } from '@/src/components/SaraOrb';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';

interface Brief {
  greeting: string;
  date: string;
  reminders_today: { reminder_id: string; title: string; remind_at: string }[];
  recent_memories: { memory_id: string; title: string }[];
  recent_conversations: { history_id: string; title: string }[];
  stats: { memories: number; conversations: number; notes: number };
}

const SHORTCUTS = [
  { key: 'chat',        icon: 'chatbubbles',       label: 'Chat',        path: '/chat' },
  { key: 'notes',       icon: 'document-text',     label: 'Notes',       path: '/notes' },
  { key: 'reminders',   icon: 'alarm',             label: 'Reminders',   path: '/reminders' },
  { key: 'tasks',       icon: 'checkbox',          label: 'Tasks',       path: '/tasks' },
  { key: 'device',      icon: 'phone-portrait',    label: 'Device',      path: '/device' },
  { key: 'automations', icon: 'git-branch',        label: 'Automations', path: '/automations' },
  { key: 'marketplace', icon: 'storefront',        label: 'Marketplace', path: '/marketplace' },
  { key: 'ocr',         icon: 'scan',              label: 'Scan',        path: '/ocr' },
  { key: 'briefing',    icon: 'analytics',         label: 'Briefing',    path: '/briefing' },
] as const;

export default function HomeScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const { user } = useAuth();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setBrief(await BriefingApi.get()); } catch {} finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const greetingWord = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="home-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header(spacing)}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
              {greetingWord}, {user?.name?.split(' ')[0] || 'friend'}
            </Text>
            <Text style={{ color: palette.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, marginTop: 4 }}>
              Hello, I&apos;m Sara
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={10}
            testID="home-settings-button"
            style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
            }}
          >
            <Ionicons name="settings-outline" size={20} color={palette.onSurface} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.brand} />}
        >
          <View style={{ alignItems: 'center', marginTop: spacing.md }}>
            <SaraOrb size={180} />
          </View>

          <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
            <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, textAlign: 'center' }}>
              How can I help you today?
            </Text>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, textAlign: 'center', marginTop: spacing.sm, maxWidth: 320, lineHeight: 22 }}>
              Tap the microphone to start talking, or use a shortcut below.
            </Text>
          </View>

          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <MicButton
              active={false}
              onPress={() => router.push({ pathname: '/chat', params: { autostart: '1' } })}
              testID="home-mic-button"
            />
          </View>

          {/* Shortcut grid — Phase 4/5/6 entry points */}
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.md }}>
              Quick actions
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}>
              {SHORTCUTS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => router.push(s.path as any)}
                  testID={`home-shortcut-${s.key}`}
                  style={{
                    width: 96, height: 96, padding: spacing.md,
                    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
                    backgroundColor: palette.surfaceSecondary,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
                    flexShrink: 0,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: palette.brandTertiary + '40',
                  }}>
                    <Ionicons name={s.icon as any} size={20} color={palette.brand} />
                  </View>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Live briefing preview */}
          {brief && (brief.reminders_today.length > 0 || brief.stats.memories + brief.stats.conversations + brief.stats.notes > 0) ? (
            <Pressable
              onPress={() => router.push('/briefing')}
              testID="home-briefing-card"
              style={{
                marginTop: spacing.xl, marginHorizontal: spacing.xl,
                padding: spacing.lg, borderRadius: radius.md,
                backgroundColor: palette.surfaceSecondary,
                borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
                gap: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="sunny" size={16} color={palette.brandSecondary} />
                <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, flex: 1 }}>
                  Your day at a glance
                </Text>
                <Ionicons name="chevron-forward" size={16} color={palette.onSurfaceTertiary} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Stat label="Memories" value={brief.stats.memories} />
                <Stat label="Chats" value={brief.stats.conversations} />
                <Stat label="Notes" value={brief.stats.notes} />
                <Stat label="Reminders" value={brief.reminders_today.length} />
              </View>
              {brief.reminders_today.slice(0, 2).map((r) => (
                <View key={r.reminder_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="alarm-outline" size={14} color={palette.brandSecondary} />
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, flex: 1 }} numberOfLines={1}>{r.title}</Text>
                  <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm }}>
                    {new Date(r.remind_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { palette, fontSize, fontWeight } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{value}</Text>
      <Text style={{ color: palette.onSurfaceSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = {
  header: (sp: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: sp.xl,
    paddingTop: sp.md,
    paddingBottom: sp.sm,
  }),
};
