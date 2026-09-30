import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { unreadAlertsCount } from '../data/alerts';
import type { ChatMessage } from '../types';

const QUICK_ACTIONS = [
  'Consultar inventario',
  'Reportar una falla',
  'Consultar producción',
  'Consultar vacaciones',
] as const;

function nowTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm0',
    role: 'assistant',
    text: 'Soy ConvOps, tu asistente de operaciones. Pídeme movimientos de inventario, reportes de falla o consultas de producción en lenguaje cotidiano.',
    time: '09:00',
  },
];

/** Local mock brain. Simulates confirmable commands without any API. */
function mockReply(input: string): ChatMessage {
  const text = input.toLowerCase();
  const time = nowTime();
  if (/(saca|salida|mueve|retira)/.test(text) && /(rollo|tela|almac|orden)/.test(text)) {
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'Encontré el siguiente movimiento:\n\nMaterial: Tela sintética\nCantidad: 50 rollos\nOrigen: Almacén B\nOrden: #104\n\n¿Confirmas el movimiento?',
      time,
      actions: ['confirm', 'cancel'],
    };
  }
  if (/(falla|falla|descompuest|avería|averia|rota|roto|hiladora|máquina|maquina)/.test(text)) {
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'Incidencia detectada:\n\nEquipo: Hiladora 4\nTipo: Falla mecánica\nDescripción: Banda rota\n\n¿Deseas registrar la incidencia?',
      time,
      actions: ['confirm', 'cancel'],
    };
  }
  if (/(vacacion|permiso|ausencia)/.test(text)) {
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'Tienes 12 días de vacaciones disponibles. Tu turno actual es 06:00 – 14:00.\n\n¿Deseas solicitar algún día?',
      time,
      actions: ['confirm', 'cancel'],
    };
  }
  if (/(inventario|stock|existencia)/.test(text)) {
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'Inventario actualizado:\n\nMaterial: Tela sintética TS-204\nMovimiento: -50 rollos\nAlmacén: B\nOrden: OT-104\n\nDisponible: 12 rollos',
      time,
    };
  }
  if (/(producci|orden|avance)/.test(text)) {
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'Orden #104 · Componente textil TX-40\n\nProgreso: 68%\nEstado: En proceso\nMáquina: Hiladora 4',
      time,
    };
  }
  return {
    id: `a-${Date.now()}`,
    role: 'assistant',
    text: 'Entendido. En esta fase de demostración solo simulo movimientos de inventario, incidencias y consultas básicas. Prueba con “Saca 50 rollos de tela sintética del almacén B para la orden 104”.',
    time,
  };
}

export function AssistantScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const pushAssistant = (reply: ChatMessage) => {
    setMessages((prev) => [...prev, reply]);
    setThinking(false);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (text.length === 0 || thinking) {
      return;
    }
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text, time: nowTime() }]);
    setInput('');
    setThinking(true);
    const reply = mockReply(text);
    setTimeout(() => pushAssistant(reply), 700);
  };

  const resolveAction = (id: string, action: 'confirm' | 'cancel') => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              actions: undefined,
              text: `${m.text}\n\n${action === 'confirm' ? '✓ Confirmado (mock).' : '✕ Cancelado (mock).'}`,
            }
          : m,
      ),
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Asistente"
        subtitle="ConvOps · La red que mueve tu producción"
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.flex}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.lg }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.role === 'user';
            return (
              <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: palette.brand }
                      : { backgroundColor: palette.surface, borderColor: palette.borderStrong, borderWidth: 1 },
                  ]}>
                  <Text style={[styles.message, { color: mine ? '#FFFFFF' : palette.textPrimary }]}>
                    {item.text}
                  </Text>
                  {item.actions !== undefined ? (
                    <View style={styles.actions}>
                      <Button
                        label="Confirmar"
                        onPress={() => resolveAction(item.id, 'confirm')}
                      />
                      <Button
                        label="Cancelar"
                        variant="secondary"
                        onPress={() => resolveAction(item.id, 'cancel')}
                      />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.time, { color: palette.textMuted }]}>
                  {mine ? `Tú · ${item.time}` : `ConvOps · ${item.time}`}
                </Text>
              </View>
            );
          }}
        />
        {thinking ? (
          <Text style={[styles.thinking, { color: palette.accent }]}>ConvOps está procesando…</Text>
        ) : null}
        <View style={[styles.quickRow, { borderTopColor: palette.borderStrong }]}>
          <FlatList
            data={[...QUICK_ACTIONS]}
            horizontal
            keyExtractor={(q) => q}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickContent}
            renderItem={({ item }) => <Chip label={item} onPress={() => send(item)} />}
          />
        </View>
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: palette.backgroundSecondary,
              borderTopColor: palette.borderStrong,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="¿Qué necesitas hacer?"
            placeholderTextColor={palette.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            accessibilityLabel="Escribe tu solicitud"
            style={[styles.input, { color: palette.textPrimary, backgroundColor: palette.surface, borderColor: palette.borderStrong }]}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={input.trim().length === 0 || thinking}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            style={({ pressed }) => [
              styles.send,
              {
                backgroundColor: palette.brand,
                opacity: input.trim().length === 0 || thinking ? 0.45 : pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={styles.sendGlyph}>›</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    maxWidth: '88%',
  },
  rowRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  message: {
    fontSize: typography.body.fontSize,
    lineHeight: 21,
  },
  time: {
    fontSize: typography.caption.fontSize,
    marginTop: 3,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  thinking: {
    fontSize: typography.bodySmall.fontSize,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  quickRow: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  quickContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    maxHeight: 110,
    minHeight: 44,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendGlyph: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
    marginTop: -3,
  },
});
