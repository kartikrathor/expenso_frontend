import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  InboxNotification,
  useNotificationInboxStore,
} from '../store/notificationInboxStore';
import { useNotificationNavStore } from '../store/notificationNavStore';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function typeLabel(type: string) {
  switch (type) {
    case 'support_reply':
    case 'support_ticket':
      return 'Support';
    case 'joint_expense':
      return 'Joint';
    case 'admin_broadcast':
      return 'Update';
    default:
      return 'Alert';
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items = useNotificationInboxStore(s => s.items);
  const markRead = useNotificationInboxStore(s => s.markRead);
  const markAllRead = useNotificationInboxStore(s => s.markAllRead);
  const clearAll = useNotificationInboxStore(s => s.clearAll);
  const requestOpenSupport = useNotificationNavStore(s => s.requestOpenSupport);

  const onOpenItem = (item: InboxNotification) => {
    markRead(item.id);
    if (
      (item.type === 'support_reply' || item.type === 'support_ticket') &&
      item.ticketId
    ) {
      onClose();
      requestOpenSupport(item.ticketId);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
          <Pressable onPress={markAllRead} hitSlop={12}>
            <Text style={styles.action}>Read all</Text>
          </Pressable>
        </View>

        {items.length ? (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            ListHeaderComponent={
              <View style={styles.toolbar}>
                <Text style={styles.count}>
                  {items.filter(i => !i.read).length} unread · {items.length} total
                </Text>
                <Pressable onPress={clearAll}>
                  <Text style={styles.clear}>Clear</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => onOpenItem(item)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{typeLabel(item.type)}</Text>
                  </View>
                  <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
                {!item.read ? <View style={styles.dot} /> : null}
              </Pressable>
            )}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              Admin updates, support replies, and joint activity will show up here when the app
              receives them.
            </Text>
          </ScrollView>
        )}
      </View>
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
    },
    back: { ...Typography.body, color: colors.primaryLight, fontWeight: '600', minWidth: 64 },
    title: { ...Typography.h3, color: colors.text },
    action: { ...Typography.caption, color: colors.primaryLight, fontWeight: '700', minWidth: 64, textAlign: 'right' },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    count: { ...Typography.caption, color: colors.textMuted },
    clear: { ...Typography.caption, color: colors.danger, fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      position: 'relative',
    },
    cardUnread: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '12',
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    pill: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    pillText: {
      ...Typography.caption,
      fontSize: 10,
      fontWeight: '800',
      color: colors.primaryLight,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    when: { ...Typography.caption, color: colors.textMuted, fontSize: 11 },
    cardTitle: { ...Typography.bodyBold, color: colors.text },
    cardBody: { ...Typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    dot: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    empty: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
    emptyTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.sm },
    emptyBody: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
