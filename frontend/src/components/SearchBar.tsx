import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TextInput, View, ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  style?: ViewStyle;
  testID?: string;
}

export const SearchBar: React.FC<Props> = ({ value, onChangeText, placeholder = 'Search', style, testID }) => {
  const { palette, spacing, radius, fontSize } = useTheme();
  return (
    <View
      testID={testID}
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: palette.surfaceTertiary,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.lg,
        height: 48,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.border,
      }, style]}
    >
      <Ionicons name="search" size={18} color={palette.onSurfaceSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.onSurfaceTertiary}
        style={{ flex: 1, color: palette.onSurface, fontSize: fontSize.lg }}
      />
    </View>
  );
};
