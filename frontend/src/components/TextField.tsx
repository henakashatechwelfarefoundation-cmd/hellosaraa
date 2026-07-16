import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  errorText?: string;
  containerStyle?: ViewStyle;
}

export const TextField: React.FC<Props> = ({ label, errorText, containerStyle, ...rest }) => {
  const { palette, spacing, radius, fontSize, fontWeight } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      {label ? (
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          borderRadius: radius.md,
          backgroundColor: palette.surfaceTertiary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: errorText ? palette.error : focused ? palette.brand : 'transparent',
        }}
      >
        <TextInput
          {...rest}
          placeholderTextColor={palette.onSurfaceTertiary}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={{
            color: palette.onSurface,
            fontSize: fontSize.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: 14,
          }}
        />
      </View>
      {errorText ? (
        <Text style={{ color: palette.error, fontSize: fontSize.sm }}>{errorText}</Text>
      ) : null}
    </View>
  );
};
