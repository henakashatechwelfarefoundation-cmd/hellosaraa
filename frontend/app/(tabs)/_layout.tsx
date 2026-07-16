import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Bottom tab bar for the authenticated shell.
 * A glassmorphic bar sits above content with a subtle tint.
 */
export default function TabsLayout() {
  const { palette, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.onSurfaceTertiary,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          height: Platform.select({ ios: 82, android: 68, default: 68 }),
          paddingBottom: Platform.select({ ios: 24, android: 10, default: 10 }),
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView tint={isDark ? 'dark' : 'light'} intensity={60} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glassTint }]} />
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth,
              backgroundColor: palette.glassBorder,
            }} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="planet" color={color} size={size} />,
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: 'Memory',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} />,
          tabBarButtonTestID: 'tab-memory',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
          tabBarButtonTestID: 'tab-history',
        }}
      />
    </Tabs>
  );
}
