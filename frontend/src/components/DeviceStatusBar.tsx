import { Ionicons } from '@expo/vector-icons';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

function batteryIcon(level: number, charging: boolean): any {
  if (charging) return 'battery-charging';
  if (level >= 0.9) return 'battery-full';
  if (level >= 0.5) return 'battery-half';
  if (level >= 0.2) return 'battery-half';
  return 'battery-dead';
}

function networkIcon(state: NetInfoState | null): any {
  if (!state || !state.isConnected) return 'cloud-offline-outline';
  if (state.type === 'wifi') return 'wifi';
  if (state.type === 'cellular') return 'cellular';
  return 'globe-outline';
}

/** Real device battery + network status — replaces the old static "requires native" button. */
export function DeviceStatusBar() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [net, setNet] = useState<NetInfoState | null>(null);

  useEffect(() => {
    let batterySub: { remove: () => void } | null = null;
    let stateSub: { remove: () => void } | null = null;

    Battery.getBatteryLevelAsync().then(setLevel).catch(() => {});
    Battery.getBatteryStateAsync().then((s) => setCharging(s === Battery.BatteryState.CHARGING)).catch(() => {});
    batterySub = Battery.addBatteryLevelListener(({ batteryLevel }) => setLevel(batteryLevel));
    stateSub = Battery.addBatteryStateListener(({ batteryState }) => setCharging(batteryState === Battery.BatteryState.CHARGING));

    const unsubscribeNet = NetInfo.addEventListener(setNet);
    NetInfo.fetch().then(setNet);

    return () => {
      batterySub?.remove();
      stateSub?.remove();
      unsubscribeNet();
    };
  }, []);

  return (
    <View style={{
      flexDirection: 'row', gap: spacing.md,
    }}>
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        padding: spacing.md, borderRadius: radius.md,
        backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
      }} testID="device-status-battery">
        <Ionicons name={level == null ? 'battery-half' : batteryIcon(level, charging)} size={20} color={palette.brand} />
        <Text style={{ color: palette.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
          {level == null ? 'Battery —' : `${Math.round(level * 100)}%${charging ? ' · charging' : ''}`}
        </Text>
      </View>
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        padding: spacing.md, borderRadius: radius.md,
        backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
      }} testID="device-status-network">
        <Ionicons name={networkIcon(net)} size={20} color={palette.brand} />
        <Text style={{ color: palette.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
          {net ? (net.isConnected ? (net.type === 'wifi' ? 'Wi-Fi' : net.type === 'cellular' ? 'Cellular' : net.type) : 'Offline') : 'Network —'}
        </Text>
      </View>
    </View>
  );
}
