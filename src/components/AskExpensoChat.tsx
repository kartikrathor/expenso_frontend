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
  ActionSheetIOS,
  Share,
  ToastAndroid,
  NativeModules,
  type KeyboardEvent,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { useProStore } from '../store/proStore';
import { apiRequest, ApiError } from '../services/api';
import { Expense } from '../types/expense';
import { AppAlertModal, AppAlertContent } from './AppAlertModal';
import { ChatHistorySkeleton } from './Skeleton';
import { SpiderWebBackground } from './SpiderWebBackground';
import { userFacingError } from '../utils/userFacingError';
import { MonthlyBudgetEntry } from '../utils/monthlyBudget';
import {
  detectChatLang,
  localizeChips,
  START_CHIPS,
  WELCOME,
  ChatLang,
} from '../utils/chatLocale';
import {
  loadAskChatHistory,
  saveAskChatHistory,
  withTimestamps,
  getAskChatHistoryCached,
  getAskChatClearEpoch,
  subscribeAskChatCleared,
} from '../utils/askChatHistory';

/**
 * Prefer native clipboard when linked (after rebuild). Otherwise Share sheet — never crash.
 */
async function copyTextToClipboard(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;

  const native = NativeModules.RNCClipboard as
    | { setString?: (value: string) => void }
    | undefined;
  if (typeof native?.setString === 'function') {
    native.setString(t);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied', ToastAndroid.SHORT);
    }
    return;
  }

  await Share.share({ message: t, title: 'Copy message' });
}

type ChatBubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: string[];
  intent?: string;
  createdAt?: number;
  /** How this reply was produced */
  source?: 'rules' | 'llm' | 'fallback' | 'precise';
  /** Show “more accurate” under this assistant reply */
  canPrecise?: boolean;
};

type AskExpensoChatProps = {
  expenses: Expense[];
  monthlyBudget: number;
  monthlyBudgets: MonthlyBudgetEntry[];
  repeatMonthlyBudget: boolean;
  isJoint: boolean;
};

function startChipsFor(lang: ChatLang, isJoint: boolean) {
  const set = START_CHIPS[lang];
  return isJoint ? set.joint : set.default;
}

function welcomeBubble(isJoint: boolean): ChatBubble {
  const chips = startChipsFor('en', isJoint);
  return {
    id: 'welcome',
    role: 'assistant',
    text: isJoint ? WELCOME.en.joint : WELCOME.en.solo,
    chips,
    createdAt: Date.now(),
  };
}

function localTodayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function mapStored(stored: ReturnType<typeof getAskChatHistoryCached>): ChatBubble[] {
  if (!stored || !stored.length) return [];
  return stored.map(m => ({
    id: m.id,
    role: m.role,
    text: m.text,
    chips: m.chips,
    intent: m.intent,
    createdAt: m.createdAt,
    source: m.source,
    canPrecise: m.source === 'precise' ? false : m.canPrecise !== false,
  }));
}

function initialMessages(
  userId: string | undefined,
  isJoint: boolean,
): { messages: ChatBubble[]; ready: boolean } {
  if (!userId) {
    return { messages: [welcomeBubble(isJoint)], ready: true };
  }
  const cached = getAskChatHistoryCached(userId, isJoint);
  if (cached === null) {
    // Never blank the Ask tab while AsyncStorage hydrates — show welcome, swap if history exists
    return { messages: [welcomeBubble(isJoint)], ready: true };
  }
  const mapped = mapStored(cached);
  const hasReal = mapped.some(m => m.id !== 'welcome');
  if (hasReal) {
    return {
      messages: mapped.filter(m => m.id !== 'welcome' || mapped.length === 1),
      ready: true,
    };
  }
  return { messages: [welcomeBubble(isJoint)], ready: true };
}

