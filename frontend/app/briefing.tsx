import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BriefingApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SaraOrb } from '@/src/components/SaraOrb';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface Briefing {
  greeting: string;
  date: string;
  reminders_today: { reminder_id: string; title: string; remind_at: string }[];
  recent_memories: { memory_id: string; title: string }[];
  recent_conversations: { history_id: string; title: string; created_at: string }[];
  stats: { memories: number; conversations: number; notes: number };
}

export default function BriefingScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await BriefingApi.get()); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="briefing-screen">
      <AuroraBackground />
      <SettingsHeader title="Daily Briefing" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.brand} />}
      >
        {loading || !data ? (
          <>
            <Skeleton style={{ height: 120 }} />
            <Skeleton style={{ height: 200 }} />
            <Skeleton style={{ height: 200 }} />
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
              <SaraOrb size={110} />
              <Text style={{ color: palette.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' }}>
                {data.greeting}
              </Text>
              <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>{data.date}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {[
                { label: 'Memories', value: data.stats.memories, icon: 'sparkles' as const },
                { label: 'Chats', value: data.stats.conversations, icon: 'chatbubbles' as const },
                { label: 'Notes', value: data.stats.notes, icon: 'document-text' as const },
              ].map((s) => (
                <View key={s.label} style={{
                  flex: 1, padding: spacing.lg, borderRadius: radius.md,
                  backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
                  alignItems: 'center', gap: spacing.xs,
                }}>
                  <Ionicons name={s.icon} size={20} color={palette.brand} />
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{s.value}</Text>
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm }}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Section title="Reminders next 24h" icon="alarm">
              {data.reminders_today.length === 0 ? (
                <Empty text="Nothing urgent. Take a breath." />
              ) : data.reminders_today.map((r) => (
                <Row key={r.reminder_id} icon="alarm-outline" title={r.title}
                  subtitle={new Date(r.remind_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} />
              ))}
            </Section>

            <Section title="Recent memories" icon="sparkles">
              {data.recent_memories.length === 0 ? (
                <Empty text="Sara hasn't stored anything yet." />
              ) : data.recent_memories.map((m) => (
                <Row key={m.memory_id} icon="sparkles-outline" title={m.title} />
              ))}
            </Section>

            <Section title="Recent chats" icon="chatbubbles" onPressAll={() => router.push('/(tabs)/history')}>
              {data.recent_conversations.length === 0 ? (
                <Empty text="Start a conversation from Home." />
              ) : data.recent_conversations.map((h) => (
                <Row key={h.history_id} icon="chatbubbles-outline" title={h.title}
                  subtitle={new Date(h.created_at).toLocaleDateString()} />
              ))}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, icon, children, onPressAll }: any) {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name={icon} size={16} color={palette.brand} />
        <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, flex: 1 }}>{title}</Text>
        {onPressAll ? (
          <Text onPress={onPressAll} style={{ color: palette.brand, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>See all</Text>
        ) : null}
      </View>
      <View style={{
        borderRadius: radius.md, overflow: 'hidden',
        backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
      }}>
        {children}
      </View>
    </View>
  );
}

function Row({ icon, title, subtitle }: any) {
  const { palette, spacing, fontSize } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.divider,
    }}>
      <Ionicons name={icon} size={18} color={palette.brandSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.onSurface, fontSize: fontSize.base }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { palette, spacing, fontSize } = useTheme();
  return (
    <View style={{ padding: spacing.lg }}>
      <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, fontStyle: 'italic' }}>{text}</Text>
    </View>
  );
}
