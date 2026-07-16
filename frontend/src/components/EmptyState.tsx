import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  testID?: string;
}

export const EmptyState: React.FC<Props> = ({ icon = 'sparkles-outline', title, subtitle, testID }) => {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.surfaceSecondary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
        }}
      >
        <Ionicons name={icon} size={40} color={palette.brand} />
      </View>
      <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, textAlign: 'center', maxWidth: 320 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};
