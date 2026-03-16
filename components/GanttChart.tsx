import React from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Task } from './datewheel';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ROW_HEIGHT = 56;
const LABEL_WIDTH = 120;
const BAR_AREA = SCREEN_WIDTH * 2.5;
const MIN_BAR_WIDTH = 24;

function formatShort(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  currentTaskName: string;
  startDate: Date;
  endDate: Date;
  duration: string;
  unit: string;
  currentTaskColor: string;
}

export default function GanttChart({
  visible,
  onClose,
  tasks,
  currentTaskName,
  startDate,
  endDate,
  duration,
  unit,
  currentTaskColor,
}: Props) {

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
    },
  ];

  if (allTasks.length === 0) return null;

  const projectStart = new Date(allTasks[0].startDate);
  const projectEnd = new Date(allTasks[allTasks.length - 1].endDate);
  const totalMs = projectEnd.getTime() - projectStart.getTime();
  const today = new Date();

  function getMonthLabels() {
    const labels: { label: string; x: number }[] = [];
    const current = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    while (current <= projectEnd) {
      const ms = current.getTime() - projectStart.getTime();
      const x = Math.max((ms / totalMs) * BAR_AREA, 0);
      labels.push({
        label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        x,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return labels;
  }

  const monthLabels = getMonthLabels();

  const todayX = today >= projectStart && today <= projectEnd
    ? ((today.getTime() - projectStart.getTime()) / totalMs) * BAR_AREA
    : -1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GANTT CHART</Text>
          <Text style={styles.headerSub}>
            {formatDateFull(projectStart)} → {formatDateFull(projectEnd)}
          </Text>
        </View>

        {/* Gantt body — horizontal scroll wraps everything */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={styles.horizontalScroll}
          contentContainerStyle={{ minWidth: LABEL_WIDTH + BAR_AREA }}
        >
          <View>

            {/* Month header row */}
            <View style={styles.monthHeaderRow}>
              <View style={styles.labelHeaderCell}>
                <Text style={styles.labelHeaderText}>TASK</Text>
              </View>
              <View style={{ width: BAR_AREA, position: 'relative', height: 36 }}>
                {monthLabels.map((m, i) => (
                  <React.Fragment key={i}>
                    <Text style={[styles.monthLabel, { left: m.x + 4 }]}>
                      {m.label}
                    </Text>
                    <View style={[styles.monthDivider, { left: m.x }]} />
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Task rows */}
            <ScrollView
              horizontal={false}
              showsVerticalScrollIndicator={false}
            >
              {allTasks.map((task, i) => {
                const taskStart = new Date(task.startDate);
                const taskEnd = new Date(task.endDate);
                const startMs = taskStart.getTime() - projectStart.getTime();
                const durationMs = taskEnd.getTime() - taskStart.getTime();
                const barX = Math.max((startMs / totalMs) * BAR_AREA, 0);
                const barW = Math.max((durationMs / totalMs) * BAR_AREA, MIN_BAR_WIDTH);
                const isActive = task.id === -1;

                return (
                  <View
                    key={task.id}
                    style={[styles.row, i % 2 === 0 && styles.rowAlt]}
                  >
                    {/* Label */}
                    <View style={styles.labelCell}>
                      <View style={[styles.taskColorDot, { backgroundColor: task.color }]} />
                      <View style={styles.labelText}>
                        <Text style={styles.taskLabel} numberOfLines={1}>
                          {task.name}
                          {isActive ? ' ●' : ''}
                        </Text>
                        <Text style={styles.taskDates}>
                          {formatShort(taskStart)} → {formatShort(taskEnd)}
                        </Text>
                      </View>
                    </View>

                    {/* Bar area */}
                    <View style={[styles.barCell, { width: BAR_AREA }]}>

                      {/* Grid lines */}
                      {monthLabels.map((m, mi) => (
                        <View key={`grid-${mi}`} style={[styles.gridLine, { left: m.x }]} />
                      ))}

                      {/* Today line */}
                      {todayX > 0 && (
                        <View style={[styles.todayLine, { left: todayX }]} />
                      )}

                      {/* Task bar */}
                      <View
                        style={[
                          styles.bar,
                          {
                            left: barX,
                            width: barW,
                            backgroundColor: task.color,
                            opacity: isActive ? 1 : 0.8,
                            borderWidth: isActive ? 1.5 : 0,
                            borderColor: '#FFFFFF',
                          },
                        ]}
                      >
                        {barW > 50 && (
                          <Text style={styles.barLabel} numberOfLines={1}>
                            {task.duration} {task.unit}
                          </Text>
                        )}
                      </View>

                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Today label row */}
            {todayX > 0 && (
              <View style={{ height: 24, width: LABEL_WIDTH + BAR_AREA, position: 'relative' }}>
                <View style={[styles.todayLabelContainer, { left: LABEL_WIDTH + todayX - 16 }]}>
                  <Text style={styles.todayLabelText}>TODAY</Text>
                </View>
              </View>
            )}

          </View>
        </ScrollView>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendTodayLine} />
            <Text style={styles.legendText}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFFFFF', opacity: 0.6 }]} />
            <Text style={styles.legendText}>Active task</Text>
          </View>
          <Text style={styles.legendHint}>Scroll to explore →</Text>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1923',
  },
  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
    backgroundColor: '#0F1923',
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: '#2E9BFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#5A7A96',
  },
  horizontalScroll: {
    flex: 1,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3F52',
    backgroundColor: '#1C2B38',
    height: 36,
  },
  labelHeaderCell: {
    width: LABEL_WIDTH,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRightWidth: 0.5,
    borderRightColor: '#2A3F52',
  },
  labelHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 1.5,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 11,
    color: '#5A7A96',
    fontWeight: '500',
    top: 8,
  },
  monthDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: '#2A3F52',
  },
  row: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C2B38',
  },
  rowAlt: {
    backgroundColor: '#0D1820',
  },
  labelCell: {
    width: LABEL_WIDTH,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: ROW_HEIGHT,
    borderRightWidth: 0.5,
    borderRightColor: '#2A3F52',
  },
  taskColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  labelText: {
    flex: 1,
  },
  taskLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  taskDates: {
    fontSize: 9,
    color: '#5A7A96',
  },
  barCell: {
    height: ROW_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  todayLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#F0A500',
    zIndex: 10,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: '#1C2B38',
  },
  bar: {
    position: 'absolute',
    top: 10,
    height: ROW_HEIGHT - 20,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  barLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todayLabelContainer: {
    position: 'absolute',
    top: 4,
  },
  todayLabelText: {
    fontSize: 9,
    color: '#F0A500',
    fontWeight: '600',
    letterSpacing: 1,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#2A3F52',
    backgroundColor: '#0F1923',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendTodayLine: {
    width: 16,
    height: 2,
    backgroundColor: '#F0A500',
    borderRadius: 1,
    marginRight: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#5A7A96',
  },
  legendHint: {
    fontSize: 11,
    color: '#2A3F52',
  },
});