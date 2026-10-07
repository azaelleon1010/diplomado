import React from 'react';
import { View, Text, StyleSheet } from 'react-native-web';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.user : styles.assistant]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{content}</Text>
      </View>
      <Text style={styles.role}>{isUser ? 'Tú' : 'ConvOps'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  user: { alignItems: 'flex-end' },
  assistant: { alignItems: 'flex-start' },
  userBubble: {
    backgroundColor: '#0047AB',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  assistantBubble: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#2F4F4F',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  text: { color: '#F1F5F9', fontSize: 14, lineHeight: 1.5 },
  userText: { color: '#FFFFFF' },
  role: { color: '#64748B', fontSize: 10, marginTop: 2, paddingHorizontal: 4 },
});
