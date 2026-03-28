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

// ─── Mini wheel illustration ────────────────────────────────────────────────
function WheelIllustration() {
  const size = 180;
  const r = size / 2;
  const ringR = r - 16;

  function dayToAngle(day: number) {
    return (day / 365) * 360 - 90;
  }
  function angleToXY(deg: number, radius: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: r + radius * Math.cos(rad), y: r + radius * Math.sin(rad) };
  }
  function buildArc(startDay: number, endDay: number, color: string, opacity = 0.75) {
    const span = endDay - startDay;
    if (span <= 0) return null;
    const sa = dayToAngle(startDay);
    const ea = dayToAngle(endDay);
    const s = angleToXY(sa, ringR);
    const e = angleToXY(ea, ringR);
    const large = (span / 365) * 360 > 180 ? 1 : 0;
    const d = `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${ringR} ${ringR} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
    return <Path key={color} d={d} fill="none" stroke={color} strokeWidth={28} strokeOpacity={opacity} />;
  }

  const months = [31,28,31,30,31,30,31,31,30,31,30,31];
  const monthNames = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  let dayStart = 0;
  const monthElements = months.map((days, i) => {
    const midDay = dayStart + days / 2;
    const angle = dayToAngle(midDay);
    const pos = angleToXY(angle, ringR - 26);
    const divAngle = dayToAngle(dayStart);
    const inner = angleToXY(divAngle, ringR - 13);
    const outer = angleToXY(divAngle, ringR + 13);
    dayStart += days;
    return { midDay, angle, pos, inner, outer, name: monthNames[i] };
  });

  const startDot = angleToXY(dayToAngle(32), ringR); // Feb 1
  const endDot = angleToXY(dayToAngle(212), ringR);  // Jul 31

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle cx={r} cy={r} r={ringR} fill="none" stroke="#1C2B38" strokeWidth={28} />

      {/* Task arc: Feb–Apr */}
      {buildArc(32, 120, '#2E9BFF', 0.7)}
      {/* Task arc: Apr–Jul */}
      {buildArc(120, 212, '#1DB8A0', 0.7)}

      {/* Ring borders */}
      <Circle cx={r} cy={r} r={ringR + 14} fill="none" stroke="#2E7DBC" strokeWidth={0.8} strokeOpacity={0.4} />
      <Circle cx={r} cy={r} r={ringR - 14} fill="none" stroke="#2E7DBC" strokeWidth={0.8} strokeOpacity={0.4} />

      {/* Month dividers & labels */}
      {monthElements.map((m, i) => (
        <React.Fragment key={i}>
          <Line x1={m.inner.x} y1={m.inner.y} x2={m.outer.x} y2={m.outer.y}
            stroke="#2E7DBC" strokeWidth={0.5} strokeOpacity={0.5} />
          <SvgText
            x={m.pos.x} y={m.pos.y}
            fontSize={8} fontWeight="600" fill="#8AAFC4"
            textAnchor="middle" alignmentBaseline="middle"
            rotation={m.angle + 90} originX={m.pos.x} originY={m.pos.y}
          >
            {m.name}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Center hub */}
      <Circle cx={r} cy={r} r={r - 56} fill="#0F1923" stroke="#2E7DBC" strokeWidth={1.2} />

      {/* Boundary dot */}
      <Circle cx={angleToXY(dayToAngle(120), ringR).x} cy={angleToXY(dayToAngle(120), ringR).y}
        r={6} fill="#2E9BFF" stroke="#FFFFFF" strokeWidth={1.2} strokeOpacity={0.5} />

      {/* Start dot */}
      <Circle cx={startDot.x} cy={startDot.y} r={7} fill="#2E9BFF" stroke="#FFFFFF" strokeWidth={1.5} strokeOpacity={0.5} />

      {/* End dot */}
      <Circle cx={endDot.x} cy={endDot.y} r={9} fill="#F0A500" fillOpacity={0.9} stroke="#FFFFFF" strokeWidth={1.5} strokeOpacity={0.5} />

      {/* Center text */}
      <SvgText x={r} y={r - 6} fontSize={22} fontWeight="700" fill="#FFFFFF" textAnchor="middle">30</SvgText>
      <SvgText x={r} y={r + 12} fontSize={8} fontWeight="600" fill="#2E9BFF" textAnchor="middle" letterSpacing={1}>DAYS</SvgText>
    </Svg>
  );
}

// ─── Mini Gantt illustration ─────────────────────────────────────────────────
function GanttIllustration() {
  const bars = [
    { label: 'Design',   x: 0,   w: 0.35, color: '#2E9BFF' },
    { label: 'Build',    x: 0.3, w: 0.45, color: '#1DB8A0' },
    { label: 'Testing',  x: 0.7, w: 0.3,  color: '#8B5CF6' },
  ];
  const W = 220, H = 90;
  const LEFT = 54, BAR_H = 14, ROW = 26;

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
  arrow: {
    backgroundColor: '#1C2B38', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
  },
  arrowText: { fontSize: 12, color: '#8AAFC4' },
});

// ─── Milestone illustration ───────────────────────────────────────────────────
function MilestoneIllustration() {
  const size = 100;
  const r = size / 2;
  const ringR = r - 10;

  function dayToAngle(day: number) { return (day / 365) * 360 - 90; }
  function angleToXY(deg: number, radius: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: r + radius * Math.cos(rad), y: r + radius * Math.sin(rad) };
  }

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
        const pos = angleToXY(dayToAngle(d.day), ringR - 14);
        const s = 5;
        return (
          <React.Fragment key={i}>
            <Circle cx={pos.x} cy={pos.y} r={9} fill={d.color} fillOpacity={0.2} />
            <Path
              d={`M ${pos.x} ${pos.y - s} L ${pos.x + s} ${pos.y} L ${pos.x} ${pos.y + s} L ${pos.x - s} ${pos.y} Z`}
              fill={d.color} stroke="#FFFFFF" strokeWidth={0.8} strokeOpacity={0.9}
            />
          </React.Fragment>
        );
      })}
      <Circle cx={r} cy={r} r={r - 32} fill="#0F1923" stroke="#2E7DBC" strokeWidth={1} />
      <SvgText x={r} y={r + 4} fontSize={16} fill="#F0A500" textAnchor="middle">◆</SvgText>
    </Svg>
  );
}

// ─── Save/Export illustration ─────────────────────────────────────────────────
function SaveIllustration() {
  const icons = [
    { icon: '📂', label: 'Projects' },
    { icon: '📋', label: 'Templates' },
    { icon: '📊', label: 'CSV' },
    { icon: '🖨️', label: 'PDF' },
  ];
  return (
    <View style={saveStyles.grid}>
      {icons.map((item, i) => (
        <View key={i} style={saveStyles.item}>
          <Text style={saveStyles.icon}>{item.icon}</Text>
          <Text style={saveStyles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const saveStyles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  item: {
    width: 72, alignItems: 'center', gap: 6,
    backgroundColor: '#1C2B38', borderRadius: 12, paddingVertical: 14,
    borderWidth: 0.5, borderColor: '#2A3F52',
  },
  icon: { fontSize: 24 },
  label: { fontSize: 10, color: '#8AAFC4', fontWeight: '600', letterSpacing: 0.5 },
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
    body: 'Plan your projects on a circular year calendar. See durations, deadlines, and task sequences at a glance.',
    illustration: <WheelIllustration />,
    accent: '#2E9BFF',
  },
  {
    key: 'wheel',
    title: 'Drag to\nSet Dates',
    subtitle: 'Start · End · Boundaries',
    body: 'Drag the blue dot to move the start date. Drag the orange dot to change the end. Between tasks, drag the boundary dot to resize.',
    illustration: <WheelIllustration />,
    accent: '#F0A500',
  },
  {
    key: 'tasks',
    title: 'Build Your\nTimeline',
    subtitle: 'Sequential task planning',
    body: 'Tap "+ Add Task" to lock in the current range and start the next one. Each task gets its own color arc on the wheel.',
    illustration: (
      <View style={{ alignItems: 'center', gap: 10 }}>
        <WheelIllustration />
        <GanttIllustration />
      </View>
    ),
    accent: '#1DB8A0',
  },
  {
    key: 'milestones',
    title: 'Mark\nMilestones',
    subtitle: 'Key dates as diamonds',
    body: 'Tap "+ Milestone" to drop a diamond marker on the wheel for important dates like launches, reviews, or deadlines.',
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
    key: 'lock',
    title: 'Lock &\nShift All',
    subtitle: 'Move the whole project',
    body: 'Toggle the lock icon to lock the timeline. Then drag anywhere on the wheel ring to shift every task and the current range together.',
    illustration: <LockIllustration />,
    accent: '#F0A500',
  },
  {
    key: 'save',
    title: 'Save &\nShare',
    subtitle: 'Projects · Templates · Export',
    body: 'Save your work as a project or reusable template. Export to CSV or PDF to share with your team.',
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

  function goNext() {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      setActiveIndex(activeIndex + 1);
    } else {
      handleDone();
    }
  }

  function handleDone() {
    setActiveIndex(0);
    onDone();
  }

  function handleSkip() {
    handleDone();
  }

  const isLast = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleSkip}
    >
      <View style={styles.root}>

        {/* Skip button */}
        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

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
              {/* Illustration area */}
              <View style={styles.illustrationArea}>
                {item.illustration}
              </View>

              {/* Text area */}
              <View style={styles.textArea}>
                <View style={[styles.accentLine, { backgroundColor: item.accent }]} />
                <Text style={styles.subtitle}>{item.subtitle.toUpperCase()}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>
          )}
        />

        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && { backgroundColor: currentSlide.accent, width: 20 },
              ]}
            />
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
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#5A7A96',
    fontWeight: '500',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 28,
  },
  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
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
