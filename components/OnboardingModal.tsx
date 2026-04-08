import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Shared geometry helpers ──────────────────────────────────────────────────
function dayToAngle(day: number) { return (day / 365) * 360 - 90; }
function angleToXY(deg: number, radius: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}
function buildArc(
  startDay: number, endDay: number, color: string,
  ringR: number, r: number, strokeWidth = 28, opacity = 0.75
) {
  const span = endDay - startDay;
  if (span <= 0) return null;
  const sa = dayToAngle(startDay);
  const ea = dayToAngle(endDay);
  const s = angleToXY(sa, ringR, r, r);
  const e = angleToXY(ea, ringR, r, r);
  const large = (span / 365) * 360 > 180 ? 1 : 0;
  const d = `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${ringR} ${ringR} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  return <Path key={`${color}-${startDay}`} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity={opacity} />;
}

// ─── Wheel illustration ───────────────────────────────────────────────────────
function WheelIllustration({ size = 180 }: { size?: number }) {
  const r = size / 2;
  const ringR = r - 16;
  const months = [31,28,31,30,31,30,31,31,30,31,30,31];
  const monthNames = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  let dayStart = 0;
  const monthElements = months.map((days, i) => {
    const midDay = dayStart + days / 2;
    const angle = dayToAngle(midDay);
    const pos = angleToXY(angle, ringR - 26, r, r);
    const inner = angleToXY(dayToAngle(dayStart), ringR - 13, r, r);
    const outer = angleToXY(dayToAngle(dayStart), ringR + 13, r, r);
    dayStart += days;
    return { pos, inner, outer, name: monthNames[i], angle };
  });
  const startDot = angleToXY(dayToAngle(32), ringR, r, r);
  const endDot   = angleToXY(dayToAngle(212), ringR, r, r);
  const boundaryDot = angleToXY(dayToAngle(120), ringR, r, r);

  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={ringR} fill="none" stroke="#1C2B38" strokeWidth={28} />
      {buildArc(32, 120, '#2E9BFF', ringR, r)}
      {buildArc(120, 212, '#1DB8A0', ringR, r)}
      <Circle cx={r} cy={r} r={ringR + 14} fill="none" stroke="#2E7DBC" strokeWidth={0.8} strokeOpacity={0.4} />
      <Circle cx={r} cy={r} r={ringR - 14} fill="none" stroke="#2E7DBC" strokeWidth={0.8} strokeOpacity={0.4} />
      {monthElements.map((m, i) => (
        <React.Fragment key={i}>
          <Line x1={m.inner.x} y1={m.inner.y} x2={m.outer.x} y2={m.outer.y}
            stroke="#2E7DBC" strokeWidth={0.5} strokeOpacity={0.5} />
          <SvgText x={m.pos.x} y={m.pos.y} fontSize={8} fontWeight="600" fill="#8AAFC4"
            textAnchor="middle" alignmentBaseline="middle"
            rotation={m.angle + 90} originX={m.pos.x} originY={m.pos.y}>
            {m.name}
          </SvgText>
        </React.Fragment>
      ))}
      <Circle cx={r} cy={r} r={r - 56} fill="#0F1923" stroke="#2E7DBC" strokeWidth={1.2} />
      <Circle cx={boundaryDot.x} cy={boundaryDot.y} r={6} fill="#2E9BFF" stroke="#FFFFFF" strokeWidth={1.2} strokeOpacity={0.5} />
      <Circle cx={startDot.x} cy={startDot.y} r={7} fill="#2E9BFF" stroke="#FFFFFF" strokeWidth={1.5} strokeOpacity={0.5} />
      <Circle cx={endDot.x} cy={endDot.y} r={9} fill="#F0A500" fillOpacity={0.9} stroke="#FFFFFF" strokeWidth={1.5} strokeOpacity={0.5} />
      <SvgText x={r} y={r - 6} fontSize={22} fontWeight="700" fill="#FFFFFF" textAnchor="middle">30</SvgText>
      <SvgText x={r} y={r + 12} fontSize={8} fontWeight="600" fill="#2E9BFF" textAnchor="middle" letterSpacing={1}>DAYS</SvgText>
    </Svg>
  );
}

// ─── Gantt illustration ───────────────────────────────────────────────────────
function GanttIllustration() {
  const bars = [
    { label: 'Design',  x: 0,    w: 0.35, color: '#2E9BFF' },
    { label: 'Build',   x: 0.30, w: 0.45, color: '#1DB8A0' },
    { label: 'Testing', x: 0.70, w: 0.28, color: '#8B5CF6' },
  ];
  const W = 220, H = 90, LEFT = 54, BAR_H = 14, ROW = 26;
  const todayX = LEFT + 0.46 * (W - LEFT - 8);
  return (
    <Svg width={W} height={H}>
      <Rect x={0} y={0} width={W} height={H} fill="#1C2B38" rx={10} />
      {bars.map((bar, i) => {
        const y = 14 + i * ROW;
        const bx = LEFT + bar.x * (W - LEFT - 8);
        const bw = bar.w * (W - LEFT - 8);
        return (
          <React.Fragment key={i}>
            <SvgText x={6} y={y + BAR_H / 2 + 4} fontSize={9} fill="#8AAFC4" fontWeight="500">{bar.label}</SvgText>
            <Rect x={LEFT} y={y} width={W - LEFT - 8} height={BAR_H} fill="#0F1923" rx={4} />
            <Rect x={bx} y={y} width={bw} height={BAR_H} fill={bar.color} fillOpacity={0.8} rx={4} />
          </React.Fragment>
        );
      })}
      {/* Today line */}
      <Line x1={todayX} y1={6} x2={todayX} y2={H - 6} stroke="#F0A500" strokeWidth={1.5} strokeDasharray="3,2" />
      <SvgText x={todayX} y={H - 1} fontSize={7} fill="#F0A500" textAnchor="middle" fontWeight="600">TODAY</SvgText>
    </Svg>
  );
}

// ─── Calendar grid illustration ───────────────────────────────────────────────
function CalendarIllustration() {
  const days = [
    // week 1
    { t: 0 }, { t: 0 }, { t: 1 }, { t: 1 }, { t: 1 }, { t: 0 }, { t: 0 },
    // week 2
    { t: 1 }, { t: 1 }, { t: 1 }, { t: 1 }, { t: 1 }, { t: 0 }, { t: 0 },
    // week 3
    { t: 2 }, { t: 2 }, { t: 2 }, { t: 2 }, { t: 2 }, { t: 0 }, { t: 0 },
    // week 4
    { t: 2 }, { t: 2 }, { t: 'M' }, { t: 3 }, { t: 3 }, { t: 0 }, { t: 0 },
    // week 5
    { t: 3 }, { t: 3 }, { t: 3 }, { t: 3 }, { t: 3 }, { t: 0 }, { t: 0 },
  ];
  const colors: Record<number | string, string> = {
    0: '#1C2B38', 1: '#2E9BFF', 2: '#1DB8A0', 3: '#8B5CF6', M: '#F0A500',
  };
  const CW = 200, COLS = 7, ROWS = 5, PAD = 2;
  const cellW = (CW - PAD * (COLS - 1)) / COLS;
  const cellH = 18;
  const dayLabels = ['S','M','T','W','T','F','S'];

  return (
    <Svg width={CW} height={ROWS * (cellH + PAD) + 22}>
      {/* Day headers */}
      {dayLabels.map((lbl, i) => (
        <SvgText key={i} x={i * (cellW + PAD) + cellW / 2} y={12}
          fontSize={8} fill="#5A7A96" textAnchor="middle" fontWeight="600">{lbl}</SvgText>
      ))}
      {/* Day cells */}
      {days.map((d, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * (cellW + PAD);
        const y = 18 + row * (cellH + PAD);
        const fill = colors[d.t as any] ?? '#1C2B38';
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={cellW} height={cellH} rx={3} fill={fill} fillOpacity={d.t === 0 ? 1 : 0.6} />
            {d.t === 'M' && (
              <SvgText x={x + cellW / 2} y={y + cellH / 2 + 3} fontSize={9} fill="#F0A500" textAnchor="middle">◆</SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Lead / Lag illustration ──────────────────────────────────────────────────
function LeadLagIllustration() {
  const W = 260, H = 100;
  const barH = 20, y1 = 14, y2 = 46, y3 = 78;
  return (
    <Svg width={W} height={H}>
      {/* OVERLAP row */}
      <SvgText x={0} y={y1 + barH / 2 + 4} fontSize={8} fill="#5A7A96" fontWeight="600">LEAD</SvgText>
      <Rect x={30} y={y1} width={110} height={barH} fill="#2E9BFF" fillOpacity={0.7} rx={4} />
      <SvgText x={85} y={y1 + barH / 2 + 4} fontSize={8} fill="#FFF" fontWeight="600" textAnchor="middle">Design</SvgText>
      {/* overlap zone */}
      <Rect x={118} y={y1} width={22} height={barH} fill="#EF4444" fillOpacity={0.4} />
      <Rect x={118} y={y1} width={88} height={barH} fill="#1DB8A0" fillOpacity={0.7} rx={4} />
      <SvgText x={162} y={y1 + barH / 2 + 4} fontSize={8} fill="#FFF" fontWeight="600" textAnchor="middle">Build</SvgText>
      <SvgText x={129} y={y1 - 3} fontSize={7} fill="#EF4444" textAnchor="middle">−3d</SvgText>

      {/* Divider */}
      <Line x1={0} y1={y2 - 4} x2={W} y2={y2 - 4} stroke="#2A3F52" strokeWidth={0.5} />

      {/* GAP row */}
      <SvgText x={0} y={y2 + barH / 2 + 4} fontSize={8} fill="#5A7A96" fontWeight="600">LAG</SvgText>
      <Rect x={30} y={y2} width={100} height={barH} fill="#2E9BFF" fillOpacity={0.7} rx={4} />
      <SvgText x={80} y={y2 + barH / 2 + 4} fontSize={8} fill="#FFF" fontWeight="600" textAnchor="middle">Design</SvgText>
      {/* gap zone */}
      <Rect x={130} y={y2} width={20} height={barH} fill="#F97316" fillOpacity={0.15} />
      <Line x1={130} y1={y2} x2={130} y2={y2 + barH} stroke="#F97316" strokeWidth={1} strokeDasharray="3,2" />
      <Line x1={150} y1={y2} x2={150} y2={y2 + barH} stroke="#F97316" strokeWidth={1} strokeDasharray="3,2" />
      <SvgText x={140} y={y2 - 3} fontSize={7} fill="#F97316" textAnchor="middle">+3d</SvgText>
      <Rect x={150} y={y2} width={100} height={barH} fill="#1DB8A0" fillOpacity={0.7} rx={4} />
      <SvgText x={200} y={y2 + barH / 2 + 4} fontSize={8} fill="#FFF" fontWeight="600" textAnchor="middle">Build</SvgText>
    </Svg>
  );
}

// ─── Lock illustration ────────────────────────────────────────────────────────
function LockIllustration() {
  return (
    <View style={lockStyles.container}>
      <View style={lockStyles.badge}>
        <Text style={lockStyles.icon}>🔒</Text>
        <Text style={lockStyles.label}>TIMELINE LOCKED</Text>
      </View>
      <View style={lockStyles.arrow}>
        <Text style={lockStyles.arrowText}>← Drag anywhere to shift →</Text>
      </View>
    </View>
  );
}
const lockStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A1500', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#F0A500',
  },
  icon: { fontSize: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#F0A500', letterSpacing: 1.5 },
  arrow: { backgroundColor: '#1C2B38', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  arrowText: { fontSize: 12, color: '#8AAFC4' },
});

// ─── Milestone illustration ───────────────────────────────────────────────────
function MilestoneIllustration() {
  const size = 100, r = size / 2, ringR = r - 10;
  const diamonds = [
    { day: 90, color: '#F0A500' },
    { day: 180, color: '#EC4899' },
    { day: 270, color: '#84CC16' },
  ];
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={ringR} fill="none" stroke="#1C2B38" strokeWidth={20} />
      <Circle cx={r} cy={r} r={ringR + 10} fill="none" stroke="#2E7DBC" strokeWidth={0.8} strokeOpacity={0.3} />
      <Circle cx={r} cy={r} r={ringR - 10} fill="none" stroke="#2E7DBC" strokeWidth={0.8} strokeOpacity={0.3} />
      {diamonds.map((d, i) => {
        const pos = angleToXY(dayToAngle(d.day), ringR - 14, r, r);
        const s = 5;
        return (
          <React.Fragment key={i}>
            <Circle cx={pos.x} cy={pos.y} r={9} fill={d.color} fillOpacity={0.2} />
            <Path d={`M ${pos.x} ${pos.y - s} L ${pos.x + s} ${pos.y} L ${pos.x} ${pos.y + s} L ${pos.x - s} ${pos.y} Z`}
              fill={d.color} stroke="#FFFFFF" strokeWidth={0.8} strokeOpacity={0.9} />
          </React.Fragment>
        );
      })}
      <Circle cx={r} cy={r} r={r - 32} fill="#0F1923" stroke="#2E7DBC" strokeWidth={1} />
      <SvgText x={r} y={r + 4} fontSize={16} fill="#F0A500" textAnchor="middle">◆</SvgText>
    </Svg>
  );
}

// ─── Reminder illustration ────────────────────────────────────────────────────
function ReminderIllustration() {
  const pills = ['1 day', '3 days', '7 days', '14 days'];
  return (
    <View style={remStyles.container}>
      <View style={remStyles.bell}>
        <Text style={remStyles.bellIcon}>🔔</Text>
        <Text style={remStyles.bellLabel}>Reminder set</Text>
      </View>
      <Text style={remStyles.sub}>Notify me before end date</Text>
      <View style={remStyles.pills}>
        {pills.map((p, i) => (
          <View key={i} style={[remStyles.pill, i === 1 && remStyles.pillActive]}>
            <Text style={[remStyles.pillText, i === 1 && remStyles.pillTextActive]}>{p}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const remStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  bell: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1C2B38', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
    borderWidth: 1, borderColor: '#2E7DBC',
  },
  bellIcon: { fontSize: 22 },
  bellLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  sub: { fontSize: 12, color: '#5A7A96' },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    backgroundColor: '#1C2B38', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2A3F52',
  },
  pillActive: { backgroundColor: 'rgba(46,155,255,0.12)', borderColor: '#2E9BFF' },
  pillText: { fontSize: 12, color: '#5A7A96', fontWeight: '500' },
  pillTextActive: { color: '#2E9BFF', fontWeight: '700' },
});

// ─── Export illustration ──────────────────────────────────────────────────────
function SaveIllustration() {
  const icons = [
    { icon: '📂', label: 'Projects', color: '#2E9BFF' },
    { icon: '📋', label: 'Templates', color: '#1DB8A0' },
    { icon: '📊', label: 'CSV', color: '#84CC16' },
    { icon: '🖨️', label: 'PDF', color: '#EC4899' },
    { icon: '📅', label: 'iCal', color: '#F0A500' },
    { icon: '{}', label: 'JSON', color: '#8B5CF6' },
  ];
  return (
    <View style={saveStyles.grid}>
      {icons.map((item, i) => (
        <View key={i} style={saveStyles.item}>
          <Text style={[saveStyles.icon, { color: item.color }]}>{item.icon}</Text>
          <Text style={saveStyles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
const saveStyles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 },
  item: {
    width: 76, alignItems: 'center', gap: 6,
    backgroundColor: '#1C2B38', borderRadius: 12, paddingVertical: 14,
    borderWidth: 0.5, borderColor: '#2A3F52',
  },
  icon: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 10, color: '#8AAFC4', fontWeight: '600', letterSpacing: 0.5 },
});

// ─── No Weekend illustration ──────────────────────────────────────────────────
function WeekendIllustration() {
  const days = ['M','T','W','T','F','S','S'];
  const shifted = ['M','T','W','T','F','→Mon'];
  return (
    <View style={wkStyles.container}>
      <View style={wkStyles.row}>
        {days.map((d, i) => (
          <View key={i} style={[wkStyles.cell, (i === 5 || i === 6) && wkStyles.weekend]}>
            <Text style={[wkStyles.cellText, (i === 5 || i === 6) && wkStyles.weekendText]}>{d}</Text>
          </View>
        ))}
      </View>
      <Text style={wkStyles.arrow}>↓ Task ends Friday or later</Text>
      <View style={wkStyles.badge}>
        <Text style={wkStyles.badgeText}>🗓️  End date moved to Monday</Text>
      </View>
    </View>
  );
}
const wkStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#1C2B38',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#2A3F52',
  },
  weekend: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' },
  cellText: { fontSize: 11, color: '#8AAFC4', fontWeight: '600' },
  weekendText: { color: '#EF4444' },
  arrow: { fontSize: 12, color: '#5A7A96' },
  badge: {
    backgroundColor: 'rgba(46,155,255,0.1)', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#2E7DBC',
  },
  badgeText: { fontSize: 13, color: '#2E9BFF', fontWeight: '600' },
});

// ─── Slide data ───────────────────────────────────────────────────────────────
interface Slide {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  illustration: React.ReactNode;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    title: 'Welcome to\nDate Wheel',
    subtitle: 'Visual project planning',
    body: 'Plan your projects on a circular year calendar. See durations, deadlines, and task sequences at a glance — all on one elegant ring.',
    illustration: <WheelIllustration />,
    accent: '#2E9BFF',
  },
  {
    key: 'wheel',
    title: 'Drag to\nSet Dates',
    subtitle: 'Start · End · Boundaries',
    body: 'Drag the blue dot to set your project start date. Drag the orange dot to change the end. Between tasks, drag the boundary dot to resize either side.',
    illustration: <WheelIllustration />,
    accent: '#F0A500',
  },
  {
    key: 'tasks',
    title: 'Build Your\nTimeline',
    subtitle: 'Sequential task planning',
    body: 'Tap "+ Task" to lock in the current range and start planning the next phase. Each task gets its own color. Switch to Gantt view for a traditional bar chart.',
    illustration: (
      <View style={{ alignItems: 'center', gap: 10 }}>
        <WheelIllustration />
        <GanttIllustration />
      </View>
    ),
    accent: '#1DB8A0',
  },
  {
    key: 'leadlag',
    title: 'Lead &\nLag',
    subtitle: 'Overlaps and gaps',
    body: 'Tasks don\'t have to be flush. Set a Lead so the next task starts before the previous ends — or a Lag to add a buffer between them. Tap any boundary dot to edit.',
    illustration: <LeadLagIllustration />,
    accent: '#EF4444',
  },
  {
    key: 'milestones',
    title: 'Mark\nMilestones',
    subtitle: 'Key dates as diamonds',
    body: 'Tap "+ Milestone" to drop a diamond marker on any important date — launches, reviews, sign-offs. Milestones appear across all three views.',
    illustration: (
      <View style={{ alignItems: 'center', gap: 16 }}>
        <MilestoneIllustration />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C2B38', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <View style={{ width: 10, height: 10, backgroundColor: '#F0A500', transform: [{ rotate: '45deg' }] }} />
          <Text style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '500' }}>Launch Day · Mar 31</Text>
        </View>
      </View>
    ),
    accent: '#F0A500',
  },
  {
    key: 'calendar',
    title: 'Calendar &\nGantt Views',
    subtitle: 'Three ways to see your plan',
    body: 'Switch to the Calendar view for a month-by-month grid, or the Gantt chart for a horizontal bar timeline. Pinch to zoom and pan freely in both views.',
    illustration: (
      <View style={{ alignItems: 'center', gap: 12 }}>
        <CalendarIllustration />
      </View>
    ),
    accent: '#8B5CF6',
  },
  {
    key: 'reminders',
    title: 'Smart\nReminders',
    subtitle: 'Never miss a deadline',
    body: 'Tap the bell icon on any task or milestone to schedule a notification: 1, 3, 7, or 14 days before the date. Set it and forget it.',
    illustration: <ReminderIllustration />,
    accent: '#2E9BFF',
  },
  {
    key: 'weekends',
    title: 'No Weekend\nEnd Dates',
    subtitle: 'Business-ready scheduling',
    body: 'Turn on "No Weekend End Dates" in Settings and any task end that lands on a Saturday or Sunday automatically shifts to the following Monday.',
    illustration: <WeekendIllustration />,
    accent: '#1DB8A0',
  },
  {
    key: 'lock',
    title: 'Lock &\nShift All',
    subtitle: 'Move the whole project',
    body: 'Toggle the lock icon (top-left) to freeze the timeline. Then drag anywhere on the wheel to slide every task forward or backward — relative durations stay intact.',
    illustration: <LockIllustration />,
    accent: '#F0A500',
  },
  {
    key: 'save',
    title: 'Save &\nExport',
    subtitle: 'Projects · Templates · Export',
    body: 'Save your work as a named project or a reusable template. Export to CSV, PDF, XLSX, iCal, or JSON to share with your team — all from the Save As menu.',
    illustration: <SaveIllustration />,
    accent: '#84CC16',
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onDone: () => void;
}

export default function OnboardingModal({ visible, onDone }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  function goTo(index: number) {
    listRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }

  function goNext() {
    if (activeIndex < SLIDES.length - 1) {
      goTo(activeIndex + 1);
    } else {
      handleDone();
    }
  }

  function handleDone() {
    setActiveIndex(0);
    onDone();
  }

  const isLast = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleDone}
    >
      <View style={styles.root}>

        {/* Header row: slide counter + exit button */}
        <View style={styles.header}>
          <Text style={styles.slideCounter}>
            {activeIndex + 1} / {SLIDES.length}
          </Text>
          <TouchableOpacity style={styles.exitBtn} onPress={handleDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.exitText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Slides */}
        <FlatList
          ref={listRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          keyExtractor={(item) => item.key}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setActiveIndex(index);
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.illustrationArea}>
                {item.illustration}
              </View>
              <View style={styles.textArea}>
                <View style={[styles.accentLine, { backgroundColor: item.accent }]} />
                <Text style={styles.subtitle}>{item.subtitle.toUpperCase()}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>
          )}
        />

        {/* Dot indicators — tappable */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <View
                style={[
                  styles.dot,
                  i === activeIndex && { backgroundColor: currentSlide.accent, width: 20 },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={[styles.nextBtn, { borderColor: currentSlide.accent }]}
          onPress={goNext}
        >
          <Text style={[styles.nextBtnText, { color: currentSlide.accent }]}>
            {isLast ? "Let's Go  🚀" : 'Next  →'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1923',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  slideCounter: {
    fontSize: 12,
    color: '#2A3F52',
    fontWeight: '600',
    letterSpacing: 1,
  },
  exitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C2B38',
    borderWidth: 1,
    borderColor: '#2A3F52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitText: {
    fontSize: 14,
    color: '#5A7A96',
    fontWeight: '600',
    lineHeight: 16,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 28,
  },
  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  textArea: {
    width: '100%',
    paddingBottom: 16,
    paddingTop: 16,
  },
  accentLine: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    color: '#8AAFC4',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2A3F52',
  },
  nextBtn: {
    width: SCREEN_WIDTH - 48,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomSpacer: {
    height: 40,
  },
});
