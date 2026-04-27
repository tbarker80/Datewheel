import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Milestone, Task } from './datewheel';

const ROW_HEIGHT = 56;
const LABEL_WIDTH = 130;
const HEADER_HEIGHT = 36;
const DEFAULT_ZOOM = 2.5;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 8.0;

function formatShort(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  milestones?: Milestone[];
  currentTaskName: string;
  startDate: Date;
  endDate: Date;
  duration: string;
  unit: string;
  currentTaskColor: string;
  activeTaskPercentComplete?: number;
}

export default function GanttChart({
  visible,
  onClose,
  tasks,
  milestones = [],
  currentTaskName,
  startDate,
  endDate,
  duration,
  unit,
  currentTaskColor,
  activeTaskPercentComplete = 0,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Refs for gesture callbacks (avoid stale closures)
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pinchStartZoomRef = useRef(zoom);

  // Scroll refs
  const labelScrollRef = useRef<ScrollView>(null);
  const barScrollRef = useRef<ScrollView>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const isSyncingLabel = useRef(false);
  const isSyncingBar = useRef(false);

  const barArea = Math.max(screenWidth * zoom, 800);

  // Compute project bounds up front so effects and gestures can reference them
  const allTasks = [
    ...tasks,
    {
      id: -1,
      name: currentTaskName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      color: currentTaskColor,
      duration,
      unit,
      percentComplete: activeTaskPercentComplete,
    },
  ];

  const projectStart = allTasks.length > 0 ? new Date(allTasks[0].startDate) : new Date();
  const projectEnd = allTasks.length > 0 ? new Date(allTasks[allTasks.length - 1].endDate) : new Date();
  const totalMs = projectEnd.getTime() - projectStart.getTime();
  const today = new Date();

  // Lock orientation and scroll to today when chart opens
  React.useEffect(() => {
    if (visible) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      if (totalMs > 0 && today >= projectStart && today <= projectEnd) {
        const todayFrac = (today.getTime() - projectStart.getTime()) / totalMs;
        setTimeout(() => {
          horizontalScrollRef.current?.scrollTo({
            x: Math.max(0, todayFrac * barArea - screenWidth / 3),
            animated: true,
          });
        }, 450);
      }
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    }
  }, [visible]);

  // Pinch-to-zoom gesture — .runOnJS(true) keeps callbacks on the JS thread
  // so we can call setState directly without any wrapper.
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchStartZoomRef.current = zoomRef.current;
    })
    .onUpdate((e) => {
      const raw = pinchStartZoomRef.current * e.scale;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw));
      // Snap to 0.25 steps to reduce re-render frequency
      setZoom(Math.round(clamped * 4) / 4);
    });

  // Early exits after all hooks
  if (allTasks.length === 0 || totalMs === 0) return null;

  function getX(date: Date): number {
    return Math.max(((date.getTime() - projectStart.getTime()) / totalMs) * barArea, 0);
  }

  function getMonthLabels() {
    const labels: { label: string; x: number }[] = [];
    const current = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    while (current <= projectEnd) {
      labels.push({
        label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        x: getX(current),
      });
      current.setMonth(current.getMonth() + 1);
    }
    return labels;
  }

  function getWeekLabels() {
    const labels: { label: string; x: number }[] = [];
    // Start from the Monday on or before projectStart
    const current = new Date(projectStart);
    const dow = current.getDay();
    current.setDate(current.getDate() - (dow === 0 ? 6 : dow - 1));
    // Advance to first full week boundary after projectStart
    if (current < projectStart) current.setDate(current.getDate() + 7);
    while (current <= projectEnd) {
      labels.push({
        label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        x: getX(current),
      });
      current.setDate(current.getDate() + 7);
    }
    return labels;
  }

  const monthLabels = getMonthLabels();
  const showWeeks = zoom >= 3.0;
  const weekLabels = showWeeks ? getWeekLabels() : [];
  const todayX = today >= projectStart && today <= projectEnd ? getX(today) : -1;

  function nudgeZoom(delta: number) {
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 4) / 4)));
  }

  const atMin = zoom <= MIN_ZOOM;
  const atMax = zoom >= MAX_ZOOM;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>

          {/* Header */}
          <View style={[styles.header, { paddingTop: isLandscape ? 12 : 52 }]}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity style={styles.backBtn} onPress={onClose}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>

              {/* Zoom controls */}
              <View style={styles.zoomRow}>
                <TouchableOpacity
                  style={[styles.zoomBtn, atMin && styles.zoomBtnDisabled]}
                  onPress={() => nudgeZoom(-0.5)}
                  disabled={atMin}
                >
                  <Text style={[styles.zoomBtnText, atMin && styles.zoomBtnTextDisabled]}>− Out</Text>
                </TouchableOpacity>
                {zoom === DEFAULT_ZOOM ? (
                  <Text style={styles.zoomLevel}>default</Text>
                ) : (
                  <TouchableOpacity onPress={() => setZoom(DEFAULT_ZOOM)}>
                    <Text style={styles.zoomReset}>↺ reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.zoomBtn, atMax && styles.zoomBtnDisabled]}
                  onPress={() => nudgeZoom(0.5)}
                  disabled={atMax}
                >
                  <Text style={[styles.zoomBtnText, atMax && styles.zoomBtnTextDisabled]}>+ In</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.headerTitle}>GANTT CHART</Text>
            <Text style={styles.headerSub}>
              {formatDateFull(projectStart)} → {formatDateFull(projectEnd)}
            </Text>
          </View>

          {/* Chart area — pinch gesture wraps the whole chart body */}
          <GestureDetector gesture={pinchGesture}>
            <View style={styles.chartArea}>

              {/* Frozen label column */}
              <View style={styles.labelColumn}>
                <View style={styles.labelHeaderCell}>
                  <Text style={styles.labelHeaderText}>TASK</Text>
                </View>
                <ScrollView
                  ref={labelScrollRef}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={true}
                  onScroll={(e) => {
                    if (isSyncingLabel.current) return;
                    isSyncingBar.current = true;
                    barScrollRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
                    setTimeout(() => { isSyncingBar.current = false; }, 50);
                  }}
                  scrollEventThrottle={16}
                  style={{ flex: 1 }}
                >
                  {allTasks.map((task, i) => {
                    const isActive = task.id === -1;
                    return (
                      <View key={task.id} style={[styles.labelCell, i % 2 === 0 && styles.rowAlt]}>
                        <View style={[styles.taskColorDot, { backgroundColor: task.color }]} />
                        <View style={styles.labelTextBlock}>
                          <Text style={styles.taskLabel} numberOfLines={1}>
                            {task.name}{isActive ? ' ●' : ''}
                          </Text>
                          <Text style={styles.taskDates}>
                            {formatShort(new Date(task.startDate))} → {formatShort(new Date(task.endDate))}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {milestones.map((m, i) => (
                    <View
                      key={`ms-label-${m.id}`}
                      style={[styles.labelCell, (allTasks.length + i) % 2 === 0 && styles.rowAlt]}
                    >
                      <View style={[styles.milestoneDot, { backgroundColor: m.color }]} />
                      <View style={styles.labelTextBlock}>
                        <Text style={styles.taskLabel} numberOfLines={1}>◆ {m.name}</Text>
                        <Text style={styles.taskDates}>{formatShort(new Date(m.date))}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Scrollable bar area */}
              <ScrollView
                ref={horizontalScrollRef}
                horizontal
                showsHorizontalScrollIndicator={true}
                style={{ flex: 1 }}
                contentContainerStyle={{ width: barArea }}
              >
                <View style={{ flex: 1 }}>

                  {/* Month + week header */}
                  <View style={[styles.monthHeaderRow, { width: barArea }]}>
                    {monthLabels.map((m, i) => (
                      <React.Fragment key={`mo-${i}`}>
                        <Text style={[styles.monthLabel, { left: m.x + 4 }]}>{m.label}</Text>
                        <View style={[styles.monthDivider, { left: m.x }]} />
                      </React.Fragment>
                    ))}
                    {weekLabels.map((w, i) => (
                      <React.Fragment key={`wk-${i}`}>
                        <View style={[styles.weekDivider, { left: w.x }]} />
                        {zoom >= 4.0 && (
                          <Text style={[styles.weekLabel, { left: w.x + 2 }]}>{w.label}</Text>
                        )}
                      </React.Fragment>
                    ))}
                  </View>

                  {/* Vertically scrollable rows */}
                  <ScrollView
                    ref={barScrollRef}
                    showsVerticalScrollIndicator={false}
                    onScroll={(e) => {
                      if (isSyncingBar.current) return;
                      isSyncingLabel.current = true;
                      labelScrollRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
                      setTimeout(() => { isSyncingLabel.current = false; }, 50);
                    }}
                    scrollEventThrottle={16}
                  >
                    {/* Task bars */}
                    {allTasks.map((task, i) => {
                      const taskStart = new Date(task.startDate);
                      const taskEnd = new Date(task.endDate);
                      const barX = getX(taskStart);
                      const barW = Math.max(
                        ((taskEnd.getTime() - taskStart.getTime()) / totalMs) * barArea,
                        24
                      );
                      const isActive = task.id === -1;
                      return (
                        <View
                          key={task.id}
                          style={[styles.barRow, { width: barArea }, i % 2 === 0 && styles.rowAlt]}
                        >
                          {monthLabels.map((m, mi) => (
                            <View key={`grid-mo-${mi}`} style={[styles.gridLine, { left: m.x }]} />
                          ))}
                          {weekLabels.map((w, wi) => (
                            <View key={`grid-wk-${wi}`} style={[styles.weekGridLine, { left: w.x }]} />
                          ))}
                          {todayX > 0 && (
                            <View style={[styles.todayLine, { left: todayX }]} />
                          )}
                          <View style={[
                            styles.bar,
                            {
                              left: barX,
                              width: barW,
                              backgroundColor: task.color,
                              opacity: isActive ? 1 : 0.8,
                              borderWidth: isActive ? 1.5 : 0,
                              borderColor: '#FFFFFF',
                            },
                          ]}>
                            {barW > 50 && (
                              <Text style={styles.barLabel} numberOfLines={1}>
                                {task.duration} {task.unit}
                              </Text>
                            )}
                            {(task.percentComplete ?? 0) > 0 && (
                              <View style={[
                                styles.progressLine,
                                { width: `${task.percentComplete}%` as any },
                              ]} />
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Milestone rows */}
                    {milestones.map((milestone, i) => {
                      const mX = getX(new Date(milestone.date));
                      return (
                        <View
                          key={`ms-bar-${milestone.id}`}
                          style={[styles.barRow, { width: barArea }, (allTasks.length + i) % 2 === 0 && styles.rowAlt]}
                        >
                          {monthLabels.map((m, mi) => (
                            <View key={`grid-mo-${mi}`} style={[styles.gridLine, { left: m.x }]} />
                          ))}
                          {weekLabels.map((w, wi) => (
                            <View key={`grid-wk-${wi}`} style={[styles.weekGridLine, { left: w.x }]} />
                          ))}
                          {todayX > 0 && (
                            <View style={[styles.todayLine, { left: todayX }]} />
                          )}
                          <View style={[styles.milestoneLine, { left: mX, backgroundColor: milestone.color }]} />
                          <View style={[styles.milestoneDiamond, {
                            left: mX - 7,
                            top: ROW_HEIGHT / 2 - 7,
                            backgroundColor: milestone.color,
                          }]} />
                          <Text style={[styles.milestoneBarLabel, {
                            left: mX + 12,
                            top: ROW_HEIGHT / 2 - 7,
                            color: milestone.color,
                          }]} numberOfLines={1}>
                            {milestone.name}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Today label */}
                  {todayX > 0 && (
                    <View style={{ height: 20, width: barArea, position: 'relative' }}>
                      <Text style={[styles.todayLabelText, { left: todayX - 14 }]}>TODAY</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </GestureDetector>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendTodayLine} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', opacity: 0.6 }]} />
              <Text style={styles.legendText}>Active</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDiamond} />
              <Text style={styles.legendText}>Milestone</Text>
            </View>
            <Text style={styles.legendHint}>Pinch or use buttons to zoom</Text>
          </View>

        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1923' },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
    backgroundColor: '#0F1923',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {},
  backText: { fontSize: 16, color: '#2E9BFF', fontWeight: '500' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomBtn: {
    backgroundColor: '#1C2B38',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: '#2A3F52',
  },
  zoomBtnDisabled: { opacity: 0.35 },
  zoomBtnText: { fontSize: 11, color: '#2E9BFF', fontWeight: '600' },
  zoomBtnTextDisabled: { color: '#5A7A96' },
  zoomLevel: { fontSize: 11, color: '#5A7A96', minWidth: 48, textAlign: 'center' },
  zoomReset: { fontSize: 11, color: '#2E9BFF', minWidth: 48, textAlign: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '600', color: '#5A7A96', letterSpacing: 1.5, marginBottom: 2 },
  headerSub: { fontSize: 12, color: '#5A7A96' },
  chartArea: { flex: 1, flexDirection: 'row' },
  labelColumn: {
    width: LABEL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#2A3F52',
    backgroundColor: '#0F1923',
    zIndex: 10,
  },
  labelHeaderCell: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3F52',
    backgroundColor: '#1C2B38',
  },
  labelHeaderText: { fontSize: 10, fontWeight: '600', color: '#5A7A96', letterSpacing: 1.5 },
  labelCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C2B38',
  },
  taskColorDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  milestoneDot: { width: 8, height: 8, transform: [{ rotate: '45deg' }], flexShrink: 0 },
  labelTextBlock: { flex: 1 },
  taskLabel: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  taskDates: { fontSize: 9, color: '#5A7A96' },
  monthHeaderRow: {
    height: HEADER_HEIGHT,
    position: 'relative',
    backgroundColor: '#1C2B38',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3F52',
  },
  monthLabel: { position: 'absolute', fontSize: 11, color: '#5A7A96', fontWeight: '500', top: 4 },
  monthDivider: { position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: '#2A3F52' },
  weekDivider: { position: 'absolute', top: 18, bottom: 0, width: 0.5, backgroundColor: '#1E3040' },
  weekLabel: { position: 'absolute', fontSize: 8, color: '#3A5A76', top: 20 },
  barRow: {
    height: ROW_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C2B38',
  },
  rowAlt: { backgroundColor: '#0D1820' },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: '#1C2B38' },
  weekGridLine: { position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: '#141E27' },
  todayLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: '#F0A500', zIndex: 10 },
  bar: {
    position: 'absolute',
    top: 10,
    height: ROW_HEIGHT - 20,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  barLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '600' },
  progressLine: {
    position: 'absolute',
    top: (ROW_HEIGHT - 20) / 3,       // center of 1/3-height bar within the task bar
    left: 0,
    height: (ROW_HEIGHT - 20) / 3,    // 1/3 of task bar thickness
    backgroundColor: '#000000',
    opacity: 0.55,
    borderRadius: 1,
  },
  milestoneLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, opacity: 0.7 },
  milestoneDiamond: {
    position: 'absolute',
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
  milestoneBarLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
  },
  todayLabelText: {
    position: 'absolute',
    fontSize: 9,
    color: '#F0A500',
    fontWeight: '600',
    letterSpacing: 1,
    top: 4,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#2A3F52',
    backgroundColor: '#0F1923',
    gap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendTodayLine: { width: 16, height: 2, backgroundColor: '#F0A500', borderRadius: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDiamond: { width: 8, height: 8, backgroundColor: '#F0A500', transform: [{ rotate: '45deg' }] },
  legendText: { fontSize: 11, color: '#5A7A96' },
  legendHint: { fontSize: 11, color: '#2A3F52', marginLeft: 'auto' as any },
});
