import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
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

function dayToAngle(dayOfYear: number) {
  return (dayOfYear / TOTAL_DAYS) * 360 - 90;
}

function angleToXY(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: R + radius * Math.cos(rad),
    y: R + radius * Math.sin(rad),
  };
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getMonthStartDays() {
  const days: number[] = [];
  let running = 0;
  MONTHS.forEach((m) => {
    days.push(running);
    running += m.days;
  });
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
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  });
}

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
    const arc1Large = arc1Angle > 180 ? 1 : 0;
    const arc2Days = endDay - 1;
    const arc2Angle = (arc2Days / TOTAL_DAYS) * 360;
    const arc2Large = arc2Angle > 180 ? 1 : 0;
    let path = '';
    if (arc1Days > 0) {
      path += `M ${startXY.x.toFixed(2)} ${startXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${arc1Large} 1 ${yearEndXY.x.toFixed(2)} ${yearEndXY.y.toFixed(2)}`;
    }
    if (arc2Days > 0) {
      path += ` M ${yearStartXY.x.toFixed(2)} ${yearStartXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${arc2Large} 1 ${endXY.x.toFixed(2)} ${endXY.y.toFixed(2)}`;
    }
    return path;
  }
}

export interface Task {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  duration: string;
  unit: string;
}

interface Props {
  startDate: Date;
  endDate: Date;
  duration: string;
  unit: string;
  tasks: Task[];
  totalDuration: string;
  holidayCountry: string;
  onUnitToggle: () => void;
  onEndDateChange: (date: Date) => void;
  onStartDateChange: (date: Date) => void;
  onBoundaryDragStart: (taskIndex: number) => void;
  onBoundaryChange: (taskIndex: number, newDate: Date) => void;
}

