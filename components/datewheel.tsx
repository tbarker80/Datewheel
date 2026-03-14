import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

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

interface Props {
  startDate: Date;
  endDate: Date;
  duration: string;
  unit: string;
  onUnitToggle: () => void;
  onEndDateChange: (date: Date) => void;
  onStartDateChange: (date: Date) => void;
}

export default function DateWheel({ startDate, endDate, duration, unit, onUnitToggle, onEndDateChange, onStartDateChange }: Props) {
  const monthStarts = getMonthStartDays();

  const startDay = getDayOfYear(startDate);
  const endDay = getDayOfYear(endDate);
  const startAngle = dayToAngle(startDay);
  const endAngle = dayToAngle(endDay);
  const startXY = angleToXY(startAngle, RING_RADIUS);
  const endXY = angleToXY(endAngle, RING_RADIUS);

  // Handle arc crossing year boundary
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  let arcPath = '';

  if (sameYear) {
    const spanDays = endDay - startDay;
    const spanAngle = (spanDays / TOTAL_DAYS) * 360;
    const largeArc = spanAngle > 180 ? 1 : 0;
    if (spanDays > 0) {
      arcPath = `M ${startXY.x.toFixed(2)} ${startXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${endXY.x.toFixed(2)} ${endXY.y.toFixed(2)}`;
    }
  } else {
    // End date is in next year — draw arc from start to Dec 31 + Jan 1 to end
    const toYearEnd = TOTAL_DAYS - startDay;
    const fromYearStart = endDay;
    const totalSpan = toYearEnd + fromYearStart;
    const spanAngle = (totalSpan / TOTAL_DAYS) * 360;
    const largeArc = spanAngle > 180 ? 1 : 0;
    const yearEndXY = angleToXY(dayToAngle(TOTAL_DAYS), RING_RADIUS);
    // Draw as one arc going the long way around
    arcPath = `M ${startXY.x.toFixed(2)} ${startXY.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${endXY.x.toFixed(2)} ${endXY.y.toFixed(2)}`;
  }

  function handleRingDrag(touchX: number, touchY: number) {
    const dx = touchX - R;
    const dy = touchY - R;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < R * 0.4 || distance > R) return;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    const dayOfYear = Math.round((angle / 360) * TOTAL_DAYS);

    const distToStart = Math.sqrt(
      Math.pow(touchX - startXY.x, 2) + Math.pow(touchY - startXY.y, 2)
    );
    const distToEnd = Math.sqrt(
      Math.pow(touchX - endXY.x, 2) + Math.pow(touchY - endXY.y, 2)
    );

    if (distToStart < distToEnd) {
      // Moving start date — allow crossing into previous year
      const currentStartDay = getDayOfYear(startDate);
      if (dayOfYear > currentStartDay + 180) {
        // Dragged far back — go to previous year
        const newDate = new Date(startDate.getFullYear() - 1, 0, dayOfYear);
        if (newDate < endDate) onStartDateChange(newDate);
      } else {
        const newDate = new Date(startDate.getFullYear(), 0, dayOfYear);
        if (newDate < endDate) onStartDateChange(newDate);
      }
    } else {
      // Moving end date — allow crossing into next year
      const currentStartDay = getDayOfYear(startDate);
      if (dayOfYear < currentStartDay - 30 || (!sameYear && dayOfYear < 180)) {
        // Crossed year boundary
        const newDate = new Date(startDate.getFullYear() + 1, 0, dayOfYear);
        onEndDateChange(newDate);
      } else {
        const newDate = new Date(startDate.getFullYear(), 0, dayOfYear);
        if (newDate > startDate) onEndDateChange(newDate);
      }
    }
  }

  const ringGesture = Gesture.Pan()
    .onUpdate((e) => {
      runOnJS(handleRingDrag)(e.x, e.y);
    });

  return (
    <GestureDetector gesture={ringGesture}>
      <View style={[styles.container, { width: SIZE, height: SIZE }]}>
        <Svg width={SIZE} height={SIZE}>

          {/* Outer ring background */}
          <Circle
            cx={R} cy={R} r={RING_RADIUS}
            fill="none"
            stroke="#1C2B38"
            strokeWidth={36}
          />

          {/* Glowing arc between start and end */}
          {arcPath !== '' && (
            <Path
              d={arcPath}
              fill="none"
              stroke="#2E9BFF"
              strokeWidth={36}
              strokeOpacity={0.6}
            />
          )}

          {/* Ring border outer */}
          <Circle
            cx={R} cy={R} r={RING_RADIUS + 18}
            fill="none"
            stroke="#2E7DBC"
            strokeWidth={1}
            strokeOpacity={0.4}
          />

          {/* Ring border inner */}
          <Circle
            cx={R} cy={R} r={RING_RADIUS - 18}
            fill="none"
            stroke="#2E7DBC"
            strokeWidth={1}
            strokeOpacity={0.4}
          />

          {/* Month labels */}
          {MONTHS.map((month, i) => {
            const midDay = monthStarts[i] + month.days / 2;
            const angle = dayToAngle(midDay);
            const pos = angleToXY(angle, LABEL_RADIUS);
            return (
              <SvgText
                key={month.name}
                x={pos.x}
                y={pos.y}
                fontSize={11}
                fontWeight="600"
                fill="#8AAFC4"
                textAnchor="middle"
                alignmentBaseline="middle"
                rotation={angle + 90}
                originX={pos.x}
                originY={pos.y}
              >
                {month.name}
              </SvgText>
            );
          })}

          {/* Month divider ticks */}
          {monthStarts.map((dayStart, i) => {
            const angle = dayToAngle(dayStart);
            const inner = angleToXY(angle, RING_RADIUS - 16);
            const outer = angleToXY(angle, RING_RADIUS + 16);
            return (
              <Line
                key={i}
                x1={inner.x} y1={inner.y}
                x2={outer.x} y2={outer.y}
                stroke="#2E7DBC"
                strokeWidth={0.5}
                strokeOpacity={0.5}
              />
            );
          })}

          {/* Center hub */}
          <Circle
            cx={R} cy={R} r={R - 80}
            fill="#0F1923"
            stroke="#2E7DBC"
            strokeWidth={1.5}
          />

          {/* Start dot - blue */}
          <Circle
            cx={startXY.x}
            cy={startXY.y}
            r={10}
            fill="#2E9BFF"
          />
          <Circle
            cx={startXY.x}
            cy={startXY.y}
            r={10}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeOpacity={0.4}
          />

          {/* End dot - amber */}
          <Circle
            cx={endXY.x}
            cy={endXY.y}
            r={12}
            fill="#F0A500"
            fillOpacity={0.9}
          />
          <Circle
            cx={endXY.x}
            cy={endXY.y}
            r={12}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeOpacity={0.4}
          />

        </Svg>

        {/* Center content */}
        <View style={styles.centerContent} pointerEvents="box-none">
          <Text style={styles.centerDuration}>{duration}</Text>
          <Text style={styles.centerUnit} onPress={onUnitToggle}>
            {unit.toUpperCase()} ▾
          </Text>
          <Text style={styles.centerHint}>tap to change unit</Text>
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
  centerDuration: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 58,
  },
  centerUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E9BFF',
    letterSpacing: 2,
    marginTop: 4,
  },
  centerHint: {
    fontSize: 10,
    color: '#2A3F52',
    marginTop: 6,
  },
});