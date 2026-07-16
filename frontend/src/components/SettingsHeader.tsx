import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  title: string;
  rightAccessory?: React.ReactNode;
  onBack?: () => void;
  containerStyle?: ViewStyle;
}

export const SettingsHeader: React.FC<Props> = ({ title, rightAccessory, onBack, containerStyle }) => {
  const { palette, spacing, fontSize, fontWeight } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      <View style={[{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl,
        paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md,
      }, containerStyle]}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={12}
          testID="settings-back-button"
          style={{
            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
            backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={palette.onSurface} />
        </Pressable>
        <Text style={{ flex: 1, color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
          {title}
        </Text>
        {rightAccessory}
      </View>
    </SafeAreaView>
  );
};
