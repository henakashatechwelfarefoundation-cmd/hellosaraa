import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Global offline banner. Sits above content, hides when connected.
 */
export const OfflineBanner: React.FC = () => {
  const { palette, spacing, fontSize, fontWeight } = useTheme();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setOnline(!!s.isConnected && s.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  if (online) return null;
  return (
    <SafeAreaView edges={['top']} style={{
      backgroundColor: palette.warning, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      }}>
        <Ionicons name="cloud-offline" size={16} color="#000" />
        <Text style={{ color: '#000', fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
          You&apos;re offline — Sara will queue actions until you reconnect.
        </Text>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#000' }} />
    </SafeAreaView>
  );
};
