import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuroraBackground } from '@/src/components/AuroraBackground';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { SaraOrb } from '@/src/components/SaraOrb';
import { TextField } from '@/src/components/TextField';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeContext';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const { loginEmail, registerEmail, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password || (mode === 'register' && !name)) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') await loginEmail(email.trim().toLowerCase(), password);
      else await registerEmail(email.trim().toLowerCase(), password, name.trim());
      router.replace('/');
    } catch (e: any) {
      setError(e?.detail || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      router.replace('/');
    } catch (e: any) {
      setError(e?.detail || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.xxxl }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
              <SaraOrb size={110} />
              <Text style={{
                color: palette.onSurface, fontSize: fontSize.xxxl, fontWeight: fontWeight.bold,
                marginTop: spacing.xl, letterSpacing: 0.5,
              }}>
                Hello Sara
              </Text>
              <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, marginTop: spacing.sm }}>
                {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
              </Text>
            </View>

            <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
              <PrimaryButton
                label={googleLoading ? 'Opening Google…' : 'Continue with Google'}
                variant="ghost"
                loading={googleLoading}
                onPress={handleGoogle}
                icon={<Ionicons name="logo-google" size={18} color={palette.onSurface} />}
                testID="google-signin-button"
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm }}>
                <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.border }} />
                <Text style={{ color: palette.onSurfaceTertiary, fontSize: fontSize.sm }}>OR</Text>
                <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.border }} />
              </View>

              {mode === 'register' && (
                <TextField
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  autoCapitalize="words"
                  testID="auth-name-input"
                />
              )}
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                testID="auth-email-input"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                testID="auth-password-input"
              />

              {error ? (
                <Text style={{ color: palette.error, fontSize: fontSize.sm }} testID="auth-error">
                  {error}
                </Text>
              ) : null}

              <PrimaryButton
                label={mode === 'login' ? 'Log in' : 'Create account'}
                onPress={submit}
                loading={loading}
                testID="auth-submit-button"
              />

              <Pressable
                onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{ alignItems: 'center', paddingVertical: spacing.md }}
                testID="auth-toggle-mode"
              >
                <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base }}>
                  {mode === 'login' ? "New here? " : 'Have an account? '}
                  <Text style={{ color: palette.brand, fontWeight: fontWeight.semibold }}>
                    {mode === 'login' ? 'Create an account' : 'Log in'}
                  </Text>
                </Text>
              </Pressable>
            </View>

            <Text style={{
              color: palette.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: 'center',
              marginTop: spacing.xl, maxWidth: 320, alignSelf: 'center',
            }}>
              By continuing, you agree to our Terms & Privacy Policy. Sara will never access anything without your explicit permission.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
