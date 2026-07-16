import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  padding?: number;
  radius?: number;
  bordered?: boolean;
}

/**
 * Glassmorphic container: expo-blur with a translucent brand-tinted base.
 * Falls back to a solid surfaceSecondary on very old Android where blur may be jittery.
 */
export const GlassCard: React.FC<Props> = ({
  children, style, intensity = 45, padding, radius, bordered = true,
}) => {
  const { palette, spacing, radius: r, isDark } = useTheme();
  const rad = radius ?? r.md;
  const pad = padding ?? spacing.lg;

  const containerStyle: ViewStyle = {
    borderRadius: rad,
    overflow: 'hidden',
    borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
    borderColor: palette.glassBorder,
    // Web + low-end Android: BlurView may be transparent — ensure the card
    // always has a visible surface underneath.
    backgroundColor: Platform.OS === 'web' ? palette.surfaceSecondary : palette.surfaceSecondary + '80',
  };

  return (
    <View style={[containerStyle, style]}>
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glassTint }]} />
      <View style={{ padding: pad }}>{children}</View>
    </View>
  );
};
