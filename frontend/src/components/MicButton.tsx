import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/src/theme/ThemeContext';

interface Props {
  active: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * Glowing microphone FAB — visual centerpiece of Home.
 * Idle: soft breathing glow. Active: expanding cyan/purple pulse rings.
 */
export const MicButton: React.FC<Props> = ({ active, onPress, testID }) => {
  const { palette } = useTheme();
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
    }
  }, [active, pulse]);

  const ring1 = useAnimatedStyle(() => ({
    opacity: pulse.value === 0 ? 0 : 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));
  const ring2 = useAnimatedStyle(() => {
    const v = (pulse.value + 0.5) % 1;
    return { opacity: pulse.value === 0 ? 0 : 1 - v, transform: [{ scale: 1 + v * 0.9 }] };
  });
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.94);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  return (
    <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.ring, ring1, { borderColor: palette.brand }]} />
      <Animated.View style={[styles.ring, ring2, { borderColor: palette.brandSecondary }]} />
      <Animated.View style={buttonStyle}>
        <Pressable
          testID={testID}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.pressable}
        >
          <LinearGradient
            colors={[palette.brand, palette.brandSecondary]}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
            style={styles.gradient}
          >
            <Ionicons name={active ? 'radio' : 'mic'} size={44} color="#fff" />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const SIZE = 108;
const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
  },
  pressable: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