export function AskExpensoChat({
  expenses,
  monthlyBudget,
  monthlyBudgets,
  repeatMonthlyBudget,
  isJoint,
}: AskExpensoChatProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore(s => s.token);
  const userId = useAuthStore(s => s.user?.id);
  const isPro = useProStore(s => s.isPro);
  const openPaywall = useProStore(s => s.openPaywall);
  const tabInset = getTabBarBottomInset(insets.bottom);
  const initialLang: ChatLang = 'en';
  const boot = useMemo(
    () => initialMessages(userId, isJoint),
    // only for first mount identity — reload handled in effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [chatLang, setChatLang] = useState<ChatLang>(initialLang);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chips, setChips] = useState<string[]>(() => {
    const last = boot.messages[boot.messages.length - 1];
    return last?.chips?.length ? last.chips : startChipsFor(initialLang, isJoint);
  });
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const [historyReady, setHistoryReady] = useState(boot.ready);
  const [lastIntent, setLastIntent] = useState<string | undefined>(() => {
    const hit = [...boot.messages].reverse().find(m => m.role === 'assistant' && m.intent);
    return hit?.intent;
  });
  const [preciseBusyId, setPreciseBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>(boot.messages);
  const listRef = useRef<FlatList>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLatest = useCallback((animated = true) => {
    // The list is inverted, so offset 0 is the newest message.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);
  /** Block persist until first AsyncStorage read finishes (avoids wiping real history with welcome). */
  const hydratePending = useRef(
    !!userId && getAskChatHistoryCached(userId, isJoint) === null,
  );

  // Newest-first for inverted FlatList (chat sticks to bottom without scroll jump)
  const listData = useMemo(() => [...messages].reverse(), [messages]);

  // Restore last 30 days of chat (per user + personal/joint)
  useEffect(() => {
    let cancelled = false;
    const apply = (mapped: ChatBubble[]) => {
      const welcome = welcomeBubble(isJoint);
      const hasReal = mapped.some(m => m.id !== 'welcome');
      const next = hasReal
        ? mapped.filter(m => m.id !== 'welcome' || mapped.length === 1)
        : [welcome];
      setMessages(next);
      const last = next[next.length - 1];
      if (last?.chips?.length) setChips(last.chips);
      else setChips(welcome.chips || startChipsFor('en', isJoint));
      const lastIntentMsg = [...next].reverse().find(m => m.role === 'assistant' && m.intent);
      setLastIntent(lastIntentMsg?.intent);
      hydratePending.current = false;
      setHistoryReady(true);
    };

    const cached = userId ? getAskChatHistoryCached(userId, isJoint) : null;
    if (!userId) {
      hydratePending.current = false;
      apply([]);
      return;
    }
    if (cached !== null) {
      hydratePending.current = false;
      apply(mapStored(cached));
      return;
    }

    hydratePending.current = true;
    // Keep welcome visible; only swap when stored history has real turns
    (async () => {
      const stored = await loadAskChatHistory(userId, isJoint);
      if (cancelled) return;
      apply(mapStored(stored));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isJoint]);

  // Clear all data / wipe: drop in-memory thread so it can't re-save itself
  useEffect(() => {
    return subscribeAskChatCleared(clearedUserId => {
      if (!userId || clearedUserId !== userId) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const welcome = welcomeBubble(isJoint);
      setMessages([welcome]);
      setChips(welcome.chips || startChipsFor('en', isJoint));
      setLastIntent(undefined);
      setInput('');
      setPreciseBusyId(null);
      setHistoryReady(true);
    });
  }, [userId, isJoint]);

  // Persist chat (debounce) — auto-prunes > 30 days on save
  useEffect(() => {
    if (!historyReady || !userId || hydratePending.current) return;
    const epoch = getAskChatClearEpoch();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (hydratePending.current) return;
      void saveAskChatHistory(userId, isJoint, withTimestamps(messages), { epoch });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Flush latest on unmount / dependency change so leaving Ask doesn't drop last turn
      if (!hydratePending.current) {
        void saveAskChatHistory(userId, isJoint, withTimestamps(messages), { epoch });
      }
    };
  }, [messages, userId, isJoint, historyReady]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      setKeyboardOpen(true);
      // iOS: KeyboardAvoidingView handles lift.
      // Android + floating tabs: window often does not resize — pin composer above keyboard.
      if (Platform.OS === 'ios') {
        setKeyboardLift(0);
        return;
      }
      setKeyboardLift(Math.round(e.endCoordinates.height));
    };
    const onHide = () => {
      setKeyboardOpen(false);
      setKeyboardLift(0);
    };
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

  // Above floating tab when closed; when keyboard open, clear tab space.
  const composerSafePad = keyboardOpen
    ? Math.max(insets.bottom, Spacing.sm)
    : tabInset;
  const [alert, setAlert] = useState<AppAlertContent | null>(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const copyMessage = useCallback((text: string) => {
    const t = (text || '').trim();
    if (!t) return;
    ReactNativeHapticFeedback.trigger('notificationSuccess', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    void copyTextToClipboard(t);
  }, []);

  const onBubbleLongPress = useCallback(
    (item: ChatBubble) => {
      const text = (item.text || '').trim();
      if (!text) return;
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      const title = item.role === 'user' ? 'Your message' : 'AI reply';
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Copy', 'Cancel'],
            cancelButtonIndex: 1,
            title,
          },
          idx => {
            if (idx === 0) copyMessage(text);
          },
        );
        return;
      }
      setAlert({
        icon: '📋',
        title,
        message: 'Copy this message to your clipboard.',
        buttons: [
          { label: 'Cancel', variant: 'secondary' },
          { label: 'Copy', variant: 'primary', onPress: () => copyMessage(text) },
        ],
      });
    },
    [copyMessage],
  );

  const send = useCallback(
    async (raw: string, mode: 'keyboard' | 'chip' = 'keyboard') => {
      const text = raw.trim();
      if (!text || !token || busy) return;

      // Always read latest entitlement (avoid stale closure / cached Pro)
      if (!useProStore.getState().isPro) {
        openPaywall('ask_ai');
        return;
      }

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

      const lastBubble = messagesRef.current[messagesRef.current.length - 1];
      const chipContext =
        mode === 'chip' && lastBubble?.role === 'assistant'
          ? {
              afterReply: lastBubble.text,
              afterIntent: lastBubble.intent,
              chipsShown: lastBubble.chips || chips,
            }
          : undefined;

      const userMsg: ChatBubble = {
        id: `u_${Date.now()}`,
        role: 'user',
        text,
        createdAt: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      scrollToLatest();
      if (mode === 'keyboard') setInput('');
      setBusy(true);

      try {
        const data = await apiRequest<{
          reply: string;
          chips?: string[];
          intent?: string;
          source?: 'rules' | 'llm' | 'fallback' | 'precise';
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
            monthlyBudgets,
            repeatMonthlyBudget,
            isJoint,
            inputMode: mode,
            lastIntent,
            lang,
            clientToday: localTodayKey(),
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            history: prior,
            ...(chipContext ? { chipContext } : {}),
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
            createdAt: Date.now(),
            source: data.source,
            canPrecise: data.source !== 'precise',
          },
        ]);
        scrollToLatest();
        setChips(replyChips);
      } catch (err: any) {
        const proBlocked =
          err instanceof ApiError &&
          (err.code === 'PRO_REQUIRED' || err.status === 403);
        if (proBlocked) {
          // Drop optimistic user bubble — free users must not keep an Ask thread going
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          if (mode === 'keyboard') setInput(text);
          openPaywall('ask_ai');
          return;
        }
        setMessages(prev => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text: userFacingError(
              err,
              'Couldn’t reach Ask Expenso right now. Check your internet and try again.',
            ),
            chips: startChipsFor(lang, isJoint),
            createdAt: Date.now(),
            source: 'fallback',
            canPrecise: true,
          },
        ]);
        scrollToLatest();
      } finally {
        setBusy(false);
      }
    },
    [
      token,
      busy,
      expenses,
      monthlyBudget,
      monthlyBudgets,
      repeatMonthlyBudget,
      isJoint,
      lastIntent,
      chips,
      openPaywall,
      scrollToLatest,
    ],
  );

  const requestPrecise = useCallback(
    async (assistantMsg: ChatBubble) => {
      if (!token || busy || preciseBusyId || assistantMsg.role !== 'assistant') return;
      if (assistantMsg.id === 'welcome') return;
      if (!useProStore.getState().isPro) {
        openPaywall('ask_ai');
        return;
      }

      const idx = messagesRef.current.findIndex(m => m.id === assistantMsg.id);
      const priorUser =
        idx > 0
          ? [...messagesRef.current.slice(0, idx)].reverse().find(m => m.role === 'user')
          : undefined;
      const question = priorUser?.text?.trim();
      if (!question) return;

      setPreciseBusyId(assistantMsg.id);
      const lang = detectChatLang(question);
      setChatLang(lang);

      const prior = messagesRef.current
        .filter(m => m.id !== 'welcome')
        .slice(-8)
        .map(m => ({
          role: m.role,
          text: m.text,
          intent: m.intent,
        }));

      try {
        const data = await apiRequest<{
          reply: string;
          chips?: string[];
          intent?: string;
          source?: string;
          tokensRemaining?: number;
          tokensLimit?: number;
        }>('/api/assistant/precise', {
          method: 'POST',
          token,
          timeoutMs: 35000,
          body: {
            message: question,
            previousReply: assistantMsg.text,
            monthlyBudget,
            monthlyBudgets,
            repeatMonthlyBudget,
            isJoint,
            lang,
            clientToday: localTodayKey(),
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            history: prior,
            // Full expense list goes to server for AI — never shown in UI
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

        // Replace the quick reply in-place — user only sees the better answer
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  text: data.reply,
                  chips: replyChips,
                  intent: data.intent,
                  source: 'precise',
                  canPrecise: false,
                  createdAt: Date.now(),
                }
              : m,
          ),
        );
        setChips(replyChips);
      } catch (err: any) {
        const proBlocked =
          err instanceof ApiError &&
          (err.code === 'PRO_REQUIRED' || err.status === 403);
        if (proBlocked) {
          openPaywall('ask_ai');
          return;
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  text:
                    (m.text || '') +
                    '\n\n' +
                    userFacingError(
                      err,
                      'Couldn’t get a more detailed answer. Please try again in a bit.',
                    ),
                }
              : m,
          ),
        );
      } finally {
        setPreciseBusyId(null);
      }
    },
    [
      token,
      busy,
      preciseBusyId,
      expenses,
      monthlyBudget,
      monthlyBudgets,
      repeatMonthlyBudget,
      isJoint,
      openPaywall,
    ],
  );

  const rootProps =
    Platform.OS === 'ios'
      ? {
          behavior: 'padding' as const,
          keyboardVerticalOffset: insets.top,
        }
      : {};

  return (
    <View
      style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView style={styles.root} {...rootProps}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Ask Expenso</Text>
            <Text style={styles.subtitle}>
              {isPro
                ? isJoint
                  ? 'Joint data · smart assistant'
                  : 'Your data · smart assistant'
                : 'Pro · 500 tokens / day'}
            </Text>
          </View>
          {isPro && tokensLeft != null ? (
            <View style={styles.tokenPill}>
              <Text style={styles.tokenText}>
                {tokensLeft}/{tokensLimit}
              </Text>
            </View>
          ) : !isPro ? (
            <Pressable style={styles.lockPill} onPress={() => openPaywall('ask_ai')}>
              <Text style={styles.lockPillText}>🔒 Pro</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Webs only behind the message list — never over header / composer */}
        <View style={styles.listShell}>
          <View style={styles.listWebs} pointerEvents="none" collapsable={false}>
            <SpiderWebBackground opacity={0.22} />
          </View>

          {!historyReady ? (
            <View style={styles.listFlex}>
              <ChatHistorySkeleton />
            </View>
          ) : (
            <View style={styles.listFront} collapsable={false}>
              <FlatList
                ref={listRef}
                style={styles.listFlex}
                data={listData}
                inverted
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                removeClippedSubviews={false}
                renderItem={({ item }) => {
                  const showPrecise =
                    isPro &&
                    item.role === 'assistant' &&
                    item.id !== 'welcome' &&
                    item.canPrecise !== false &&
                    item.source !== 'precise';
                  const refining = preciseBusyId === item.id;
                  return (
                    <View
                      style={[
                        styles.bubbleWrap,
                        item.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
                      ]}
                    >
                      <Pressable
                        onLongPress={() => onBubbleLongPress(item)}
                        delayLongPress={350}
                        accessibilityHint="Long press to copy"
                        style={[
                          styles.bubble,
                          item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            item.role === 'user'
                              ? styles.bubbleTextUser
                              : styles.bubbleTextAssistant,
                          ]}
                          selectable={false}
                        >
                          {item.text}
                        </Text>
                      </Pressable>
                      {showPrecise && (
                        <Pressable
                          style={styles.preciseBtn}
                          onPress={() => requestPrecise(item)}
                          disabled={!!preciseBusyId || busy || refining}
                          hitSlop={8}
                        >
                          {refining ? (
                            <ActivityIndicator size="small" color={colors.primaryLight} />
                          ) : (
                            <Text style={styles.preciseText}>✦ Need a more accurate answer</Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                }}
              />
            </View>
          )}
        </View>

        <View
          style={[
            styles.inputBar,
            {
              paddingBottom: composerSafePad,
              marginBottom: keyboardLift,
              backgroundColor: colors.background,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {(messages[messages.length - 1]?.chips || chips).map((c, i) => (
              <Pressable
                key={`${i}-${c}`}
                style={[styles.chip, (busy || !isPro) && styles.chipDisabled]}
                onPress={() => {
                  if (!useProStore.getState().isPro) {
                    openPaywall('ask_ai');
                    return;
                  }
                  send(c, 'chip');
                }}
                disabled={busy}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {!isPro ? `🔒 ${c}` : c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                if (!useProStore.getState().isPro) openPaywall('ask_ai');
              }}
              disabled={isPro}
            >
              <TextInput
                style={[styles.input, !isPro && styles.inputLocked]}
                value={input}
                onChangeText={setInput}
                placeholder={
                  !isPro
                    ? 'Pro required for Ask AI'
                    : chatLang === 'hi'
                      ? 'e.g. is month kitna kharch?'
                      : 'e.g. how much this month?'
                }
                placeholderTextColor={colors.textMuted}
                editable={!busy && isPro}
                pointerEvents={isPro ? 'auto' : 'none'}
                onFocus={() => {
                  setTimeout(() => scrollToLatest(), 150);
                }}
                onSubmitEditing={() => send(input, 'keyboard')}
                returnKeyType="send"
                blurOnSubmit={false}
              />
            </Pressable>
            <Pressable
              style={[
                styles.sendBtn,
                ((isPro && !input.trim()) || busy) && styles.sendDisabled,
              ]}
              onPress={() => {
                if (!useProStore.getState().isPro) {
                  openPaywall('ask_ai');
                  return;
                }
                send(input, 'keyboard');
              }}
              disabled={busy || (isPro && !input.trim())}
            >
              {busy ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.sendText}>{isPro ? 'Ask' : 'Pro'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <AppAlertModal
        visible={!!alert}
        title={alert?.title || ''}
        message={alert?.message || ''}
        icon={alert?.icon}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1 },
    listShell: {
      flex: 1,
      position: 'relative',
    },
    listWebs: {
      ...StyleSheet.absoluteFillObject,
    },
    listFront: {
      flex: 1,
    },
    listFlex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
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
    lockPill: {
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radius.full,
      backgroundColor: colors.warning + '22',
      borderWidth: 1,
      borderColor: colors.warning + '55',
      marginLeft: Spacing.sm,
    },
    lockPillText: { ...Typography.small, color: colors.warning, fontWeight: '800' },
    list: { padding: Spacing.lg, paddingBottom: Spacing.md, flexGrow: 1 },
    bubbleWrap: { marginBottom: Spacing.sm, maxWidth: '92%' },
    bubbleWrapUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubbleWrapAssistant: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: {
      maxWidth: '100%',
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    bubbleUser: {
      backgroundColor: colors.primary,
    },
    bubbleAssistant: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: { ...Typography.body, lineHeight: 22 },
    bubbleTextUser: { color: '#FFF' },
    bubbleTextAssistant: { color: colors.text },
    preciseBtn: {
      marginTop: 4,
      paddingVertical: 4,
      paddingHorizontal: 2,
      minHeight: 22,
      justifyContent: 'center',
    },
    preciseText: {
      ...Typography.small,
      fontSize: 12,
      color: colors.primaryLight,
      fontWeight: '600',
      opacity: 0.9,
    },
    chipsScroll: {
      flexGrow: 0,
      maxHeight: 48,
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    chip: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.primary + '22',
      borderWidth: 1,
      borderColor: colors.primary + '55',
      marginRight: Spacing.sm,
    },
    chipDisabled: { opacity: 0.45 },
    chipText: {
      ...Typography.small,
      color: colors.primaryLight,
      fontWeight: '700',
      lineHeight: 16,
    },
    inputBar: {
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xs,
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
    inputLocked: {
      opacity: 0.7,
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
