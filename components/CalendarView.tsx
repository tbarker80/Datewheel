import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
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
import Svg, { Polygon } from 'react-native-svg';
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

  // ── Pinch-to-zoom + pan ───────────────────────────────────────────────────
  const [tappedLabel, setTappedLabel] = useState<{ name: string; color: string } | null>(null);
  const [contentH, setContentH] = useState(0);
  const [containerH, setContainerH] = useState(0);

  const zoom = useSharedValue(1.0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartZoom = useSharedValue(1.0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const contentHShared = useSharedValue(0);
  const containerHShared = useSharedValue(0);

  // Keep shared values in sync with state
  useEffect(() => { contentHShared.value = contentH; }, [contentH]);
  useEffect(() => { containerHShared.value = containerH; }, [containerH]);

  const { width: SCREEN_W } = Dimensions.get('window');
  const screenWShared = useSharedValue(SCREEN_W);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchStartZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom.value * e.scale));
      zoom.value = next;
      // Re-clamp X when zoom changes
      const maxX = Math.max(0, (screenWShared.value * next - screenWShared.value) / 2);
      translateX.value = Math.min(maxX, Math.max(-maxX, translateX.value));
      // Re-clamp Y
      const scaledH = contentHShared.value * next;
      const maxY = Math.max(0, (scaledH - containerHShared.value) / 2);
      translateY.value = Math.min(maxY, Math.max(-maxY, translateY.value));
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const z = zoom.value;
      const maxX = Math.max(0, (screenWShared.value * z - screenWShared.value) / 2);
      const scaledH = contentHShared.value * z;
      const maxY = Math.max(0, (scaledH - containerHShared.value) / 2);
      translateX.value = Math.min(maxX, Math.max(-maxX, panStartX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(-maxY, panStartY.value + e.translationY));
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const gridScaleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoom.value },
    ],
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

  // Derive the full month range spanned by all tasks + milestones
  const allDates = [
    ...allTasks.map(t => new Date(t.startDate)),
    ...allTasks.map(t => new Date(t.endDate)),
    ...milestones.map(m => new Date(m.date)),
  ];
  const minDate = allDates.length > 0 ? allDates.reduce((a, b) => a < b ? a : b) : new Date();
  const maxDate = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : new Date();
  const months: { year: number; month: number }[] = [];
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  // Group into rows of 3
  const monthRows: { year: number; month: number }[][] = [];
  for (let i = 0; i < months.length; i += 3) monthRows.push(months.slice(i, i + 3));
  // Header year label — show range if multi-year
  const headerYear = minDate.getFullYear() === maxDate.getFullYear()
    ? String(minDate.getFullYear())
    : `${minDate.getFullYear()} – ${maxDate.getFullYear()}`;

  const msMap: Record<string, Milestone> = {};
  milestones.forEach(m => {
    const d = new Date(m.date);
    msMap[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = m;
  });

  // Returns all tasks active on a given day (in order)
  function getDayTasks(y: number, mo: number, d: number): Task[] {
    const ms = new Date(y, mo, d).getTime();
    return allTasks.filter(task => {
      const s = new Date(task.startDate);
      const e = new Date(task.endDate);
      const sMs = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
      const eMs = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
      return ms >= sMs && ms <= eMs;
    });
  }

  function getDayLabel(y: number, mo: number, d: number): { name: string; color: string } | null {
    const msKey = `${y}-${mo}-${d}`;
    if (msMap[msKey]) {
      const m = msMap[msKey];
      return { name: `◆ ${m.name}`, color: m.color };
    }
    const dayTasks = getDayTasks(y, mo, d);
    if (dayTasks.length === 0) return null;
    if (dayTasks.length === 1) return { name: dayTasks[0].name, color: dayTasks[0].color };
    // Multiple tasks — list them
    return {
      name: dayTasks.map(t => t.name).join(' · '),
      color: dayTasks[dayTasks.length - 1].color,
    };
  }

  // ── Month renderer ────────────────────────────────────────────────────────
  function renderMonth(yr: number, month: number) {
    const numDays = daysInMonth(yr, month);
    const firstDow = firstDowOfMonth(yr, month);
    const isCurrentMonth = today.getFullYear() === yr && today.getMonth() === month;

    const cells: number[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(0);
    for (let d = 1; d <= numDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(0);

    const weeks: number[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    return (
      <View key={`${yr}-${month}`} style={[styles.monthBox, { borderColor: theme.border, width: BASE_MONTH_W }]}>
        <Text style={[styles.monthName, { color: isCurrentMonth ? theme.accent : theme.text }]}>
          {MONTH_NAMES[month]}{months.length > 12 ? ` '${String(yr).slice(-2)}` : ''}
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
              const dayTasks = getDayTasks(yr, month, day);
              const hasColor = dayTasks.length > 0;
              const isOverlap = dayTasks.length >= 2;
              const topColor = hasColor ? dayTasks[dayTasks.length - 1].color : null;
              const botColor = isOverlap ? dayTasks[dayTasks.length - 2].color : null;
              const isToday =
                today.getFullYear() === yr &&
                today.getMonth() === month &&
                today.getDate() === day;
              const msKey = `${yr}-${month}-${day}`;
              const milestone = msMap[msKey];
              const isSunSat = di === 0 || di === 6;
              const S = BASE_CELL;

              return (
                <Pressable
                  key={di}
                  style={[
                    styles.dayCell,
                    { width: S, height: S },
                    !isOverlap && topColor ? { backgroundColor: topColor + 'CC', borderRadius: 2 } : undefined,
                    isToday ? {
                      borderWidth: 1.5,
                      borderColor: hasColor ? '#fff' : theme.accent,
                      borderRadius: S / 2,
                      overflow: 'hidden',
                    } : { borderRadius: 2, overflow: 'hidden' },
                  ]}
                  onPress={() => {
                    const label = getDayLabel(yr, month, day);
                    if (!label) { setTappedLabel(null); return; }
                    setTappedLabel(prev =>
                      prev?.name === label.name ? null : label
                    );
                  }}
                >
                  {/* Diagonal split for overlapping tasks */}
                  {isOverlap && topColor && botColor && (
                    <Svg
                      width={S} height={S}
                      style={StyleSheet.absoluteFill}
                    >
                      {/* Top-right triangle = most recent task */}
                      <Polygon
                        points={`0,0 ${S},0 ${S},${S}`}
                        fill={topColor + 'CC'}
                      />
                      {/* Bottom-left triangle = previous overlapping task */}
                      <Polygon
                        points={`0,0 0,${S} ${S},${S}`}
                        fill={botColor + 'CC'}
                      />
                    </Svg>
                  )}
                  {milestone && (
                    <View style={[styles.milestoneDot, { backgroundColor: milestone.color }]} />
                  )}
                  <Text style={[
                    styles.dayText,
                    {
                      color: hasColor ? '#fff' : isToday ? theme.accent : isSunSat ? '#4A7FA5' : theme.text,
                      fontWeight: isToday ? '700' : '400',
                    },
                  ]}>
                    {day}
                  </Text>
                </Pressable>
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
            <Text style={[styles.yearLabel, { color: theme.text }]}>{headerYear}</Text>
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
                <Text style={[styles.legendText, { color: theme.text }]} numberOfLines={1}>
                  {t.name}
                </Text>
              </View>
            ))}
            {milestones.map(m => (
              <View key={`ms-${m.id}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                <Text style={[styles.legendText, { color: theme.text }]} numberOfLines={1}>
                  {m.name}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Pinch-to-zoom + pan grid + floating label overlay */}
          <View
            style={{ flex: 1, overflow: 'hidden' }}
            onLayout={e => setContainerH(e.nativeEvent.layout.height)}
          >
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.gridOuter, gridScaleStyle]}>
                <View
                  style={styles.gridInner}
                  onLayout={e => setContentH(e.nativeEvent.layout.height)}
                >
                  {monthRows.map((row, ri) => (
                    <View key={ri} style={styles.gridRow}>
                      {row.map(({ year: yr2, month: mo }) => renderMonth(yr2, mo))}
                    </View>
                  ))}
                </View>
              </Animated.View>
            </GestureDetector>

            {/* Floating task label — overlaid on calendar, dismisses on tap */}
            {tappedLabel && (
              <Pressable
                style={[styles.labelBanner, { backgroundColor: tappedLabel.color + 'DD', borderColor: tappedLabel.color }]}
                onPress={() => setTappedLabel(null)}
              >
                <View style={[styles.labelSwatch, { backgroundColor: '#fff' }]} />
                <Text style={[styles.labelText, { color: '#fff' }]} numberOfLines={1}>
                  {tappedLabel.name}
                </Text>
                <Text style={[styles.labelDismiss, { color: '#fff' }]}>✕</Text>
              </Pressable>
            )}
          </View>

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
    maxHeight: 64,
    borderBottomWidth: 0.5,
  },
  legendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    maxWidth: 120,
  },
  labelBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 0,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  labelSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labelText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  labelDismiss: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  gridOuter: {
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
