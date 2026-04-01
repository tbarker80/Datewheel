import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { HOLIDAYS } from './holidays';

const { width } = Dimensions.get('window');
const SIZE = width * 0.9;
const R = SIZE / 2;
const RING_RADIUS = R - 20;
const LABEL_RADIUS = R - 44;

const MONTHS = [
  { name: 'Jan', days: 31 },
  { name: 'Feb', days: 28 },
  { name: 'Mar', days: 31 },
  { name: 'Apr', days: 30 },
  { name: 'May', days: 31 },
  { name: 'Jun', days: 30 },
  { name: 'Jul', days: 31 },
  { name: 'Aug', days: 31 },
  { name: 'Sep', days: 30 },
  { name: 'Oct', days: 31 },
  { name: 'Nov', days: 30 },
  { name: 'Dec', days: 31 },
];

const TOTAL_DAYS = 365;

export const TASK_COLORS = [
  '#2E9BFF',
  '#1DB8A0',
  '#8B5CF6',
  '#F97316',
  '#EC4899',
  '#84CC16',
];

export const OVERLAP_COLOR = '#EF4444';

export interface Task {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  duration: string;
  unit: string;
  notificationId?: string;
  reminderDays?: number;
}
export interface Task {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  duration: string;
  unit: string;
  notificationId?: string;
  reminderDays?: number;
  lagDays?: number;   // ← ADD: negative = overlap, positive = gap, undefined = flush
}

