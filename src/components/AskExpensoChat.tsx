import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { apiRequest } from '../services/api';
import { Expense } from '../types/expense';
import {
  detectChatLang,
  localizeChips,
  START_CHIPS,
  WELCOME,
  ChatLang,
} from '../utils/chatLocale';

type ChatBubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: string[];
  intent?: string;
};

type AskExpensoChatProps = {
  expenses: Expense[];
  monthlyBudget: number;
  isJoint: boolean;
};

function startChipsFor(lang: ChatLang, isJoint: boolean) {
  const set = START_CHIPS[lang];
  return isJoint ? set.joint : set.default;
}

export function AskExpensoChat({
  expenses,
  monthlyBudget,
  isJoint,
}: AskExpensoChatProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore(s => s.token);
  const tabInset = getTabBarBottomInset(insets.bottom);
  const initialLang: ChatLang = 'en';
  const startChips = startChipsFor(initialLang, isJoint);

  const [chatLang, setChatLang] = useState<ChatLang>(initialLang);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chips, setChips] = useState<string[]>(startChips);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: isJoint ? WELCOME.en.joint : WELCOME.en.solo,
      chips: startChips,
    },
  ]);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = () => {
      setKeyboardOpen(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    };
    const onHide = () => setKeyboardOpen(false);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const [tokensLeft, setTokensLeft] = useState<number | null>(null);
  const [tokensLimit, setTokensLimit] = useState(500);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ chips: string[] }>('/api/assistant/suggestions', { token })
      .then(data => {
        if (data.chips?.length) setChips(localizeChips(data.chips, 'en'));
      })
      .catch(() => {});
    apiRequest<{ remaining: number; limit: number }>('/api/assistant/usage', { token })
      .then(data => {
        if (typeof data.remaining === 'number') setTokensLeft(data.remaining);
        if (typeof data.limit === 'number') setTokensLimit(data.limit);
      })
      .catch(() => {});
  }, [token]);

  // Above floating tab when closed; flush to bottom when keyboard is open (tab bar hides).
  const composerPadBottom = keyboardOpen
    ? Math.max(insets.bottom, Spacing.sm)
    : tabInset;

  const [lastIntent, setLastIntent] = useState<string | undefined>();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const send = useCallback(
    async (raw: string, mode: 'keyboard' | 'chip' = 'keyboard') => {
      const text = raw.trim();
      if (!text || !token || busy) return;

      const lang = detectChatLang(text);
      setChatLang(lang);

      const prior = messagesRef.current
        .filter(m => m.id !== 'welcome')
        .slice(-8)
        .map(m => ({
          role: m.role,
          text: m.text,
          intent: m.intent,
        }));

      const userMsg: ChatBubble = {
        id: `u_${Date.now()}`,
        role: 'user',
        text,
      };
      setMessages(prev => [...prev, userMsg]);
      if (mode === 'keyboard') setInput('');
      setBusy(true);

      try {
        const data = await apiRequest<{
          reply: string;
          chips?: string[];
          intent?: string;
          source?: 'rules' | 'llm' | 'fallback';
          aiRemaining?: number;
          tokensRemaining?: number;
          tokensLimit?: number;
          tokenCost?: number;
        }>('/api/assistant/chat', {
          method: 'POST',
          token,
          timeoutMs: 25000,
          body: {
            message: text,
            monthlyBudget,
            isJoint,
            inputMode: mode,
            lastIntent,
            lang,
            history: prior,
            expenses: expenses.map(e => ({
              amount: e.amount,
              merchantLabel: e.merchantLabel,
              category: e.category,
              note: e.note,
              date: e.date,
              createdById: e.createdById,
              createdByName: e.createdByName,
              paidById: e.paidById,
              paidByName: e.paidByName,
              groupId: e.groupId,
              groupName: e.groupName,
            })),
          },
        });

        if (typeof data.tokensRemaining === 'number') setTokensLeft(data.tokensRemaining);
        if (typeof data.tokensLimit === 'number') setTokensLimit(data.tokensLimit);
        if (data.intent) setLastIntent(data.intent);

        const replyChips = localizeChips(
          data.chips?.length ? data.chips : startChipsFor(lang, isJoint),
          lang,
        );
        setMessages(prev => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text: data.reply,
            chips: replyChips,
            intent: data.intent,
          },
        ]);
        setChips(replyChips);
      } catch (err: any) {
        setMessages(prev => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text:
              err?.message ||
              'Server se baat nahi ho payi. Internet check karke dobara try karo.',
            chips: startChipsFor(lang, isJoint),
          },
        ]);
      } finally {
        setBusy(false);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [token, busy, expenses, monthlyBudget, isJoint, lastIntent],
  );

  const rootProps =
    Platform.OS === 'ios'
      ? {
          behavior: 'padding' as const,
          keyboardVerticalOffset: insets.top,
        }
      : {};

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}
      {...rootProps}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ask Expenso</Text>
          <Text style={styles.subtitle}>
            {isJoint ? 'Joint data · smart assistant' : 'Your data · smart assistant'}
          </Text>
        </View>
        {tokensLeft != null && (
          <View style={styles.tokenPill}>
            <Text style={styles.tokenText}>
              {tokensLeft}/{tokensLimit}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        ref={listRef}
        style={styles.listFlex}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
              ]}
            >
              {item.text}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipsRow}
          >
            {(messages[messages.length - 1]?.chips || chips).map(c => (
              <Pressable
                key={c}
                style={styles.chip}
                onPress={() => send(c, 'chip')}
                disabled={busy}
              >
                <Text style={styles.chipText}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        }
      />

      <View style={[styles.inputBar, { paddingBottom: composerPadBottom }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={
              chatLang === 'hi' ? 'e.g. is month kitna kharch?' : 'e.g. how much this month?'
            }
            placeholderTextColor={colors.textMuted}
            editable={!busy}
            onFocus={() => {
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
            }}
            onSubmitEditing={() => send(input, 'keyboard')}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || busy) && styles.sendDisabled]}
            onPress={() => send(input, 'keyboard')}
            disabled={!input.trim() || busy}
          >
            {busy ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.sendText}>Ask</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1 },
    listFlex: { flex: 1 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { ...Typography.h2, color: colors.text, fontSize: 22 },
    subtitle: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
    tokenPill: {
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radius.full,
      backgroundColor: colors.primary + '22',
      borderWidth: 1,
      borderColor: colors.primary + '55',
      marginLeft: Spacing.sm,
    },
    tokenText: { ...Typography.small, color: colors.primaryLight, fontWeight: '700' },
    list: { padding: Spacing.lg, paddingBottom: Spacing.md, flexGrow: 1 },
    bubble: {
      maxWidth: '88%',
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      marginBottom: Spacing.sm,
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
    },
    bubbleAssistant: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: { ...Typography.body, lineHeight: 22 },
    bubbleTextUser: { color: '#FFF' },
    bubbleTextAssistant: { color: colors.text },
    chipsRow: { paddingTop: Spacing.sm, paddingBottom: Spacing.md, gap: Spacing.sm },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.primary + '22',
      borderWidth: 1,
      borderColor: colors.primary + '55',
      marginRight: Spacing.sm,
    },
    chipText: { ...Typography.small, color: colors.primaryLight, fontWeight: '700' },
    inputBar: {
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
      color: colors.text,
      fontSize: 16,
    },
    sendBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      minWidth: 64,
      alignItems: 'center',
    },
    sendDisabled: { opacity: 0.45 },
    sendText: { ...Typography.bodyBold, color: '#FFF' },
  });
}
