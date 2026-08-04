import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { format, parseISO, startOfDay } from 'date-fns';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { TimeFilter } from '../types/expense';
import { ExpenseDatePicker } from './ExpenseDatePicker';
import {
  DateRange,
  canShiftTimeFilterForward,
  formatTimeFilterAnchor,
  shiftTimeFilterAnchor,
} from '../utils/expenseAnalytics';
import { applyCalendarDay } from '../utils/expenseDate';

const FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

type TimeFilterBarProps = {
  filter: TimeFilter;
  anchor: Date;
  customRange: DateRange | null;
  onFilterChange: (filter: TimeFilter) => void;
  onAnchorChange: (anchor: Date) => void;
  onCustomRangeChange: (range: DateRange | null) => void;
  /** When false, period arrows & custom dates show Pro paywall */
  proNavEnabled?: boolean;
  onProGate?: (reason: 'analytics_nav' | 'custom_date') => void;
};

export function TimeFilterBar({
  filter,
  anchor,
  customRange,
  onFilterChange,
  onAnchorChange,
  onCustomRangeChange,
  proNavEnabled = true,
  onProGate,
}: TimeFilterBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openPicker, setOpenPicker] = useState<'from' | 'to' | null>(null);

  const canGoNext = canShiftTimeFilterForward(filter, anchor);
  const rangeActive = filter === 'all' && !!customRange;

  const fromIso = applyCalendarDay(
    customRange?.start ?? startOfDay(new Date()),
  );
  const toIso = applyCalendarDay(customRange?.end ?? startOfDay(new Date()));

  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                onFilterChange(f.key);
                onAnchorChange(new Date());
                setOpenPicker(null);
                if (f.key !== 'all') onCustomRangeChange(null);
              }}
            >
              {active ? (
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterGrad}
                >
                  <Text style={styles.filterTextOn}>{f.label}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.filterText}>{f.label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {filter !== 'all' ? (
        <View style={styles.anchorRow}>
          <Pressable
            style={styles.anchorNav}
            onPress={() => {
              if (!proNavEnabled) {
                onProGate?.('analytics_nav');
                return;
              }
              onAnchorChange(shiftTimeFilterAnchor(filter, anchor, -1));
            }}
            hitSlop={8}
          >
            <Text style={styles.anchorNavText}>‹</Text>
          </Pressable>
          <Text style={styles.anchorLabel} numberOfLines={1}>
            {formatTimeFilterAnchor(filter, anchor)}
          </Text>
          <Pressable
            style={[styles.anchorNav, !canGoNext && proNavEnabled && styles.anchorNavDisabled]}
            onPress={() => {
              if (!proNavEnabled) {
                onProGate?.('analytics_nav');
                return;
              }
              if (!canGoNext) return;
              onAnchorChange(shiftTimeFilterAnchor(filter, anchor, 1));
            }}
            disabled={proNavEnabled && !canGoNext}
            hitSlop={8}
          >
            <Text style={styles.anchorNavText}>›</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.customWrap}>
          <Text style={styles.customHint}>
            {rangeActive
              ? `${format(customRange!.start, 'd MMM yyyy')} → ${format(customRange!.end, 'd MMM yyyy')}`
              : 'Pick a custom duration (optional)'}
          </Text>

          {/* Triggers side-by-side; calendar opens full-width below */}
          <View style={styles.triggerRow}>
            <Pressable
              style={[
                styles.triggerChip,
                openPicker === 'from' && styles.triggerChipActive,
              ]}
              onPress={() => {
                if (!proNavEnabled) {
                  onProGate?.('custom_date');
                  return;
                }
                setOpenPicker(p => (p === 'from' ? null : 'from'));
              }}
            >
              <Text style={styles.triggerLabel}>From</Text>
              <Text style={styles.triggerValue} numberOfLines={1}>
                {format(parseISO(fromIso), 'd MMM yyyy')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.triggerChip,
                openPicker === 'to' && styles.triggerChipActive,
              ]}
              onPress={() => {
                if (!proNavEnabled) {
                  onProGate?.('custom_date');
                  return;
                }
                setOpenPicker(p => (p === 'to' ? null : 'to'));
              }}
            >
              <Text style={styles.triggerLabel}>To</Text>
              <Text style={styles.triggerValue} numberOfLines={1}>
                {format(parseISO(toIso), 'd MMM yyyy')}
              </Text>
            </Pressable>
          </View>

          {proNavEnabled && openPicker === 'from' ? (
            <ExpenseDatePicker
              compact
              panelOnly
              label="From"
              valueIso={fromIso}
              open
              onOpenChange={o => setOpenPicker(o ? 'from' : null)}
              onChange={iso => {
                const start = startOfDay(parseISO(iso));
                const end = customRange?.end
                  ? startOfDay(customRange.end)
                  : start;
                onCustomRangeChange({
                  start,
                  end: end.getTime() < start.getTime() ? start : end,
                });
                setOpenPicker(null);
              }}
            />
          ) : null}

          {proNavEnabled && openPicker === 'to' ? (
            <ExpenseDatePicker
              compact
              panelOnly
              label="To"
              valueIso={toIso}
              open
              onOpenChange={o => setOpenPicker(o ? 'to' : null)}
              onChange={iso => {
                const end = startOfDay(parseISO(iso));
                const start = customRange?.start
                  ? startOfDay(customRange.start)
                  : end;
                onCustomRangeChange({
                  start: start.getTime() > end.getTime() ? end : start,
                  end,
                });
                setOpenPicker(null);
              }}
            />
          ) : null}

          {rangeActive ? (
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                onCustomRangeChange(null);
                setOpenPicker(null);
              }}
            >
              <Text style={styles.clearText}>Clear custom range</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: { marginBottom: Spacing.lg, gap: Spacing.sm },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    filterChip: {
      flex: 1,
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: {
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    filterGrad: {
      width: '100%',
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
    filterTextOn: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
    anchorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    anchorNav: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    anchorNavDisabled: { opacity: 0.35 },
    anchorNavText: {
      fontSize: 22,
      color: colors.primaryLight,
      fontWeight: '600',
      marginTop: -2,
    },
    anchorLabel: {
      ...Typography.bodyBold,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
      fontSize: 15,
    },
    customWrap: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      overflow: 'hidden',
      width: '100%',
    },
    customHint: {
      ...Typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      fontWeight: '600',
    },
    triggerRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      width: '100%',
    },
    triggerChip: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.background,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.sm,
    },
    triggerChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    triggerLabel: {
      ...Typography.small,
      color: colors.textMuted,
      fontWeight: '600',
      marginBottom: 2,
    },
    triggerValue: {
      ...Typography.caption,
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    clearBtn: {
      alignSelf: 'center',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
    },
    clearText: {
      ...Typography.caption,
      color: colors.danger,
      fontWeight: '700',
    },
  });
}
