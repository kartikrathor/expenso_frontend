import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivityStore, ActivityItem } from '../store/activityStore';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { ExpenseCard } from '../components/ExpenseCard';
import { EmptyState } from '../components/EmptyState';
import { ThemeToggle } from '../components/ThemeToggle';
import { CATEGORIES, getCategoryConfig } from '../constants/categories';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useDeleteExpense } from '../hooks/useDeleteExpense';
import { useEditExpense } from '../hooks/useEditExpense';
import { formatCurrency } from '../utils/expenseParser';
import { CategoryId } from '../types/expense';
import { format, parseISO } from 'date-fns';

type Tab = 'expenses' | 'activity';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('expenses');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'added' | 'edited' | 'deleted'>('all');

  const { isJoint, expenses, onRefresh, refreshing } = useHouseholdExpenses();
  const activities = useActivityStore(s => s.activities);

  const { requestDelete, deleteModal } = useDeleteExpense();
  const { requestEdit, editModal } = useEditExpense();

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch =
        !search ||
        e.merchantLabel.toLowerCase().includes(search.toLowerCase()) ||
        e.note.toLowerCase().includes(search.toLowerCase()) ||
        e.amount.toString().includes(search);
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const filteredActivity = useMemo(() => {
    return activities.filter(a => {
      if (activityFilter !== 'all' && a.type !== activityFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.merchantLabel.toLowerCase().includes(q) ||
        a.note.toLowerCase().includes(q) ||
        a.amount.toString().includes(q) ||
        a.byName.toLowerCase().includes(q)
      );
    });
  }, [activities, activityFilter, search]);

  const ListHeader = useMemo(() => (
    <>
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>History 📋</Text>
            <Text style={styles.subtitle}>
              {tab === 'expenses'
                ? `${expenses.length} active · ${isJoint ? 'Joint' : 'Personal'}`
                : `${activities.length} activity logs`}
            </Text>
          </View>
          <ThemeToggle />
        </View>
      </Animated.View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'expenses' && styles.tabActive]}
          onPress={() => setTab('expenses')}
        >
          <Text style={[styles.tabText, tab === 'expenses' && styles.tabTextActive]}>Expenses</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'activity' && styles.tabActive]}
          onPress={() => setTab('activity')}
        >
          <Text style={[styles.tabText, tab === 'activity' && styles.tabTextActive]}>Activity</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={tab === 'activity' ? 'Search activity...' : 'Search merchant, amount...'}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      {tab === 'expenses' ? (
        <FlatList
          horizontal
          data={[{ id: 'all' as const, label: 'All', emoji: '📦' }, ...CATEGORIES]}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
          contentContainerStyle={styles.categoryFilterContent}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.catChip, categoryFilter === item.id && styles.catChipActive]}
              onPress={() => setCategoryFilter(item.id as CategoryId | 'all')}
            >
              <Text>{item.emoji}</Text>
              <Text style={[styles.catChipText, categoryFilter === item.id && styles.catChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <View style={styles.activityFilterRow}>
          {([
            { id: 'all', label: 'All' },
            { id: 'added', label: 'Added' },
            { id: 'edited', label: 'Edited' },
            { id: 'deleted', label: 'Deleted' },
          ] as const).map(f => (
            <Pressable
              key={f.id}
              style={[styles.catChip, activityFilter === f.id && styles.catChipActive]}
              onPress={() => setActivityFilter(f.id)}
            >
              <Text style={[styles.catChipText, activityFilter === f.id && styles.catChipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  ), [
    styles,
    colors.textMuted,
    search,
    categoryFilter,
    activityFilter,
    expenses.length,
    activities.length,
    tab,
    isJoint,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {tab === 'expenses' ? (
        <FlatList
          data={filteredExpenses}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🔍"
              title="No results found"
              subtitle="Try changing the search term or filter"
            />
          }
          renderItem={({ item, index }) => (
            <View style={styles.cardWrap}>
              <ExpenseCard expense={item} index={index} onDelete={requestDelete} onEdit={requestEdit} />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filteredActivity}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="📝"
              title="No activity yet"
              subtitle="Adds, edits, and deletes will show up here"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ActivityRow item={item} styles={styles} />
            </View>
          )}
        />
      )}
      {deleteModal}
      {editModal}
    </View>
  );
}

function ActivityRow({
  item,
  styles,
}: {
  item: ActivityItem;
  styles: ReturnType<typeof createStyles>;
}) {
  const cat = getCategoryConfig(item.category);
  const badge =
    item.type === 'added'
      ? { label: 'Added', color: '#22C55E' }
      : item.type === 'edited'
        ? { label: 'Edited', color: '#3B82F6' }
        : { label: 'Deleted', color: '#EF4444' };

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityTop}>
        <View style={[styles.badge, { backgroundColor: badge.color + '22' }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        <Text style={styles.activityTime}>
          {format(parseISO(item.at), 'd MMM · h:mm a')}
        </Text>
      </View>

      <Text style={styles.activityTitle}>
        {cat.emoji} {item.merchantLabel}
      </Text>
      <Text style={styles.activityAmount}>{formatCurrency(item.amount)}</Text>

      {item.type === 'edited' && (
        <Text style={styles.activityMeta}>
          Was {formatCurrency(item.previousAmount ?? 0)}
          {item.previousMerchantLabel && item.previousMerchantLabel !== item.merchantLabel
            ? ` · ${item.previousMerchantLabel}`
            : ''}
          {' → '}
          {formatCurrency(item.amount)}
          {item.previousMerchantLabel !== item.merchantLabel ? ` · ${item.merchantLabel}` : ''}
        </Text>
      )}

      {!!item.note && item.type !== 'edited' && (
        <Text style={styles.activityNote} numberOfLines={2}>{item.note}</Text>
      )}

      <Text style={styles.activityBy}>
        by {item.byName} · {item.source === 'joint' ? 'Joint' : 'Personal'}
      </Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { ...Typography.h1, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.primary + '33' },
    tabText: { ...Typography.small, color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: colors.primaryLight, fontWeight: '700' },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      borderRadius: Radius.lg, marginHorizontal: Spacing.lg, paddingHorizontal: Spacing.md,
      borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.md,
    },
    searchIcon: { fontSize: 16, marginRight: Spacing.sm },
    searchInput: { flex: 1, ...Typography.body, color: colors.text, paddingVertical: Spacing.md },
    clearBtn: { color: colors.textMuted, fontSize: 16, padding: Spacing.sm },
    categoryFilter: { maxHeight: 44, marginBottom: Spacing.md },
    categoryFilterContent: { paddingHorizontal: Spacing.lg },
    activityFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    catChip: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm, gap: 4,
    },
    catChipActive: { backgroundColor: colors.primary + '33', borderColor: colors.primary },
    catChipText: { ...Typography.small, color: colors.textSecondary },
    catChipTextActive: { color: colors.primaryLight, fontWeight: '700' },
    cardWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    activityCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activityTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.full,
    },
    badgeText: { ...Typography.small, fontWeight: '700' },
    activityTime: { ...Typography.small, color: colors.textMuted },
    activityTitle: { ...Typography.body, color: colors.text, fontWeight: '600' },
    activityAmount: { ...Typography.body, color: colors.text, marginTop: 2, fontWeight: '700', fontSize: 18 },
    activityMeta: { ...Typography.caption, color: colors.textSecondary, marginTop: Spacing.xs },
    activityNote: { ...Typography.caption, color: colors.textMuted, marginTop: Spacing.xs },
    activityBy: { ...Typography.small, color: colors.textMuted, marginTop: Spacing.sm },
  });
}