export interface Milestone {
  id: number;
  name: string;
  date: string;
  color: string;
  notificationId?: string;
  reminderDays?: number;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function dayToAngle(dayOfYear: number) {
  return (dayOfYear / TOTAL_DAYS) * 360 - 90;
}

function angleToXY(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: R + radius * Math.cos(rad), y: R + radius * Math.sin(rad) };
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthStartDays() {
  const days: number[] = [];
  let running = 0;
  MONTHS.forEach((m) => { days.push(running); running += m.days; });
  return days;
}

function getHolidayDays(country: string, year: number): number[] {
  if (!country || country === 'NONE') return [];
  const holidays = HOLIDAYS[country];
  if (!holidays) return [];
  return Object.keys(holidays).map((key) => {
    const [month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const start = new Date(year, 0, 0);
    return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  });
}

function formatShortDate(dayOfYear: number, year: number): string {
  const date = new Date(year, 0, dayOfYear);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Arc building ─────────────────────────────────────────────────────────────

function buildArcPath(startDay: number, endDay: number, sameYear: boolean): string {
  const startAngle = dayToAngle(startDay);
  const endAngle = dayToAngle(endDay);
  const startXY = angleToXY(startAngle, RING_RADIUS);
  const endXY = angleToXY(endAngle, RING_RADIUS);

  if (sameYear) {
    const spanDays = endDay - startDay;
    if (spanDays <= 0 || spanDays >= TOTAL_DAYS) return '';
    const spanAngle = (spanDays / TOTAL_DAYS) * 360;
    const largeArc = spanAngle > 180 ? 1 : 0;
    return `M ${startXY.x.toFixed(2)} ${startXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${endXY.x.toFixed(2)} ${endXY.y.toFixed(2)}`;
  } else {
    const yearEndXY = angleToXY(dayToAngle(TOTAL_DAYS), RING_RADIUS);
    const yearStartXY = angleToXY(dayToAngle(1), RING_RADIUS);
    const arc1Days = TOTAL_DAYS - startDay;
    const arc1Angle = (arc1Days / TOTAL_DAYS) * 360;
    const arc2Days = endDay - 1;
    const arc2Angle = (arc2Days / TOTAL_DAYS) * 360;
    let path = '';
    if (arc1Days > 0)
      path += `M ${startXY.x.toFixed(2)} ${startXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${arc1Angle > 180 ? 1 : 0} 1 ${yearEndXY.x.toFixed(2)} ${yearEndXY.y.toFixed(2)}`;
    if (arc2Days > 0)
      path += ` M ${yearStartXY.x.toFixed(2)} ${yearStartXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${arc2Angle > 180 ? 1 : 0} 1 ${endXY.x.toFixed(2)} ${endXY.y.toFixed(2)}`;
    return path;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  startDate: Date;
  endDate: Date;
  activeLagDays?: number;  // lag between last stored task and active task
  duration: string;
  unit: string;
  tasks: Task[];
  milestones: Milestone[];
  totalDuration: string;
  holidayCountry: string;
  highlightedTaskId: number | null;
  highlightedTaskDuration: string;
  isLocked: boolean;
  physicalScale: number;
  onBoundaryTap?: (taskIndex: number) => void;
  onDurationTap: () => void;
  onTimelineShift: (shiftDays: number) => void;
  onUnitToggle: () => void;
  onEndDateChange: (date: Date) => void;
  onStartDateChange: (date: Date) => void;
  onBoundaryDragStart: (taskIndex: number) => void;
  onBoundaryChange: (taskIndex: number, newDate: Date) => void;
  onEndDragStart: () => void;
  onDragEnd: () => void;
  onDragActive: (dragging: boolean) => void;
  onTaskTap: (taskId: number | null) => void;
  onScaleChange: (scale: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DateWheel({
  startDate,
  endDate,
  duration,
  unit,
  tasks,
  activeLagDays,
  milestones,
  totalDuration,
  holidayCountry,
  highlightedTaskId,
  highlightedTaskDuration,
  isLocked,
  physicalScale,
  onBoundaryTap,
  onDurationTap,
  onTimelineShift,
  onUnitToggle,
  onEndDateChange,
  onStartDateChange,
  onBoundaryDragStart,
  onBoundaryChange,
  onEndDragStart,
  onDragEnd,
  onDragActive,
  onTaskTap,
  onScaleChange,
}: Props) {
  const monthStarts = getMonthStartDays();
  const holidayDays = getHolidayDays(holidayCountry, startDate.getFullYear());
  const year = startDate.getFullYear();

  // ─── Derived values ───────────────────────────────────────────────────────
  const startDay = getDayOfYear(startDate);
  const endDay = getDayOfYear(endDate);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startXY = angleToXY(dayToAngle(startDay), RING_RADIUS);
  const endXY = angleToXY(dayToAngle(endDay), RING_RADIUS);
  const activeArcPath = buildArcPath(startDay, endDay, sameYear);

  const totalTaskDays = tasks.reduce((sum, t) => {
    const s = new Date(t.startDate);
    const e = new Date(t.endDate);
    return sum + Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);
  const exceededYear = totalTaskDays > TOTAL_DAYS;

  const boundaryDots = tasks.map((task, i) => {
    const tEndDay = getDayOfYear(new Date(task.endDate));
    const xy = angleToXY(dayToAngle(tEndDay), RING_RADIUS);
    return { x: xy.x, y: xy.y, taskIndex: i };
  });

  // ─── Focus point: highlighted task end or active task end ─────────────────
  // This is the SVG point that will be centered on screen when zoomed.
  const focusedTask = highlightedTaskId !== null
    ? tasks.find(t => t.id === highlightedTaskId)
    : null;
  const focusDay = focusedTask
    ? getDayOfYear(new Date(focusedTask.endDate))
    : endDay;
  const focusXY = angleToXY(dayToAngle(focusDay), RING_RADIUS);

  // Refs to avoid stale closures in gesture handlers
  const physicalScaleRef = React.useRef(physicalScale);
  physicalScaleRef.current = physicalScale;
  const focusXYRef = React.useRef(focusXY);
  focusXYRef.current = focusXY;

  // ─── ViewBox + pan state ──────────────────────────────────────────────────
  // Pan offset in SVG units. Positive panX shifts view left (shows more right).
  const [viewPan, setViewPan] = React.useState({ x: 0, y: 0 });
  const viewPanRef = React.useRef({ x: 0, y: 0 });

  // Reset pan whenever scale changes
  React.useEffect(() => {
    viewPanRef.current = { x: 0, y: 0 };
    setViewPan({ x: 0, y: 0 });
  }, [physicalScale]);

  // ViewBox: at scale 1 show full SVG; at higher scales zoom into focus point
  const vw = SIZE / physicalScale;
  const vh = SIZE / physicalScale;
  const vx = physicalScale === 1 ? 0 : focusXY.x - vw / 2 - viewPan.x;
  const vy = physicalScale === 1 ? 0 : focusXY.y - vh / 2 - viewPan.y;
  const viewBoxStr = `${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`;

  // Convert screen touch → SVG coordinate using viewBox mapping
  // Screen (touchX, touchY) maps to SVG as: svgX = vx + touchX * vw/SIZE
  function toSvg(touchX: number, touchY: number): { x: number; y: number } {
    const ps = physicalScaleRef.current;
    const fw = SIZE / ps;
    const fx = focusXYRef.current;
    const cx = ps === 1 ? 0 : fx.x - fw / 2 - viewPanRef.current.x;
    const cy = ps === 1 ? 0 : fx.y - fw / 2 - viewPanRef.current.y;
    return {
      x: cx + touchX * fw / SIZE,
      y: cy + touchY * fw / SIZE,
    };
  }

  // ─── Gesture state ────────────────────────────────────────────────────────
  const dragTargetRef = React.useRef<'start' | 'end' | number>('end');
  const isDraggingRef = React.useRef(false);
  const isPanningViewRef = React.useRef(false);
  const lockDragStartDayRef = React.useRef<number>(0);
  const pinchStartScaleRef = React.useRef(1);
  const panStartTouchRef = React.useRef({ x: 0, y: 0 });
  const panStartPanRef = React.useRef({ x: 0, y: 0 });
  const angleToDayRef = React.useRef<number | null>(null);
  const [activeDot, setActiveDot] = React.useState<'start' | 'end' | number | null>(null);

  function dist(ax: number, ay: number, bx: number, by: number) {
    return Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
  }

  function snapToUnit(dayOfYear: number, currentUnit: string, isStart: boolean, taskStartDay?: number): number {
    switch (currentUnit) {
      case 'Weeks': {
        const baseDay = taskStartDay !== undefined ? taskStartDay : startDay;
        if (isStart) {
          const weeks = Math.round(dayOfYear / 7);
          return Math.max(weeks, 1) * 7;
        } else {
          const diff = dayOfYear - baseDay;
          const weeks = Math.round(diff / 7);
          return baseDay + Math.max(weeks, 1) * 7;
        }
      }
      case 'Months': {
        const baseDate = new Date(startDate.getFullYear(), 0, dayOfYear);
        const snapped = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const yearStart = new Date(snapped.getFullYear(), 0, 0);
        return Math.floor((snapped.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
      }
      case 'Business Days':
      case 'Days':
      default:
        return dayOfYear;
    }
  }

  // ─── Drag handlers ────────────────────────────────────────────────────────

  function handleDragStart(touchX: number, touchY: number) {
    const { x, y } = toSvg(touchX, touchY);
    const dx = x - R;
    const dy = y - R;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (isLocked) {
      if (distance < R * 0.4 || distance > R) return;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      lockDragStartDayRef.current = Math.round((angle / 360) * TOTAL_DAYS);
      isDraggingRef.current = true;
      isPanningViewRef.current = false;
      onDragActive(true);
      return;
    }

    const distToStart = dist(x, y, startXY.x, startXY.y);
    const distToEnd = dist(x, y, endXY.x, endXY.y);

    let closestBoundaryDist = Infinity;
    let closestBoundaryIndex = -1;
    boundaryDots.forEach((dot) => {
      const d = dist(x, y, dot.x, dot.y);
      if (d < closestBoundaryDist) {
        closestBoundaryDist = d;
        closestBoundaryIndex = dot.taskIndex;
      }
    });

    const minDist = Math.min(distToStart, distToEnd, closestBoundaryDist);
    const ACTIVATION_RADIUS = 44;

    if (minDist <= ACTIVATION_RADIUS) {
      // Close to a dot — dot drag
      isPanningViewRef.current = false;
      if (minDist === closestBoundaryDist && closestBoundaryIndex >= 0) {
        dragTargetRef.current = closestBoundaryIndex;
        setActiveDot(closestBoundaryIndex);
        onBoundaryDragStart(closestBoundaryIndex);
      } else if (minDist === distToStart) {
        dragTargetRef.current = 'start';
        setActiveDot('start');
      } else {
        dragTargetRef.current = 'end';
        setActiveDot('end');
        onEndDragStart();
      }
      isDraggingRef.current = true;
      onDragActive(true);
    } else if (physicalScaleRef.current > 1) {
      // Not near a dot, but zoomed in — start view panning
      isPanningViewRef.current = true;
      isDraggingRef.current = true;
      panStartTouchRef.current = { x: touchX, y: touchY };
      panStartPanRef.current = { ...viewPanRef.current };
      onDragActive(true);
    } else {
      isDraggingRef.current = false;
      isPanningViewRef.current = false;
    }
  }

  function handleDragUpdate(touchX: number, touchY: number) {
    if (!isDraggingRef.current) return;

    // View panning
    if (isPanningViewRef.current) {
      const ps = physicalScaleRef.current;
      const newPan = {
        x: panStartPanRef.current.x + (touchX - panStartTouchRef.current.x) / ps,
        y: panStartPanRef.current.y + (touchY - panStartTouchRef.current.y) / ps,
      };
      viewPanRef.current = newPan;
      setViewPan({ ...newPan });
      return;
    }

    // Dot dragging — convert touch to SVG space
    const { x, y } = toSvg(touchX, touchY);
    const dx = x - R;
    const dy = y - R;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < R * 0.4 || distance > R) return;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    // Dampen drag speed when zoomed — higher scale = more precision needed
    const dampening = physicalScale > 1 ? physicalScale * 1.5 : 1;
    const rawDay = (angle / 360) * TOTAL_DAYS;
    const prevDay = angleToDayRef.current ?? rawDay;
    angleToDayRef.current = prevDay + (rawDay - prevDay) / dampening;
    const dayOfYear = Math.round(angleToDayRef.current);


    if (isLocked) {
      const shiftDays = dayOfYear - lockDragStartDayRef.current;
      if (shiftDays !== 0) {
        lockDragStartDayRef.current = dayOfYear;
        onTimelineShift(shiftDays);
      }
      return;
    }

    const target = dragTargetRef.current;

    if (typeof target === 'number') {
      const taskStartDate = tasks[target] ? new Date(tasks[target].startDate) : startDate;
      const taskStartDay = getDayOfYear(taskStartDate);
      const snappedDay = snapToUnit(dayOfYear, unit, false, taskStartDay);
      const newDate = new Date(startDate.getFullYear(), 0, snappedDay);
      if (tasks[target] && newDate > new Date(tasks[target].startDate)) {
        onBoundaryChange(target, newDate);
      }
    } else if (target === 'start') {
      const snappedDay = snapToUnit(dayOfYear, unit, true);
      const newDate = new Date(startDate.getFullYear(), 0, snappedDay);
      if (newDate < endDate) onStartDateChange(newDate);
    } else {
      const snappedDay = snapToUnit(dayOfYear, unit, false);
      if (dayOfYear < startDay - 30 || (!sameYear && dayOfYear < 180)) {
        onEndDateChange(new Date(startDate.getFullYear() + 1, 0, snappedDay));
      } else {
        const newDate = new Date(startDate.getFullYear(), 0, snappedDay);
        if (newDate > startDate) onEndDateChange(newDate);
      }
    }
  }

  function handleDragEnd() {
    isDraggingRef.current = false;
    isPanningViewRef.current = false;
    angleToDayRef.current = null;
    setActiveDot(null);
    onDragActive(false);
    onDragEnd();
  }

  function handleTap(touchX: number, touchY: number) {
    const { x, y } = toSvg(touchX, touchY);
    const dx = x - R;
    const dy = y - R;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if tap is on a boundary dot
    if (onBoundaryTap) {
      for (let i = 0; i < tasks.length; i++) {
        const dot = boundaryDots[i];
        if (dist(x, y, dot.x, dot.y) < 24) {
          onBoundaryTap(i);
          return;
        }
      }
    }


    if (distance > RING_RADIUS + 20) { onTaskTap(null); return; }
    if (distance < RING_RADIUS - 20) { return; }

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    const tappedDay = Math.round((angle / 360) * TOTAL_DAYS);

    for (const task of tasks) {
      const tStartDay = getDayOfYear(new Date(task.startDate));
      const tEndDay = getDayOfYear(new Date(task.endDate));
      if (tappedDay >= tStartDay && tappedDay <= tEndDay) {
        onTaskTap(highlightedTaskId === task.id ? null : task.id);
        return;
      }
    }
    onTaskTap(null);
  }

  // ─── Pinch handlers ───────────────────────────────────────────────────────

  function handlePinchStart() {
    pinchStartScaleRef.current = physicalScaleRef.current;
  }

  function handlePinchUpdate(scale: number) {
    const newScale = Math.min(4.0, Math.max(1.0, pinchStartScaleRef.current * scale));
    onScaleChange(Math.round(newScale * 2) / 2); // snap to 0.5 steps
  }

  // ─── Gestures ─────────────────────────────────────────────────────────────

  const tapGesture = Gesture.Tap()
    .onEnd((e) => { runOnJS(handleTap)(e.x, e.y); });

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(0)
    .minDistance(2)
    .onStart((e) => { runOnJS(handleDragStart)(e.x, e.y); })
    .onUpdate((e) => { runOnJS(handleDragUpdate)(e.x, e.y); })
    .onEnd(() => { runOnJS(handleDragEnd)(); })
    .onFinalize(() => { runOnJS(handleDragEnd)(); });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { runOnJS(handlePinchStart)(); })
    .onUpdate((e) => { runOnJS(handlePinchUpdate)(e.scale); });

  const ringGesture = Gesture.Race(tapGesture, panGesture);
  const combinedGesture = Gesture.Simultaneous(pinchGesture, ringGesture);

  // ─── Tick marks ───────────────────────────────────────────────────────────

  const weekTicks = React.useMemo(() => {
    const ticks: number[] = [];
    for (let d = 7; d <= TOTAL_DAYS; d += 7) ticks.push(d);
    return ticks;
  }, []);

  const dayTicks = React.useMemo(() => {
    if (physicalScale < 2.5) return [];
    const ticks: number[] = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      if (d % 7 !== 0) ticks.push(d);
    }
    return ticks;
  }, [physicalScale]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <GestureDetector gesture={combinedGesture}>
      <View style={[styles.container, { width: SIZE, height: SIZE }]}>

        <Svg width={SIZE} height={SIZE} viewBox={viewBoxStr}>

          {/* Background ring */}
          <Circle cx={R} cy={R} r={RING_RADIUS} fill="none" stroke="#1C2B38" strokeWidth={36}/>

          {/* Task arcs */}
          {tasks.map((task) => {
            const tStartDay = getDayOfYear(new Date(task.startDate));
            const tEndDay = getDayOfYear(new Date(task.endDate));
            const tSameYear = new Date(task.startDate).getFullYear() === new Date(task.endDate).getFullYear();
            const path = buildArcPath(tStartDay, tEndDay, tSameYear);
            const color = exceededYear && task === tasks[tasks.length - 1] ? OVERLAP_COLOR : task.color;
            const isHighlighted = highlightedTaskId === task.id;
            const isDimmed = highlightedTaskId !== null && !isHighlighted;
            return path ? (
              <React.Fragment key={task.id}>
                {isHighlighted && <Path d={path} fill="none" stroke={color} strokeWidth={44} strokeOpacity={0.25}/>}
                <Path d={path} fill="none" stroke={color}
                  strokeWidth={isHighlighted ? 40 : 36}
                  strokeOpacity={isDimmed ? 0.25 : isHighlighted ? 1.0 : 0.7}/>
              </React.Fragment>
            ) : null;
          })}

          {/* Active arc */}
          {activeArcPath !== '' && (
            <Path d={activeArcPath} fill="none"
              stroke={exceededYear ? OVERLAP_COLOR : TASK_COLORS[tasks.length % TASK_COLORS.length]}
              strokeWidth={36} strokeOpacity={0.6}/>
          )}

          {/* Ring borders */}
          <Circle cx={R} cy={R} r={RING_RADIUS + 18} fill="none" stroke="#2E7DBC" strokeWidth={1} strokeOpacity={0.4}/>
          <Circle cx={R} cy={R} r={RING_RADIUS - 18} fill="none" stroke="#2E7DBC" strokeWidth={1} strokeOpacity={0.4}/>

          {/* Month labels and dividers */}
          {MONTHS.map((month, i) => {
            const midDay = monthStarts[i] + month.days / 2;
            const angle = dayToAngle(midDay);
            const pos = angleToXY(angle, LABEL_RADIUS);
            const divAngle = dayToAngle(monthStarts[i]);
            const inner = angleToXY(divAngle, RING_RADIUS - 16);
            const outer = angleToXY(divAngle, RING_RADIUS + 16);
            return (
              <React.Fragment key={month.name}>
                <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke="#2E7DBC" strokeWidth={0.5} strokeOpacity={0.5}/>
                <SvgText x={pos.x} y={pos.y} fontSize={11} fontWeight="600" fill="#8AAFC4"
                  textAnchor="middle" alignmentBaseline="middle"
                  rotation={angle + 90} originX={pos.x} originY={pos.y}>
                  {month.name}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Week tick marks — always in SVG, readable at scale >= 1.5 */}
          {weekTicks.map((day) => {
            const angle = dayToAngle(day);
            const inner = angleToXY(angle, RING_RADIUS - 10);
            const outer = angleToXY(angle, RING_RADIUS + 10);
            const labelPos = angleToXY(angle, LABEL_RADIUS + 4);
            return (
              <React.Fragment key={`wk-${day}`}>
                <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke="#3A5A76" strokeWidth={0.8} strokeOpacity={0.7}/>
                {physicalScale >= 2.0 && (
                  <SvgText x={labelPos.x} y={labelPos.y}
                    fontSize={7} fontWeight="500" fill="#5A7A96"
                    textAnchor="middle" alignmentBaseline="middle"
                    rotation={angle + 90} originX={labelPos.x} originY={labelPos.y}>
                    {formatShortDate(day, year)}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}

          {/* Day tick marks — rendered at scale >= 2.5 */}
          {dayTicks.map((day) => {
            const angle = dayToAngle(day);
            const inner = angleToXY(angle, RING_RADIUS - 5);
            const outer = angleToXY(angle, RING_RADIUS + 5);
            return (
              <Line key={`d-${day}`}
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="#2A3F52" strokeWidth={0.5} strokeOpacity={0.8}/>
            );
          })}

          {/* Holiday markers */}
          {holidayDays.map((dayNum, i) => {
            const angle = dayToAngle(dayNum);
            const inner = angleToXY(angle, RING_RADIUS - 14);
            const outer = angleToXY(angle, RING_RADIUS + 14);
            return (
              <Line key={`holiday-${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="#EF4444" strokeWidth={2} strokeOpacity={0.7} strokeLinecap="round"/>
            );
          })}

          {/* Today marker */}
          {(() => {
            const todayDay = getDayOfYear(new Date());
            const todayAngle = dayToAngle(todayDay);
            const inner = angleToXY(todayAngle, RING_RADIUS - 18);
            const outer = angleToXY(todayAngle, RING_RADIUS + 18);
            const dotPos = angleToXY(todayAngle, RING_RADIUS);
            return (
              <>
                <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke="#F0A500" strokeWidth={2.5} strokeOpacity={0.9} strokeLinecap="round"/>
                <Circle cx={dotPos.x} cy={dotPos.y} r={4} fill="#F0A500" fillOpacity={0.9}/>
              </>
            );
          })()}

          {/* Center hub */}
          <Circle cx={R} cy={R} r={R - 80} fill="#0F1923" stroke="#2E7DBC" strokeWidth={1.5}/>

            {/* Boundary dots */}
            {tasks.map((task, i) => {
              const tEndDay = getDayOfYear(new Date(task.endDate));
              const tEndXY = angleToXY(dayToAngle(tEndDay), RING_RADIUS);
              const isActive = activeDot === i;
              const nextTask = i < tasks.length - 1 ? tasks[i + 1] : undefined;
            const isLastTask = i === tasks.length - 1;
            const hasLag = (nextTask !== undefined && nextTask.lagDays !== undefined && nextTask.lagDays !== 0) ||
                (isLastTask && activeLagDays !== undefined && activeLagDays !== 0);

    const isOverlapLag = hasLag && (
  (nextTask !== undefined && nextTask.lagDays !== undefined && nextTask.lagDays < 0) ||
  (isLastTask && activeLagDays !== undefined && activeLagDays < 0)
);

    return (
      <React.Fragment key={task.id}>
        {isActive && <Circle cx={tEndXY.x} cy={tEndXY.y} r={20} fill={task.color} fillOpacity={0.2}/>}
        <Circle cx={tEndXY.x} cy={tEndXY.y} r={isActive ? 13 : 8}
          fill={task.color} stroke="#FFFFFF"
          strokeWidth={isActive ? 2.5 : 1.5}
          strokeOpacity={isActive ? 0.9 : 0.4}/>
        {task.reminderDays && !isActive && (
          <Circle cx={tEndXY.x} cy={tEndXY.y} r={13}
            fill="none" stroke="#FFFFFF" strokeWidth={1}
            strokeOpacity={0.5} strokeDasharray="2 2"/>
        )}
        {/* Lag/overlap indicator ring */}
        {hasLag && !isActive && (
          <Circle
            cx={tEndXY.x} cy={tEndXY.y}
            r={16}
            fill="none"
            stroke={isOverlapLag ? '#EF4444' : '#F0A500'}
            strokeWidth={1.5}
            strokeOpacity={0.8}
          />
        )}
      </React.Fragment>
    );
  })}

          {/* Milestone diamonds */}
          {milestones.map((milestone) => {
            const mXY = angleToXY(dayToAngle(getDayOfYear(new Date(milestone.date))), RING_RADIUS - 22);
            const size = 6;
            return (
              <React.Fragment key={`ms-${milestone.id}`}>
                <Circle cx={mXY.x} cy={mXY.y} r={10} fill={milestone.color} fillOpacity={0.2}/>
                <Path
                  d={`M ${mXY.x} ${mXY.y - size} L ${mXY.x + size} ${mXY.y} L ${mXY.x} ${mXY.y + size} L ${mXY.x - size} ${mXY.y} Z`}
                  fill={milestone.color} stroke="#FFFFFF" strokeWidth={1} strokeOpacity={0.9}/>
              </React.Fragment>
            );
          })}

          {/* Start dot */}
          {activeDot === 'start' && <Circle cx={startXY.x} cy={startXY.y} r={22} fill="#2E9BFF" fillOpacity={0.2}/>}
          <Circle cx={startXY.x} cy={startXY.y} r={activeDot === 'start' ? 15 : 10} fill="#2E9BFF"/>
          <Circle cx={startXY.x} cy={startXY.y} r={activeDot === 'start' ? 15 : 10}
            fill="none" stroke="#FFFFFF"
            strokeWidth={activeDot === 'start' ? 2.5 : 1.5}
            strokeOpacity={activeDot === 'start' ? 0.9 : 0.4}/>

          {/* End dot */}
          {activeDot === 'end' && <Circle cx={endXY.x} cy={endXY.y} r={24} fill="#F0A500" fillOpacity={0.2}/>}
          <Circle cx={endXY.x} cy={endXY.y} r={activeDot === 'end' ? 17 : 12}
            fill="#F0A500" fillOpacity={0.9}/>
          <Circle cx={endXY.x} cy={endXY.y} r={activeDot === 'end' ? 17 : 12}
            fill="none" stroke="#FFFFFF"
            strokeWidth={activeDot === 'end' ? 2.5 : 1.5}
            strokeOpacity={activeDot === 'end' ? 0.9 : 0.4}/>

        </Svg>

        {/* Center content — shown at scale 1 only, since hub moves off-center when panned */}
        {physicalScale === 1 && (
          <View style={styles.centerContent} pointerEvents="box-none">
            {tasks.length > 0 && (
              <Text style={styles.centerTaskCount}>{tasks.length + 1} Tasks</Text>
            )}
            <TouchableOpacity onPress={onDurationTap} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
              <Text style={styles.centerDuration}>
                {highlightedTaskId !== null ? highlightedTaskDuration : duration}
              </Text>
            </TouchableOpacity>
            <Text style={styles.centerUnit} onPress={onUnitToggle}>
              {unit.toUpperCase()} ▾
            </Text>
            {tasks.length > 0 && totalDuration !== "" && (
              <>
                <Text style={styles.centerDurationTotal}>{totalDuration}</Text>
                <Text style={styles.centerTotalLabel}>TOTAL</Text>
              </>
            )}
            {exceededYear && (
              <Text style={styles.overlapWarning}>⚠ 1yr exceeded</Text>
            )}
          </View>
        )}

      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE,
    height: SIZE,
  },
  centerTaskCount: {
    fontSize: 11,
    color: '#5A7A96',
    letterSpacing: 1,
    marginBottom: 2,
  },
  centerDuration: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 54,
  },
  centerUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E9BFF',
    letterSpacing: 2,
    marginTop: 2,
    marginBottom: 2,
  },
  centerDurationTotal: {
    fontSize: 48,
    fontWeight: '700',
    color: '#8AAFC4',
    lineHeight: 54,
  },
  centerTotalLabel: {
    fontSize: 10,
    color: '#5A7A96',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  overlapWarning: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
    fontWeight: '600',
  },
});
