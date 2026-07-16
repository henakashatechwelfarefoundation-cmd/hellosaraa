import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  testID?: string;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const PrimaryButton: React.FC<Props> = ({
  label, onPress, loading, disabled, variant = 'primary', size = 'lg', testID, style, icon,
}) => {
  const { palette, spacing, radius, fontSize, fontWeight } = useTheme();

  const height = size === 'lg' ? 56 : 48;
  const paddingH = size === 'lg' ? spacing.xl : spacing.lg;
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  const containerStyle: ViewStyle = {
    height,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: paddingH,
    opacity: disabled ? 0.5 : 1,
    overflow: 'hidden',
    backgroundColor: isPrimary ? 'transparent' : isGhost ? 'transparent' : palette.surfaceSecondary,
    borderWidth: isGhost ? StyleSheet.hairlineWidth : 0,
    borderColor: palette.borderStrong,
  };
  const textColor = isPrimary
    ? palette.onBrand
    : isGhost
      ? palette.onSurface
      : palette.onSurface;
  const textStyle: TextStyle = { color: textColor, fontSize: fontSize.lg, fontWeight: fontWeight.semibold };

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={[containerStyle, style]}
      testID={testID}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[palette.brand, palette.brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={textStyle}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};
