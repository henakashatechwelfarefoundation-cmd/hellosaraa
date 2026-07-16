import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutomationsApi, MarketplaceApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SearchBar } from '@/src/components/SearchBar';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface MPItem {
  marketplace_id: string;
  name: string;
  description: string;
  trigger: string;
  steps: { action: string }[];
  icon: string;
  tags: string[];
  author_name: string;
  installs: number;
  likes: number;
}

interface OwnWorkflow {
  workflow_id: string;
  name: string;
}

export default function MarketplaceScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<MPItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [own, setOwn] = useState<OwnWorkflow[]>([]);
  const [selectedWfId, setSelectedWfId] = useState<string>('');
  const [desc, setDesc] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await MarketplaceApi.list(query || undefined)); }
    catch {} finally { setLoading(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const openPublish = async () => {
    try {
      const wfs = await AutomationsApi.list();
      setOwn(wfs.map((w: any) => ({ workflow_id: w.workflow_id, name: w.name })));
      setSelectedWfId(wfs[0]?.workflow_id || '');
    } catch {}
    setShowPublish(true);
  };

  const install = async (item: MPItem) => {
    setInstallingId(item.marketplace_id);
    try {
      await MarketplaceApi.install(item.marketplace_id);
      setStatus(`Installed "${item.name}" — say "${item.trigger.replace('voice:', '')}" to run it.`);
      await load();
    } catch (e: any) {
      setStatus(e?.detail || 'Install failed');
    } finally {
      setInstallingId(null);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const like = async (item: MPItem) => {
    try { await MarketplaceApi.like(item.marketplace_id); await load(); } catch {}
  };

  const publish = async () => {
    if (!selectedWfId || !desc.trim()) return;
    setPublishing(true);
    try {
      const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      await MarketplaceApi.publish({ workflow_id: selectedWfId, description: desc.trim(), tags });
      setShowPublish(false); setDesc(''); setTagsText('');
      setStatus('Published to marketplace 🎉');
      await load();
    } catch (e: any) {
      setStatus(e?.detail || 'Publish failed');
    } finally {
      setPublishing(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="marketplace-screen">
      <AuroraBackground />
      <SettingsHeader
        title="Marketplace"
        rightAccessory={
          <Pressable onPress={openPublish} hitSlop={10} testID="marketplace-publish-button"
            style={{
              paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill,
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: palette.brand,
            }}>
            <Ionicons name="cloud-upload" size={14} color={palette.onBrand} />
            <Text style={{ color: palette.onBrand, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Publish</Text>
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search automations" testID="marketplace-search" />
      </View>

      {status ? (
        <View style={{
          marginHorizontal: spacing.xl, marginBottom: spacing.sm,
          padding: spacing.md, borderRadius: radius.md,
          backgroundColor: palette.brandTertiary + '30', borderWidth: 1, borderColor: palette.brand,
        }}>
          <Text style={{ color: palette.brand, fontSize: fontSize.sm }}>{status}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[1,2,3].map((i) => <Skeleton key={i} style={{ height: 130 }} />)}
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="cloud-outline"
            title="Nothing here yet"
            subtitle="Be the first to publish an automation!"
            testID="marketplace-empty"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 120 }}>
          {items.map((item) => (
            <View
              key={item.marketplace_id}
              testID={`mp-item-${item.marketplace_id}`}
              style={{
                padding: spacing.lg, borderRadius: radius.md, gap: spacing.md,
                backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
              }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View style={{
                  width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: palette.brandTertiary + '55',
                }}>
                  <Ionicons name={item.icon as any} size={22} color={palette.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>{item.name}</Text>
                  <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 }}>
                    by {item.author_name} · {item.installs} installs
                  </Text>
                </View>
                <Pressable onPress={() => like(item)} hitSlop={8} testID={`mp-like-${item.marketplace_id}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="heart" size={16} color={palette.brandSecondary} />
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm }}>{item.likes}</Text>
                </Pressable>
              </View>
              <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }}>
                {item.description}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                <Text style={{
                  color: palette.brand, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                  backgroundColor: palette.brandTertiary + '30',
                  paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm,
                }}>
                  {item.trigger}
                </Text>
                {item.steps.map((s, i) => (
                  <Text key={i} style={{
                    color: palette.onSurfaceSecondary, fontSize: fontSize.sm,
                    backgroundColor: palette.surfaceTertiary,
                    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm,
                  }}>
                    {s.action}
                  </Text>
                ))}
              </View>
              <PrimaryButton
                label={installingId === item.marketplace_id ? 'Installing…' : 'Install'}
                loading={installingId === item.marketplace_id}
                onPress={() => install(item)}
                testID={`mp-install-${item.marketplace_id}`}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showPublish} animationType="slide" transparent onRequestClose={() => setShowPublish(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl, maxHeight: '85%' }}>
              <SafeAreaView edges={['bottom']} style={{ gap: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>Publish automation</Text>
                  <Pressable onPress={() => setShowPublish(false)}><Ionicons name="close" size={24} color={palette.onSurface} /></Pressable>
                </View>
                {own.length === 0 ? (
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
                    You don&apos;t have any automations yet. Create one in Automations first.
                  </Text>
                ) : (
                  <>
                    <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
                      Which one?
                    </Text>
                    <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={{ gap: spacing.sm }}>
                      {own.map((w) => {
                        const active = selectedWfId === w.workflow_id;
                        return (
                          <Pressable
                            key={w.workflow_id}
                            onPress={() => setSelectedWfId(w.workflow_id)}
                            testID={`mp-publish-select-${w.workflow_id}`}
                            style={{
                              padding: spacing.md, borderRadius: radius.md,
                              backgroundColor: palette.surfaceSecondary,
                              borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                              borderColor: active ? palette.brand : palette.border,
                            }}
                          >
                            <Text style={{ color: palette.onSurface, fontSize: fontSize.base }}>{w.name}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <TextInput
                      value={desc} onChangeText={setDesc}
                      placeholder="What does it do? (users will read this)"
                      placeholderTextColor={palette.onSurfaceTertiary} multiline
                      style={{
                        color: palette.onSurface, fontSize: fontSize.base, minHeight: 80, textAlignVertical: 'top',
                        padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                      }}
                      testID="mp-publish-description"
                    />
                    <TextInput
                      value={tagsText} onChangeText={setTagsText}
                      placeholder="Tags (comma separated: focus, morning, night)"
                      placeholderTextColor={palette.onSurfaceTertiary}
                      autoCapitalize="none"
                      style={{
                        color: palette.onSurface, fontSize: fontSize.base,
                        padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                      }}
                      testID="mp-publish-tags"
                    />
                    <PrimaryButton label="Publish" loading={publishing} onPress={publish} testID="mp-publish-submit" />
                  </>
                )}
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
