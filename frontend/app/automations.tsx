import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutomationsApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface Step { action: string; payload?: Record<string, unknown> }
interface Workflow {
  workflow_id: string;
  name: string;
  trigger: string;
  steps: Step[];
  enabled: boolean;
  run_count: number;
  last_run_at?: string | null;
}

const ACTION_LIBRARY = [
  { key: 'flashlight_on', label: 'Flashlight on' },
  { key: 'flashlight_off', label: 'Flashlight off' },
  { key: 'call', label: 'Call contact' },
  { key: 'sms', label: 'Send SMS' },
  { key: 'note', label: 'Create note' },
  { key: 'reminder', label: 'Create reminder' },
  { key: 'search', label: 'Web search' },
  { key: 'brightness_up', label: 'Brightness up' },
  { key: 'brightness_down', label: 'Brightness down' },
];

export default function AutomationsScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('manual');
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    try { setItems(await AutomationsApi.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStep = (k: string) => {
    setSelected((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  };

  const save = async () => {
    if (!name.trim() || selected.length === 0) return;
    await AutomationsApi.create({
      name: name.trim(),
      trigger: trigger || 'manual',
      steps: selected.map((k) => ({ action: k, payload: {} })),
      enabled: true,
    });
    setShow(false); setName(''); setSelected([]); setTrigger('manual');
    await load();
  };

  const run = async (w: Workflow) => {
    await AutomationsApi.run(w.workflow_id);
    await load();
  };

  const remove = async (id: string) => {
    await AutomationsApi.remove(id);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="automations-screen">
      <AuroraBackground />
      <SettingsHeader
        title="Automations"
        rightAccessory={
          <Pressable onPress={() => setShow(true)} hitSlop={10} testID="automations-new-button"
            style={{
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: palette.brand,
            }}>
            <Ionicons name="add" size={22} color={palette.onBrand} />
          </Pressable>
        }
      />

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[1,2,3].map((i) => <Skeleton key={i} style={{ height: 90 }} />)}
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="git-branch-outline"
            title="No automations yet"
            subtitle={'Chain multiple actions together — e.g. "Good night" turns flashlight off, sets brightness low, and creates tomorrow\'s reminder.'}
            testID="automations-empty"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 100 }}>
          {items.map((w) => (
            <View key={w.workflow_id} testID={`automation-${w.workflow_id}`}
              style={{
                padding: spacing.lg, borderRadius: radius.md, gap: spacing.sm,
                backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: palette.brandTertiary + '40',
                }}>
                  <Ionicons name="git-branch" size={18} color={palette.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>{w.name}</Text>
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
                    {w.steps.length} steps · run {w.run_count} times
                  </Text>
                </View>
                <Pressable onPress={() => run(w)} hitSlop={8} testID={`automation-run-${w.workflow_id}`}
                  style={{
                    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: palette.brand,
                  }}>
                  <Ionicons name="play" size={16} color={palette.onBrand} />
                </Pressable>
                <Pressable onPress={() => remove(w.workflow_id)} hitSlop={8} testID={`automation-delete-${w.workflow_id}`}>
                  <Ionicons name="trash-outline" size={18} color={palette.error} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {w.steps.map((s, i) => (
                  <Text key={i} style={{
                    color: palette.brand, fontSize: fontSize.sm,
                    backgroundColor: palette.brandTertiary + '30',
                    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm,
                  }}>
                    {s.action}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={show} animationType="slide" transparent onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl, maxHeight: '80%' }}>
              <SafeAreaView edges={['bottom']} style={{ gap: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>New automation</Text>
                  <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={palette.onSurface} /></Pressable>
                </View>
                <TextInput
                  value={name} onChangeText={setName} placeholder="Name (e.g. Good night)"
                  placeholderTextColor={palette.onSurfaceTertiary}
                  style={{
                    color: palette.onSurface, fontSize: fontSize.lg,
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="automation-name-input"
                />
                <TextInput
                  value={trigger} onChangeText={setTrigger} placeholder="Trigger (manual, voice:good night, time:22:00)"
                  placeholderTextColor={palette.onSurfaceTertiary}
                  autoCapitalize="none"
                  style={{
                    color: palette.onSurface, fontSize: fontSize.base,
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="automation-trigger-input"
                />
                <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
                  Steps
                </Text>
                <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: spacing.sm }}>
                  {ACTION_LIBRARY.map((a) => {
                    const active = selected.includes(a.key);
                    return (
                      <Pressable
                        key={a.key}
                        onPress={() => toggleStep(a.key)}
                        testID={`automation-step-${a.key}`}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                          padding: spacing.md, borderRadius: radius.md,
                          backgroundColor: palette.surfaceSecondary,
                          borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                          borderColor: active ? palette.brand : palette.border,
                        }}
                      >
                        <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? palette.brand : palette.onSurfaceTertiary} />
                        <Text style={{ color: palette.onSurface, fontSize: fontSize.base, flex: 1 }}>{a.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <PrimaryButton label="Save automation" onPress={save} testID="automation-save-button" />
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
