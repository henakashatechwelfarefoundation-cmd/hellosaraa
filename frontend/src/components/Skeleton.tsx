import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Simple pulsing skeleton block for loading states.
 */
export const Skeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { palette, radius } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: palette.surfaceTertiary, borderRadius: radius.md, opacity: 0.7 },
        StyleSheet.flatten(style),
      ]}
    />
  );
};
