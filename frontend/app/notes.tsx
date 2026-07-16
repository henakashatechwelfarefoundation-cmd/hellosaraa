import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotesApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { EmptyState } from '@/src/components/EmptyState';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SearchBar } from '@/src/components/SearchBar';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface Note {
  note_id: string;
  title: string;
  content: string;
  tags: string[];
  color: string;
  pinned: boolean;
  updated_at: string;
}

const COLORS = ['purple', 'cyan', 'pink', 'amber', 'emerald'];
const COLOR_MAP: Record<string, string> = {
  purple: '#7C3AED', cyan: '#06B6D4', pink: '#EC4899', amber: '#F59E0B', emerald: '#10B981',
};

export default function NotesScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('purple');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await NotesApi.list(query || undefined)); }
    catch {} finally { setLoading(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null); setTitle(''); setContent(''); setColor('purple'); setShowEditor(true);
  };
  const openEdit = (n: Note) => {
    setEditing(n); setTitle(n.title); setContent(n.content); setColor(n.color); setShowEditor(true);
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await NotesApi.update(editing.note_id, { title, content, color });
      } else {
        await NotesApi.create({ title, content, tags: [], color });
      }
      setShowEditor(false);
      await load();
    } catch {} finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try { await NotesApi.remove(id); await load(); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="notes-screen">
      <AuroraBackground />
      <SettingsHeader
        title="Notes"
        rightAccessory={
          <Pressable onPress={openNew} hitSlop={10} testID="notes-new-button"
            style={{
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: palette.brand,
            }}>
            <Ionicons name="add" size={22} color={palette.onBrand} />
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search notes" testID="notes-search" />
      </View>

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[1,2,3].map((i) => <Skeleton key={i} style={{ height: 100 }} />)}
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="document-text-outline"
            title="No notes yet"
            subtitle="Capture ideas, meeting notes, or anything worth remembering. Tap + to create one."
            testID="notes-empty"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 100 }}>
          {items.map((n) => (
            <Pressable
              key={n.note_id}
              onPress={() => openEdit(n)}
              onLongPress={() => remove(n.note_id)}
              testID={`note-item-${n.note_id}`}
              style={{
                padding: spacing.lg, borderRadius: radius.md,
                backgroundColor: palette.surfaceSecondary,
                borderLeftWidth: 4, borderLeftColor: COLOR_MAP[n.color] || palette.brand,
                borderTopWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
                borderTopColor: palette.border, borderRightColor: palette.border, borderBottomColor: palette.border,
                gap: spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {n.pinned ? <Ionicons name="pin" size={14} color={palette.brand} /> : null}
                <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, flex: 1 }} numberOfLines={1}>
                  {n.title}
                </Text>
              </View>
              <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }} numberOfLines={3}>
                {n.content}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={showEditor} animationType="slide" transparent onRequestClose={() => setShowEditor(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: spacing.xl, gap: spacing.lg,
            }}>
              <SafeAreaView edges={['bottom']} style={{ gap: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                    {editing ? 'Edit note' : 'New note'}
                  </Text>
                  <Pressable onPress={() => setShowEditor(false)} testID="note-editor-close">
                    <Ionicons name="close" size={24} color={palette.onSurface} />
                  </Pressable>
                </View>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Title"
                  placeholderTextColor={palette.onSurfaceTertiary}
                  style={{
                    color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.semibold,
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                  }}
                  testID="note-editor-title"
                />
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder="Start typing…"
                  placeholderTextColor={palette.onSurfaceTertiary}
                  multiline
                  style={{
                    color: palette.onSurface, fontSize: fontSize.base, minHeight: 160, maxHeight: 260,
                    padding: spacing.md, backgroundColor: palette.surfaceSecondary, borderRadius: radius.md,
                    textAlignVertical: 'top',
                  }}
                  testID="note-editor-content"
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      testID={`note-color-${c}`}
                      style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: COLOR_MAP[c],
                        borderWidth: color === c ? 3 : 0, borderColor: palette.onSurface,
                      }}
                    />
                  ))}
                </View>
                <PrimaryButton label={editing ? 'Save' : 'Create note'} onPress={save} loading={saving} testID="note-editor-save" />
                {editing ? (
                  <PrimaryButton
                    label="Delete note" variant="ghost"
                    onPress={async () => { await remove(editing.note_id); setShowEditor(false); }}
                    testID="note-editor-delete"
                  />
                ) : null}
              </SafeAreaView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
