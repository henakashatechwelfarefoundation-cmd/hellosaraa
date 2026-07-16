import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HistoryApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { SearchBar } from '@/src/components/SearchBar';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface HistoryItem {
  history_id: string;
  title: string;
  snippet: string;
  turns: number;
  created_at: string;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await HistoryApi.list(query || undefined);
      setItems(data);
    } catch (e: any) {
      setError(e?.detail || 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => {
    const grouped: Record<string, HistoryItem[]> = {};
    for (const it of items) {
      const key = formatDay(it.created_at);
      (grouped[key] ||= []).push(it);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="history-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.lg }}>
          <Text style={{ color: palette.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.bold }}>
            History
          </Text>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search conversations"
            testID="history-search"
          />
        </View>

        {loading ? (
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} style={{ height: 74 }} />
            ))}
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="alert-circle-outline" title="Something went wrong" subtitle={error} />
          </View>
        ) : sections.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="time-outline"
              title="No conversations yet"
              subtitle="Every chat with Sara will appear here. You can review, search, or clear them anytime."
              testID="history-empty"
            />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.history_id}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140, gap: spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.brand} />}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={{
                color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                letterSpacing: 0.5, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm,
              }}>
                {title}
              </Text>
            )}
            renderItem={({ item }) => (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: palette.surfaceSecondary,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: palette.border,
                  flexDirection: 'row',
                  gap: spacing.md,
                  alignItems: 'center',
                }}
                testID={`history-item-${item.history_id}`}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 20, backgroundColor: palette.brandTertiary + '40',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="chatbubbles" size={18} color={palette.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }} numberOfLines={1}>
                    {item.snippet}
                  </Text>
                </View>
                <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm }}>
                  {item.turns}·turns
                </Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
