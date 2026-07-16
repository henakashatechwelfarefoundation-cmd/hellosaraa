import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { SaraOrb } from '@/src/components/SaraOrb';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';

/**
 * Splash router:
 *  - while auth loading -> show branded splash (orb + logo)
 *  - not authenticated  -> /auth
 *  - authenticated, no onboarding -> /onboarding
 *  - fully onboarded    -> /(tabs)/home
 */
export default function Index() {
  const { loading, user } = useAuth();
  const { palette, fontSize, fontWeight, spacing } = useTheme();

  if (loading) {
    return (
      <View style={styles.container} testID="splash-screen">
        <AuroraBackground />
        <View style={{ alignItems: 'center', gap: spacing.xl }}>
          <SaraOrb size={140} />
          <Text style={{
            color: palette.onSurface, fontSize: fontSize.xxxl, fontWeight: fontWeight.bold, letterSpacing: 1,
          }}>
            Hello Sara
          </Text>
          <ActivityIndicator color={palette.brand} />
        </View>
      </View>
    );
  }

  if (!user) return <Redirect href="/auth" />;
  if (!user.onboarding_completed) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
