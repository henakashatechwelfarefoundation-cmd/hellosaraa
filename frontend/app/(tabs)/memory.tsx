import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemoriesApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { SearchBar } from '@/src/components/SearchBar';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface Memory {
  memory_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

const FILTERS = ['All', 'Personal', 'Work', 'Health', 'Ideas'] as const;

export default function MemoryScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const load = useCallback(async () => {
    setError(null);
    try {
      const tag = filter === 'All' ? undefined : filter.toLowerCase();
      const data = await MemoriesApi.list(query || undefined, tag);
      setItems(data);
    } catch (e: any) {
      setError(e?.detail || 'Failed to load memories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="memory-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.lg }}>
          <Text style={{ color: palette.onSurface, fontSize: fontSize.xxl, fontWeight: fontWeight.bold }}>
            Memory
          </Text>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search memories"
            testID="memory-search"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.xl }}
          >
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  testID={`memory-filter-${f.toLowerCase()}`}
                  style={{
                    height: 36,
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? palette.brand : palette.surfaceSecondary,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: active ? palette.brand : palette.border,
                    flexShrink: 0,
                  }}
                >
                  <Text style={{
                    color: active ? palette.onBrand : palette.onSurfaceSecondary,
                    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                  }}>
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ height: 100 }} />
            ))}
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="alert-circle-outline" title="Something went wrong" subtitle={error} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="sparkles-outline"
              title="Your memory is empty"
              subtitle="As you chat with Sara, she'll remember what matters to you. All memories stay on your account and can be deleted anytime."
              testID="memory-empty"
            />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(m) => m.memory_id}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140, gap: spacing.md }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />}
            renderItem={({ item }) => (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: palette.surfaceSecondary,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: palette.border,
                  gap: spacing.sm,
                }}
                testID={`memory-item-${item.memory_id}`}
              >
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={16} color={palette.brand} />
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, flex: 1 }}>
                    {item.title}
                  </Text>
                </View>
                <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }} numberOfLines={3}>
                  {item.content}
                </Text>
                {item.tags?.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                    {item.tags.map((t) => (
                      <Text key={t} style={{
                        color: palette.brand, fontSize: fontSize.sm,
                        backgroundColor: palette.brandTertiary + '30',
                        paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm,
                      }}>
                        {t}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
