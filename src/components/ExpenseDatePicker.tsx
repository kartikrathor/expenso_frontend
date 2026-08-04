import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  addMonths,
  format,
  isAfter,
  isSameDay,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  applyCalendarDay,
  buildMonthGrid,
  formatExpenseDayLabel,
} from '../utils/expenseDate';

type ExpenseDatePickerProps = {
  valueIso: string;
  onChange: (iso: string) => void;
  label?: string;
  /** Tighter trigger + short date label (Insights custom range). */
  compact?: boolean;
  /** Controlled open — omit for internal toggle. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Show only the calendar panel (parent owns the trigger). */
  panelOnly?: boolean;
};

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function CalendarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="16" rx="3" stroke={color} strokeWidth="1.8" />
      <Path d="M3 10h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M8 3v4M16 3v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path
        d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ExpenseDatePicker({
  valueIso,
  onChange,
  label = 'Date',
  compact = false,
  open: openProp,
  onOpenChange,
  panelOnly = false,
}: ExpenseDatePickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setOpenInternal(next);
  };
  const selected = useMemo(() => {
    try {
      const d = parseISO(valueIso);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }, [valueIso]);
  const [monthCursor, setMonthCursor] = useState(() => startOfDay(selected));

  useEffect(() => {
    if (open) setMonthCursor(startOfDay(selected));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only snap when panel opens

  const toggle = () => {
    setOpen(!open);
  };

  const pickDay = (day: Date) => {
    onChange(applyCalendarDay(day, valueIso));
    setOpen(false);
  };

  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);
  const grid = buildMonthGrid(monthCursor);
  const canGoNextMonth =
    addMonths(monthCursor, 1).getFullYear() < today.getFullYear() ||
    (addMonths(monthCursor, 1).getFullYear() === today.getFullYear() &&
      addMonths(monthCursor, 1).getMonth() <= today.getMonth());

  const valueLabel = compact
    ? (() => {
        try {
          const d = parseISO(valueIso);
          if (Number.isNaN(d.getTime())) return 'Pick date';
          if (isToday(d)) return `Today · ${format(d, 'd MMM')}`;
          if (isYesterday(d)) return `Yesterday · ${format(d, 'd MMM')}`;
          return format(d, 'd MMM yyyy');
        } catch {
          return 'Pick date';
        }
      })()
    : formatExpenseDayLabel(valueIso);

  return (
    <View style={styles.wrap}>
      {!panelOnly ? (
        <Pressable style={styles.row} onPress={toggle}>
          <View style={styles.rowLeft}>
            <View style={styles.iconWrap}>
              <CalendarIcon color={colors.primaryLight} size={compact ? 16 : 18} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {valueLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>{open ? '▾' : '›'}</Text>
        </Pressable>
      ) : null}

      {open && (
        <View style={[styles.panel, panelOnly && styles.panelFlush]}>
          <View style={styles.quickRow}>
            <Pressable
              style={[styles.quickChip, isToday(selected) && styles.quickChipActive]}
              onPress={() => pickDay(today)}
            >
              <Text style={[styles.quickText, isToday(selected) && styles.quickTextActive]}>
                Today
              </Text>
            </Pressable>
            <Pressable
              style={[styles.quickChip, isYesterday(selected) && styles.quickChipActive]}
              onPress={() => pickDay(yesterday)}
            >
              <Text
                style={[styles.quickText, isYesterday(selected) && styles.quickTextActive]}
              >
                Yesterday
              </Text>
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable
              hitSlop={10}
              onPress={() => setMonthCursor(m => addMonths(m, -1))}
              style={styles.navBtn}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel} numberOfLines={1}>
              {format(monthCursor, 'MMM yyyy')}
            </Text>
            <Pressable
              hitSlop={10}
              disabled={!canGoNextMonth}
              onPress={() => {
                if (canGoNextMonth) setMonthCursor(m => addMonths(m, 1));
              }}
              style={[styles.navBtn, !canGoNextMonth && styles.navBtnDisabled]}
            >
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map(d => (
              <View key={d} style={styles.dayCell}>
                <Text style={styles.weekDay}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map((day, idx) => {
              if (!day) {
                return <View key={`e-${idx}`} style={styles.dayCell} />;
              }
              const disabled = isAfter(startOfDay(day), today);
              const active = isSameDay(day, selected);
              return (
                <Pressable
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  disabled={disabled}
                  style={[
                    styles.dayCell,
                    active && styles.dayCellActive,
                    disabled && styles.dayCellDisabled,
                  ]}
                  onPress={() => pickDay(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      active && styles.dayTextActive,
                      disabled && styles.dayTextDisabled,
                      isToday(day) && !active && styles.dayTextToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  compact: boolean,
) {
  const cellPct = `${100 / 7}%` as unknown as number;
  return StyleSheet.create({
    wrap: {
      marginTop: compact ? 0 : Spacing.md,
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'stretch',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: compact ? Spacing.sm + 2 : Spacing.md,
      paddingVertical: compact ? Spacing.sm : Spacing.sm + 2,
      maxWidth: '100%',
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? Spacing.xs + 2 : Spacing.sm,
      flex: 1,
      minWidth: 0,
    },
    iconWrap: {
      width: compact ? 32 : 36,
      height: compact ? 32 : 36,
      borderRadius: Radius.md,
      backgroundColor: colors.primary + '22',
      borderWidth: 1,
      borderColor: colors.primary + '44',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { ...Typography.small, color: colors.textMuted },
    rowValue: {
      ...Typography.body,
      color: colors.text,
      fontWeight: '600',
      fontSize: compact ? 13 : Typography.body.fontSize,
    },
    chevron: {
      fontSize: 18,
      color: colors.textMuted,
      fontWeight: '600',
      paddingLeft: Spacing.sm,
      flexShrink: 0,
    },
    panel: {
      marginTop: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.sm + 2,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    panelFlush: {
      marginTop: 0,
      backgroundColor: colors.background,
    },
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    quickChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickChipActive: {
      backgroundColor: colors.primary + '33',
      borderColor: colors.primary,
    },
    quickText: { ...Typography.small, color: colors.textSecondary, fontWeight: '600' },
    quickTextActive: { color: colors.primaryLight, fontWeight: '700' },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navBtnDisabled: { opacity: 0.35 },
    navBtnText: { fontSize: 22, color: colors.text, lineHeight: 24 },
    monthLabel: {
      ...Typography.bodyBold,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    weekRow: { flexDirection: 'row', width: '100%', marginBottom: 4 },
    weekDay: {
      ...Typography.small,
      color: colors.textMuted,
      fontWeight: '600',
      textAlign: 'center',
      fontSize: 11,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
    dayCell: {
      width: cellPct,
      aspectRatio: 1,
      maxWidth: cellPct,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.full,
    },
    dayCellActive: { backgroundColor: colors.primary },
    dayCellDisabled: { opacity: 0.35 },
    dayText: { ...Typography.body, color: colors.text, fontSize: 14 },
    dayTextActive: { color: '#FFF', fontWeight: '700' },
    dayTextDisabled: { color: colors.textMuted },
    dayTextToday: { color: colors.primaryLight, fontWeight: '700' },
  });
}
