import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MetaApi, SettingsApi } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SectionRow } from '@/src/components/SectionRow';
import { SettingsHeader } from '@/src/components/SettingsHeader';
import { TextField } from '@/src/components/TextField';
import { useTheme } from '@/src/theme/ThemeContext';

/**
 * AI Provider selection — Hello Sara is model-agnostic.
 * Only open-source / self-hosted providers are offered by design.
 */
export default function AIProviderScreen() {
  const { palette, spacing, fontSize, radius } = useTheme();
  const [providers, setProviders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    MetaApi.providers().then(setProviders).catch(() => {});
    SettingsApi.get().then(setSettings).catch(() => {});
  }, []);

  const update = async (patch: Record<string, unknown>) => {
    setSettings((s: any) => ({ ...s, ...patch }));
    try { await SettingsApi.update(patch); } catch {}
  };

  const active = settings?.ai_provider;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="ai-provider-screen">
      <AuroraBackground />
      <SettingsHeader title="AI Provider" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 }}>
          Hello Sara is model-agnostic and runs against your own open-source LLM server. Pick a provider and configure the endpoint. Nothing is sent to closed AI services.
        </Text>

        <View style={{
          borderRadius: radius.lg, overflow: 'hidden',
          backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
        }}>
          {providers.map((p) => (
            <SectionRow
              key={p.id}
              icon="server-outline"
              title={p.label}
              subtitle={p.default_base_url}
              value={active === p.id ? 'Selected' : undefined}
              onPress={() => update({ ai_provider: p.id, ai_provider_base_url: p.default_base_url, ai_provider_model: p.example_models[0] })}
              testID={`ai-provider-${p.id}`}
            />
          ))}
        </View>

        <TextField
          label="Base URL"
          value={settings?.ai_provider_base_url || ''}
          onChangeText={(v) => update({ ai_provider_base_url: v })}
          autoCapitalize="none"
          placeholder="http://localhost:11434"
          testID="ai-provider-baseurl"
        />
        <TextField
          label="Model"
          value={settings?.ai_provider_model || ''}
          onChangeText={(v) => update({ ai_provider_model: v })}
          autoCapitalize="none"
          placeholder="llama3.2"
          testID="ai-provider-model"
        />
      </ScrollView>
    </View>
  );
}
