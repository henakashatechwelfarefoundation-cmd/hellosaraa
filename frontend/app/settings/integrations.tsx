import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IntegrationsApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { Skeleton } from '@/src/components/Skeleton';
import { useTheme } from '@/src/theme/ThemeContext';

interface ProviderStatus {
  provider: string;
  label: string;
  configured: boolean;
  connected: boolean;
  connected_at?: string;
}

const ICONS: Record<string, any> = {
  google: 'logo-google',
  microsoft: 'grid',
  dropbox: 'cloud-outline',
  box: 'archive-outline',
};

export default function IntegrationsScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [items, setItems] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await IntegrationsApi.list()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async (p: ProviderStatus) => {
    if (!p.configured) {
      Alert.alert(
        `${p.label} isn't set up yet`,
        `Add ${p.provider.toUpperCase()}_CLIENT_ID and ${p.provider.toUpperCase()}_CLIENT_SECRET to the backend's .env (see backend/.env.example for the exact steps), then restart the backend and try again.`,
      );
      return;
    }
    setBusy(p.provider);
    try {
      const { url } = await IntegrationsApi.connectUrl(p.provider);
      const redirectUrl = Platform.OS === 'web' ? window.location.origin : Linking.createURL('integrations');
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      // The backend redirects to APP_REDIRECT_SCHEME (default frontend://integrations)
      // once the OAuth dance finishes — we don't need to parse that URL, just refresh.
      if (result.type === 'success' || result.type === 'dismiss') {
        await load();
      }
    } catch (e: any) {
      Alert.alert('Could not connect', e?.detail || e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (p: ProviderStatus) => {
    setBusy(p.provider);
    try {
      await IntegrationsApi.disconnect(p.provider);
      await load();
    } catch {} finally { setBusy(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="integrations-screen">
      <AuroraBackground />
      <SettingsHeader title="Integrations" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 100 }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }}>
          Connect real accounts so Sara can read/write your calendar, mail, and files. Each
          provider needs its own developer app credentials in the backend's .env first — see
          backend/.env.example for the exact steps for each one.
        </Text>

        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 76 }} />)
        ) : (
          items.map((p) => (
            <View key={p.provider} testID={`integration-row-${p.provider}`}
              style={{
                padding: spacing.lg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
              }}>
              <View style={{
                width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
                backgroundColor: palette.brandTertiary + '40',
              }}>
                <Ionicons name={ICONS[p.provider] || 'link'} size={20} color={palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>{p.label}</Text>
                <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 }}>
                  {p.connected ? 'Connected' : p.configured ? 'Not connected' : 'Needs setup on the backend'}
                </Text>
              </View>
              <Pressable
                disabled={busy === p.provider}
                onPress={() => (p.connected ? disconnect(p) : connect(p))}
                testID={`integration-action-${p.provider}`}
                style={{
                  paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill,
                  backgroundColor: p.connected ? 'transparent' : palette.brand,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: p.connected ? palette.error : palette.brand,
                  opacity: busy === p.provider ? 0.6 : 1,
                }}
              >
                <Text style={{
                  color: p.connected ? palette.error : palette.onBrand,
                  fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                }}>
                  {busy === p.provider ? '…' : p.connected ? 'Disconnect' : 'Connect'}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
