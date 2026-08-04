import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { apiRequest } from '../services/api';
import { userFacingError } from '../utils/userFacingError';
import { TicketListSkeleton } from './Skeleton';

type Reply = {
  role: 'user' | 'admin';
  message: string;
  authorName: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  code: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  replies: Reply[];
  unread?: boolean;
  unreadByUser?: boolean;
  lastMessageAt?: string;
  lastMessageRole?: 'user' | 'admin';
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
};

type SupportModalProps = {
  visible: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
};

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'account', label: 'Account' },
  { id: 'feature', label: 'Feature' },
  { id: 'billing', label: 'Billing' },
  { id: 'other', label: 'Other' },
];

function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}

function isUnread(t: Ticket) {
  return !!(t.unread || t.unreadByUser);
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!t) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

export function SupportModal({ visible, onClose, onUnreadChange }: SupportModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore(s => s.token);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selected, setSelected] = useState<Ticket | null>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('bug');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{ tickets: Ticket[]; unreadCount?: number }>(
        '/api/support/tickets',
        { token },
      );
      const list = data.tickets || [];
      setTickets(list);
      const count = data.unreadCount ?? list.filter(isUnread).length;
      setUnreadCount(count);
      onUnreadChange?.(count);
    } catch (e: any) {
      setError(userFacingError(e, 'Couldn’t load your tickets. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [token, onUnreadChange]);

  useEffect(() => {
    if (visible) {
      setMode('list');
      setSelected(null);
      void load();
    }
  }, [visible, load]);

  const markRead = useCallback(
    async (ticket: Ticket) => {
      if (!token || !isUnread(ticket)) return ticket;
      try {
        const data = await apiRequest<{ ticket: Ticket }>(
          `/api/support/tickets/${ticket.id}/read`,
          { method: 'POST', token },
        );
        const next = data.ticket;
        setTickets(prev => prev.map(t => (t.id === next.id ? next : t)));
        setUnreadCount(c => {
          const n = Math.max(0, c - 1);
          onUnreadChange?.(n);
          return n;
        });
        return next;
      } catch {
        return { ...ticket, unread: false, unreadByUser: false };
      }
    },
    [token, onUnreadChange],
  );

  const openCreate = () => {
    setSubject('');
    setBody('');
    setCategory('bug');
    setError('');
    setMode('create');
  };

  const openDetail = async (t: Ticket) => {
    setReply('');
    setError('');
    setMode('detail');
    setSelected(t);
    const updated = await markRead(t);
    setSelected(updated);
  };

  const createTicket = async () => {
    if (!token) return;
    if (subject.trim().length < 3) {
      setError('Add a short subject.');
      return;
    }
    if (body.trim().length < 10) {
      setError('Describe the issue in a bit more detail.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest<{ ticket: Ticket }>('/api/support/tickets', {
        method: 'POST',
        token,
        body: {
          subject: subject.trim(),
          body: body.trim(),
          category,
          platform: Platform.OS,
        },
      });
      setTickets(prev => [data.ticket, ...prev]);
      setSelected(data.ticket);
      setMode('detail');
    } catch (e: any) {
      setError(userFacingError(e, 'Couldn’t create your ticket. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!token || !selected) return;
    const text = reply.trim();
    if (text.length < 2) return;
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest<{ ticket: Ticket }>(
        `/api/support/tickets/${selected.id}/replies`,
        { method: 'POST', token, body: { message: text } },
      );
      setSelected(data.ticket);
      setTickets(prev => prev.map(t => (t.id === data.ticket.id ? data.ticket : t)));
      setReply('');
    } catch (e: any) {
      setError(userFacingError(e, 'Couldn’t send your reply. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const headerTitle =
    mode === 'create' ? 'New ticket' : mode === 'detail' ? selected?.code || 'Ticket' : 'Support';

  const onBack = () => {
    if (mode === 'list') onClose();
    else {
      setMode('list');
      setSelected(null);
      setError('');
      void load();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onBack}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>{mode === 'list' ? 'Close' : '‹ Back'}</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{headerTitle}</Text>
            {mode === 'list' && unreadCount > 0 ? (
              <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.headerBadgeText}>{unreadCount} new</Text>
              </View>
            ) : null}
          </View>
          {mode === 'list' ? (
            <Pressable onPress={openCreate} hitSlop={12} style={styles.newPill}>
              <Text style={[styles.newBtn, { color: colors.primaryLight }]}>+ New</Text>
            </Pressable>
          ) : (
            <View style={{ width: 56 }} />
          )}
        </View>

        {mode === 'list' && (
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primaryLight} />
            }
          >
            <View style={[styles.hero, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '33' }]}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>We're here to help</Text>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                Open a ticket for bugs or account issues. New support replies show as unread until
                you open them.
              </Text>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
            {loading && !tickets.length ? <TicketListSkeleton /> : null}
            {!loading && !tickets.length ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No tickets yet</Text>
                <Text style={styles.emptySub}>Tap + New to open a support request.</Text>
                <Pressable style={[styles.emptyBtn, { backgroundColor: colors.primary + '22' }]} onPress={openCreate}>
                  <Text style={[styles.emptyBtnText, { color: colors.primaryLight }]}>Create ticket</Text>
                </Pressable>
              </View>
            ) : null}

            {tickets.map(t => {
              const unread = isUnread(t);
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.card,
                    {
                      borderColor: unread ? colors.primary + '88' : colors.border,
                      backgroundColor: unread ? colors.primary + '12' : colors.surface,
                    },
                  ]}
                  onPress={() => openDetail(t)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
                      <Text style={[styles.code, unread && { color: colors.primaryLight }]}>
                        {t.code}
                      </Text>
                      {unread ? (
                        <View style={[styles.newTag, { backgroundColor: colors.primary }]}>
                          <Text style={styles.newTagText}>NEW</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.status,
                        {
                          color:
                            t.status === 'resolved' || t.status === 'closed'
                              ? colors.textMuted
                              : colors.primaryLight,
                        },
                      ]}
                    >
                      {statusLabel(t.status)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.cardSubject, unread && { fontWeight: '800' }]}
                    numberOfLines={1}
                  >
                    {t.subject}
                  </Text>
                  <Text style={styles.preview} numberOfLines={2}>
                    {t.lastMessageRole === 'admin' ? 'Support: ' : 'You: '}
                    {t.lastMessagePreview || t.body}
                  </Text>
                  <Text style={styles.cardMeta}>{timeAgo(t.lastMessageAt || t.updatedAt)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {mode === 'create' && (
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Category</Text>
            <View style={styles.chips}>
              {CATEGORIES.map(c => {
                const on = category === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategory(c.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor: on ? colors.primary : colors.border,
                        backgroundColor: on ? colors.primary + '22' : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? colors.primaryLight : colors.textSecondary,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={[styles.field, { color: colors.text, borderColor: colors.border }]}
              value={subject}
              onChangeText={setSubject}
              placeholder="Short summary"
              placeholderTextColor={colors.textMuted}
              maxLength={120}
            />

            <Text style={[styles.label, { marginTop: Spacing.md }]}>Details</Text>
            <TextInput
              style={[styles.area, { color: colors.text, borderColor: colors.border }]}
              value={body}
              onChangeText={setBody}
              placeholder="What went wrong? Steps to reproduce help a lot."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={4000}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.submitWrap, busy && { opacity: 0.6 }]}
              onPress={createTicket}
              disabled={busy}
            >
              <LinearGradient
                colors={[...actionGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGrad}
              >
                {busy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>Submit ticket</Text>
                )}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        )}

        {mode === 'detail' && selected && (
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.detailHead}>
              <Text style={styles.detailSubject}>{selected.subject}</Text>
              <View style={styles.detailMetaRow}>
                <View style={[styles.statusPill, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.statusPillText, { color: colors.primaryLight }]}>
                    {statusLabel(selected.status)}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>{selected.category}</Text>
              </View>
            </View>

            <View style={styles.thread}>
              {(selected.replies?.length
                ? selected.replies
                : [
                    {
                      role: 'user' as const,
                      message: selected.body,
                      authorName: 'You',
                      createdAt: selected.createdAt,
                    },
                  ]
              ).map((r, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    r.role === 'admin'
                      ? {
                          backgroundColor: colors.primary + '18',
                          alignSelf: 'flex-start',
                          borderLeftWidth: 3,
                          borderLeftColor: colors.primary,
                        }
                      : {
                          backgroundColor: colors.surface,
                          alignSelf: 'flex-end',
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                  ]}
                >
                  <Text style={styles.bubbleWho}>
                    {r.role === 'admin' ? 'Expenso Support' : r.authorName || 'You'}
                  </Text>
                  <Text style={styles.bubbleText}>{r.message}</Text>
                  <Text style={styles.bubbleTime}>{new Date(r.createdAt).toLocaleString()}</Text>
                </View>
              ))}
            </View>

            {selected.status !== 'closed' ? (
              <>
                <Text style={styles.label}>Add a reply</Text>
                <TextInput
                  style={[
                    styles.area,
                    { color: colors.text, borderColor: colors.border, minHeight: 90 },
                  ]}
                  value={reply}
                  onChangeText={setReply}
                  placeholder="Follow-up for the support team…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
                {!!error && <Text style={styles.error}>{error}</Text>}
                <Pressable
                  style={[styles.submitWrap, (busy || reply.trim().length < 2) && { opacity: 0.5 }]}
                  onPress={sendReply}
                  disabled={busy || reply.trim().length < 2}
                >
                  <LinearGradient
                    colors={[...actionGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGrad}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitText}>Send reply</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <Text style={styles.hint}>This ticket is closed.</Text>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.sm,
    },
    headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
    headerBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radius.full,
    },
    headerBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
    back: { ...Typography.bodyBold, color: colors.primaryLight, minWidth: 56 },
    title: { ...Typography.h3, color: colors.text },
    newPill: { minWidth: 56, alignItems: 'flex-end' },
    newBtn: { ...Typography.bodyBold },
    body: { padding: Spacing.lg },
    hero: {
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    heroTitle: { ...Typography.bodyBold, fontSize: 17, marginBottom: 4 },
    heroSub: { ...Typography.body, lineHeight: 21, fontSize: 14 },
    hint: { ...Typography.body, color: colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
    label: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    field: {
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
    area: {
      minHeight: 120,
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      backgroundColor: colors.surface,
      fontSize: 16,
      lineHeight: 22,
    },
    error: { ...Typography.caption, color: colors.danger, marginTop: Spacing.sm },
    submitWrap: {
      marginTop: Spacing.lg,
      height: 48,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    submitGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    submitText: { ...Typography.bodyBold, color: '#FFF' },
    card: {
      borderWidth: 1,
      borderRadius: Radius.xl,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
    cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    newTag: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    newTagText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
    code: { ...Typography.caption, color: colors.textMuted, fontWeight: '800' },
    status: { ...Typography.caption, fontWeight: '700', textTransform: 'capitalize' },
    cardSubject: { ...Typography.bodyBold, color: colors.text, fontSize: 16 },
    preview: { ...Typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    cardMeta: { ...Typography.caption, color: colors.textMuted, marginTop: 6 },
    empty: { alignItems: 'center', paddingVertical: Spacing.xl },
    emptyTitle: { ...Typography.h3, color: colors.text },
    emptySub: { ...Typography.body, color: colors.textSecondary, marginTop: Spacing.sm },
    emptyBtn: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
    },
    emptyBtnText: { ...Typography.bodyBold },
    detailHead: { marginBottom: Spacing.md },
    detailSubject: { ...Typography.h3, color: colors.text, marginBottom: 8 },
    detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
    },
    statusPillText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
    thread: { marginTop: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.lg },
    bubble: {
      maxWidth: '92%',
      borderRadius: Radius.lg,
      padding: Spacing.md,
    },
    bubbleWho: {
      ...Typography.caption,
      fontWeight: '800',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    bubbleText: { ...Typography.body, color: colors.text, lineHeight: 20 },
    bubbleTime: { ...Typography.caption, color: colors.textMuted, marginTop: 6, fontSize: 11 },
  });
}
