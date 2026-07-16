import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  chevron?: boolean;
  destructive?: boolean;
  testID?: string;
}

export const SectionRow: React.FC<Props> = ({
  icon, title, subtitle, value, onPress, toggle, chevron = true, destructive, testID,
}) => {
  const { palette, spacing, radius, fontSize, fontWeight } = useTheme();

  const content = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.lg,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: radius.md, backgroundColor: palette.brandTertiary + '40',
        alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg,
      }}>
        <Ionicons name={icon} size={18} color={destructive ? palette.error : palette.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: destructive ? palette.error : palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, marginRight: 6 }}>
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ true: palette.brand, false: palette.surfaceTertiary }}
          thumbColor="#fff"
        />
      ) : chevron ? (
        <Ionicons name="chevron-forward" size={18} color={palette.onSurfaceTertiary} />
      ) : null}
    </View>
  );

  if (toggle) {
    return <View testID={testID} style={styles.row(palette.divider)}>{content}</View>;
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row(palette.divider), pressed && { opacity: 0.7 }]}
    >
      {content}
    </Pressable>
  );
};

const styles = {
  row: (borderColor: string) => ({
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: borderColor,
  }),
};
