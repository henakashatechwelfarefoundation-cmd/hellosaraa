import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { streamChat } from '@/src/api/client';
import { AuroraBackground } from '@/src/components/AuroraBackground';
import { MicButton } from '@/src/components/MicButton';
import { useTheme } from '@/src/theme/ThemeContext';
import { executeIntent, parseIntent } from '@/src/voice/commandRouter';
import { useTorch } from '@/src/voice/useTorch';
import {
  isRecognitionSupported, speak, startRecognition, stopSpeaking,
} from '@/src/voice/voice';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: boolean;
}

export default function ChatScreen() {
  const { palette, spacing, fontSize, fontWeight, radius } = useTheme();
  const params = useLocalSearchParams<{ autostart?: string }>();
  const { controller: torch, PortalNode } = useTorch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setInput('');

    // Voice-command routing — device actions never round-trip through AI
    const intent = parseIntent(trimmed);
    if (intent.type !== 'chat') {
      const userMsg: Message = { id: `m_${Date.now()}`, role: 'user', content: trimmed };
      setMessages((cur) => [...cur, userMsg]);
      const result = await executeIntent(intent, {
        torch,
        onChat: async () => { /* fall-through never reached */ },
      });
      const sysMsg: Message = {
        id: `s_${Date.now()}`, role: 'assistant',
        content: result.message,
      };
      setMessages((cur) => [...cur, sysMsg]);
      return;
    }

    const userMsg: Message = { id: `m_${Date.now()}`, role: 'user', content: trimmed };
    const pendingMsg: Message = { id: `p_${Date.now()}`, role: 'assistant', content: '', pending: true };
    const nextMessages = [...messages, userMsg, pendingMsg];
    setMessages(nextMessages);

    const history = nextMessages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    let gotAnyChunk = false;
    streamChat(history, {
      onChunk: (fullSoFar) => {
        gotAnyChunk = true;
        setMessages((cur) => cur.map((m) => (m.id === pendingMsg.id
          ? { ...m, content: fullSoFar, pending: false } : m)));
      },
      onDone: (fullText) => {
        setMessages((cur) => cur.map((m) => (m.id === pendingMsg.id
          ? { ...m, content: fullText, pending: false } : m)));
        if (fullText.trim()) speak(fullText);
      },
      onError: (message) => {
        setMessages((cur) => cur.map((m) => (m.id === pendingMsg.id
          ? {
            ...m,
            content: gotAnyChunk ? m.content : (message || 'Something went wrong reaching your AI provider. Configure it in Settings › AI Provider.'),
            pending: false,
            error: !gotAnyChunk,
          } : m)));
      },
    });
  }, [messages, torch]);

  const startListen = useCallback(async () => {
    setError(null);
    if (!isRecognitionSupported()) {
      setError('Voice input needs a native build. Type instead — or install the app from a development build.');
      return;
    }
    setListening(true);
    const stop = await startRecognition({
      onPartial: (t) => setPartial(t),
      onFinal: (t) => { setPartial(''); setListening(false); send(t); },
      onError: (m) => { setError(m); setListening(false); setPartial(''); },
      onStateChange: (s) => setListening(s === 'listening'),
    }, { interim: true });
    stopRef.current = stop;
  }, [send]);

  const stopListen = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
    setPartial('');
  }, []);

  useEffect(() => {
    if (params.autostart === '1') startListen();
    return () => { stopRef.current?.(); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }} testID="chat-screen">
      <AuroraBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header(spacing)}>
          <Pressable onPress={() => router.back()} hitSlop={12} testID="chat-back-button"
            style={{
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: palette.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
            }}>
            <Ionicons name="chevron-back" size={20} color={palette.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
              Chat with Sara
            </Text>
            <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
              {listening ? 'Listening…' : 'Ask anything'}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 80, gap: spacing.md }}>
                <Ionicons name="chatbubbles-outline" size={40} color={palette.brand} />
                <Text style={{ color: palette.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.semibold }}>
                  Say hi to Sara
                </Text>
                <Text style={{ color: palette.onSurfaceSecondary, fontSize: fontSize.base, textAlign: 'center', maxWidth: 300 }}>
                  Tap the mic or type below. Sara will reply using the open-source AI provider you configured in Settings.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: isUser ? palette.brand : palette.surfaceSecondary,
                    borderWidth: item.error ? 1 : StyleSheet.hairlineWidth,
                    borderColor: item.error ? palette.error : palette.border,
                  }}
                  testID={`chat-message-${item.role}`}
                >
                  <Text style={{
                    color: isUser ? palette.onBrand : palette.onSurface,
                    fontSize: fontSize.base, lineHeight: 21,
                    fontStyle: item.pending ? 'italic' : 'normal',
                    opacity: item.pending ? 0.7 : 1,
                  }}>
                    {item.pending && !item.content ? 'Thinking…' : item.content}
                  </Text>
                </View>
              );
            }}
          />

          {partial ? (
            <View style={{
              marginHorizontal: spacing.xl, marginBottom: spacing.sm,
              padding: spacing.md, borderRadius: radius.md,
              backgroundColor: palette.brandTertiary + '30', borderWidth: 1, borderColor: palette.brand,
            }}>
              <Text style={{ color: palette.brand, fontSize: fontSize.sm, fontStyle: 'italic' }}>
                {partial}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text style={{ color: palette.error, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.sm }}>
              {error}
            </Text>
          ) : null}

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.xl,
            borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border,
            backgroundColor: palette.surface,
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message Sara…"
              placeholderTextColor={palette.onSurfaceTertiary}
              style={{
                flex: 1, backgroundColor: palette.surfaceSecondary,
                borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 12,
                color: palette.onSurface, fontSize: fontSize.base,
                borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border,
              }}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              testID="chat-input"
            />
            {input.trim() ? (
              <Pressable
                onPress={() => send(input)}
                testID="chat-send-button"
                style={{
                  width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: palette.brand,
                }}
              >
                <Ionicons name="send" size={20} color={palette.onBrand} />
              </Pressable>
            ) : (
              <Pressable
                onPress={listening ? stopListen : startListen}
                testID="chat-mic-button"
                style={{
                  width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: listening ? palette.error : palette.brand,
                }}
              >
                <Ionicons name={listening ? 'stop' : 'mic'} size={22} color={palette.onBrand} />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {messages.length === 0 && !listening ? (
        <View pointerEvents="none" style={{
          position: 'absolute', bottom: 200, left: 0, right: 0, alignItems: 'center', opacity: 0.3,
        }}>
          <MicButton active={false} onPress={() => {}} />
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  header: (sp: any) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: sp.xl,
    paddingTop: sp.md,
    paddingBottom: sp.md,
    gap: sp.md,
  }),
};
