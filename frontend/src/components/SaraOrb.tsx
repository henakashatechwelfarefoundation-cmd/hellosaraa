import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  size?: number;
  active?: boolean;
}

/**
 * SaraOrb — abstract animated character.
 * A soft breathing orb with dual-tinted glow rings.
 * (Reanimated only — no Skia dependency required.)
 */
export const SaraOrb: React.FC<Props> = ({ size = 220, active = false }) => {
  const { palette } = useTheme();
  const breathe = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1.06, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    ring.value = withRepeat(
      withTiming(1, { duration: active ? 1500 : 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [breathe, ring, active]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));
  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + ring.value * 0.35,
    transform: [{ scale: 1 + ring.value * 0.12 }],
  }));
  const midRingStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + ring.value * 0.4,
    transform: [{ scale: 1 + ring.value * 0.06 }],
  }));

  return (
    <View style={{ width: size * 1.8, height: size * 1.8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, outerRingStyle, { alignItems: 'center', justifyContent: 'center' }]}>
        <View
          style={{
            width: size * 1.6,
            height: size * 1.6,
            borderRadius: (size * 1.6) / 2,
            backgroundColor: palette.brand,
            opacity: 0.18,
          }}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, midRingStyle, { alignItems: 'center', justifyContent: 'center' }]}>
        <View
          style={{
            width: size * 1.25,
            height: size * 1.25,
            borderRadius: (size * 1.25) / 2,
            backgroundColor: palette.brandSecondary,
            opacity: 0.22,
          }}
        />
      </Animated.View>
      <Animated.View style={[orbStyle]}>
        <LinearGradient
          colors={[palette.brand, palette.brandSecondary]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowColor: palette.brand,
            shadowOpacity: 0.9,
            shadowRadius: 60,
            shadowOffset: { width: 0, height: 0 },
            elevation: 20,
          }}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0.3, y: 0.15 }}
          end={{ x: 0.6, y: 0.6 }}
          style={{
            position: 'absolute',
            top: size * 0.12,
            left: size * 0.18,
            width: size * 0.5,
            height: size * 0.35,
            borderRadius: size * 0.3,
          }}
        />
      </Animated.View>
    </View>
  );
};
