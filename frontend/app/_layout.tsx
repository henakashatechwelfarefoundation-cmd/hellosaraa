import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/src/auth/AuthContext';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { FloatingAssistant } from '@/src/components/FloatingAssistant';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { requestNotificationPermission } from '@/src/notifications/notifications';
import { ThemeProvider, useTheme } from '@/src/theme/ThemeContext';

// Suppress noisy dev logs so users can focus on the app.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible until icon fonts register — required because
// @expo/vector-icons hits the CDN via useIconFonts on Expo Go / Android.
SplashScreen.preventAutoHideAsync();

function StatusBarWithTheme() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} translucent />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      requestNotificationPermission().catch(() => {});
    }
  }, [loaded, error]);

  // On CDN failure we still boot; icons may tofu but the app remains usable.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <StatusBarWithTheme />
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="notes" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="reminders" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="tasks" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="device" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="briefing" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="automations" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="ocr" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="marketplace" options={{ animation: 'slide_from_right' }} />
              </Stack>
              <FloatingAssistant />
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
