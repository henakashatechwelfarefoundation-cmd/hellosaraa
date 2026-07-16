import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Full-bleed aurora background — deep purple → near-black slow gradient.
 * Sits behind screens to reinforce the "AI companion" mood.
 */
export const AuroraBackground: React.FC = () => {
  const { palette } = useTheme();
  return (
    <>
      <LinearGradient
        colors={[palette.auroraTop, palette.surface, palette.auroraBottom]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(124,58,237,0.18)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(6,182,212,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
};
