import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Milestone, Task } from './datewheel';

const { width: SW } = Dimensions.get('window');

const COL_COUNT = 3;
const COL_GAP = 8;
const H_PAD = 12;
// Base cell size — zoom multiplier is applied on top
const BASE_MONTH_W = (SW - H_PAD * 2 - COL_GAP * (COL_COUNT - 1)) / COL_COUNT;
const BASE_CELL = Math.floor(BASE_MONTH_W / 7);

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.2;

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDowOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface Props {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  milestones: Milestone[];
  startDate: Date;
  endDate: Date;
  currentTaskName: string;
  currentTaskColor: string;
  year: number;
  theme: {
    bg: string;
    card: string;
    text: string;
    muted: string;
    accent: string;
    border: string;
  };
}

export default function CalendarView({
  visible,
  onClose,
  tasks,
  milestones,
  startDate,
  endDate,
  currentTaskName,
  currentTaskColor,
  year,
  theme,
}: Props) {
  // ── Entrance / exit animation ─────────────────────────────────────────────
  // Two-stage: backdrop blooms first, then content scales in
  const backdropOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(1.12);

  useEffect(() => {
    if (visible) {
      // Stage 1: backdrop fades in
      backdropOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
      // Stage 2: content blooms in with slight delay
      contentOpacity.value = withDelay(180, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
      contentScale.value = withDelay(180, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.05)) }));
    } else {
      backdropOpacity.value = withTiming(0, { duration: 260 });
      contentOpacity.value = withTiming(0, { duration: 200 });
      contentScale.value = withTiming(0.92, { duration: 200 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  // ── Pinch-to-zoom ─────────────────────────────────────────────────────────
  const zoom = useSharedValue(1.0);
  const pinchStartZoom = useRef(1.0);

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchStartZoom.current = zoom.value;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom.current * e.scale));
      zoom.value = next;
    });

  const gridScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }],
    // Push origin to top so zooming feels anchored at the top
    transformOrigin: 'top center',
  }));

  // ── Data ──────────────────────────────────────────────────────────────────
  const today = new Date();

  const allTasks: Task[] = [
    ...tasks,
    {
      id: -1,
      name: currentTaskName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      color: currentTaskColor,
      duration: '',
      unit: '',
    },
  ];

  const msMap: Record<string, Milestone> = {};
  milestones.forEach(m => {
    const d = new Date(m.date);
    msMap[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = m;
  });

  function getDayColor(y: number, mo: number, d: number): string | null {
    const ms = new Date(y, mo, d).getTime();
    let color: string | null = null;
    for (const task of allTasks) {
      const s = new Date(task.startDate);
      const e = new Date(task.endDate);
      const sMs = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
      const eMs = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
      if (ms >= sMs && ms <= eMs) color = task.color;
    }
    return color;
  }

  // ── Month renderer ────────────────────────────────────────────────────────
  function renderMonth(month: number) {
    const numDays = daysInMonth(year, month);
    const firstDow = firstDowOfMonth(year, month);
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    const cells: number[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(0);
    for (let d = 1; d <= numDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(0);

    const weeks: number[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    return (
      <View key={month} style={[styles.monthBox, { borderColor: theme.border, width: BASE_MONTH_W }]}>
        <Text style={[styles.monthName, { color: isCurrentMonth ? theme.accent : theme.text }]}>
          {MONTH_NAMES[month]}
        </Text>

        <View style={styles.dowRow}>
          {DOW_LABELS.map((l, i) => (
            <Text
              key={i}
              style={[styles.dowLabel, {
                color: i === 0 || i === 6 ? '#4A7FA5' : theme.muted,
                width: BASE_CELL,
              }]}
            >
              {l}
            </Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (day === 0) {
                return <View key={di} style={{ width: BASE_CELL, height: BASE_CELL }} />;
              }
              const color = getDayColor(year, month, day);
              const isToday =
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day;
              const msKey = `${year}-${month}-${day}`;
              const milestone = msMap[msKey];
              const isSunSat = di === 0 || di === 6;

              return (
                <View
                  key={di}
                  style={[
                    styles.dayCell,
                    { width: BASE_CELL, height: BASE_CELL },
                    color ? { backgroundColor: color + 'CC', borderRadius: 2 } : undefined,
                    isToday ? {
                      borderWidth: 1.5,
                      borderColor: color ? '#fff' : theme.accent,
                      borderRadius: BASE_CELL / 2,
                    } : undefined,
                  ]}
                >
                  {milestone && (
                    <View style={[styles.milestoneDot, { backgroundColor: milestone.color }]} />
                  )}
                  <Text style={[
                    styles.dayText,
                    {
                      color: color ? '#fff' : isToday ? theme.accent : isSunSat ? '#4A7FA5' : theme.text,
                      fontWeight: isToday ? '700' : '400',
                    },
                  ]}>
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>

        {/* Stage 1: Dark backdrop blooms over the wheel */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }, backdropStyle]}
          pointerEvents="none"
        />

        {/* Stage 2: Calendar content scales in */}
        <Animated.View style={[{ flex: 1 }, contentStyle]}>

          {/* Header — outside pinch zone */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.yearLabel, { color: theme.text }]}>{year}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
              <Text style={[styles.closeBtn, { color: theme.accent }]}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.legend, { borderBottomColor: theme.border }]}
            contentContainerStyle={styles.legendContent}
          >
            {allTasks.map(t => (
              <View key={t.id} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: t.color }]} />
                <Text style={[styles.legendText, { color: theme.muted }]} numberOfLines={1}>
                  {t.name}
                </Text>
              </View>
            ))}
            {milestones.map(m => (
              <View key={`ms-${m.id}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                <Text style={[styles.legendText, { color: theme.muted }]} numberOfLines={1}>
                  {m.name}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Pinch-to-zoom grid */}
          <GestureDetector gesture={pinchGesture}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Animated.View style={[styles.gridOuter, gridScaleStyle]}>
                <View style={styles.gridInner}>
                  <View style={styles.gridRow}>
                    {[0, 1, 2].map(m => renderMonth(m))}
                  </View>
                  <View style={styles.gridRow}>
                    {[3, 4, 5].map(m => renderMonth(m))}
                  </View>
                  <View style={styles.gridRow}>
                    {[6, 7, 8].map(m => renderMonth(m))}
                  </View>
                  <View style={styles.gridRow}>
                    {[9, 10, 11].map(m => renderMonth(m))}
                  </View>
                </View>
              </Animated.View>
            </ScrollView>
          </GestureDetector>

        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  yearLabel: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeBtn: {
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    maxHeight: 40,
    borderBottomWidth: 0.5,
  },
  legendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    maxWidth: 90,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  gridOuter: {
    // Extra height padding so scale-up doesn't clip content
    paddingBottom: 80,
  },
  gridInner: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: COL_GAP,
  },
  monthBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  monthName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dowLabel: {
    fontSize: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 9,
    textAlign: 'center',
  },
  milestoneDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 3,
    height: 3,
    borderRadius: 2,
  },
});
