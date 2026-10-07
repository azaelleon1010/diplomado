import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native-web';
import { ChatMessage } from './ChatMessage';
import { AssistantInput } from './AssistantInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content:
      'Inventario actualizado.\n\nMaterial: Tela sintética TS-204\nMovimiento: -50 rollos\nAlmacén: B\nOrden: OT-104\n\nDisponible: 12 rollos',
  },
];

export function AssistantPanel() {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [loading, setLoading] = useState(false);

  const handleSend = (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // MOCK: Simulate assistant response delay
    setTimeout(() => {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Recibido: "${text}"\n\nEste es el asistente ConvOps. En producción, aquí se conectaría con el motor de intenciones y se ejecutarían las reglas de negocio correspondientes.\n\nEstado: MOCK`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLoading(false);
    }, 800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ConvOps Assistant</Text>
        <Text style={styles.subtitle}>La red que mueve tu operación.</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage role={item.role} content={item.content} />}
        style={styles.list}
        inverted={false}
        keyboardShouldPersistTaps="handled"
      />

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loading}>Conectando con motor de intenciones...</Text>
        </View>
      )}

      <AssistantInput onSend={handleSend} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    flexDirection: 'column',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2F4F4F',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    padding: 12,
    paddingLeft: 24,
  },
  loading: {
    color: '#00FFCC',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
