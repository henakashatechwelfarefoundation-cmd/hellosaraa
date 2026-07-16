import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TasksApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface Task {
  task_id: string;
  title: string;
  notes?: string | null;
  due_at?: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

const PRIORITIES: { key: Task['priority']; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];

function priorityColor(p: Task['priority'], palette: any) {
  if (p === 'high') return palette.error;
  if (p === 'medium') return palette.brand;
  return palette.onSurfaceTertiary;
}

export default function TasksScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await TasksApi.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await TasksApi.create({ title, notes: notes || undefined, priority });
      setShow(false); setTitle(''); setNotes(''); setPriority('medium');
      await load();
    } catch {} finally { setSaving(false); }
  };

  const toggle = async (t: Task) => {
    setItems((cur) => cur.map((x) => (x.task_id === t.task_id ? { ...x, completed: !x.completed } : x)));
    try { await TasksApi.update(t.task_id, { completed: !t.completed }); } catch { await load(); }
  };

  const remove = async (id: string) => {
    try { await TasksApi.remove(id); await load(); } catch {}
  };

  const visible = items.filter((t) => showCompleted || !t.completed);
  const pendingCount = items.filter((t) => !t.completed).length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="tasks-screen">
      <AuroraBackground />
      <SettingsHeader
        title="Tasks"
        rightAccessory={
          <Pressable onPress={() => setShow(true)} hitSlop={10} testID="tasks-new-button"
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
          {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 64 }} />)}
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="checkbox-outline"
            title="No tasks"
            subtitle="Keep a to-do list Sara can read back to you. Tap + to add one."
            testID="tasks-empty"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm }}>
              {pendingCount} pending
            </Text>
            <Pressable onPress={() => setShowCompleted((v) => !v)} testID="tasks-toggle-completed">
              <Text style={{ color: palette.brand, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
                {showCompleted ? 'Hide completed' : 'Show completed'}
              </Text>
            </Pressable>
          </View>
          {visible.map((t) => (
            <View key={t.task_id} testID={`task-item-${t.task_id}`}
              style={{
                padding: spacing.lg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
                opacity: t.completed ? 0.55 : 1,
              }}>
              <Pressable onPress={() => toggle(t)} hitSlop={10} testID={`task-toggle-${t.task_id}`}>
                <Ionicons
                  name={t.completed ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={t.completed ? palette.brand : palette.onSurfaceTertiary}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold,
                  textDecorationLine: t.completed ? 'line-through' : 'none',
                }}>{t.title}</Text>
                {t.notes ? (
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>{t.notes}</Text>
                ) : null}
              </View>
              <View style={{
                width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor(t.priority, palette),
              }} />
              <Pressable onPress={() => remove(t.task_id)} hitSlop={10} testID={`task-delete-${t.task_id}`}>
                <Ionicons name="trash-outline" size={20} color={palette.error} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={show} animationType="slide" transparent onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl }}>
              <SafeAreaView edges={['bottom']} style={{ gap: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>New task</Text>
                  <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={palette.onSurface} /></Pressable>
                </View>
                <TextInput
                  value={title} onChangeText={setTitle} placeholder="What needs doing"
                  placeholderTextColor={palette.onSurfaceTertiary}
                  style={{
                    color: palette.onSurface, fontSize: fontSize.lg,
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="task-title-input"
                />
                <TextInput
                  value={notes} onChangeText={setNotes} placeholder="Notes (optional)"
                  placeholderTextColor={palette.onSurfaceTertiary} multiline
                  style={{
                    color: palette.onSurface, fontSize: fontSize.base, minHeight: 60, textAlignVertical: 'top',
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="task-notes-input"
                />
                <View>
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm, fontWeight: fontWeight.medium }}>
                    Priority
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {PRIORITIES.map((p) => {
                      const active = priority === p.key;
                      return (
                        <Pressable
                          key={p.key}
                          onPress={() => setPriority(p.key)}
                          testID={`task-priority-${p.key}`}
                          style={{
                            paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill,
                            backgroundColor: active ? palette.brand : palette.surfaceSecondary,
                            borderWidth: StyleSheet.hairlineWidth, borderColor: active ? palette.brand : palette.border,
                          }}
                        >
                          <Text style={{ color: active ? palette.onBrand : palette.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <PrimaryButton label="Add task" onPress={create} loading={saving} testID="task-save-button" />
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
