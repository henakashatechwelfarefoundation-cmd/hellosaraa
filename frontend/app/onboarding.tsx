import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { GlassCard } from '@/src/components/GlassCard';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';

interface Slide {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  { key: 'voice', icon: 'mic-circle', title: 'Voice Assistant', body: 'Natural conversations with a hands-free wake word — coming in Phase 2.' },
  { key: 'memory', icon: 'sparkles', title: 'Personal Memory', body: 'Sara remembers what matters to you — always on your terms.' },
  { key: 'productivity', icon: 'calendar', title: 'Calendar & Reminders', body: 'Plan your day, capture ideas, and never miss a beat.' },
  { key: 'phone', icon: 'call', title: 'Phone Control', body: 'Call, message, and control your device with your voice.' },
  { key: 'learning', icon: 'bulb', title: 'Learns With You', body: 'Adapts to your routines and preferences over time.' },
  { key: 'privacy', icon: 'lock-closed', title: 'Privacy First', body: 'You control every permission. Nothing is accessed without your consent.' },
];

export default function OnboardingScreen() {
  const { palette, spacing, fontSize, fontWeight } = useTheme();
  const { markOnboardingDone } = useAuth();
  const [index, setIndex] = useState(0);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const next = () => {
    if (!isLast) setIndex(index + 1);
    else finish();
  };

  const finish = async () => {
    await markOnboardingDone();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="onboarding-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{
          paddingHorizontal: spacing.xl, paddingTop: spacing.md,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text style={{ color: palette.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
            Meet Sara
          </Text>
          <Pressable onPress={finish} hitSlop={10} testID="onboarding-skip">
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium }}>
              Skip
            </Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
          <GlassCard padding={spacing.xl}>
            <View
              key={slide.key}
              style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}
              testID={`onboarding-slide-${slide.key}`}
            >
              <View style={{
                width: 96, height: 96, borderRadius: 28,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: palette.brandTertiary + '55',
              }}>
                <Ionicons name={slide.icon} size={52} color={palette.brand} />
              </View>
              <Text style={{
                color: palette.onSurface, fontSize: fontSize.xxl,
                fontWeight: fontWeight.bold, textAlign: 'center',
              }}>
                {slide.title}
              </Text>
              <Text style={{
                color: palette.onSurfaceSecondary, fontSize: fontSize.lg,
                textAlign: 'center', lineHeight: 24,
              }}>
                {slide.body}
              </Text>
            </View>
          </GlassCard>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === index ? 24 : 8, height: 8, borderRadius: 4,
                  backgroundColor: i === index ? palette.brand : palette.surfaceTertiary,
                }}
              />
            ))}
          </View>
          <PrimaryButton
            label={isLast ? 'Get Started' : 'Next'}
            onPress={next}
            testID="onboarding-next-button"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({});