export default function DateWheel({
  startDate,
  endDate,
  duration,
  unit,
  tasks,
  totalDuration,
  holidayCountry,
  onUnitToggle,
  onEndDateChange,
  onStartDateChange,
  onBoundaryDragStart,
  onBoundaryChange,
}: Props) {
  const monthStarts = getMonthStartDays();
  const holidayDays = getHolidayDays(holidayCountry, startDate.getFullYear());

  const startDay = getDayOfYear(startDate);
  const endDay = getDayOfYear(endDate);
  const startAngle = dayToAngle(startDay);
  const endAngle = dayToAngle(endDay);
  const startXY = angleToXY(startAngle, RING_RADIUS);
  const endXY = angleToXY(endAngle, RING_RADIUS);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  const activeArcPath = buildArcPath(startDay, endDay, sameYear);

  const totalTaskDays = tasks.reduce((sum, t) => {
    const s = new Date(t.startDate);
    const e = new Date(t.endDate);
    return sum + Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  }, 0);
  const exceededYear = totalTaskDays > TOTAL_DAYS;

  const boundaryDots = tasks.map((task, i) => {
    const te = new Date(task.endDate);
    const tEndDay = getDayOfYear(te);
    const tEndAngle = dayToAngle(tEndDay);
    const xy = angleToXY(tEndAngle, RING_RADIUS);
    return { x: xy.x, y: xy.y, taskIndex: i };
  });

  const dragTargetRef = React.useRef<'start' | 'end' | number>('end');
  const isDraggingRef = React.useRef(false);
  const [activeDot, setActiveDot] = React.useState<'start' | 'end' | number | null>(null);

  function dist(ax: number, ay: number, bx: number, by: number) {
    return Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
  }

  function snapToUnit(dayOfYear: number, currentUnit: string, isStart: boolean): number {
    switch (currentUnit) {
      case 'Weeks': {
        if (isStart) {
          const weeks = Math.round(dayOfYear / 7);
          return Math.max(weeks, 1) * 7;
        } else {
          const diff = dayOfYear - startDay;
          const weeks = Math.round(diff / 7);
          return startDay + Math.max(weeks, 1) * 7;
        }
      }
      case 'Months': {
        const baseDate = new Date(startDate.getFullYear(), 0, dayOfYear);
        const snapped = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const yearStart = new Date(snapped.getFullYear(), 0, 0);
        const snapDiff = snapped.getTime() - yearStart.getTime();
        return Math.floor(snapDiff / (1000 * 60 * 60 * 24));
      }
      case 'Business Days':
      case 'Days':
      default:
        return dayOfYear;
    }
  }

  function handleDragStart(touchX: number, touchY: number) {
    const dx = touchX - R;
    const dy = touchY - R;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < R * 0.4 || distance > R) return;

    const distToStart = dist(touchX, touchY, startXY.x, startXY.y);
    const distToEnd = dist(touchX, touchY, endXY.x, endXY.y);

    let closestBoundaryDist = Infinity;
    let closestBoundaryIndex = -1;

    boundaryDots.forEach((dot) => {
      const d = dist(touchX, touchY, dot.x, dot.y);
      if (d < closestBoundaryDist) {
        closestBoundaryDist = d;
        closestBoundaryIndex = dot.taskIndex;
      }
    });

    const minDist = Math.min(distToStart, distToEnd, closestBoundaryDist);

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
    }
    isDraggingRef.current = true;
  }

  function handleDragUpdate(touchX: number, touchY: number) {
    if (!isDraggingRef.current) return;

    const dx = touchX - R;
    const dy = touchY - R;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < R * 0.4 || distance > R) return;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    const dayOfYear = Math.round((angle / 360) * TOTAL_DAYS);

    const target = dragTargetRef.current;

    if (typeof target === 'number') {
      const snappedDay = snapToUnit(dayOfYear, unit, false);
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
        const newDate = new Date(startDate.getFullYear() + 1, 0, snappedDay);
        onEndDateChange(newDate);
      } else {
        const newDate = new Date(startDate.getFullYear(), 0, snappedDay);
        if (newDate > startDate) onEndDateChange(newDate);
      }
    }
  }

  function handleDragEnd() {
    isDraggingRef.current = false;
    setActiveDot(null);
  }

  const ringGesture = Gesture.Pan()
    .onStart((e) => { runOnJS(handleDragStart)(e.x, e.y); })
    .onUpdate((e) => { runOnJS(handleDragUpdate)(e.x, e.y); })
    .onEnd(() => { runOnJS(handleDragEnd)(); });

  return (
    <GestureDetector gesture={ringGesture}>
      <View style={[styles.container, { width: SIZE, height: SIZE }]}>
        <Svg width={SIZE} height={SIZE}>

          <Circle cx={R} cy={R} r={RING_RADIUS} fill="none" stroke="#1C2B38" strokeWidth={36}/>

          {tasks.map((task) => {
            const ts = new Date(task.startDate);
            const te = new Date(task.endDate);
            const tStartDay = getDayOfYear(ts);
            const tEndDay = getDayOfYear(te);
            const tSameYear = ts.getFullYear() === te.getFullYear();
            const path = buildArcPath(tStartDay, tEndDay, tSameYear);
            const color = exceededYear && task === tasks[tasks.length - 1]
              ? OVERLAP_COLOR : task.color;
            return path ? (
              <Path key={task.id} d={path} fill="none" stroke={color} strokeWidth={36} strokeOpacity={0.7}/>
            ) : null;
          })}

          {activeArcPath !== '' && (
            <Path
              d={activeArcPath}
              fill="none"
              stroke={exceededYear ? OVERLAP_COLOR : TASK_COLORS[tasks.length % TASK_COLORS.length]}
              strokeWidth={36}
              strokeOpacity={0.6}
            />
          )}

          <Circle cx={R} cy={R} r={RING_RADIUS + 18} fill="none" stroke="#2E7DBC" strokeWidth={1} strokeOpacity={0.4}/>
          <Circle cx={R} cy={R} r={RING_RADIUS - 18} fill="none" stroke="#2E7DBC" strokeWidth={1} strokeOpacity={0.4}/>

          {MONTHS.map((month, i) => {
            const midDay = monthStarts[i] + month.days / 2;
            const angle = dayToAngle(midDay);
            const pos = angleToXY(angle, LABEL_RADIUS);
            return (
              <SvgText
                key={month.name}
                x={pos.x} y={pos.y}
                fontSize={11} fontWeight="600"
                fill="#8AAFC4"
                textAnchor="middle"
                alignmentBaseline="middle"
                rotation={angle + 90}
                originX={pos.x} originY={pos.y}
              >
                {month.name}
              </SvgText>
            );
          })}

          {monthStarts.map((dayStart, i) => {
            const angle = dayToAngle(dayStart);
            const inner = angleToXY(angle, RING_RADIUS - 16);
            const outer = angleToXY(angle, RING_RADIUS + 16);
            return (
              <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="#2E7DBC" strokeWidth={0.5} strokeOpacity={0.5}/>
            );
          })}

          {holidayDays.map((dayNum, i) => {
            const angle = dayToAngle(dayNum);
            const inner = angleToXY(angle, RING_RADIUS - 14);
            const outer = angleToXY(angle, RING_RADIUS + 14);
            return (
              <Line key={`holiday-${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="#EF4444" strokeWidth={2} strokeOpacity={0.7} strokeLinecap="round"/>
            );
          })}

          <Circle cx={R} cy={R} r={R - 80} fill="#0F1923" stroke="#2E7DBC" strokeWidth={1.5}/>

          {/* Task boundary dots */}
          {tasks.map((task, i) => {
            const te = new Date(task.endDate);
            const tEndDay = getDayOfYear(te);
            const tEndAngle = dayToAngle(tEndDay);
            const tEndXY = angleToXY(tEndAngle, RING_RADIUS);
            const isActive = activeDot === i;
            return (
              <React.Fragment key={task.id}>
                {isActive && (
                  <Circle
                    cx={tEndXY.x} cy={tEndXY.y} r={20}
                    fill={task.color} fillOpacity={0.2}
                  />
                )}
                <Circle
                  cx={tEndXY.x} cy={tEndXY.y}
                  r={isActive ? 13 : 8}
                  fill={task.color}
                  stroke="#FFFFFF"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeOpacity={isActive ? 0.9 : 0.4}
                />
              </React.Fragment>
            );
          })}

          {/* Start dot */}
          {activeDot === 'start' && (
            <Circle cx={startXY.x} cy={startXY.y} r={22} fill="#2E9BFF" fillOpacity={0.2}/>
          )}
          <Circle cx={startXY.x} cy={startXY.y} r={activeDot === 'start' ? 15 : 10} fill="#2E9BFF"/>
          <Circle cx={startXY.x} cy={startXY.y} r={activeDot === 'start' ? 15 : 10}
            fill="none" stroke="#FFFFFF"
            strokeWidth={activeDot === 'start' ? 2.5 : 1.5}
            strokeOpacity={activeDot === 'start' ? 0.9 : 0.4}/>

          {/* End dot */}
          {activeDot === 'end' && (
            <Circle cx={endXY.x} cy={endXY.y} r={24} fill="#F0A500" fillOpacity={0.2}/>
          )}
          <Circle cx={endXY.x} cy={endXY.y} r={activeDot === 'end' ? 17 : 12}
            fill="#F0A500" fillOpacity={0.9}/>
          <Circle cx={endXY.x} cy={endXY.y} r={activeDot === 'end' ? 17 : 12}
            fill="none" stroke="#FFFFFF"
            strokeWidth={activeDot === 'end' ? 2.5 : 1.5}
            strokeOpacity={activeDot === 'end' ? 0.9 : 0.4}/>

        </Svg>

        <View style={styles.centerContent} pointerEvents="box-none">
          {tasks.length > 0 && (
            <Text style={styles.centerTaskCount}>{tasks.length + 1} Tasks</Text>
          )}
          <Text style={styles.centerDuration}>{duration}</Text>
          <Text style={styles.centerUnit} onPress={onUnitToggle}>
            {unit.toUpperCase()} ▾
          </Text>
          {tasks.length > 0 && totalDuration !== "" && (
            <View style={styles.totalBadge}>
              <Text style={styles.centerTotal}>{totalDuration} total</Text>
            </View>
          )}
          {exceededYear && (
            <Text style={styles.overlapWarning}>⚠ 1yr exceeded</Text>
          )}
        </View>

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
    marginTop: 4,
  },
  totalBadge: {
    marginTop: 6,
    backgroundColor: '#1C2B38',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#2E7DBC',
  },
  centerTotal: {
    fontSize: 10,
    color: '#8AAFC4',
    fontWeight: '500',
  },
  overlapWarning: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
    fontWeight: '600',
  },
});