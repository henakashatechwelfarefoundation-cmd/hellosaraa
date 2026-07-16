import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NotesApi, OcrApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { useTheme } from '@/src/theme/ThemeContext';

/**
 * OCR & Scan (Phase 5) — capture with camera or pick from gallery, send to
 * backend Tesseract, offer to save as note or copy.
 */
export default function OcrScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [image, setImage] = useState<string | null>(null);
  const [imageDisplay, setImageDisplay] = useState<string | null>(null);
  const [text, setText] = useState<string>('');
  const [engine, setEngine] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (fromCamera: boolean) => {
    setError(null);
    const opts: ImagePicker.ImagePickerOptions = {
      base64: true,
      quality: 0.6,
      allowsEditing: true,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setImage(asset.base64 || null);
    setImageDisplay(asset.uri);
  };

  const run = async () => {
    if (!image) return;
    setBusy(true); setError(null);
    try {
      const res = await OcrApi.run(image);
      setText(res.text || '');
      setEngine(res.engine || '');
      if (res.engine === 'unavailable') {
        setError('Text extraction is not available on this server. Save the image to a note for now.');
      }
    } catch (e: any) {
      setError(e?.detail || 'OCR failed');
    } finally { setBusy(false); }
  };

  const saveNote = async () => {
    if (!text.trim()) return;
    await NotesApi.create({ title: text.split('\n')[0].slice(0, 60) || 'Scanned text', content: text, tags: ['ocr', 'scan'] });
  };

  const copyAll = async () => {
    if (text) await Clipboard.setStringAsync(text);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="ocr-screen">
      <AuroraBackground />
      <SettingsHeader title="Scan & OCR" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }}>
          Snap a receipt, business card, or any document — Sara will pull the text out.
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <PrimaryButton
            label="Camera"
            icon={<Ionicons name="camera" size={18} color={palette.onBrand} />}
            onPress={() => pick(true)}
            testID="ocr-camera-button"
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Gallery"
            variant="ghost"
            icon={<Ionicons name="images" size={18} color={palette.onSurface} />}
            onPress={() => pick(false)}
            testID="ocr-gallery-button"
            style={{ flex: 1 }}
          />
        </View>

        {imageDisplay ? (
          <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border }}>
            <Image source={{ uri: imageDisplay }} style={{ width: '100%', height: 240, resizeMode: 'cover' }} />
          </View>
        ) : null}

        {image ? (
          <PrimaryButton label={busy ? 'Extracting…' : 'Extract text'} loading={busy} onPress={run} testID="ocr-extract-button" />
        ) : null}

        {error ? (
          <Text style={{ color: palette.warning, fontSize: fontSize.sm, textAlign: 'center' }}>{error}</Text>
        ) : null}

        {text ? (
          <View style={{
            padding: spacing.lg, borderRadius: radius.md,
            backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
            gap: spacing.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="document-text" size={16} color={palette.brand} />
              <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, flex: 1 }}>
                Extracted text
              </Text>
              <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm }}>{engine}</Text>
            </View>
            <Text selectable style={{ color: palette.onSurface, fontSize: fontSize.base, lineHeight: 22 }}>
              {text}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <PrimaryButton label="Save as note" onPress={saveNote} testID="ocr-save-note" style={{ flex: 1 }} />
              <PrimaryButton label="Copy" variant="ghost" onPress={copyAll} testID="ocr-copy" style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
