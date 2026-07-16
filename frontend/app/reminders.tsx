import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RemindersApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { cancelReminderNotification, scheduleReminderNotification } from '@/src/notifications/notifications';
import { useTheme } from '@/src/theme/ThemeContext';
import { storage } from '@/src/utils/storage';

const notifKey = (reminderId: string) => `hs.reminder.notif.${reminderId}`;

interface Reminder {
  reminder_id: string;
  title: string;
  notes?: string | null;
  remind_at: string;
  completed?: boolean;
}

const PRESETS = [
  { label: 'In 15 minutes', mins: 15 },
  { label: 'In 1 hour', mins: 60 },
  { label: 'In 3 hours', mins: 180 },
  { label: 'Tomorrow 9am', tomorrow: true },
];

function toISO(offsetMins?: number, tomorrow?: boolean): string {
  const d = new Date();
  if (tomorrow) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (offsetMins) {
    d.setMinutes(d.getMinutes() + offsetMins);
  }
  return d.toISOString();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function RemindersScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState<string>(toISO(60));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await RemindersApi.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const created = await RemindersApi.create({ title, notes: notes || undefined, remind_at: when });
      const notifId = await scheduleReminderNotification(created.reminder_id, title, notes, when);
      if (notifId) await storage.setItem(notifKey(created.reminder_id), notifId);
      setShow(false); setTitle(''); setNotes(''); setWhen(toISO(60));
      await load();
    } catch {} finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      const notifId = await storage.getItem<string>(notifKey(id), '');
      if (notifId) await cancelReminderNotification(notifId);
      await RemindersApi.remove(id);
      await load();
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="reminders-screen">
      <AuroraBackground />
      <SettingsHeader
        title="Reminders"
        rightAccessory={
          <Pressable onPress={() => setShow(true)} hitSlop={10} testID="reminders-new-button"
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
          {[1,2,3].map((i) => <Skeleton key={i} style={{ height: 72 }} />)}
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="alarm-outline"
            title="No reminders"
            subtitle="Sara will nudge you at the right time. Tap + to add one."
            testID="reminders-empty"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 100 }}>
          {items.map((r) => (
            <View key={r.reminder_id} testID={`reminder-item-${r.reminder_id}`}
              style={{
                padding: spacing.lg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
              }}>
              <View style={{
                width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
                backgroundColor: palette.brandTertiary + '40',
              }}>
                <Ionicons name="alarm" size={20} color={palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>{r.title}</Text>
                <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>{formatWhen(r.remind_at)}</Text>
              </View>
              <Pressable onPress={() => remove(r.reminder_id)} hitSlop={10} testID={`reminder-delete-${r.reminder_id}`}>
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
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>New reminder</Text>
                  <Pressable onPress={() => setShow(false)}><Ionicons name="close" size={24} color={palette.onSurface} /></Pressable>
                </View>
                <TextInput
                  value={title} onChangeText={setTitle} placeholder="What to remember"
                  placeholderTextColor={palette.onSurfaceTertiary}
                  style={{
                    color: palette.onSurface, fontSize: fontSize.lg,
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="reminder-title-input"
                />
                <TextInput
                  value={notes} onChangeText={setNotes} placeholder="Notes (optional)"
                  placeholderTextColor={palette.onSurfaceTertiary} multiline
                  style={{
                    color: palette.onSurface, fontSize: fontSize.base, minHeight: 60, textAlignVertical: 'top',
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="reminder-notes-input"
                />
                <View>
                  <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm, fontWeight: fontWeight.medium }}>
                    When
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                    {PRESETS.map((p) => {
                      const iso = toISO(p.mins, p.tomorrow);
                      const active = when === iso;
                      return (
                        <Pressable
                          key={p.label}
                          onPress={() => setWhen(iso)}
                          testID={`reminder-preset-${p.label.toLowerCase().replace(/\W+/g,'-')}`}
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
                  <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: spacing.sm }}>
                    {formatWhen(when)}
                  </Text>
                </View>
                <PrimaryButton label="Create reminder" onPress={create} loading={saving} testID="reminder-save-button" />
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
