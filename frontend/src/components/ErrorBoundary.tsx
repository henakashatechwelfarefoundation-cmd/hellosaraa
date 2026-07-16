import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';

/**
 * Global error boundary — catches render errors so the whole app never
 * shows a white screen. In production the message goes to console for now;
 * a future phase can wire this to Sentry/Bugsnag without touching UI code.
 */
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Ionicons name="warning" size={56} color="#F59E0B" />
        <Text style={styles.title}>Something went wrong.</Text>
        <Text style={styles.msg}>{this.state.error.message}</Text>
        <PrimaryButton label="Try again" onPress={this.reset} testID="errorboundary-retry" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#09090B',
    alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16,
  },
  title: { color: '#FAFAFA', fontSize: 22, fontWeight: '700' as const, textAlign: 'center' },
  msg: { color: '#A1A1AA', fontSize: 14, textAlign: 'center', maxWidth: 320 },
});
