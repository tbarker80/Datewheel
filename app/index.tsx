import CalendarView from "@/components/CalendarView";
import DateWheel, { Milestone, Task, TASK_COLORS } from "@/components/datewheel";
import GanttChart from "@/components/GanttChart";
import { businessDaysWithHolidays, countHolidaysInRange, isHoliday } from "@/components/holidays";
import LagEditModal from '@/components/LagEditModal';
import MilestoneModal from "@/components/MilestoneModal";
import {
  cancelReminder,
  requestNotificationPermissions,
  scheduleReminder
} from '@/components/notifications';
import OnboardingModal from '@/components/OnboardingModal';
import { useProStatus } from "@/components/ProContext";
import ProModal from "@/components/ProModal";
import ReminderModal from "@/components/ReminderModal";
import SettingsModal, { AppSettings } from "@/components/SettingsModal";
import TaskEditModal, { TaskEditValues } from "@/components/TaskEditModal";
import TaskNameModal from "@/components/TaskNameModal";
import TemplatesModal, { Project, saveTemplate, Template } from "@/components/TemplatesModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from 'expo-file-system';
import * as Haptics from "expo-haptics";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as StoreReview from 'expo-store-review';
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath } from 'react-native-svg';
import * as XLSX from 'xlsx';
import { registerDatewheelHandler } from './_layout';

function daysBetween(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function weeksBetween(start: Date, end: Date) {
  const weeks = daysBetween(start, end) / 7;
  if (weeks % 1 === 0) return String(Math.round(weeks));
  const rounded = Math.round(weeks * 2) / 2;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

function monthsBetween(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function shiftByUnit(date: Date, direction: 1 | -1, unit: string, country: string): Date {
  const d = new Date(date);
  switch (unit) {
    case 'Weeks':
      d.setDate(d.getDate() + direction * 7);
      break;
    case 'Months':
      d.setMonth(d.getMonth() + direction);
      break;
    case 'Business Days': {
      let count = 0;
      while (count < 1) {
        d.setDate(d.getDate() + direction);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6 && !isHoliday(d, country)) count++;
      }
      break;
    }
    default: // Days
      d.setDate(d.getDate() + direction);
  }
  return d;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getDayName(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

const UNITS = ["Days", "Weeks", "Months", "Business Days"];

const MILESTONE_COLORS = ['#F0A500', '#EC4899', '#84CC16', '#2E9BFF', '#8B5CF6'];
const MAX_UNDO_LEVELS = 25;

// Corner button geometry
const _SW   = Dimensions.get('window').width;
const _R    = Math.round(_SW * 0.9 / 2);   // wheel radius (= half container width)
const _GAP  = 10;                           // gap between wheel circle and button inner arc
const _Rarc = _R - _GAP;                    // arc radius used in paths — smaller than _R = gap
const C     = Math.round(_R * 0.44);        // button bounding square (44% of wheel radius)
const CT    = Math.round(C * 0.52);         // touch-target square
const _BTNSHIFT = Math.round(C * 0.15);    // how far inward the touch target shifts from the outer corner
const RO    = 10;                           // outer corner radius
const CR    = C - RO;
// Where the arc circle (radius _Rarc, centred at the wheel centre) intersects a button edge.
// For TL: wheel centre is at (_R,_R) in local space; right edge is x=C.
//   (C−_R)² + (y−_R)² = _Rarc²  →  y = _R − √(_Rarc²−(_R−C)²)
const _di   = Math.round(_R - Math.sqrt(_Rarc * _Rarc - (_R - C) * (_R - C)));
// Four paths — exact reflections of TL. Arc command uses _Rarc (not _R).
//   TL sweep=0, TR sweep=1, BL sweep=1, BR sweep=0  (each x-reflection flips sweep)
const PATH_TL = `M 0,${RO} Q 0,0 ${RO},0 L ${C},0 L ${C},${_di} A ${_Rarc},${_Rarc} 0 0,0 ${_di},${C} L 0,${C} Z`;
const PATH_TR = `M ${C},${RO} Q ${C},0 ${CR},0 L 0,0 L 0,${_di} A ${_Rarc},${_Rarc} 0 0,1 ${C-_di},${C} L ${C},${C} Z`;
const PATH_BL = `M 0,${CR} Q 0,${C} ${RO},${C} L ${C},${C} L ${C},${C-_di} A ${_Rarc},${_Rarc} 0 0,1 ${_di},0 L 0,0 Z`;
const PATH_BR = `M ${C},${CR} Q ${C},${C} ${CR},${C} L 0,${C} L 0,${C-_di} A ${_Rarc},${_Rarc} 0 0,0 ${C-_di},0 L ${C},0 Z`;

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  hapticsEnabled: true,
  holidayCountry: "NONE",
  noWeekendEnd: false,
};

// Advance Saturday → Monday, Sunday → Monday. Friday and earlier unchanged.
function snapToWeekday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

interface DatewheelFile {
  version: string;
  exportedAt: string;
  tasks: Task[];
  milestones: Milestone[];
  currentTaskName: string;
  unit: string;
  startDate: string;
  endDate: string;
}
interface CombinedTask {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  duration: string;
  unit: string;
  notificationId?: string;
  reminderDays?: number;
  isActive: boolean;
}

interface UndoSnapshot {
  tasks: Task[];
  milestones: Milestone[];
  startDate: string;
  endDate: string;
  currentTaskName: string;
}

function calcDuration(start: Date, end: Date, unit: string, holidayCountry: string) {
  if (end <= start) return "0";
  switch (unit) {
    case "Days": return String(daysBetween(start, end));
    case "Weeks": return String(weeksBetween(start, end));
    case "Months": return String(monthsBetween(start, end));
    case "Business Days": return String(businessDaysWithHolidays(start, end, holidayCountry));
    default: return "0";
  }
}

function calcTotalDuration(tasks: Task[], currentEnd: Date, unit: string, holidayCountry: string): string {
  if (tasks.length === 0) return "";
  const firstStart = new Date(tasks[0].startDate);
  return calcDuration(firstStart, currentEnd, unit, holidayCountry);
}

async function saveProject(
  name: string,
  tasks: Task[],
  currentTaskName: string,
  unit: string,
  startDate: Date,
  endDate: Date,
  overwriteId?: number
): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem("projects");
    const existing: Project[] = stored ? JSON.parse(stored) : [];
    const now = new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    if (overwriteId !== undefined) {
      const updated = existing.map(p =>
        p.id === overwriteId
          ? { ...p, name, tasks, currentTaskName, unit, startDate: startDate.toISOString(), endDate: endDate.toISOString(), updatedAt: now }
          : p
      );
      await AsyncStorage.setItem("projects", JSON.stringify(updated));
      return overwriteId;
    }
    const id = Date.now();
    const newProject: Project = {
      id,
      name,
      tasks,
      currentTaskName,
      unit,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: now,
      updatedAt: now,
    };
    await AsyncStorage.setItem("projects", JSON.stringify([newProject, ...existing]));
    return id;
  } catch (e) {
    console.warn('Failed to save project:', e);
    return overwriteId ?? -1;
  }
}

export default function Index() {
  const { isPro } = useProStatus();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 30);

  const [startDate, setStartDate] = useState(today);
  const [lagEditVisible, setLagEditVisible] = useState(false);
  const [lagEditTaskIndex, setLagEditTaskIndex] = useState<number>(-1);
  const [pctEditTaskId, setPctEditTaskId] = useState<number | null>(null);
  const [pctEditValue, setPctEditValue] = useState(0);
  const [taskEditId, setTaskEditId] = useState<number | null>(null);
  const [taskActionTarget, setTaskActionTarget] = useState<{ id: number; name: string; color: string; isActive: boolean } | null>(null);
  const [activeTaskPercentComplete, setActiveTaskPercentComplete] = useState(0);
  const [lagEditInitialOverride, setLagEditInitialOverride] = useState<number | undefined>(undefined);
  const [stepModes, setStepModes] = useState<Record<string, 'shift' | 'free'>>({});
  const [wheelScale, setWheelScale] = useState(1.0);
  const [endDate, setEndDate] = useState(future);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [unit, setUnit] = useState("Days");
  const [unitIndex, setUnitIndex] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingField, setPickingField] = useState("start");
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [taskNameVisible, setTaskNameVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [openVisible, setOpenVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [ganttVisible, setGanttVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const wheelFade = useRef(new Animated.Value(1)).current;
  const [proModalVisible, setProModalVisible] = useState(false);
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveAsVisible, setSaveAsVisible] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [activeLagDays, setActiveLagDays] = useState<number | undefined>(undefined);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [currentTaskName, setCurrentTaskName] = useState("Task 1");
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [durationEditVisible, setDurationEditVisible] = useState(false);
  const [durationEditValue, setDurationEditValue] = useState('');
  const [durationEditUnit, setDurationEditUnit] = useState<'Days' | 'Weeks' | 'Months'>('Days');
  const [renamingMilestone, setRenamingMilestone] = useState<Milestone | null>(null);
  const [tappedTaskId, setTappedTaskId] = useState<number | null>(null);
  const [dragDisplayDates, setDragDisplayDates] = useState<{
    start: Date;
    end: Date;
    label: string;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [milestoneDatePickerVisible, setMilestoneDatePickerVisible] = useState(false);

  const tasksRef = useRef<Task[]>([]);
  const startDateRef = useRef<Date>(today);
  const scrollViewRef = useRef<ScrollView>(null);
  const endDateRef = useRef<Date>(future);
  const taskSnapshotRef = useRef<Task[]>([]);
  const activeStartSnapshotRef = useRef<string>("");
  const activeEndSnapshotRef = useRef<string>("");
  const milestonesRef = useRef<Milestone[]>([]);
  const currentTaskNameRef = useRef<string>("Task 1");
  const savedTappedTaskIdRef = useRef<number | null>(null);
  const stepLagCallbackRef = useRef<((lagDays: number) => void) | null>(null);
  const activeTaskReminderDaysRef = useRef<number | undefined>(undefined);
  const [activeTaskReminderDays, setActiveTaskReminderDays] = useState<number | undefined>(undefined);
  type ReminderEditTarget = { kind: 'activeTask' } | { kind: 'task'; id: number } | { kind: 'milestone'; id: number };
  const [reminderEditTarget, setReminderEditTarget] = useState<ReminderEditTarget | null>(null);

  const duration = calcDuration(startDate, endDate, unit, settings.holidayCountry);
  const totalDuration = calcTotalDuration(tasks, endDate, unit, settings.holidayCountry);
  const theme = settings.darkMode ? darkTheme : lightTheme;
  const currentTaskColor = TASK_COLORS[tasks.length % TASK_COLORS.length];
  const canUndo = undoStack.length > 0;

  const timelineStart = tasks.length > 0 ? new Date(tasks[0].startDate) : startDate;
  const timelineEnd = endDate;

  const tappedTask = tappedTaskId !== null ? tasks.find(t => t.id === tappedTaskId) : null;
  const activeTaskStart = tappedTask ? new Date(tappedTask.startDate) : isDragging && dragDisplayDates ? dragDisplayDates.start : startDate;
  const activeTaskEnd = tappedTask ? new Date(tappedTask.endDate) : isDragging && dragDisplayDates ? dragDisplayDates.end : endDate;
  const activeTaskLabel = tappedTask ? tappedTask.name : isDragging && dragDisplayDates ? dragDisplayDates.label : currentTaskName;
  const highlightedTaskDuration = tappedTask
    ? calcDuration(new Date(tappedTask.startDate), new Date(tappedTask.endDate), unit, settings.holidayCountry)
    : duration;

  useEffect(() => {
    loadSettings();
    loadTasks();
    loadMilestones();
    checkOnboarding(); 
    requestNotificationPermissions();
  }, []);

  useEffect(() => {
    registerDatewheelHandler((data: string) => {
      try {
        const file: DatewheelFile = JSON.parse(data);
        Alert.alert(
          '📂 Open Project?',
          'Received a Date Wheel project. Open it now? This will replace your current work.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open',
              onPress: () => {
                saveUndoSnapshot();
                saveTasks(file.tasks || []);
                setMilestonesSync(file.milestones || []);
                setStartDateSync(new Date(file.startDate));
                setEndDateSync(new Date(file.endDate));
                setCurrentTaskName(file.currentTaskName || 'Task 1');
                currentTaskNameRef.current = file.currentTaskName || 'Task 1';
                setUnit(file.unit || 'Days');
              },
            },
          ]
        );
      } catch (e) {
        Alert.alert('Import failed', 'Could not read the Date Wheel file.');
      }
    });
  }, []);

  function saveUndoSnapshot() {
    const snapshot: UndoSnapshot = {
      tasks: tasksRef.current.map(t => ({ ...t })),
      milestones: milestonesRef.current.map(m => ({ ...m })),
      startDate: startDateRef.current.toISOString(),
      endDate: endDateRef.current.toISOString(),
      currentTaskName: currentTaskNameRef.current,
    };
    setUndoStack(prev => {
      const updated = [snapshot, ...prev];
      return updated.slice(0, MAX_UNDO_LEVELS);
    });
  }

  function detectOverlapAfterEdit(updatedTasks: Task[], taskIndex: number): {
  hasOverlap: boolean;
  isGap: boolean;
  conflictIndex: number;
  lagDays: number;
  conflictIndex2?: number;
  lagDays2?: number;
} {
  const task = updatedTasks[taskIndex];
  const taskEnd = new Date(task.endDate);
  const taskStart = new Date(task.startDate);

  let result1: { conflictIndex: number; lagDays: number } | null = null;
  let result2: { conflictIndex: number; lagDays: number } | null = null;

  // Check against next task
  if (taskIndex < updatedTasks.length - 1) {
    const nextTask = updatedTasks[taskIndex + 1];
    const lag = daysBetween(taskEnd, new Date(nextTask.startDate));
    if (lag !== 0) result1 = { conflictIndex: taskIndex + 1, lagDays: lag };
  }

  // Check against active task if last stored task
  if (taskIndex === updatedTasks.length - 1) {
    const lag = daysBetween(taskEnd, startDateRef.current);
    if (lag !== 0) result1 = { conflictIndex: -99, lagDays: lag };
  }

  // Check against previous task
  if (taskIndex > 0) {
    const prevTask = updatedTasks[taskIndex - 1];
    const lag = daysBetween(new Date(prevTask.endDate), taskStart);
    if (lag !== 0) result2 = { conflictIndex: taskIndex - 1, lagDays: lag };
  }

  const primary = result1 ?? result2;
  const secondary = result1 && result2 ? result2 : undefined;

  if (!primary) return { hasOverlap: false, isGap: false, conflictIndex: -1, lagDays: 0 };

  return {
    hasOverlap: primary.lagDays < 0 || (secondary?.lagDays ?? 0) < 0,
    isGap: primary.lagDays > 0 || (secondary?.lagDays ?? 0) > 0,
    conflictIndex: primary.conflictIndex,
    lagDays: primary.lagDays,
    conflictIndex2: secondary?.conflictIndex,
    lagDays2: secondary?.lagDays,
  };
}

  async function handleUndo() {
    if (undoStack.length === 0) return;
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const [last, ...rest] = undoStack;
    setUndoStack(rest);
    setTasksSync(last.tasks);
    setMilestonesSync(last.milestones);
    setStartDateSync(new Date(last.startDate));
    setEndDateSync(new Date(last.endDate));
    setCurrentTaskName(last.currentTaskName);
    currentTaskNameRef.current = last.currentTaskName;
    await AsyncStorage.setItem("tasks", JSON.stringify(last.tasks));
    await AsyncStorage.setItem("milestones", JSON.stringify(last.milestones));
  }

  function handleShiftTimeline(field: 'start' | 'end', direction: 1 | -1) {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isLocked) {
      // Shift entire project (all tasks + active task) together
      const anchor = field === 'start' ? startDateRef.current : endDateRef.current;
      const newAnchor = shiftByUnit(anchor, direction, unit, settings.holidayCountry);
      const deltaMs = newAnchor.getTime() - anchor.getTime();
      saveUndoSnapshot();
      saveTasks(tasksRef.current.map(t => ({
        ...t,
        startDate: new Date(new Date(t.startDate).getTime() + deltaMs).toISOString(),
        endDate: new Date(new Date(t.endDate).getTime() + deltaMs).toISOString(),
      })));
      setStartDateSync(new Date(startDateRef.current.getTime() + deltaMs));
      setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
      return;
    }

    if (field === 'end') {
      const newEnd = shiftByUnit(endDateRef.current, direction, unit, settings.holidayCountry);
      if (newEnd > startDateRef.current) {
        saveUndoSnapshot();
        setEndDateSync(newEnd);
      }
      return;
    }
    // Timeline start: shift tasks[0] if tasks exist, otherwise shift active start
    if (tasksRef.current.length > 0) {
      const first = tasksRef.current[0];
      const newStart = shiftByUnit(new Date(first.startDate), direction, unit, settings.holidayCountry);
      if (newStart < new Date(first.endDate)) {
        saveUndoSnapshot();
        saveTasks(tasksRef.current.map((t, i) => i === 0 ? { ...t, startDate: newStart.toISOString() } : t));
      }
    } else {
      const newStart = shiftByUnit(startDateRef.current, direction, unit, settings.holidayCountry);
      if (newStart < endDateRef.current) {
        saveUndoSnapshot();
        setStartDateSync(newStart);
      }
    }
  }

  function applyStepCascade(fromIndex: number, toIndex: number, deltaMs: number, taskList: Task[]): Task[] {
    if (fromIndex > toIndex) return [...taskList]; // no tasks in range
    const result = [...taskList];
    for (let i = fromIndex; i <= toIndex; i++) {
      if (i < 0 || i >= result.length) continue;
      if (result[i].lagDays !== undefined) continue;
      const s = new Date(new Date(result[i].startDate).getTime() + deltaMs);
      const e = new Date(new Date(result[i].endDate).getTime() + deltaMs);
      result[i] = { ...result[i], startDate: s.toISOString(), endDate: e.toISOString() };
    }
    return result;
  }

  function showStepOverlapAlert(params: {
    key: string;
    lagDays: number;
    taskName: string;
    adjacentName: string;
    lagOwnerIndex: number;
    onShift: () => void;
    onFree: () => void;
  }) {
    const { key, lagDays, taskName, adjacentName, onShift, onFree } = params;
    const isOverlap = lagDays < 0;
    const absD = Math.abs(lagDays);
    Alert.alert(
      isOverlap ? 'Task Overlap Detected' : 'Task Gap Detected',
      `"${taskName}" and "${adjacentName}" would have ${isOverlap ? 'an overlap' : 'a gap'} of ${absD} day${absD !== 1 ? 's' : ''}. What would you like to do?`,
      [
        {
          text: 'Shift Tasks',
          onPress: () => {
            setStepModes(prev => ({ ...prev, [key]: 'shift' }));
            onShift();
          },
        },
        {
          text: 'Keep Overlap/Gap',
          onPress: () => {
            setStepModes(prev => ({ ...prev, [key]: 'free' }));
            onFree();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function handleShiftActiveTask(field: 'start' | 'end', direction: 1 | -1) {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (tappedTask) {
      const idx = tasksRef.current.findIndex(t => t.id === tappedTask.id);
      if (idx === -1) return;

      const current = field === 'start' ? new Date(tappedTask.startDate) : new Date(tappedTask.endDate);
      const newDate = shiftByUnit(current, direction, unit, settings.holidayCountry);
      const deltaMs = newDate.getTime() - current.getTime();

      const valid = field === 'start'
        ? newDate < new Date(tappedTask.endDate)
        : newDate > new Date(tappedTask.startDate);
      if (!valid) return;

      const stepKey = `${tappedTask.id}-${field}`;
      const existingMode = stepModes[stepKey];

      const updatedTasks = tasksRef.current.map(t => {
        if (t.id !== tappedTask.id) return t;
        if (field === 'start') {
          // Recalculate end from originalDuration if present, to preserve intent after weekend snap
          const baseDays = t.originalDuration ? parseInt(t.originalDuration) : daysBetween(new Date(t.startDate), new Date(t.endDate));
          const newEnd = new Date(newDate.getTime() + baseDays * 86400000);
          return { ...t, startDate: newDate.toISOString(), endDate: newEnd.toISOString(), duration: String(baseDays), originalDuration: undefined };
        }
        return { ...t, endDate: newDate.toISOString(), originalDuration: undefined };
      });

      if (existingMode === 'shift') {
        saveUndoSnapshot();
        if (field === 'end') {
          saveTasks(applyStepCascade(idx + 1, tasksRef.current.length - 1, deltaMs, updatedTasks));
          if (activeLagDays === undefined) {
            setStartDateSync(new Date(startDateRef.current.getTime() + deltaMs));
            setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
          }
        } else {
          saveTasks(applyStepCascade(0, idx - 1, deltaMs, updatedTasks));
        }
        return;
      }

      if (existingMode === 'free') {
        saveUndoSnapshot();
        saveTasks(updatedTasks);
        return;
      }

      // First move: check for overlap/gap with adjacent task
      if (field === 'end') {
        const nextTask = tasksRef.current[idx + 1];
        if (nextTask && nextTask.lagDays === undefined) {
          const lagDays = Math.round((new Date(nextTask.startDate).getTime() - newDate.getTime()) / 86400000);
          if (lagDays !== 0) {
            showStepOverlapAlert({
              key: stepKey,
              lagDays,
              taskName: tappedTask.name,
              adjacentName: nextTask.name,
              lagOwnerIndex: idx + 1,
              onShift: () => {
                saveUndoSnapshot();
                saveTasks(applyStepCascade(idx + 1, tasksRef.current.length - 1, deltaMs, updatedTasks));
                if (activeLagDays === undefined) {
                  setStartDateSync(new Date(startDateRef.current.getTime() + deltaMs));
                  setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
                }
              },
              onFree: () => {
                stepLagCallbackRef.current = (confirmedLag: number) => {
                  saveUndoSnapshot();
                  // Reposition next task so its start is exactly confirmedLag days after newDate
                  const next = updatedTasks[idx + 1];
                  const nextNewStart = new Date(newDate.getTime() + confirmedLag * 86400000);
                  const nextDurationMs = new Date(next.endDate).getTime() - new Date(next.startDate).getTime();
                  const nextNewEnd = new Date(nextNewStart.getTime() + nextDurationMs);
                  const repositioned = updatedTasks.map((t, i) => {
                    if (i === idx + 1) return { ...t, startDate: nextNewStart.toISOString(), endDate: nextNewEnd.toISOString(), lagDays: confirmedLag === 0 ? undefined : confirmedLag };
                    return t;
                  });
                  // Cascade subsequent tasks by the same delta
                  const cascadeDelta = nextNewStart.getTime() - new Date(next.startDate).getTime();
                  for (let i = idx + 2; i < repositioned.length; i++) {
                    if (repositioned[i].lagDays !== undefined) continue;
                    repositioned[i] = { ...repositioned[i], startDate: new Date(new Date(repositioned[i].startDate).getTime() + cascadeDelta).toISOString(), endDate: new Date(new Date(repositioned[i].endDate).getTime() + cascadeDelta).toISOString() };
                  }
                  if (activeLagDays === undefined) {
                    setStartDateSync(new Date(startDateRef.current.getTime() + cascadeDelta));
                    setEndDateSync(new Date(endDateRef.current.getTime() + cascadeDelta));
                  }
                  saveTasks(repositioned);
                  stepLagCallbackRef.current = null;
                };
                setLagEditInitialOverride(lagDays);
                setLagEditTaskIndex(idx + 1);
                setLagEditVisible(true);
              },
            });
            return;
          }
        } else if (!nextTask && activeLagDays === undefined) {
          // Last stored task: check against active task start
          const lagDays = Math.round((startDateRef.current.getTime() - newDate.getTime()) / 86400000);
          if (lagDays !== 0) {
            showStepOverlapAlert({
              key: stepKey,
              lagDays,
              taskName: tappedTask.name,
              adjacentName: currentTaskNameRef.current,
              lagOwnerIndex: -99,
              onShift: () => {
                saveUndoSnapshot();
                saveTasks(updatedTasks);
                setStartDateSync(new Date(startDateRef.current.getTime() + deltaMs));
                setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
              },
              onFree: () => {
                stepLagCallbackRef.current = (confirmedLag: number) => {
                  saveUndoSnapshot();
                  const newActiveStart = new Date(newDate.getTime() + confirmedLag * 86400000);
                  const activeDurationMs = endDateRef.current.getTime() - startDateRef.current.getTime();
                  saveTasks(updatedTasks);
                  setStartDateSync(newActiveStart);
                  setEndDateSync(new Date(newActiveStart.getTime() + activeDurationMs));
                  setActiveLagDays(confirmedLag === 0 ? undefined : confirmedLag);
                  stepLagCallbackRef.current = null;
                };
                setLagEditInitialOverride(lagDays);
                setLagEditTaskIndex(-99);
                setLagEditVisible(true);
              },
            });
            return;
          }
        }
      } else {
        const prevTask = idx > 0 ? tasksRef.current[idx - 1] : null;
        if (prevTask && tasksRef.current[idx].lagDays === undefined) {
          const lagDays = Math.round((newDate.getTime() - new Date(prevTask.endDate).getTime()) / 86400000);
          if (lagDays !== 0) {
            showStepOverlapAlert({
              key: stepKey,
              lagDays,
              taskName: tappedTask.name,
              adjacentName: prevTask.name,
              lagOwnerIndex: idx,
              onShift: () => {
                saveUndoSnapshot();
                saveTasks(applyStepCascade(0, idx - 1, deltaMs, updatedTasks));
              },
              onFree: () => {
                stepLagCallbackRef.current = (confirmedLag: number) => {
                  saveUndoSnapshot();
                  // Reposition tapped task so its start is exactly confirmedLag days after prevTask.endDate
                  const curr = updatedTasks[idx];
                  const thisNewStart = new Date(new Date(prevTask.endDate).getTime() + confirmedLag * 86400000);
                  const thisDurationMs = new Date(curr.endDate).getTime() - new Date(curr.startDate).getTime();
                  const thisNewEnd = new Date(thisNewStart.getTime() + thisDurationMs);
                  const repositioned = updatedTasks.map((t, i) => {
                    if (i === idx) return { ...t, startDate: thisNewStart.toISOString(), endDate: thisNewEnd.toISOString(), lagDays: confirmedLag === 0 ? undefined : confirmedLag };
                    return t;
                  });
                  // Cascade subsequent tasks by the same delta
                  const cascadeDelta = thisNewStart.getTime() - new Date(curr.startDate).getTime();
                  for (let i = idx + 1; i < repositioned.length; i++) {
                    if (repositioned[i].lagDays !== undefined) continue;
                    repositioned[i] = { ...repositioned[i], startDate: new Date(new Date(repositioned[i].startDate).getTime() + cascadeDelta).toISOString(), endDate: new Date(new Date(repositioned[i].endDate).getTime() + cascadeDelta).toISOString() };
                  }
                  if (activeLagDays === undefined) {
                    setStartDateSync(new Date(startDateRef.current.getTime() + cascadeDelta));
                    setEndDateSync(new Date(endDateRef.current.getTime() + cascadeDelta));
                  }
                  saveTasks(repositioned);
                  stepLagCallbackRef.current = null;
                };
                setLagEditInitialOverride(lagDays);
                setLagEditTaskIndex(idx);
                setLagEditVisible(true);
              },
            });
            return;
          }
        }
      }

      // No adjacent conflict — just move
      saveUndoSnapshot();
      saveTasks(updatedTasks);
      return;
    }

    // No tapped task: move active project start/end
    if (field === 'start') {
      const newStart = shiftByUnit(startDateRef.current, direction, unit, settings.holidayCountry);
      if (newStart >= endDateRef.current) return;
      const deltaMs = newStart.getTime() - startDateRef.current.getTime();
      const lastTask = tasksRef.current.length > 0 ? tasksRef.current[tasksRef.current.length - 1] : null;
      const stepKey = 'active-start';
      const existingMode = stepModes[stepKey];

      if (existingMode === 'shift') {
        saveUndoSnapshot();
        saveTasks(applyStepCascade(0, tasksRef.current.length - 1, deltaMs, tasksRef.current));
        setStartDateSync(newStart);
        setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
        return;
      }

      if (!existingMode && lastTask && activeLagDays === undefined) {
        const lagDays = Math.round((newStart.getTime() - new Date(lastTask.endDate).getTime()) / 86400000);
        if (lagDays !== 0) {
          showStepOverlapAlert({
            key: stepKey,
            lagDays,
            taskName: currentTaskNameRef.current,
            adjacentName: lastTask.name,
            lagOwnerIndex: -99,
            onShift: () => {
              saveUndoSnapshot();
              saveTasks(applyStepCascade(0, tasksRef.current.length - 1, deltaMs, tasksRef.current));
              setStartDateSync(newStart);
              setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
            },
            onFree: () => {
              stepLagCallbackRef.current = (confirmedLag: number) => {
                saveUndoSnapshot();
                // Position active task exactly confirmedLag days after last stored task's end
                const adjustedStart = new Date(new Date(lastTask!.endDate).getTime() + confirmedLag * 86400000);
                const activeDurationMs = endDateRef.current.getTime() - startDateRef.current.getTime();
                setStartDateSync(adjustedStart);
                setEndDateSync(new Date(adjustedStart.getTime() + activeDurationMs));
                setActiveLagDays(confirmedLag === 0 ? undefined : confirmedLag);
                stepLagCallbackRef.current = null;
              };
              setLagEditInitialOverride(lagDays);
              setLagEditTaskIndex(-99);
              setLagEditVisible(true);
            },
          });
          return;
        }
      }

      saveUndoSnapshot();
      setStartDateSync(newStart);
    } else {
      const newEnd = shiftByUnit(endDateRef.current, direction, unit, settings.holidayCountry);
      if (newEnd > startDateRef.current) {
        saveUndoSnapshot();
        setEndDateSync(newEnd);
      }
    }
  }

  async function loadSettings() {
    try {
      const stored = await AsyncStorage.getItem("settings");
      if (stored) setSettings(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  function handleLagConfirm(lagDays: number) {
    if (stepLagCallbackRef.current) {
      stepLagCallbackRef.current(lagDays);
      setLagEditVisible(false);
      setLagEditTaskIndex(-1);
      setLagEditInitialOverride(undefined);
      return;
    }

    saveUndoSnapshot();

    if (lagEditTaskIndex === -99) {
      // Editing lag between last stored task and active task
      const lastTask = tasksRef.current[tasksRef.current.length - 1];
      if (!lastTask) return;
      const prevEnd = new Date(lastTask.endDate);
      const newActiveStart = new Date(prevEnd.getTime() + lagDays * 24 * 60 * 60 * 1000);
      const activeDurationMs = endDateRef.current.getTime() - startDateRef.current.getTime();
      setStartDateSync(newActiveStart);
      setEndDateSync(new Date(newActiveStart.getTime() + activeDurationMs));
      setActiveLagDays(lagDays === 0 ? undefined : lagDays);
      setLagEditVisible(false);
      setLagEditTaskIndex(-1);
      return;
    }

    if (lagEditTaskIndex < 0 || lagEditTaskIndex >= tasksRef.current.length) return;

    const updated = tasksRef.current.map((t, i) => {
      if (i === lagEditTaskIndex) return { ...t, lagDays: lagDays === 0 ? undefined : lagDays };
      return t;
    });

    // Recalculate this task's startDate based on the previous task's endDate + lagDays
    const prevTask = updated[lagEditTaskIndex - 1];
    if (prevTask) {
      const prevEnd = new Date(prevTask.endDate);
      const newStart = new Date(prevEnd.getTime() + lagDays * 24 * 60 * 60 * 1000);
      const durationMs = new Date(updated[lagEditTaskIndex].endDate).getTime() - new Date(updated[lagEditTaskIndex].startDate).getTime();
      const newEnd = new Date(newStart.getTime() + durationMs);
      updated[lagEditTaskIndex] = {
        ...updated[lagEditTaskIndex],
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
        lagDays: lagDays === 0 ? undefined : lagDays,
      };

      // Cascade subsequent tasks
      const delta = newStart.getTime() - new Date(tasksRef.current[lagEditTaskIndex].startDate).getTime();
      for (let i = lagEditTaskIndex + 1; i < updated.length; i++) {
        if (updated[i].lagDays !== undefined) continue;
        const s = new Date(new Date(updated[i].startDate).getTime() + delta);
        const e = new Date(new Date(updated[i].endDate).getTime() + delta);
        updated[i] = { ...updated[i], startDate: s.toISOString(), endDate: e.toISOString() };
      }

      // Shift active task
      setStartDateSync(new Date(startDateRef.current.getTime() + delta));
      setEndDateSync(new Date(endDateRef.current.getTime() + delta));
    }

    saveTasks(updated);
    setLagEditVisible(false);
    setLagEditTaskIndex(-1);
  }

  function handleLagClear() {
    handleLagConfirm(0);
  }

  async function checkOnboarding() {
    try {
      const seen = await AsyncStorage.getItem('onboarding_seen');
      if (!seen) {
        setOnboardingVisible(true);
      }
    } catch (e) {
      console.warn('Failed to check onboarding status:', e);
    }
  }

  async function handleOnboardingDone() {
    setOnboardingVisible(false);
    try {
      await AsyncStorage.setItem('onboarding_seen', 'true');
    } catch (e) {
      console.warn('Failed to save onboarding status:', e);
    }
  }


  async function saveSettings(newSettings: AppSettings) {
  const oldCountry = settings.holidayCountry;
  const newCountry = newSettings.holidayCountry;
  setSettings(newSettings);
  await AsyncStorage.setItem("settings", JSON.stringify(newSettings));

  if (oldCountry === newCountry) return;

  saveUndoSnapshot();

  // For each task, calculate how many holidays fall in the range
  // under the old vs new country, and shift end date by the difference
  const recalculated = tasksRef.current.map(task => {
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    const oldHolidays = countHolidaysInRange(start, end, oldCountry);
    const newHolidays = countHolidaysInRange(start, end, newCountry);
    const diff = newHolidays - oldHolidays;
    if (diff === 0) return task;
    const newEnd = new Date(end);
    newEnd.setDate(newEnd.getDate() + diff);
    return { ...task, endDate: newEnd.toISOString() };
  });

  await saveTasks(recalculated);

  // Recalculate active task
  const activeOldHolidays = countHolidaysInRange(
    startDateRef.current, endDateRef.current, oldCountry
  );
  const activeNewHolidays = countHolidaysInRange(
    startDateRef.current, endDateRef.current, newCountry
  );
  const activeDiff = activeNewHolidays - activeOldHolidays;
  if (activeDiff !== 0) {
    const newActiveEnd = new Date(endDateRef.current);
    newActiveEnd.setDate(newActiveEnd.getDate() + activeDiff);
    setEndDateSync(newActiveEnd);
  }
}

  async function loadTasks() {
    try {
      const stored = await AsyncStorage.getItem("tasks");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTasks(parsed);
          tasksRef.current = parsed;
        }
      }
    } catch (e) {
      setTasks([]);
      tasksRef.current = [];
    }
  }

  async function loadMilestones() {
    try {
      const stored = await AsyncStorage.getItem("milestones");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMilestones(parsed);
          milestonesRef.current = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load milestones:', e);
    }
  }

  async function requestReviewIfAppropriate(taskCount: number) {
    try {
      if (taskCount === 3) {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (isAvailable) {
          await StoreReview.requestReview();
        }
      }
    } catch (e) {
      console.warn('Failed to request review:', e);
    }
  }

  function setTasksSync(newTasks: Task[]) {
    setTasks(newTasks);
    tasksRef.current = newTasks;
  }

  function setMilestonesSync(newMilestones: Milestone[]) {
    setMilestones(newMilestones);
    milestonesRef.current = newMilestones;
  }

  function setStartDateSync(date: Date) {
    setStartDate(date);
    startDateRef.current = date;
  }

  function setEndDateSync(date: Date) {
    const snapped = settings.noWeekendEnd ? snapToWeekday(date) : date;
    setEndDate(snapped);
    endDateRef.current = snapped;
  }

  // Snap end dates of stored tasks when noWeekendEnd is on.
  // Stores originalDuration so that if the start date moves, the end recalculates
  // from the intended duration rather than the snapped one.
  function snapTaskEndDates(taskList: Task[]): Task[] {
    if (!settings.noWeekendEnd) return taskList;
    return taskList.map(t => {
      const snapped = snapToWeekday(new Date(t.endDate));
      if (snapped.toISOString() === t.endDate) {
        // No snap needed — clear any stale originalDuration
        const { originalDuration: _, ...rest } = t;
        return rest;
      }
      return {
        ...t,
        originalDuration: t.originalDuration ?? t.duration, // preserve pre-snap duration
        endDate: snapped.toISOString(),
        duration: String(daysBetween(new Date(t.startDate), snapped)),
      };
    });
  }

  async function saveTasks(newTasks: Task[]) {
    const snapped = snapTaskEndDates(newTasks);
    setTasksSync(snapped);
    await AsyncStorage.setItem("tasks", JSON.stringify(snapped));
  }

  async function handleSavePercent(taskId: number, pct: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    if (taskId === -1) {
      setActiveTaskPercentComplete(clamped);
    } else {
      const updated = tasksRef.current.map(t =>
        t.id === taskId ? { ...t, percentComplete: clamped } : t
      );
      await saveTasks(updated);
    }
    setPctEditTaskId(null);
  }

  async function handleSaveTaskEdit(values: TaskEditValues) {
    if (taskEditId === null) return;
    const task = tasksRef.current.find(t => t.id === taskEditId);
    if (!task) return;
    // Handle reminder change
    if (task.notificationId) await cancelReminder(task.notificationId);
    let notificationId: string | undefined;
    if (values.reminderDays !== null) {
      const id = await scheduleReminder(values.name, new Date(task.endDate), values.reminderDays);
      notificationId = id ?? undefined;
    }
    const updated = tasksRef.current.map(t =>
      t.id === taskEditId
        ? { ...t, name: values.name, percentComplete: values.percentComplete,
            reminderDays: values.reminderDays ?? undefined, notificationId }
        : t
    );
    await saveTasks(updated);
    setTaskEditId(null);
  }


  function takeSnapshot() {
    taskSnapshotRef.current = tasksRef.current.map(t => ({ ...t }));
    activeStartSnapshotRef.current = startDateRef.current.toISOString();
    activeEndSnapshotRef.current = endDateRef.current.toISOString();
  }

  function handleBoundaryDragStart(taskIndex: number) {
    saveUndoSnapshot();
    takeSnapshot();
    const task = tasksRef.current[taskIndex];
    if (task) {
      setIsDragging(true);
      setDragDisplayDates({
        start: new Date(task.startDate),
        end: new Date(task.endDate),
        label: task.name,
      });
    }
  }

  function handleEndDragStart() {
    saveUndoSnapshot();
    takeSnapshot();
    setIsDragging(true);
    setDragDisplayDates({
      start: startDateRef.current,
      end: endDateRef.current,
      label: currentTaskNameRef.current,
    });
  }

  function handleDragEnd() {
    setIsDragging(false);
    setDragDisplayDates(null);
    setTimeout(() => { takeSnapshot(); }, 50);
  }

  function handleDragActive(dragging: boolean) {
    if (!dragging) {
      setIsDragging(false);
      setDragDisplayDates(null);
    }
  }

  function handleTaskTap(taskId: number | null) {
    setTappedTaskId(taskId);
    if (settings.hapticsEnabled && taskId !== null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handleBoundaryChange(taskIndex: number, newDate: Date) {
    const snapshot = taskSnapshotRef.current;
    if (!snapshot || snapshot.length === 0) return;
    const originalBoundaryDate = new Date(snapshot[taskIndex].endDate);
    const shiftMs = newDate.getTime() - originalBoundaryDate.getTime();
    const shiftDays = Math.round(shiftMs / (1000 * 60 * 60 * 24));
    if (shiftDays === 0) return;
    const updated = snapshot.map((task, i) => {
      if (i === taskIndex) {
        const newEnd = new Date(originalBoundaryDate);
        newEnd.setDate(newEnd.getDate() + shiftDays);
        return { ...task, endDate: newEnd.toISOString(), duration: String(daysBetween(new Date(task.startDate), newEnd)) };
      } else if (i > taskIndex) {
        const newStart = new Date(task.startDate);
        const newEnd = new Date(task.endDate);
        newStart.setDate(newStart.getDate() + shiftDays);
        newEnd.setDate(newEnd.getDate() + shiftDays);
        return { ...task, startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
      }
      return { ...task };
    });
    setTasksSync(updated);
    await AsyncStorage.setItem("tasks", JSON.stringify(updated));
    const updatedTask = updated[taskIndex];
    if (updatedTask) {
      setDragDisplayDates({ start: new Date(updatedTask.startDate), end: new Date(updatedTask.endDate), label: updatedTask.name });
    }
    const snapActiveStart = new Date(activeStartSnapshotRef.current);
    const snapActiveEnd = new Date(activeEndSnapshotRef.current);
    snapActiveStart.setDate(snapActiveStart.getDate() + shiftDays);
    snapActiveEnd.setDate(snapActiveEnd.getDate() + shiftDays);
    setStartDateSync(snapActiveStart);
    setEndDateSync(snapActiveEnd);
    for (let i = taskIndex; i < updated.length; i++) {
      const task = updated[i];
      if (task.notificationId && task.reminderDays) {
        await cancelReminder(task.notificationId);
        const newId = await scheduleReminder(task.name, new Date(task.endDate), task.reminderDays);
        if (newId) updated[i] = { ...task, notificationId: newId };
      }
    }
    await AsyncStorage.setItem("tasks", JSON.stringify(updated));
  }

  async function shiftTasksToNewStart(newStart: Date) {
    if (tasksRef.current.length === 0) {
      setStartDateSync(newStart);
      return;
    }
    const firstTaskStart = new Date(tasksRef.current[0].startDate);
    const shiftMs = newStart.getTime() - firstTaskStart.getTime();
    const shiftDays = Math.round(shiftMs / (1000 * 60 * 60 * 24));
    if (shiftDays === 0) return;
    const shiftedTasks = tasksRef.current.map((task) => {
      const newTaskStart = new Date(task.startDate);
      const newTaskEnd = new Date(task.endDate);
      newTaskStart.setDate(newTaskStart.getDate() + shiftDays);
      newTaskEnd.setDate(newTaskEnd.getDate() + shiftDays);
      return { ...task, startDate: newTaskStart.toISOString(), endDate: newTaskEnd.toISOString() };
    });
    await saveTasks(shiftedTasks);
    const newActiveStart = new Date(startDateRef.current);
    const newActiveEnd = new Date(endDateRef.current);
    newActiveStart.setDate(newActiveStart.getDate() + shiftDays);
    newActiveEnd.setDate(newActiveEnd.getDate() + shiftDays);
    setStartDateSync(newActiveStart);
    setEndDateSync(newActiveEnd);
  }

  async function handleTimelineShift(shiftDays: number) {
    if (shiftDays === 0) return;
    let cursor: Date | null = null;

    const shiftedTasks = tasksRef.current.map((task, i) => {
      if (i === 0) {
        // First task shifts normally
        const newStart = new Date(task.startDate);
        const newEnd = new Date(task.endDate);
        newStart.setDate(newStart.getDate() + shiftDays);
        newEnd.setDate(newEnd.getDate() + shiftDays);
        cursor = newEnd;
        return { ...task, startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
      }

      if (task.lagDays !== undefined && cursor !== null) {
        // Maintain lag offset relative to previous task end
        const newStart = new Date(cursor.getTime() + task.lagDays * 24 * 60 * 60 * 1000);
        const durationMs = new Date(task.endDate).getTime() - new Date(task.startDate).getTime();
        const newEnd = new Date(newStart.getTime() + durationMs);
        cursor = newEnd;
        return { ...task, startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
      }

      // Normal shift
      const newStart = new Date(task.startDate);
      const newEnd = new Date(task.endDate);
      newStart.setDate(newStart.getDate() + shiftDays);
      newEnd.setDate(newEnd.getDate() + shiftDays);
      cursor = newEnd;
      return { ...task, startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
    });

    setTasksSync(shiftedTasks);
    await AsyncStorage.setItem("tasks", JSON.stringify(shiftedTasks));
    const newStart = new Date(startDateRef.current);
    const newEnd = new Date(endDateRef.current);
    newStart.setDate(newStart.getDate() + shiftDays);
    newEnd.setDate(newEnd.getDate() + shiftDays);
    setStartDateSync(newStart);
    setEndDateSync(newEnd);

    // Reschedule notifications
    for (const task of shiftedTasks) {
      if (task.notificationId && task.reminderDays) {
        await cancelReminder(task.notificationId);
        const newId = await scheduleReminder(task.name, new Date(task.endDate), task.reminderDays);
        if (newId) task.notificationId = newId;
      }
    }
    await AsyncStorage.setItem("tasks", JSON.stringify(shiftedTasks));
  }

  function handleDurationConfirm() {
  const num = parseInt(durationEditValue);
  if (isNaN(num) || num <= 0) {
    setDurationEditVisible(false);
    return;
  }
  saveUndoSnapshot();

  const savedTaskId = savedTappedTaskIdRef.current; // use ref, not tappedTaskId state

  const calcNewEnd = (start: Date): Date => {
    const newEnd = new Date(start);
    switch (durationEditUnit) {
      case 'Days':
        newEnd.setDate(newEnd.getDate() + num);
        break;
      case 'Weeks':
        newEnd.setDate(newEnd.getDate() + num * 7);
        break;
      case 'Months':
        newEnd.setMonth(newEnd.getMonth() + num);
        break;
    }
    return newEnd;
  };

  if (savedTaskId !== null) {
    const index = tasksRef.current.findIndex(t => t.id === savedTaskId);
    if (index !== -1) {
      const task = tasksRef.current[index];
      const newEnd = calcNewEnd(new Date(task.startDate));
      const shiftMs = newEnd.getTime() - new Date(task.endDate).getTime();

      const updated = tasksRef.current.map((t, i) => {
        if (i < index) return t;
        if (i === index) return { ...t, endDate: newEnd.toISOString() };
        const newStart = new Date(new Date(t.startDate).getTime() + shiftMs);
        const newTaskEnd = new Date(new Date(t.endDate).getTime() + shiftMs);
        return { ...t, startDate: newStart.toISOString(), endDate: newTaskEnd.toISOString() };
      });

      saveTasks(updated);
      setStartDateSync(new Date(startDateRef.current.getTime() + shiftMs));
      setEndDateSync(new Date(endDateRef.current.getTime() + shiftMs));
    }
  } else {
    const newEnd = calcNewEnd(startDateRef.current);
    setEndDateSync(newEnd);
  }

  savedTappedTaskIdRef.current = null;
  setDurationEditVisible(false);
  setDurationEditValue('');
  setDurationEditUnit('Days');
}

  function requirePro(action: () => void) {
    if (isPro) { action(); } else { setProModalVisible(true); }
  }

  function handleAddTask() {
    setTaskNameVisible(true);
  }

  function handleRenameCurrentTask() {
    setEditingTaskId(null);
    setRenameModalVisible(true);
  }

  function handleBellPress(item: { id: number; isActive?: boolean }) {
    requirePro(() => {
      if (item.isActive) {
        setReminderEditTarget({ kind: 'activeTask' });
      } else {
        setReminderEditTarget({ kind: 'task', id: item.id });
      }
    });
  }

  function handleMilestoneBellPress(id: number) {
    requirePro(() => setReminderEditTarget({ kind: 'milestone', id }));
  }

  async function confirmSetReminder(days: number | null) {
    if (!reminderEditTarget) return;
    if (reminderEditTarget.kind === 'activeTask') {
      const v = days ?? undefined;
      activeTaskReminderDaysRef.current = v;
      setActiveTaskReminderDays(v);
    } else if (reminderEditTarget.kind === 'task') {
      const task = tasksRef.current.find(t => t.id === reminderEditTarget.id);
      if (!task) return;
      if (task.notificationId) await cancelReminder(task.notificationId);
      let notificationId: string | undefined;
      if (days !== null) {
        const id = await scheduleReminder(task.name, new Date(task.endDate), days);
        notificationId = id ?? undefined;
      }
      const updated = tasksRef.current.map(t =>
        t.id === reminderEditTarget.id
          ? { ...t, reminderDays: days ?? undefined, notificationId }
          : t
      );
      await saveTasks(updated);
    } else if (reminderEditTarget.kind === 'milestone') {
      const m = milestonesRef.current.find(m => m.id === reminderEditTarget.id);
      if (!m) return;
      if (m.notificationId) await cancelReminder(m.notificationId);
      let notificationId: string | undefined;
      if (days !== null) {
        const id = await scheduleReminder(m.name, new Date(m.date), days);
        notificationId = id ?? undefined;
      }
      const updated = milestonesRef.current.map(ms =>
        ms.id === reminderEditTarget.id
          ? { ...ms, reminderDays: days ?? undefined, notificationId }
          : ms
      );
      setMilestonesSync(updated);
      await AsyncStorage.setItem('milestones', JSON.stringify(updated));
    }
    setReminderEditTarget(null);
  }

  function handleRenameTask(id: number) {
    setEditingTaskId(id);
    setRenameModalVisible(true);
  }
  function handleDeleteActiveTask() {
    Alert.alert(
      'Delete Task',
      'Remove this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            saveUndoSnapshot();
            if (tasksRef.current.length === 0) {
              // No previous tasks — just reset to defaults
              const newStart = new Date();
              const newEnd = new Date();
              newEnd.setDate(newEnd.getDate() + 30);
              setStartDateSync(newStart);
              setEndDateSync(newEnd);
              setCurrentTaskName('Task 1');
              currentTaskNameRef.current = 'Task 1';
              return;
            }
            // Pop the last stored task and make it the new active task
            const lastTask = tasksRef.current[tasksRef.current.length - 1];
            const updated = tasksRef.current.slice(0, -1);
            await saveTasks(updated);
            setStartDateSync(new Date(lastTask.startDate));
            setEndDateSync(new Date(lastTask.endDate));
            setCurrentTaskName(lastTask.name);
            currentTaskNameRef.current = lastTask.name;
            // Cancel its notification if it had one
            if (lastTask.notificationId) {
              await cancelReminder(lastTask.notificationId);
            }
          },
        },
      ]
    );
  }

  async function handleMoveTask(index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    // Build combined list: stored tasks + active task
    const combined: CombinedTask[] = [
      ...tasksRef.current.map(t => ({ ...t, isActive: false })),
      {
        id: -1,
        name: currentTaskNameRef.current,
        startDate: startDateRef.current.toISOString(),
        endDate: endDateRef.current.toISOString(),
        color: currentTaskColor,
        duration,
        unit,
        isActive: true,
        lagDays: activeLagDays,
      },
    ];

    if (swapIndex < 0 || swapIndex >= combined.length) return;

    saveUndoSnapshot();
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Swap the two items
    const newOrder = [...combined];
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];

    // Anchor = stored task with minimum ID (the originally first-created task).
    // This never changes regardless of date reordering, so the anchor is stable.
    // The active task (id = -1) is never the anchor.
    const originalMap = new Map(tasksRef.current.map(t => [t.id, t]));
    let anchorId = tasksRef.current.reduce(
      (minId, t) => t.id < minId ? t.id : minId,
      tasksRef.current[0]?.id ?? Infinity
    );
    const anchorIndex = newOrder.findIndex(t => t.id === anchorId);
    const anchorOrig = originalMap.get(anchorId)!;

    // Duration helper — uses original stored duration, or active task's current duration
    const getDurationMs = (item: CombinedTask): number => {
      if (item.isActive) {
        return endDateRef.current.getTime() - startDateRef.current.getTime();
      }
      const orig = originalMap.get(item.id);
      if (orig) return new Date(orig.endDate).getTime() - new Date(orig.startDate).getTime();
      return new Date(item.endDate).getTime() - new Date(item.startDate).getTime();
    };

    const relinked = [...newOrder];

    // Anchor stays exactly as originally stored
    relinked[anchorIndex] = {
      ...relinked[anchorIndex],
      startDate: anchorOrig.startDate,
      endDate: anchorOrig.endDate,
    };

    // Chain forward from anchor
    let cursor = new Date(anchorOrig.endDate);
    for (let i = anchorIndex + 1; i < relinked.length; i++) {
      const durationMs = getDurationMs(relinked[i]);
      const newStart = new Date(cursor);
      const newEnd = new Date(cursor.getTime() + durationMs);
      relinked[i] = { ...relinked[i], startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
      cursor = newEnd;
    }

    // Chain backward from anchor
    cursor = new Date(anchorOrig.startDate);
    for (let i = anchorIndex - 1; i >= 0; i--) {
      const durationMs = getDurationMs(relinked[i]);
      const newEnd = new Date(cursor);
      const newStart = new Date(cursor.getTime() - durationMs);
      relinked[i] = { ...relinked[i], startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
      cursor = newStart;
    }

    // Split relinked back into stored tasks and active task state
    const newStoredTasks: Task[] = [];
    let newActiveStart = startDateRef.current;
    let newActiveEnd = endDateRef.current;

    for (const item of relinked) {
      if (item.isActive) {
        newActiveStart = new Date(item.startDate);
        newActiveEnd = new Date(item.endDate);
      } else {
        const { isActive, ...taskData } = item;
        newStoredTasks.push(taskData as Task);
      }
    }

    // Reschedule notifications for tasks whose dates changed
    for (const task of newStoredTasks) {
      if (task.notificationId && task.reminderDays) {
        await cancelReminder(task.notificationId);
        const newId = await scheduleReminder(task.name, new Date(task.endDate), task.reminderDays);
        if (newId) task.notificationId = newId;
      }
    }

    setStartDateSync(newActiveStart);
    setEndDateSync(newActiveEnd);
    await saveTasks(newStoredTasks);
  }

  async function confirmAddTask(name: string, durationDays?: number) {
  saveUndoSnapshot();
  if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  // The task being stored uses the CURRENT active dates — unchanged
  const taskStart = startDateRef.current;
  const taskEnd = endDateRef.current;

  const savedReminderDays = activeTaskReminderDaysRef.current;
  activeTaskReminderDaysRef.current = undefined;
  setActiveTaskReminderDays(undefined);

  let notificationId: string | undefined;
  if (savedReminderDays !== undefined) {
    const id = await scheduleReminder(currentTaskNameRef.current, taskEnd, savedReminderDays);
    notificationId = id ?? undefined;
  }

  const newTask: Task = {
    id: Date.now(),
    name: currentTaskNameRef.current,
    startDate: taskStart.toISOString(),
    endDate: taskEnd.toISOString(),
    color: TASK_COLORS[tasksRef.current.length % TASK_COLORS.length],
    duration: String(daysBetween(taskStart, taskEnd)),
    unit,
    notificationId,
    reminderDays: savedReminderDays,
    lagDays: activeLagDays,
    percentComplete: activeTaskPercentComplete > 0 ? activeTaskPercentComplete : undefined,
  };
  setActiveTaskPercentComplete(0);

  const updated = [...tasksRef.current, newTask];
  await saveTasks(updated);
  await requestReviewIfAppropriate(updated.length);

  // The NEW active task uses the duration the user entered in the modal
  setCurrentTaskName(name);
  currentTaskNameRef.current = name;
  const newActiveStart = taskEnd;
  const newActiveEnd = new Date(newActiveStart);
  newActiveEnd.setDate(newActiveEnd.getDate() + (durationDays ?? 30));
  setStartDateSync(newActiveStart);
  setEndDateSync(newActiveEnd);
  setActiveLagDays(undefined);
  setTaskNameVisible(false);
  setTappedTaskId(null);
}
  async function confirmAddMilestone(name: string, date: Date) {
  saveUndoSnapshot();
  const newMilestone: Milestone = {
    id: Date.now(),
    name,
    date: date.toISOString(),
    color: MILESTONE_COLORS[milestonesRef.current.length % MILESTONE_COLORS.length],
  };
  const updated = [...milestonesRef.current, newMilestone];
  setMilestonesSync(updated);
  await AsyncStorage.setItem("milestones", JSON.stringify(updated));
  setMilestoneModalVisible(false);
  if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

  async function confirmRenameMilestone(newName: string) {
  if (!renamingMilestone) return;
  saveUndoSnapshot();
  const updated = milestonesRef.current.map(m =>
    m.id === renamingMilestone.id ? { ...m, name: newName.trim() || m.name } : m
  );
  setMilestonesSync(updated);
  await AsyncStorage.setItem("milestones", JSON.stringify(updated));
  setRenamingMilestone(null);
}

  async function deleteTask(id: number) {
  Alert.alert("Delete Task", "Remove this task?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete", style: "destructive",
      onPress: async () => {
        saveUndoSnapshot();
        const allTasks = tasksRef.current;
        const index = allTasks.findIndex(t => t.id === id);
        if (index === -1) return;

        // Cancel notification if set
        if (allTasks[index].notificationId) {
          await cancelReminder(allTasks[index].notificationId!);
        }

        // Calculate the gap left by the deleted task
        const deletedStart = new Date(allTasks[index].startDate);
        const deletedEnd = new Date(allTasks[index].endDate);
        const gapMs = deletedEnd.getTime() - deletedStart.getTime();

        // Remove the deleted task
        const remaining = allTasks.filter(t => t.id !== id);

        // Shift all tasks that came AFTER the deleted one
        const relinked = remaining.map((task, i) => {
          if (i < index) return task; // tasks before deleted one — unchanged
          const newStart = new Date(new Date(task.startDate).getTime() - gapMs);
          const newEnd = new Date(new Date(task.endDate).getTime() - gapMs);
          return { ...task, startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
        });

        // Shift active task too
        setStartDateSync(new Date(startDateRef.current.getTime() - gapMs));
        setEndDateSync(new Date(endDateRef.current.getTime() - gapMs));

        await saveTasks(relinked);
      },
    },
  ]);
}


  async function deleteMilestone(id: number) {
    const milestoneToDelete = milestonesRef.current.find(m => m.id === id);
    if (milestoneToDelete?.notificationId) {
      await cancelReminder(milestoneToDelete.notificationId);
    }
    const updated = milestonesRef.current.filter(m => m.id !== id);
    saveUndoSnapshot();
    setMilestonesSync(updated);
    await AsyncStorage.setItem("milestones", JSON.stringify(updated));
  }

  function handleMilestoneLongPress(milestone: Milestone) {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      milestone.name,
      formatDate(new Date(milestone.date)),
      [
        {
          text: 'Rename',
          onPress: () => setRenamingMilestone(milestone),
        },
        {
          text: 'Change Date',
          onPress: () => {
            setEditingMilestoneId(milestone.id);
            setMilestoneDatePickerVisible(true);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMilestone(milestone.id),
        },
      ]
    );
  }

  async function confirmRename(name: string) {
  if (editingTaskId === null) {
    setCurrentTaskName(name);
    currentTaskNameRef.current = name;
  } else {
    const task = tasksRef.current.find(t => t.id === editingTaskId);
    // Reschedule notification with updated name if reminder exists
    let notificationId = task?.notificationId;
    if (task?.notificationId) await cancelReminder(task.notificationId);
    if (task?.reminderDays) {
      const id = await scheduleReminder(name, new Date(task.endDate), task.reminderDays);
      notificationId = id ?? undefined;
    }
    const updated = tasksRef.current.map((t) =>
      t.id === editingTaskId ? { ...t, name, notificationId } : t
    );
    await saveTasks(updated);
  }
  setEditingTaskId(null);
  setRenameModalVisible(false);
}

  function handleReset() {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Reset", "Clear all tasks, milestones and reset dates?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset", style: "destructive",
        onPress: async () => {
          saveUndoSnapshot();
          const fresh = new Date();
          const future = new Date();
          future.setDate(fresh.getDate() + 30);
          setStartDateSync(fresh);
          setEndDateSync(future);
          setUnit("Days");
          setUnitIndex(0);
          setCurrentTaskName("Task 1");
          currentTaskNameRef.current = "Task 1";
          setMilestonesSync([]);
          await saveTasks([]);
          await AsyncStorage.removeItem("milestones");
          setCurrentProjectId(null);
          setCurrentProjectName(null);
          setIsReadOnly(false);
          setActiveLagDays(undefined);
          setActiveTaskPercentComplete(0);
          setStepModes({});
          setTappedTaskId(null);
          setDragDisplayDates(null);
          setEditingTaskId(null);
          setRenameModalVisible(true);
        },
      },
    ]);
  }

  function openPicker(field: string, captureTaskId = true) {
    savedTappedTaskIdRef.current = captureTaskId ? tappedTaskId : null;
    setPickingField(field);
    setPickerVisible(true);
  }

  async function handleConfirm(date: Date) {
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // ── Editing a stored (tapped) task ──────────────────────────────────────
    const pickerTaskId = savedTappedTaskIdRef.current;
const pickerTask = pickerTaskId !== null ? tasksRef.current.find(t => t.id === pickerTaskId) : null;

if (pickerTask) {
  const taskIndex = tasksRef.current.findIndex(t => t.id === pickerTaskId);
      if (taskIndex === -1) { setPickerVisible(false); return; }

      // Build updated task array with new date applied
      const updated = tasksRef.current.map(t => {
        if (t.id !== pickerTaskId) return t;
        if (pickingField === "start") {
          // If end was snapped, recalculate from original (pre-snap) duration to preserve intent
          const baseDays = t.originalDuration ? parseInt(t.originalDuration) : daysBetween(new Date(t.startDate), new Date(t.endDate));
          const newEnd = new Date(date.getTime() + baseDays * 86400000);
          return { ...t, startDate: date.toISOString(), endDate: newEnd.toISOString(), duration: String(baseDays), originalDuration: undefined };
        } else {
          return { ...t, endDate: date.toISOString(), duration: String(daysBetween(new Date(t.startDate), date)), originalDuration: undefined };
        }
      });

      const { hasOverlap, isGap, conflictIndex, lagDays, conflictIndex2, lagDays2 } = detectOverlapAfterEdit(updated, taskIndex);

      if (hasOverlap || isGap) {
        savedTappedTaskIdRef.current = null;
        setPickerVisible(false);
        const conflictTask = conflictIndex === -99
  ? { name: currentTaskNameRef.current }
  : updated[conflictIndex];

const conflictTask2 = conflictIndex2 !== undefined
  ? (conflictIndex2 === -99 ? { name: currentTaskNameRef.current } : updated[conflictIndex2])
  : null;

const message = conflictTask2
  ? `"${pickerTask.name}" overlaps both "${conflictTask.name}" and "${conflictTask2.name}". How would you like to handle this?`
  : `"${pickerTask.name}" ${lagDays < 0 ? 'overlaps' : 'leaves a gap with'} "${conflictTask.name}" by ${Math.abs(lagDays)} day${Math.abs(lagDays) !== 1 ? 's' : ''}. How would you like to handle this?`;
        const overlapDays = Math.abs(lagDays);

        Alert.alert(
          '⚠️ Task Overlap',
          `"${pickerTask.name}" ${lagDays < 0 ? 'overlaps' : 'leaves a gap with'} "${conflictTask.name}" by ${Math.abs(lagDays)} day${Math.abs(lagDays) !== 1 ? 's' : ''}. How would you like to handle this?`,
          [
            {
              text: 'Shift Tasks',
onPress: () => {
  saveUndoSnapshot();
  const shifted = [...updated];

  // Handle primary conflict
if (conflictIndex === -99) {
  const shiftMs = Math.abs(lagDays) * 24 * 60 * 60 * 1000;
  setStartDateSync(new Date(startDateRef.current.getTime() + shiftMs));
  setEndDateSync(new Date(endDateRef.current.getTime() + shiftMs));
} else if (conflictIndex > taskIndex) {
  const shiftMs = Math.abs(lagDays) * 24 * 60 * 60 * 1000;
  for (let i = conflictIndex; i < shifted.length; i++) {
    const newStart = new Date(new Date(shifted[i].startDate).getTime() + shiftMs);
    const newEnd = new Date(new Date(shifted[i].endDate).getTime() + shiftMs);
    shifted[i] = { ...shifted[i], startDate: newStart.toISOString(), endDate: newEnd.toISOString(), lagDays: undefined };
  }
  setStartDateSync(new Date(startDateRef.current.getTime() + shiftMs));
  setEndDateSync(new Date(endDateRef.current.getTime() + shiftMs));
} else {
  const shiftMs = Math.abs(lagDays) * 24 * 60 * 60 * 1000;
  for (let i = 0; i <= conflictIndex; i++) {
    const newStart = new Date(new Date(shifted[i].startDate).getTime() - shiftMs);
    const newEnd = new Date(new Date(shifted[i].endDate).getTime() - shiftMs);
    shifted[i] = { ...shifted[i], startDate: newStart.toISOString(), endDate: newEnd.toISOString(), lagDays: undefined };
  }
}

// Handle secondary conflict if present
if (conflictIndex2 !== undefined && lagDays2 !== undefined) {
  if (conflictIndex2 === -99) {
    const shiftMs = Math.abs(lagDays2) * 24 * 60 * 60 * 1000;
    setStartDateSync(new Date(startDateRef.current.getTime() + shiftMs));
    setEndDateSync(new Date(endDateRef.current.getTime() + shiftMs));
  } else if (conflictIndex2 > taskIndex) {
    const shiftMs = Math.abs(lagDays2) * 24 * 60 * 60 * 1000;
    for (let i = conflictIndex2; i < shifted.length; i++) {
      const newStart = new Date(new Date(shifted[i].startDate).getTime() + shiftMs);
      const newEnd = new Date(new Date(shifted[i].endDate).getTime() + shiftMs);
      shifted[i] = { ...shifted[i], startDate: newStart.toISOString(), endDate: newEnd.toISOString(), lagDays: undefined };
    }
  } else {
    const shiftMs = Math.abs(lagDays2) * 24 * 60 * 60 * 1000;
    for (let i = 0; i <= conflictIndex2; i++) {
      const newStart = new Date(new Date(shifted[i].startDate).getTime() - shiftMs);
      const newEnd = new Date(new Date(shifted[i].endDate).getTime() - shiftMs);
      shifted[i] = { ...shifted[i], startDate: newStart.toISOString(), endDate: newEnd.toISOString(), lagDays: undefined };
    }
  }
}

  saveTasks(shifted);
},
            },
            {
              text: lagDays < 0 ? 'Allow Overlap' : 'Keep Gap',
              onPress: () => {
                saveUndoSnapshot();
                if (conflictIndex === -99) {
                  // Overlap is with the active task — store on active task state
                  // and shift active task start to maintain the lag
                  const newActiveStart = new Date(
                    new Date(updated[taskIndex].endDate).getTime() + lagDays * 24 * 60 * 60 * 1000
                  );
                  const activeDurationMs = endDateRef.current.getTime() - startDateRef.current.getTime();
                  setStartDateSync(newActiveStart);
                  setEndDateSync(new Date(newActiveStart.getTime() + activeDurationMs));
                  setActiveLagDays(lagDays);
                  saveTasks(updated);
                } else {
                  const withLag = updated.map((t, i) => {
                    // lagDays always goes on the LATER task (higher index)
                    // which is the one whose start date is shifted
                    const laterIndex = conflictIndex > taskIndex ? conflictIndex : taskIndex;
                    if (i === laterIndex) {
                      return { ...t, lagDays };
                    }
                    return t;
                  });
                  saveTasks(withLag);
                }
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      // No overlap — save normally
      saveUndoSnapshot();
      saveTasks(updated);
      setPickerVisible(false);
      return;
    }

    saveUndoSnapshot();

    // ── Project start: always shift every task by the delta from first task ───
    // Must come before the isLocked block — works the same locked or unlocked.
    if (pickingField === "projectStart") {
      await shiftTasksToNewStart(date);
      setPickerVisible(false);
      return;
    }

    // ── Editing the active task ──────────────────────────────────────────────
    // If timeline is locked, shift everything together
    if (isLocked) {
      const anchor = pickingField === "start" ? startDateRef.current : endDateRef.current;
      const deltaMs = date.getTime() - anchor.getTime();
      saveTasks(tasksRef.current.map(t => ({
        ...t,
        startDate: new Date(new Date(t.startDate).getTime() + deltaMs).toISOString(),
        endDate: new Date(new Date(t.endDate).getTime() + deltaMs).toISOString(),
      })));
      setStartDateSync(new Date(startDateRef.current.getTime() + deltaMs));
      setEndDateSync(new Date(endDateRef.current.getTime() + deltaMs));
      setPickerVisible(false);
      return;
    }

    if (pickingField === "start") {
      if (tasksRef.current.length > 0) {
        const lastTask = tasksRef.current[tasksRef.current.length - 1];
        const lastEnd = new Date(lastTask.endDate);
        const lag = daysBetween(lastEnd, date);

        if (lag < 0) {
          setPickerVisible(false);
          const overlapDays = Math.abs(lag);
          Alert.alert(
            '⚠️ Task Overlap',
            `This start date overlaps "${lastTask.name}" by ${overlapDays} day${overlapDays !== 1 ? 's' : ''}. How would you like to handle this?`,
            [
              {
                text: 'Shift Tasks',
                onPress: () => {
                  shiftTasksToNewStart(date);
                  setStartDateSync(date);
                },
              },
              {
                text: 'Allow Overlap/Gap',
                onPress: () => {
                  setStartDateSync(date);
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }

        shiftTasksToNewStart(date);
      } else {
        setStartDateSync(date);
      }
    } else {
      setEndDateSync(date);
    }
    setPickerVisible(false);
  }


  function handleUnitToggle() {
    savedTappedTaskIdRef.current = tappedTaskId;
    setUnitModalVisible(true);
  }

  async function handleSave() {
    setSaveName(currentProjectName ?? "");
    setSaveAsVisible(true);
  }

  async function handleSaveAsProject() {
    const name = saveName.trim() || `Project ${new Date().toLocaleDateString()}`;
    const id = await saveProject(name, tasksRef.current, currentTaskNameRef.current, unit, startDateRef.current, endDateRef.current, currentProjectId ?? undefined);
    setCurrentProjectId(id);
    setCurrentProjectName(name);
    setSaveName(""); setSaveAsVisible(false);
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", `"${name}" saved as a project.`);
  }

  async function handleSaveAsReadOnly() {
    const name = saveName.trim() || `Project ${new Date().toLocaleDateString()}`;
    const id = await saveProject(name, tasksRef.current, currentTaskNameRef.current, unit, startDateRef.current, endDateRef.current);
    // Patch the saved project to mark it read-only
    try {
      const stored = await AsyncStorage.getItem('projects');
      const projects: Project[] = stored ? JSON.parse(stored) : [];
      const patched = projects.map(p => p.id === id ? { ...p, readOnly: true } : p);
      await AsyncStorage.setItem('projects', JSON.stringify(patched));
    } catch (e) {
      console.warn('Failed to mark project read-only:', e);
    }
    setCurrentProjectId(id);
    setCurrentProjectName(name);
    setIsReadOnly(true);
    setSaveName(''); setSaveAsVisible(false);
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved!', `"${name}" saved as a read-only project.`);
  }

  async function handleSaveAsTemplate() {
    const name = saveName.trim() || `Template ${new Date().toLocaleDateString()}`;
    await saveTemplate(name, tasksRef.current, currentTaskNameRef.current, unit);
    setSaveName(""); setSaveAsVisible(false);
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", `"${name}" saved as a template.`);
  }

  async function handleExportCSV() {
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const rows: string[] = [];
    rows.push('Type,Name,Start Date,End Date,Duration,Unit');
    tasksRef.current.forEach(task => {
      rows.push(['Task', `"${task.name}"`, formatDate(new Date(task.startDate)), formatDate(new Date(task.endDate)), task.duration, task.unit].join(','));
    });
    rows.push(['Task', `"${currentTaskNameRef.current}"`, formatDate(startDateRef.current), formatDate(endDateRef.current), duration, unit].join(','));
    milestonesRef.current.forEach(milestone => {
      rows.push(['Milestone', `"${milestone.name}"`, formatDate(new Date(milestone.date)), formatDate(new Date(milestone.date)), '', ''].join(','));
    });
    const csv = rows.join('\n');
    const fileName = `DateWheel_${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')}.csv`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;
    try {
      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: 'utf8' as any });
      await Sharing.shareAsync(filePath, { mimeType: 'text/csv', dialogTitle: 'Export Date Wheel Project', UTI: 'public.comma-separated-values-text' });
    } catch (e) {
      Alert.alert('Export failed', 'Could not export the file. Please try again.');
    }
  }

  async function handleExportXLSX() {
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const allTasks = [
      ...tasksRef.current,
      {
        id: -1,
        name: currentTaskNameRef.current,
        startDate: startDateRef.current.toISOString(),
        endDate: endDateRef.current.toISOString(),
        color: currentTaskColor,
        duration,
        unit,
        notificationId: undefined,
        reminderDays: undefined,
      } as Task,
    ];

    // ── Sheet 1: Project Summary ───────────────────────────────────────────

    const wb = XLSX.utils.book_new();

    // Header rows
    const summaryData: any[][] = [
      ['DATE WHEEL — Project Export'],
      [`Generated: ${formatDate(new Date())}`],
      [],
      ['#', 'Task Name', 'Start Date', 'End Date', 'Duration', 'Unit', 'Reminder', 'Overlap'],
    ];

    // Task rows
    allTasks.forEach((task, i) => {
      const isActive = task.id === -1;
      summaryData.push([
        i + 1,
        task.name + (isActive ? ' (Active)' : ''),
        formatDate(new Date(task.startDate)),
        formatDate(new Date(task.endDate)),
        isActive ? duration : task.duration,
        task.unit,
        task.reminderDays ? `${task.reminderDays} days before` : '',
        (task as any).lagDays !== undefined && (task as any).lagDays !== 0
          ? `${(task as any).lagDays < 0 ? 'Overlap' : 'Gap'}: ${Math.abs((task as any).lagDays)}d`
          : '',
      ]);
    });

    // Milestone rows
    if (milestonesRef.current.length > 0) {
      summaryData.push([]);
      summaryData.push(['', 'MILESTONES', 'Date', '', '', '', '', '']);
      milestonesRef.current
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(m => {
          summaryData.push([
            '',
            m.name,
            formatDate(new Date(m.date)),
            getDayName(new Date(m.date)),
            '', '', '', '',
          ]);
        });
    }

    // Total row
    summaryData.push([]);
    summaryData.push(['', 'TOTAL DURATION', '', '', totalDuration || duration, unit, '', '']);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Column widths
    summarySheet['!cols'] = [
      { wch: 4 },   // #
      { wch: 28 },  // Task Name
      { wch: 14 },  // Start
      { wch: 14 },  // End
      { wch: 10 },  // Duration
      { wch: 14 },  // Unit
      { wch: 18 },  // Reminder
      { wch: 16 },  // Overlap
    ];

    XLSX.utils.book_append_sheet(wb, summarySheet, 'Project Summary');

    // ── Sheet 2: Gantt ─────────────────────────────────────────────────────

    const ganttData: any[][] = [];

    // Calculate date range
    const firstStart = tasksRef.current.length > 0
      ? new Date(tasksRef.current[0].startDate)
      : startDateRef.current;
    const lastEnd = endDateRef.current;

    // Build week columns
    const weeks: Date[] = [];
    const cursor = new Date(firstStart);
    cursor.setDate(cursor.getDate() - cursor.getDay()); // align to Sunday
    while (cursor <= lastEnd) {
      weeks.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    // Header row — week start dates
    const ganttHeader = ['Task', 'Start', 'End', 'Duration', ...weeks.map(w =>
      w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    )];
    ganttData.push(ganttHeader);

    // Task rows
    allTasks.forEach(task => {
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      const isActive = task.id === -1;
      const row: any[] = [
        task.name + (isActive ? ' ●' : ''),
        formatDate(taskStart),
        formatDate(taskEnd),
        (isActive ? duration : task.duration) + ' ' + task.unit,
        ...weeks.map(weekStart => {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          // Mark cell if task overlaps this week
          if (taskStart < weekEnd && taskEnd > weekStart) return '█';
          return '';
        }),
      ];
      ganttData.push(row);
    });

    // Milestone rows
    milestonesRef.current.forEach(m => {
      const mDate = new Date(m.date);
      const row: any[] = [
        `◆ ${m.name}`,
        formatDate(mDate),
        '',
        '',
        ...weeks.map(weekStart => {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (mDate >= weekStart && mDate < weekEnd) return '◆';
          return '';
        }),
      ];
      ganttData.push(row);
    });

    const ganttSheet = XLSX.utils.aoa_to_sheet(ganttData);

    // Column widths for Gantt
    ganttSheet['!cols'] = [
      { wch: 24 }, // Task name
      { wch: 12 }, // Start
      { wch: 12 }, // End
      { wch: 12 }, // Duration
      ...weeks.map(() => ({ wch: 6 })), // week columns
    ];

    XLSX.utils.book_append_sheet(wb, ganttSheet, 'Gantt');

    // ── Write and share ────────────────────────────────────────────────────

    try {
      const wbOut = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `DateWheel_${new Date().toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric'
      }).replace(/\//g, '-')}.xlsx`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, wbOut, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Date Wheel as Excel',
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate the Excel file. Please try again.');
    }
  }

  async function handleExportICS() {
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    function icsDate(date: Date): string {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
    }

    function icsTimestamp(date: Date): string {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    function icsEscape(text: string): string {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    }

    function buildAlarm(reminderDays: number): string {
      return [
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder',
        `TRIGGER:-P${reminderDays}D`,
        'END:VALARM',
      ].join('\r\n');
    }

    const now = new Date();
    const allTasks = [
      ...tasksRef.current,
      {
        id: -1,
        name: currentTaskNameRef.current,
        startDate: startDateRef.current.toISOString(),
        endDate: endDateRef.current.toISOString(),
        color: currentTaskColor,
        duration,
        unit,
        reminderDays: undefined as number | undefined,
        notificationId: undefined as string | undefined,
      },
    ];

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DateWheel//DateWheel//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    allTasks.forEach((task) => {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      const endExclusive = new Date(end);
      endExclusive.setDate(endExclusive.getDate() + 1);

      const isActive = task.id === -1;
      const durationLabel = isActive ? `${duration} ${unit}` : `${task.duration} ${task.unit}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:task-${task.id}-${now.getTime()}@datewheel`);
      lines.push(`DTSTAMP:${icsTimestamp(now)}`);
      lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(endExclusive)}`);
      lines.push(`SUMMARY:${icsEscape(task.name)}${isActive ? ' (Active)' : ''}`);
      lines.push(`DESCRIPTION:${icsEscape(durationLabel)}`);
      lines.push('CATEGORIES:DateWheel Task');
      if (task.reminderDays) lines.push(buildAlarm(task.reminderDays));
      lines.push('END:VEVENT');
    });

    milestonesRef.current.forEach((milestone) => {
      const date = new Date(milestone.date);
      const endExclusive = new Date(date);
      endExclusive.setDate(endExclusive.getDate() + 1);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:milestone-${milestone.id}-${now.getTime()}@datewheel`);
      lines.push(`DTSTAMP:${icsTimestamp(now)}`);
      lines.push(`DTSTART;VALUE=DATE:${icsDate(date)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(endExclusive)}`);
      lines.push(`SUMMARY:\u272A ${icsEscape(milestone.name)}`);
      lines.push('DESCRIPTION:Milestone');
      lines.push('CATEGORIES:DateWheel Milestone');
      if (milestone.reminderDays) lines.push(buildAlarm(milestone.reminderDays));
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');

    try {
      const fileName = `DateWheel_${new Date().toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
      }).replace(/\//g, '-')}.ics`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, icsContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/calendar',
        dialogTitle: 'Export Date Wheel as iCal',
        UTI: 'public.calendar-event',
      });
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate the iCal file. Please try again.');
    }
  }

  async function handleExportPDF() {
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const allTasks = [
      ...tasksRef.current,
      { id: -1, name: currentTaskNameRef.current, startDate: startDateRef.current.toISOString(), endDate: endDateRef.current.toISOString(), color: currentTaskColor, duration, unit },
    ];

    // ── SVG wheel (light-themed for print) ────────────────────────────────────
    const SVG_SIZE = 380;
    const R = SVG_SIZE / 2;
    const RING_R = R - 28;
    const TOTAL_DAYS = 365;
    const MONTHS = [
      { name: 'Jan', days: 31 }, { name: 'Feb', days: 28 }, { name: 'Mar', days: 31 },
      { name: 'Apr', days: 30 }, { name: 'May', days: 31 }, { name: 'Jun', days: 30 },
      { name: 'Jul', days: 31 }, { name: 'Aug', days: 31 }, { name: 'Sep', days: 30 },
      { name: 'Oct', days: 31 }, { name: 'Nov', days: 30 }, { name: 'Dec', days: 31 },
    ];
    function pdfDayToAngle(day: number) { return (day / TOTAL_DAYS) * 360 - 90; }
    function pdfAngleToXY(deg: number, radius: number) {
      const rad = (deg * Math.PI) / 180;
      return { x: R + radius * Math.cos(rad), y: R + radius * Math.sin(rad) };
    }
    function getDOY(date: Date) {
      const start = new Date(date.getFullYear(), 0, 0);
      return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    function buildArc(startDay: number, endDay: number): string {
      const spanDays = endDay - startDay;
      if (spanDays <= 0 || spanDays >= TOTAL_DAYS) return '';
      const sa = pdfDayToAngle(startDay);
      const ea = pdfDayToAngle(endDay);
      const s = pdfAngleToXY(sa, RING_R);
      const e = pdfAngleToXY(ea, RING_R);
      const large = ((spanDays / TOTAL_DAYS) * 360) > 180 ? 1 : 0;
      return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${RING_R} ${RING_R} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
    }

    let monthStarts: number[] = [];
    let running = 0;
    MONTHS.forEach(m => { monthStarts.push(running); running += m.days; });

    // Track ring (light gray on white)
    const trackRing = `<circle cx="${R}" cy="${R}" r="${RING_R}" fill="none" stroke="#E2EBF3" stroke-width="30"/>`;
    // Outer/inner guide rings
    const guideRings = `<circle cx="${R}" cy="${R}" r="${RING_R + 15}" fill="none" stroke="#CBD8E5" stroke-width="0.8"/><circle cx="${R}" cy="${R}" r="${RING_R - 15}" fill="none" stroke="#CBD8E5" stroke-width="0.8"/>`;

    const monthDividers = monthStarts.map(dayStart => {
      const angle = pdfDayToAngle(dayStart);
      const inner = pdfAngleToXY(angle, RING_R - 15);
      const outer = pdfAngleToXY(angle, RING_R + 15);
      return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="#B0C4D8" stroke-width="0.8"/>`;
    }).join('');

    const monthLabels = MONTHS.map((month, i) => {
      const midDay = monthStarts[i] + month.days / 2;
      const angle = pdfDayToAngle(midDay);
      const pos = pdfAngleToXY(angle, RING_R - 42);
      const rotation = angle + 90;
      return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" font-size="9" font-weight="700" fill="#6A90B0" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotation.toFixed(1)}, ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})">${month.name}</text>`;
    }).join('');

    const taskArcs = allTasks.map(task => {
      const path = buildArc(getDOY(new Date(task.startDate)), getDOY(new Date(task.endDate)));
      if (!path) return '';
      return `<path d="${path}" fill="none" stroke="${task.color}" stroke-width="30" stroke-opacity="${task.id === -1 ? '0.9' : '0.8'}" stroke-linecap="butt"/>`;
    }).join('');

    const boundaryDots = tasksRef.current.map(task => {
      const pos = pdfAngleToXY(pdfDayToAngle(getDOY(new Date(task.endDate))), RING_R);
      return `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="6" fill="${task.color}" stroke="white" stroke-width="2"/>`;
    }).join('');

    const startPos = pdfAngleToXY(pdfDayToAngle(getDOY(startDateRef.current)), RING_R);
    const startDot = `<circle cx="${startPos.x.toFixed(1)}" cy="${startPos.y.toFixed(1)}" r="8" fill="#2E9BFF" stroke="white" stroke-width="2"/>`;

    const endPos = pdfAngleToXY(pdfDayToAngle(getDOY(endDateRef.current)), RING_R);
    const endDot = `<circle cx="${endPos.x.toFixed(1)}" cy="${endPos.y.toFixed(1)}" r="10" fill="#F0A500" stroke="white" stroke-width="2"/>`;

    const todayAngle = pdfDayToAngle(getDOY(new Date()));
    const todayInner = pdfAngleToXY(todayAngle, RING_R - 15);
    const todayOuter = pdfAngleToXY(todayAngle, RING_R + 15);
    const todayMarker = `<line x1="${todayInner.x.toFixed(1)}" y1="${todayInner.y.toFixed(1)}" x2="${todayOuter.x.toFixed(1)}" y2="${todayOuter.y.toFixed(1)}" stroke="#F0A500" stroke-width="2.5" stroke-linecap="round"/>`;

    const milestoneSVG = milestonesRef.current.map(m => {
      const pos = pdfAngleToXY(pdfDayToAngle(getDOY(new Date(m.date))), RING_R);
      const s = 6;
      return `<polygon points="${pos.x},${(pos.y - s).toFixed(1)} ${(pos.x + s).toFixed(1)},${pos.y} ${pos.x},${(pos.y + s).toFixed(1)} ${(pos.x - s).toFixed(1)},${pos.y}" fill="${m.color}" stroke="white" stroke-width="1.5"/>`;
    }).join('');

    // Hub: white with light border
    const hubRadius = R - 76;
    const hubCircle = `<circle cx="${R}" cy="${R}" r="${hubRadius}" fill="white" stroke="#CBD8E5" stroke-width="1.5"/>`;
    const hubText = `<text x="${R}" y="${R - 14}" font-size="30" font-weight="800" fill="#0D1B2A" text-anchor="middle" dominant-baseline="middle">${totalDuration || duration}</text><text x="${R}" y="${R + 14}" font-size="10" font-weight="700" fill="#1A6FBF" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">${unit.toUpperCase()}</text>${totalDuration ? `<text x="${R}" y="${R + 32}" font-size="9" fill="#8AAFC4" text-anchor="middle" dominant-baseline="middle">TOTAL</text>` : ''}`;

    const wheelSVG = `<svg width="${SVG_SIZE}" height="${SVG_SIZE}" xmlns="http://www.w3.org/2000/svg">${trackRing}${taskArcs}${guideRings}${monthDividers}${monthLabels}${todayMarker}${hubCircle}${hubText}${boundaryDots}${milestoneSVG}${startDot}${endDot}</svg>`;

    // ── Legend ────────────────────────────────────────────────────────────────
    const legendItems = allTasks.map(t =>
      `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
        <div style="width:11px;height:11px;border-radius:50%;background:${t.color};flex-shrink:0;"></div>
        <span style="font-size:11px;color:#2C4A60;font-weight:600;">${t.name}${t.id === -1 ? ' <span style="font-size:9px;color:#1A6FBF;">(active)</span>' : ''}</span>
      </div>`
    ).join('');
    const milestoneLegend = milestonesRef.current.map(m =>
      `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
        <div style="width:11px;height:11px;background:${m.color};transform:rotate(45deg);flex-shrink:0;"></div>
        <span style="font-size:11px;color:#2C4A60;font-weight:600;">◆ ${m.name}</span>
      </div>`
    ).join('');

    // ── Task table rows ───────────────────────────────────────────────────────
    const taskRows = allTasks.map((task, i) => {
      const durationDays = daysBetween(new Date(task.startDate), new Date(task.endDate));
      const isActive = task.id === -1;
      return `<tr style="background:${i % 2 === 0 ? '#F7FAFD' : '#FFFFFF'};">
        <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;">
          <div style="display:flex;align-items:center;gap:9px;">
            <div style="width:10px;height:10px;border-radius:50%;background:${task.color};flex-shrink:0;"></div>
            <span style="font-weight:700;color:#0D1B2A;font-size:13px;">${task.name}</span>
            ${isActive ? '<span style="background:#E8F0FB;color:#1A6FBF;font-size:9px;padding:2px 7px;border-radius:4px;font-weight:700;margin-left:4px;">ACTIVE</span>' : ''}
          </div>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;color:#3A6080;font-size:13px;">${formatDate(new Date(task.startDate))}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;color:#3A6080;font-size:13px;">${formatDate(new Date(task.endDate))}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;font-size:13px;font-weight:700;color:${task.color};">${task.duration} ${task.unit}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;color:#6A90B0;font-size:12px;">${durationDays} days</td>
      </tr>`;
    }).join('');

    const milestoneRows = milestonesRef.current.length > 0
      ? `<div style="margin-top:36px;">
          <div style="font-size:11px;font-weight:700;color:#6A90B0;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Milestones</div>
          <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <thead>
              <tr style="background:#1A6FBF;">
                <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">MILESTONE</th>
                <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">DATE</th>
                <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">DAY OF WEEK</th>
              </tr>
            </thead>
            <tbody>
              ${milestonesRef.current.map((m, i) =>
                `<tr style="background:${i % 2 === 0 ? '#F7FAFD' : '#FFFFFF'};">
                  <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;">
                    <div style="display:flex;align-items:center;gap:9px;">
                      <div style="width:9px;height:9px;background:${m.color};transform:rotate(45deg);flex-shrink:0;"></div>
                      <span style="font-weight:700;color:#0D1B2A;font-size:13px;">${m.name}</span>
                    </div>
                  </td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;color:#3A6080;font-size:13px;">${formatDate(new Date(m.date))}</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E8EEF4;color:#3A6080;font-size:13px;">${getDayName(new Date(m.date))}</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>`
      : '';

    const projectName = currentProjectName ?? 'Untitled Project';
    const generatedDate = formatDate(new Date());

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:#FFFFFF; color:#0D1B2A; }
    @page { margin: 36px 40px; }
  </style>
</head>
<body style="padding:40px;">

  <!-- Header bar -->
  <div style="background:#0D1B2A;border-radius:12px;padding:24px 28px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;font-weight:700;color:#6A90B0;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase;">Project Timeline Report</div>
      <div style="font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">${projectName}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#6A90B0;letter-spacing:1px;margin-bottom:4px;">GENERATED</div>
      <div style="font-size:13px;font-weight:600;color:#8AAFC4;">${generatedDate}</div>
      <div style="margin-top:10px;font-size:13px;font-weight:700;color:#2E9BFF;letter-spacing:1px;">DATE<span style="color:#F0A500;">WHEEL</span></div>
    </div>
  </div>

  <!-- Wheel + summary side by side -->
  <div style="display:flex;gap:28px;align-items:flex-start;margin-bottom:32px;">

    <!-- Wheel -->
    <div style="flex-shrink:0;background:#F4F8FB;border-radius:16px;padding:16px;border:1px solid #E2EBF3;">
      ${wheelSVG}
      <!-- Legend below wheel -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #E2EBF3;">
        <div style="font-size:9px;font-weight:700;color:#6A90B0;letter-spacing:1.5px;margin-bottom:8px;text-transform:uppercase;">Legend</div>
        ${legendItems}
        ${milestoneLegend}
        <div style="display:flex;align-items:center;gap:7px;margin-top:6px;">
          <div style="width:20px;height:2px;background:#F0A500;"></div>
          <span style="font-size:11px;color:#6A90B0;">Today</span>
        </div>
      </div>
    </div>

    <!-- Summary cards + table -->
    <div style="flex:1;min-width:0;">

      <!-- Summary cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:#F4F8FB;border-radius:10px;padding:14px 16px;border:1px solid #E2EBF3;border-left:4px solid #2E9BFF;">
          <div style="font-size:9px;font-weight:700;color:#6A90B0;letter-spacing:1.5px;margin-bottom:6px;text-transform:uppercase;">Start Date</div>
          <div style="font-size:15px;font-weight:800;color:#0D1B2A;">${formatDate(timelineStart)}</div>
          <div style="font-size:11px;color:#6A90B0;margin-top:2px;">${getDayName(timelineStart)}</div>
        </div>
        <div style="background:#F4F8FB;border-radius:10px;padding:14px 16px;border:1px solid #E2EBF3;border-left:4px solid #F0A500;">
          <div style="font-size:9px;font-weight:700;color:#6A90B0;letter-spacing:1.5px;margin-bottom:6px;text-transform:uppercase;">End Date</div>
          <div style="font-size:15px;font-weight:800;color:#0D1B2A;">${formatDate(timelineEnd)}</div>
          <div style="font-size:11px;color:#6A90B0;margin-top:2px;">${getDayName(timelineEnd)}</div>
        </div>
        <div style="background:#F4F8FB;border-radius:10px;padding:14px 16px;border:1px solid #E2EBF3;border-left:4px solid #1DB8A0;">
          <div style="font-size:9px;font-weight:700;color:#6A90B0;letter-spacing:1.5px;margin-bottom:6px;text-transform:uppercase;">Duration</div>
          <div style="font-size:15px;font-weight:800;color:#1A6FBF;">${totalDuration || duration} ${unit}</div>
          <div style="font-size:11px;color:#6A90B0;margin-top:2px;">${allTasks.length} task${allTasks.length !== 1 ? 's' : ''}${milestonesRef.current.length > 0 ? ` · ${milestonesRef.current.length} milestone${milestonesRef.current.length !== 1 ? 's' : ''}` : ''}</div>
        </div>
      </div>

      <!-- Tasks table -->
      <div style="font-size:11px;font-weight:700;color:#6A90B0;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Project Tasks</div>
      <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <thead>
          <tr style="background:#0D1B2A;">
            <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;border-radius:0;">TASK</th>
            <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">START</th>
            <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">END</th>
            <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">DURATION</th>
            <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:1px;">DAYS</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>

      ${milestoneRows}
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid #E2EBF3;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:10px;color:#B0C4D8;">Created with DateWheel · Visual Project Planning</div>
    <div style="font-size:10px;color:#B0C4D8;">${generatedDate}</div>
  </div>

</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const safeName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fileName = `${safeName}_${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')}.pdf`;
      const destPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: destPath });
      await Sharing.shareAsync(destPath, { mimeType: 'application/pdf', dialogTitle: 'Export DateWheel Project as PDF', UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
    }
  }

  async function handleShareProject() {
    try {
      const file: DatewheelFile = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        tasks: tasksRef.current,
        milestones: milestonesRef.current,
        currentTaskName: currentTaskNameRef.current,
        unit,
        startDate: startDateRef.current.toISOString(),
        endDate: endDateRef.current.toISOString(),
      };
      const json = JSON.stringify(file, null, 2);
      const fileName = `${currentTaskNameRef.current.replace(/[^a-zA-Z0-9]/g, '_')}.datewheel`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, json, { encoding: 'utf8' as any });
      await Sharing.shareAsync(filePath, { mimeType: 'application/octet-stream', dialogTitle: 'Share Date Wheel Project', UTI: 'com.tbarker80.datewheel' });
      if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Share failed', 'Could not share the project file.');
    }
  }

  function handleLoadTemplate(template: Template) {
    saveUndoSnapshot();
    const today = new Date();
    const daysBetweenDates = (s: string, e: string) =>
      Math.round((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24));
    let currentStart = new Date(today);
    const rebuiltTasks: Task[] = template.tasks.map((task) => {
      const span = daysBetweenDates(task.startDate, task.endDate);
      const newStart = new Date(currentStart);
      const newEnd = new Date(currentStart);
      newEnd.setDate(newEnd.getDate() + span);
      currentStart = new Date(newEnd);
      return { ...task, id: Date.now() + Math.random(), startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
    });
    saveTasks(rebuiltTasks);
    const newEnd = new Date(currentStart);
    newEnd.setDate(newEnd.getDate() + 30);
    setStartDateSync(currentStart);
    setEndDateSync(newEnd);
    setCurrentTaskName(template.currentTaskName);
    currentTaskNameRef.current = template.currentTaskName;
    setUnit(template.unit);
  }

  function handleLoadProject(project: Project) {
    saveUndoSnapshot();
    saveTasks(project.tasks);
    setStartDateSync(new Date(project.startDate));
    setEndDateSync(new Date(project.endDate));
    setCurrentTaskName(project.currentTaskName);
    currentTaskNameRef.current = project.currentTaskName;
    setUnit(project.unit);
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setIsReadOnly(project.readOnly ?? false);
    setActiveTaskPercentComplete(0);
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.bg, paddingTop: Math.max(0, insets.top - 15) }]}>
      <StatusBar barStyle={settings.darkMode ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ScrollView
  style={styles.scroll}
  contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 80 }]}
  showsVerticalScrollIndicator={false}
>


        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleDate, { color: theme.text }]}>DATE</Text>
            <Text style={[styles.titleWheel, { color: theme.accent }]}>WHEEL</Text>
            <View style={styles.titleDot} />
          </View>
          <View style={styles.headerRight}>
            {isReadOnly && (
              <View style={styles.readOnlyBadge}>
                <Text style={styles.readOnlyBadgeText}>READ ONLY</Text>
              </View>
            )}
            {isPro && !isReadOnly && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
            <TouchableOpacity style={styles.gearBtn} onPress={() => setSettingsVisible(true)}>
              <Text style={styles.gearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Compact toolbar: New · Open · Save · Save As · Undo */}
<View style={styles.toolbar}>
  <TouchableOpacity
    style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
    onPress={handleReset}
  >
    <Text style={[styles.toolbarIcon, { color: theme.muted }]}>＋</Text>
    <Text style={[styles.toolbarLabel, { color: theme.accent }]}>New</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
    onPress={() => setOpenVisible(true)}
  >
    <Text style={[styles.toolbarIcon, { color: theme.muted }]}>📂</Text>
    <Text style={[styles.toolbarLabel, { color: theme.accent }]}>Open</Text>
  </TouchableOpacity>

  {!isReadOnly && (
    <TouchableOpacity
      style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => requirePro(handleSave)}
    >
      <Text style={[styles.toolbarIcon, { color: theme.muted }]}>💾</Text>
      <Text style={[styles.toolbarLabel, { color: theme.accent }]}>Save{!isPro ? ' 🔒' : ''}</Text>
    </TouchableOpacity>
  )}

  <TouchableOpacity
    style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
    onPress={() => requirePro(() => { setSaveName(currentProjectName ?? ""); setSaveAsVisible(true); })}
  >
    <Text style={[styles.toolbarIcon, { color: theme.muted }]}>💾</Text>
    <Text style={[styles.toolbarLabel, { color: theme.accent }]}>{isReadOnly ? 'Save As…' : `Save As${!isPro ? ' 🔒' : ''}`}</Text>
  </TouchableOpacity>

  <TouchableOpacity
  style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border, opacity: (canUndo && !isReadOnly) ? 1 : 0.4 }]}
  onPress={handleUndo}
  disabled={!canUndo || isReadOnly}
>
  <Text style={[styles.toolbarIcon, { color: theme.accent, fontSize: 22 }]}>↩</Text>
  <Text style={[styles.toolbarLabel, { color: theme.accent }]}>Undo</Text>
</TouchableOpacity>
</View>



        {/* Timeline dates */}
        <View style={styles.dateRow}>
          <View style={[styles.dateField, { backgroundColor: theme.card }]}>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftTimeline('start', -1)} disabled={isReadOnly}>
              <Text style={[styles.dateStepText, { color: isReadOnly ? theme.muted : theme.text }]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateFieldInner} onPress={() => openPicker("projectStart", false)} disabled={isReadOnly}>
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>PROJ START</Text>
              <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(timelineStart)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftTimeline('start', 1)} disabled={isReadOnly}>
              <Text style={[styles.dateStepText, { color: isReadOnly ? theme.muted : theme.text }]}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.dateField, { backgroundColor: theme.card }]}>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftTimeline('end', -1)} disabled={isReadOnly}>
              <Text style={[styles.dateStepText, { color: isReadOnly ? theme.muted : theme.text }]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateFieldInner} onPress={() => openPicker("end", false)} disabled={isReadOnly}>
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>PROJECT END</Text>
              <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(timelineEnd)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftTimeline('end', 1)} disabled={isReadOnly}>
              <Text style={[styles.dateStepText, { color: isReadOnly ? theme.muted : theme.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Project name */}
        <View style={styles.projectNameLabel}>
          <Text style={[
            styles.projectNameText,
            !currentProjectName && styles.projectNameUnsaved,
          ]}>
            {currentProjectName ?? 'unsaved'}
          </Text>
        </View>

        {/* Wheel + 4 corner buttons */}
        <View style={styles.wheelContainer}>
          <Animated.View style={{ opacity: wheelFade }}>
            <DateWheel
              startDate={startDate}
              physicalScale={wheelScale}
              onScaleChange={setWheelScale}
              endDate={endDate}
              duration={duration}
              unit={unit}
              tasks={tasks}
              milestones={milestones}
              totalDuration={totalDuration}
              holidayCountry={settings.holidayCountry}
              highlightedTaskId={tappedTaskId}
              highlightedTaskDuration={highlightedTaskDuration}
              onUnitToggle={handleUnitToggle}
              onBoundaryDragStart={handleBoundaryDragStart}
              onBoundaryChange={handleBoundaryChange}
              onEndDragStart={handleEndDragStart}
              onDragEnd={handleDragEnd}
              onDragActive={handleDragActive}
              onTaskTap={handleTaskTap}
              isLocked={isLocked || isReadOnly}
              activeLagDays={activeLagDays}
              activePercentComplete={activeTaskPercentComplete}
              onTimelineShift={handleTimelineShift}
              onBoundaryTap={(taskIndex) => {
                const isLastStoredTask = taskIndex === tasksRef.current.length - 1;
                if (isLastStoredTask && activeLagDays !== undefined) {
                  setLagEditTaskIndex(-99);
                  setLagEditVisible(true);
                } else {
                  const task = tasksRef.current[taskIndex + 1];
                  if (task && (task.lagDays !== undefined || tappedTaskId !== null)) {
                    setLagEditTaskIndex(taskIndex + 1);
                    setLagEditVisible(true);
                  }
                }
              }}
              onDurationTap={() => {
                savedTappedTaskIdRef.current = tappedTaskId;
                const editingTask = tappedTaskId !== null
                  ? tasksRef.current.find(t => t.id === tappedTaskId)
                  : null;
                const editValue = editingTask
                  ? calcDuration(new Date(editingTask.startDate), new Date(editingTask.endDate), unit, settings.holidayCountry)
                  : duration;
                setDurationEditValue(editValue);
                setDurationEditUnit('Days');
                setDurationEditVisible(true);
              }}
              onEndDateChange={(date) => {
                if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEndDateSync(date);
                setDragDisplayDates(prev => prev ? { ...prev, end: date } : null);
              }}
              onStartDateChange={(date) => {
                if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStartDateSync(date);
                setDragDisplayDates(prev => prev ? { ...prev, start: date } : null);
              }}
            />
          </Animated.View>

          {/* TL: Lock Timeline */}
          {!isReadOnly && (
          <TouchableOpacity
            style={[styles.cornerBtn, styles.cornerTL]}
            onPress={() => {
              setIsLocked(l => !l);
              if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.cornerSvgTL} pointerEvents="none">
              <Svg width={C} height={C}>
                <SvgPath d={PATH_TL} fill={isLocked ? '#1A1200' : theme.card} opacity={0.92} />
                <SvgPath d={PATH_TL} fill="none" stroke="#F0A500" strokeWidth={1} />
              </Svg>
            </View>
            <View style={styles.cornerContentTL}>
              <View style={styles.cornerLockIcon} />
              <Text style={[styles.cornerLabel, { color: '#F0A500' }]}>
                {isLocked ? 'Locked' : 'Lock'}
              </Text>
            </View>
          </TouchableOpacity>
          )}

          {/* TR: Calendar */}
          <TouchableOpacity
            style={[styles.cornerBtn, styles.cornerTR]}
            onPress={() => { Animated.timing(wheelFade, { toValue: 0, duration: 350, useNativeDriver: true }).start(); setCalendarVisible(true); }}
            activeOpacity={0.75}
          >
            <View style={styles.cornerSvgTR} pointerEvents="none">
              <Svg width={C} height={C}>
                <SvgPath d={PATH_TR} fill={theme.card} opacity={0.92} />
                <SvgPath d={PATH_TR} fill="none" stroke={theme.accent} strokeWidth={1} />
              </Svg>
            </View>
            <View style={styles.cornerContentTR}>
              <View style={[styles.cornerCalIcon, { borderColor: theme.accent }]} />
              <Text style={[styles.cornerLabel, { color: theme.accent }]}>Cal</Text>
            </View>
          </TouchableOpacity>

          {/* BL: Add Task */}
          {!isReadOnly && (
          <TouchableOpacity
            style={[styles.cornerBtn, styles.cornerBL]}
            onPress={handleAddTask}
            activeOpacity={0.75}
          >
            <View style={styles.cornerSvgBL} pointerEvents="none">
              <Svg width={C} height={C}>
                <SvgPath d={PATH_BL} fill={theme.card} opacity={0.92} />
                <SvgPath d={PATH_BL} fill="none" stroke={currentTaskColor} strokeWidth={1} />
              </Svg>
            </View>
            <View style={styles.cornerContentBL}>
              <View style={[styles.cornerDot, { backgroundColor: currentTaskColor }]} />
              <Text style={[styles.cornerLabel, { color: currentTaskColor }]}>+ Task</Text>
            </View>
          </TouchableOpacity>
          )}

          {/* BR: Add Milestone */}
          {!isReadOnly && (
          <TouchableOpacity
            style={[styles.cornerBtn, styles.cornerBR]}
            onPress={() => setMilestoneModalVisible(true)}
            activeOpacity={0.75}
          >
            <View style={styles.cornerSvgBR} pointerEvents="none">
              <Svg width={C} height={C}>
                <SvgPath d={PATH_BR} fill={theme.card} opacity={0.92} />
                <SvgPath d={PATH_BR} fill="none" stroke='#F0A500' strokeWidth={1} />
              </Svg>
            </View>
            <View style={styles.cornerContentBR}>
              <View style={styles.cornerDiamond} />
              <Text style={[styles.cornerLabel, { color: '#F0A500' }]}>+Mile</Text>
            </View>
          </TouchableOpacity>
          )}
        </View>

        {/* Zoom controls */}
        <View style={styles.zoomRow}>
          <TouchableOpacity
            style={[styles.zoomBtn, { opacity: wheelScale <= 1.0 ? 0.3 : 1 }]}
            onPress={() => setWheelScale(s => Math.max(1.0, Math.round((s - 0.5) * 2) / 2))}
            disabled={wheelScale <= 1.0}
          >
            <Text style={[styles.zoomBtnText, { color: theme.muted }]}>−</Text>
          </TouchableOpacity>
          {wheelScale === 1.0 ? (
            <Text style={[styles.zoomLabel, { color: theme.border }]}>1×</Text>
          ) : (
            <TouchableOpacity style={styles.zoomResetBtn} onPress={() => setWheelScale(1.0)}>
              <Text style={[styles.zoomResetText, { color: theme.accent }]}>↺ Reset View</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.zoomBtn, { opacity: wheelScale >= 4.0 ? 0.3 : 1 }]}
            onPress={() => setWheelScale(s => Math.min(4.0, Math.round((s + 0.5) * 2) / 2))}
            disabled={wheelScale >= 4.0}
          >
            <Text style={[styles.zoomBtnText, { color: theme.muted }]}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Active task dates */}
        <View style={[styles.taskDateRow, { backgroundColor: theme.card }]}>
          <View style={styles.taskDateField}>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftActiveTask('start', -1)}>
              <Text style={[styles.dateStepText, { color: theme.text }]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateFieldInner} onPress={() => openPicker("start")}>
              <Text style={[styles.taskDateLabel, { color: tappedTask ? tappedTask.color : currentTaskColor }]}>{activeTaskLabel.toUpperCase()} START</Text>
              <Text style={[styles.taskDateValue, { color: tappedTask ? tappedTask.color : currentTaskColor }]}>{formatDate(activeTaskStart)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftActiveTask('start', 1)}>
              <Text style={[styles.dateStepText, { color: theme.text }]}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.taskDateField, { borderLeftWidth: 0.5, borderLeftColor: theme.border }]}>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftActiveTask('end', -1)}>
              <Text style={[styles.dateStepText, { color: theme.text }]}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateFieldInner} onPress={() => openPicker("end")}>
              <Text style={[styles.taskDateLabel, { color: tappedTask ? tappedTask.color : currentTaskColor }]}>{activeTaskLabel.toUpperCase()} END</Text>
              <Text style={[styles.taskDateValue, { color: isDragging ? theme.accent : tappedTask ? tappedTask.color : currentTaskColor }]}>{formatDate(activeTaskEnd)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateStepBtn} onPress={() => handleShiftActiveTask('end', 1)}>
              <Text style={[styles.dateStepText, { color: theme.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Task navigator */}
{tasks.length > 0 && (
  <View style={styles.taskNavRow}>
    <TouchableOpacity
      style={styles.taskNavArrow}
      onPress={() => {
        const currentIndex = tappedTaskId !== null
          ? tasks.findIndex(t => t.id === tappedTaskId)
          : tasks.length; // active task = last
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          handleTaskTap(tasks[prevIndex].id);
        } else {
          handleTaskTap(null); // wrap to active task
        }
      }}
    >
      <Text style={styles.taskNavArrowText}>◀◀</Text>
    </TouchableOpacity>

    <View style={styles.taskNavCenter}>
      <Text style={styles.taskNavLabel}>
        {tappedTaskId !== null
          ? tasks.find(t => t.id === tappedTaskId)?.name ?? 'Task'
          : currentTaskName}
      </Text>
      <Text style={styles.taskNavSub}>SELECTED TASKS</Text>
    </View>

    <TouchableOpacity
      style={styles.taskNavArrow}
      onPress={() => {
        const currentIndex = tappedTaskId !== null
          ? tasks.findIndex(t => t.id === tappedTaskId)
          : tasks.length;
        const nextIndex = currentIndex + 1;
        if (nextIndex < tasks.length) {
          handleTaskTap(tasks[nextIndex].id);
        } else {
          handleTaskTap(null); // wrap to active task
        }
      }}
    >
      <Text style={styles.taskNavArrowText}>▶▶</Text>
    </TouchableOpacity>
  </View>
)}


        {/* Unit Selector Modal */}
        <Modal visible={unitModalVisible} transparent={true} animationType="fade" onRequestClose={() => setUnitModalVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setUnitModalVisible(false)}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>SELECT UNIT</Text>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.modalOption, unit === u && styles.modalOptionActive]}
                  onPress={() => {
                    setUnit(u);
                    setUnitIndex(UNITS.indexOf(u));
                    setUnitModalVisible(false);
                    setTimeout(() => { setTappedTaskId(savedTappedTaskIdRef.current); }, 100);
                  }}
                >
                  <Text style={[styles.modalOptionText, unit === u && styles.modalOptionTextActive]}>{u}</Text>
                  {unit === u && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Duration Edit Modal */}
        <Modal visible={durationEditVisible} transparent={true} animationType="fade" onRequestClose={() => setDurationEditVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDurationEditVisible(false)}>
            <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={() => {}}>
              <Text style={styles.modalTitle}>SET DURATION</Text>
              <View style={styles.durationEditRow}>
                <TextInput
                  style={styles.durationEditInput}
                  value={durationEditValue}
                  onChangeText={v => setDurationEditValue(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  autoFocus={true}
                  selectTextOnFocus={true}
                  maxLength={4}
                  placeholder="30"
                  placeholderTextColor="#2A3F52"
                />
                <View style={styles.durationEditUnits}>
                  {(['Days', 'Weeks', 'Months'] as const).map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitBtn, durationEditUnit === u && styles.unitBtnActive]}
                      onPress={() => setDurationEditUnit(u)}
                    >
                      <Text style={[styles.unitBtnText, durationEditUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[styles.confirmBtn, { marginHorizontal: 0, marginTop: 8 }]} onPress={handleDurationConfirm}>
                <Text style={styles.confirmBtnText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelTemplateBtn} onPress={() => { setDurationEditVisible(false); setDurationEditValue(''); setDurationEditUnit('Days'); }}>
                <Text style={styles.cancelTemplateBtnText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>


        {/* Save As modal */}
        <Modal visible={saveAsVisible} transparent={true} animationType="fade" onRequestClose={() => setSaveAsVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSaveAsVisible(false)}>
            <View style={[styles.modalBox, { maxHeight: '85%' }]}>
              <Text style={styles.modalTitle}>SAVE AS & EXPORT</Text>
              <View style={styles.templateInputWrapper}>
                <TextInput
                  style={styles.templateInput}
                  placeholder="Project name..."
                  placeholderTextColor="#2A3F52"
                  value={saveName}
                  onChangeText={setSaveName}
                  autoFocus={true}
                  maxLength={40}
                  onSubmitEditing={handleSaveAsProject}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={handleSaveAsProject}>
                  <Text style={styles.saveOptionIcon}>📁</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Save as Project</Text>
                    <Text style={styles.saveOptionSub}>Saves actual dates — open and continue later</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={handleSaveAsReadOnly}>
                  <Text style={styles.saveOptionIcon}>🔒</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Save as Read Only</Text>
                    <Text style={styles.saveOptionSub}>Saves a view-only version — cannot be edited when opened</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={handleSaveAsTemplate}>
                  <Text style={styles.saveOptionIcon}>📋</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Save as Template</Text>
                    <Text style={styles.saveOptionSub}>Saves structure only — reuse for new projects</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={() => { setSaveAsVisible(false); handleExportCSV(); }}>
                  <Text style={styles.saveOptionIcon}>📤</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Export as CSV</Text>
                    <Text style={styles.saveOptionSub}>Share with Excel, Sheets, MS Project & more</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={() => { setSaveAsVisible(false); handleExportXLSX(); }}>
                  <Text style={styles.saveOptionIcon}>📊</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Export as Excel</Text>
                    <Text style={styles.saveOptionSub}>Color-coded tasks with Gantt sheet</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={() => { setSaveAsVisible(false); handleExportICS(); }}>
                  <Text style={styles.saveOptionIcon}>📅</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Export as iCal</Text>
                    <Text style={styles.saveOptionSub}>Import into Google Calendar, Outlook & more</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveOptionBtn} onPress={() => { setSaveAsVisible(false); handleExportPDF(); }}>
                  <Text style={styles.saveOptionIcon}>📄</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Export as PDF</Text>
                    <Text style={styles.saveOptionSub}>Professional report with task summary</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveOptionBtn, { marginBottom: 8 }]} onPress={() => { setSaveAsVisible(false); handleShareProject(); }}>
                  <Text style={styles.saveOptionIcon}>🔗</Text>
                  <View style={styles.saveOptionText}>
                    <Text style={styles.saveOptionTitle}>Share Project File</Text>
                    <Text style={styles.saveOptionSub}>Send to another Date Wheel user to import</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity style={styles.cancelTemplateBtn} onPress={() => { setSaveName(""); setSaveAsVisible(false); }}>
                <Text style={styles.cancelTemplateBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Project Timeline */}
        <View style={styles.taskSection}>
          <Text style={[styles.taskSectionTitle, { color: theme.muted }]}>PROJECT TIMELINE</Text>

          {/* Build combined list for rendering */}
          {[
            ...tasks.map((t, i) => ({ ...t, isActive: false, listIndex: i })),
            {
              id: -1,
              name: currentTaskName,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              color: currentTaskColor,
              duration,
              unit,
              isActive: true,
              listIndex: tasks.length,
              percentComplete: activeTaskPercentComplete,
            },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.id}
              style={[
  styles.taskItem,
  { backgroundColor: item.id === tappedTaskId ? theme.cardHighlight : theme.card },
]}
              onLongPress={() => {
                if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setTaskActionTarget({ id: item.id, name: item.name, color: item.color, isActive: !!item.isActive });
              }}
              delayLongPress={400}
            >
              <View style={[styles.taskColorBar, { backgroundColor: item.color }]} />
              <View style={styles.taskItemContent}>
                <TouchableOpacity onPress={() => item.isActive ? handleRenameCurrentTask() : handleRenameTask(item.id)}>
                  <Text style={[styles.taskItemName, { color: theme.text }]}>
                    {item.name} <Text style={styles.editHint}>✎</Text>
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.taskItemDates, { color: theme.muted }]}>
                  {formatDate(new Date(item.startDate))} → {formatDate(new Date(item.endDate))}
                </Text>
                <View style={styles.taskBottomRow}>
                  <Text style={[styles.taskItemDuration, { color: item.color }]}>
                    {item.isActive ? duration : item.duration} {item.unit}
                  </Text>
                  <TouchableOpacity
                    style={styles.pctBarTouch}
                    onPress={() => { setPctEditTaskId(item.id); setPctEditValue(item.percentComplete ?? 0); }}
                  >
                    <View style={styles.pctBarTrack}>
                      <View style={[styles.pctBarFill, { width: `${item.percentComplete ?? 0}%` as any, backgroundColor: item.color }]} />
                    </View>
                    <Text style={[styles.pctBarLabel, { color: theme.muted }]}>{item.percentComplete ?? 0}%</Text>
                  </TouchableOpacity>
                </View>
                  {item.lagDays !== undefined && item.lagDays !== 0 && !item.isActive && (
                <TouchableOpacity
                  onPress={() => {
                    const idx = tasksRef.current.findIndex(t => t.id === item.id);
                    if (idx > 0) {
                      setLagEditTaskIndex(idx);
                      setLagEditVisible(true);
                    }
                  }}
                >
                  <Text style={[styles.taskLagBadge, { color: item.lagDays < 0 ? '#EF4444' : '#F0A500' }]}>
                    {item.lagDays < 0 ? `⚡ ${Math.abs(item.lagDays)}d overlap ✎` : `↔ ${item.lagDays}d gap ✎`}
                  </Text>
                </TouchableOpacity>
              )}
              </View>
              <View style={styles.taskRight}>
                <TouchableOpacity onPress={() => handleBellPress(item)}>
                  <Text style={[styles.reminderBell, { opacity: (item.isActive ? activeTaskReminderDays : item.reminderDays) ? 1 : 0.3 }]}>🔔</Text>
                </TouchableOpacity>
                <Text style={[styles.taskNum, { color: theme.muted }]}>#{i + 1}</Text>
                <View style={styles.moveButtons}>
                  <TouchableOpacity
                    onPress={() => handleMoveTask(i, 'up')}
                    disabled={i === 0}
                    style={styles.moveBtn}
                  >
                    <Text style={[styles.moveBtnText, { color: i === 0 ? theme.border : theme.muted }]}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleMoveTask(i, 'down')}
                    disabled={i === arr.length - 1}
                    style={styles.moveBtn}
                  >
                    <Text style={[styles.moveBtnText, { color: i === arr.length - 1 ? theme.border : theme.muted }]}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Milestones */}
          {milestones
            .slice()
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((milestone) => (
              <TouchableOpacity
                key={milestone.id}
                style={[styles.milestoneItem, { backgroundColor: theme.card }]}
                onLongPress={() => handleMilestoneLongPress(milestone)}
              >
                <View style={[styles.milestoneColorBar, { backgroundColor: milestone.color }]} />
                <View style={[styles.milestoneDiamondItem, { backgroundColor: milestone.color }]} />
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneName, { color: theme.text }]}>{milestone.name}</Text>
                  <Text style={[styles.milestoneDate, { color: theme.muted }]}>
                    {formatDate(new Date(milestone.date))} · {getDayName(new Date(milestone.date))}
                  </Text>
                </View>
                <View style={styles.milestoneRight}>
                  <TouchableOpacity onPress={() => handleMilestoneBellPress(milestone.id)}>
                    <Text style={[styles.reminderBell, { opacity: milestone.reminderDays ? 1 : 0.3 }]}>🔔</Text>
                  </TouchableOpacity>
                  <Text style={[styles.milestoneTag, { color: milestone.color }]}>◆</Text>
                </View>
              </TouchableOpacity>
            ))}

          <Text style={[styles.savesHint, { color: theme.border }]}>
            Tap name to rename · Hold to delete
          </Text>


          <View style={styles.viewBtnRow}>
            <TouchableOpacity
              style={[styles.ganttBtn, { borderColor: theme.border, flex: 1 }]}
              onPress={() => setGanttVisible(true)}
            >
              <Text style={styles.ganttBtnIcon}>📊</Text>
              <Text style={[styles.ganttBtnText, { color: theme.muted }]}>Gantt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ganttBtn, { borderColor: theme.border, flex: 1 }]}
              onPress={() => setCalendarVisible(true)}
            >
              <Text style={styles.ganttBtnIcon}>📅</Text>
              <Text style={[styles.ganttBtnText, { color: theme.muted }]}>Calendar</Text>
            </TouchableOpacity>
          </View>

          {!isPro && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => setProModalVisible(true)}
            >
              <Text style={styles.upgradeBtnText}>✨ Unlock Pro — Save & Export</Text>
              <Text style={styles.upgradeBtnSub}>Save projects, open templates, export to PDF/CSV & more</Text>
            </TouchableOpacity>
          )}
        </View>

        <DateTimePickerModal
          isVisible={pickerVisible}
          mode="date"
          date={pickingField === "projectStart" ? timelineStart : pickingField === "start" ? activeTaskStart : activeTaskEnd}
          onConfirm={handleConfirm}
          onCancel={() => setPickerVisible(false)}
        />
        <DateTimePickerModal
          isVisible={milestoneDatePickerVisible}
          mode="date"
          date={editingMilestoneId !== null
            ? new Date(milestonesRef.current.find(m => m.id === editingMilestoneId)?.date || new Date())
            : new Date()
          }
          onConfirm={async (d) => {
            if (editingMilestoneId !== null) {
              saveUndoSnapshot();
              const updated = milestonesRef.current.map(m =>
                m.id === editingMilestoneId ? { ...m, date: d.toISOString() } : m
              );
              setMilestonesSync(updated);
              await AsyncStorage.setItem("milestones", JSON.stringify(updated));
            }
            setMilestoneDatePickerVisible(false);
            setEditingMilestoneId(null);
          }}
          onCancel={() => {
            setMilestoneDatePickerVisible(false);
            setEditingMilestoneId(null);
          }}
        />

      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        onClose={() => setSettingsVisible(false)}
        onChange={saveSettings}
        onShowOnboarding={() => { setSettingsVisible(false); setOnboardingVisible(true); }}
      />
      <LagEditModal
  visible={lagEditVisible}
  taskName={
    lagEditTaskIndex === -99
      ? currentTaskNameRef.current
      : (lagEditTaskIndex >= 0 && lagEditTaskIndex < tasksRef.current.length
          ? tasksRef.current[lagEditTaskIndex]?.name ?? ''
          : '')
  }
  prevTaskName={
    lagEditTaskIndex === -99
      ? tasksRef.current[tasksRef.current.length - 1]?.name ?? ''
      : (lagEditTaskIndex > 0
          ? tasksRef.current[lagEditTaskIndex - 1]?.name ?? ''
          : '')
  }
  initialLagDays={
    lagEditInitialOverride !== undefined
      ? lagEditInitialOverride
      : lagEditTaskIndex === -99
        ? activeLagDays ?? 0
        : (lagEditTaskIndex >= 0 && lagEditTaskIndex < tasksRef.current.length
            ? tasksRef.current[lagEditTaskIndex]?.lagDays ?? 0
            : 0)
  }
  onConfirm={handleLagConfirm}
  onClear={handleLagClear}
  onCancel={() => { setLagEditVisible(false); setLagEditTaskIndex(-1); setLagEditInitialOverride(undefined); stepLagCallbackRef.current = null; }}
/>
      {/* % Complete editor modal */}
      <Modal visible={pctEditTaskId !== null} transparent animationType="slide" onRequestClose={() => setPctEditTaskId(null)}>
        <TouchableOpacity style={styles.pctModalOverlay} activeOpacity={1} onPress={() => setPctEditTaskId(null)}>
          <TouchableOpacity style={styles.pctModalSheet} activeOpacity={1} onPress={() => {}}>
            {(() => {
              const task = pctEditTaskId === -1
                ? { id: -1, name: currentTaskName, color: currentTaskColor }
                : pctEditTaskId !== null ? tasks.find(t => t.id === pctEditTaskId) : null;
              if (!task) return null;
              return (
                <>
                  <Text style={styles.pctModalTitle}>{task.name}</Text>
                  <Text style={styles.pctModalSub}>Set % complete</Text>

                  {/* Big value + fine controls */}
                  <View style={styles.pctValueRow}>
                    <TouchableOpacity style={styles.pctFineBtn} onPress={() => setPctEditValue(v => Math.max(0, v - 1))}>
                      <Text style={styles.pctFineBtnText}>−1</Text>
                    </TouchableOpacity>
                    <Text style={[styles.pctValueDisplay, { color: task.color }]}>{pctEditValue}%</Text>
                    <TouchableOpacity style={styles.pctFineBtn} onPress={() => setPctEditValue(v => Math.min(100, v + 1))}>
                      <Text style={styles.pctFineBtnText}>+1</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Progress bar preview */}
                  <View style={styles.pctPreviewTrack}>
                    <View style={[styles.pctPreviewFill, { width: `${pctEditValue}%` as any, backgroundColor: task.color }]} />
                  </View>

                  {/* Large step buttons: 0 10 20 … 100 */}
                  <View style={styles.pctGridWrap}>
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.pctGridBtn, pctEditValue === v && { backgroundColor: task.color, borderColor: task.color }]}
                        onPress={() => setPctEditValue(v)}
                      >
                        <Text style={[styles.pctGridBtnText, pctEditValue === v && { color: '#FFFFFF' }]}>{v}%</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={[styles.pctDoneBtn, { backgroundColor: task.color }]} onPress={() => handleSavePercent(pctEditTaskId!, pctEditValue)}>
                    <Text style={styles.pctDoneBtnText}>Save</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Task long-press action sheet */}
      <Modal visible={taskActionTarget !== null} transparent animationType="fade" onRequestClose={() => setTaskActionTarget(null)}>
        <TouchableOpacity style={styles.taskActionOverlay} activeOpacity={1} onPress={() => setTaskActionTarget(null)}>
          <View style={styles.taskActionSheet}>
            {taskActionTarget && (
              <>
                <View style={[styles.taskActionHeader, { borderLeftColor: taskActionTarget.color }]}>
                  <Text style={styles.taskActionTitle}>{taskActionTarget.name}</Text>
                </View>
                <TouchableOpacity style={styles.taskActionBtn} onPress={() => {
                  setTaskActionTarget(null);
                  if (taskActionTarget.isActive) handleRenameCurrentTask();
                  else setTaskEditId(taskActionTarget.id);
                }}>
                  <Text style={styles.taskActionBtnIcon}>✎</Text>
                  <Text style={styles.taskActionBtnText}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.taskActionDivider} />
                <TouchableOpacity style={styles.taskActionBtn} onPress={() => {
                  setTaskActionTarget(null);
                  if (taskActionTarget.isActive) handleDeleteActiveTask();
                  else deleteTask(taskActionTarget.id);
                }}>
                  <Text style={[styles.taskActionBtnIcon, { color: '#EF4444' }]}>🗑</Text>
                  <Text style={[styles.taskActionBtnText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
                <View style={styles.taskActionDivider} />
                <TouchableOpacity style={styles.taskActionBtn} onPress={() => setTaskActionTarget(null)}>
                  <Text style={styles.taskActionBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <TaskEditModal
        visible={taskEditId !== null}
        taskNumber={taskEditId !== null ? tasks.findIndex(t => t.id === taskEditId) + 1 : 1}
        initialName={taskEditId !== null ? tasks.find(t => t.id === taskEditId)?.name : undefined}
        initialPercent={taskEditId !== null ? (tasks.find(t => t.id === taskEditId)?.percentComplete ?? 0) : 0}
        initialReminderDays={taskEditId !== null ? tasks.find(t => t.id === taskEditId)?.reminderDays : undefined}
        taskColor={taskEditId !== null ? (tasks.find(t => t.id === taskEditId)?.color ?? '#2E7DBC') : '#2E7DBC'}
        isPro={isPro}
        onSave={handleSaveTaskEdit}
        onCancel={() => setTaskEditId(null)}
      />

      <TaskNameModal visible={taskNameVisible} taskNumber={tasks.length + 1} showDuration onConfirm={confirmAddTask} onCancel={() => setTaskNameVisible(false)} />
      <TaskNameModal
        visible={renameModalVisible}
        taskNumber={editingTaskId === null ? 0 : tasks.findIndex(t => t.id === editingTaskId) + 1}
        initialName={editingTaskId === null ? currentTaskName : tasks.find(t => t.id === editingTaskId)?.name}
        onConfirm={confirmRename}
        onCancel={() => { setEditingTaskId(null); setRenameModalVisible(false); }}
      />
      <TemplatesModal
        visible={openVisible}
        onClose={() => setOpenVisible(false)}
        onLoadTemplate={handleLoadTemplate}
        onLoadProject={handleLoadProject}
      />
      <GanttChart
        visible={ganttVisible}
        onClose={() => setGanttVisible(false)}
        tasks={tasks}
        milestones={milestones}
        currentTaskName={currentTaskName}
        startDate={startDate}
        endDate={endDate}
        duration={duration}
        unit={unit}
        currentTaskColor={currentTaskColor}
      />
      <CalendarView
        visible={calendarVisible}
        onClose={() => {
          setCalendarVisible(false);
          Animated.timing(wheelFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        }}
        tasks={tasks}
        milestones={milestones}
        startDate={startDate}
        endDate={endDate}
        currentTaskName={currentTaskName}
        currentTaskColor={currentTaskColor}
        theme={theme}
      />
      <ProModal
        visible={proModalVisible}
        onClose={() => setProModalVisible(false)}
        onSuccess={() => setProModalVisible(false)}
      />
      <TaskNameModal
        visible={renamingMilestone !== null}
        taskNumber={0}
        onConfirm={confirmRenameMilestone}
        onCancel={() => setRenamingMilestone(null)}
      />
      <MilestoneModal
        visible={milestoneModalVisible}
        defaultDate={endDateRef.current}
        onConfirm={confirmAddMilestone}
        onCancel={() => setMilestoneModalVisible(false)}
      />
      <ReminderModal
        visible={reminderEditTarget !== null}
        itemName={
          reminderEditTarget === null ? '' :
          reminderEditTarget.kind === 'activeTask' ? currentTaskName :
          reminderEditTarget.kind === 'task' ? (tasksRef.current.find(t => t.id === reminderEditTarget.id)?.name ?? '') :
          (milestonesRef.current.find(m => m.id === reminderEditTarget.id)?.name ?? '')
        }
        initialReminderDays={
          reminderEditTarget === null ? undefined :
          reminderEditTarget.kind === 'activeTask' ? activeTaskReminderDays :
          reminderEditTarget.kind === 'task' ? tasksRef.current.find(t => t.id === reminderEditTarget.id)?.reminderDays :
          milestonesRef.current.find(m => m.id === reminderEditTarget.id)?.reminderDays
        }
        onConfirm={confirmSetReminder}
        onCancel={() => setReminderEditTarget(null)}
      />
      <DateTimePickerModal
        isVisible={milestoneDatePickerVisible}
        mode="date"
        date={editingMilestoneId !== null
          ? new Date(milestonesRef.current.find(m => m.id === editingMilestoneId)?.date || new Date())
          : new Date()
        }
        onConfirm={async (d) => {
          if (editingMilestoneId !== null) {
            saveUndoSnapshot();
            const updated = milestonesRef.current.map(m =>
              m.id === editingMilestoneId ? { ...m, date: d.toISOString() } : m
            );
            setMilestonesSync(updated);
            await AsyncStorage.setItem("milestones", JSON.stringify(updated));
          }
          setMilestoneDatePickerVisible(false);
          setEditingMilestoneId(null);
        }}
        onCancel={() => {
          setMilestoneDatePickerVisible(false);
          setEditingMilestoneId(null);
        }}
      />
      <OnboardingModal
        visible={onboardingVisible}
        onDone={handleOnboardingDone}
      />

    </View>
  );
}

const darkTheme = {
  bg: "#0F1923", card: "#1C2B38", cardHighlight: "#1A3A5C",
  text: "#FFFFFF", muted: "#5A7A96", accent: "#2E9BFF", border: "#2A3F52",
};

const lightTheme = {
  bg: "#E8EDF2", card: "#FFFFFF", cardHighlight: "#D6E8FF",
  text: "#0D1B2A", muted: "#5A7A96", accent: "#1A6FBF", border: "#B0C8E0",
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: -4,
    marginBottom: 8,
  },
  taskLagBadge: {
  fontSize: 10,
  fontWeight: '600',
  marginTop: 2,
  letterSpacing: 0.3,
},
taskNavRow: {
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
  backgroundColor: '#1C2B38',
  borderRadius: 14,
  marginBottom: 8,
  overflow: 'hidden',
},
taskNavArrow: {
  paddingVertical: 12,
  paddingHorizontal: 20,
  backgroundColor: '#1A3A5C',
  alignItems: 'center',
  justifyContent: 'center',
},
taskNavArrowText: {
  fontSize: 16,
  color: '#2E9BFF',
  fontWeight: '700',
},
taskNavCenter: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
},
taskNavLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: '#FFFFFF',
  marginBottom: 2,
},
taskNavSub: {
  fontSize: 9,
  fontWeight: '700',
  color: '#5A7A96',
  letterSpacing: 2,
},
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C2B38',
    borderWidth: 1,
    borderColor: '#2A3F52',
  },
  zoomResetBtn: {
  paddingHorizontal: 20,
  paddingVertical: 8,
  borderRadius: 10,
  backgroundColor: '#1C2B38',
  borderWidth: 1,
  borderColor: '#2E7DBC',
},
zoomResetText: {
  fontSize: 14,
  fontWeight: '700',
  letterSpacing: 0.5,
},
  zoomBtnText: {
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 26,
  },
  zoomLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    minWidth: 48,
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  moveButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 4,
  },
  moveBtn: {
    padding: 4,
  },
  moveBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    borderRadius: 10,
    borderWidth: 0.5,
    gap: 1,
  },
   taskRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  milestoneRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reminderBell: {
    fontSize: 15,
    padding: 2,
  },

  toolbarIcon: {
  fontSize: 14,
},
  toolbarLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  container: { alignItems: "center", padding: 16, paddingBottom: 60 },
  headerRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  titleDate: { fontSize: 24, fontWeight: "700", letterSpacing: 3 },
  titleWheel: { fontSize: 24, fontWeight: "300", letterSpacing: 3 },
  titleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2E9BFF", marginLeft: 2, marginBottom: 2 },
  proBadge: { backgroundColor: "#1A3A5C", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: "#2E7DBC" },
  proBadgeText: { fontSize: 9, fontWeight: "700", color: "#2E9BFF", letterSpacing: 1.5 },
  gearBtn: { padding: 8 },
  gearIcon: { fontSize: 24, color: "#5A7A96" },
  dateRow: { flexDirection: "row", width: "100%", gap: 8, marginBottom: 4 },
  dateField: { flex: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  dateFieldInner: { flex: 1, alignItems: "center", paddingVertical: 5 },
  dateStepBtn: { paddingHorizontal: 10, alignSelf: "stretch", justifyContent: "center", alignItems: "center" },
  dateStepText: { fontSize: 18, fontWeight: "300" },
  fieldLabel: { fontSize: 9, fontWeight: "600", letterSpacing: 1.2, marginBottom: 2 },
  fieldValue: { fontSize: 12, fontWeight: "600" },
  fieldDay: { fontSize: 10, marginTop: 1 },
  taskDateRow: { flexDirection: "row", width: "100%", borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  taskDateField: { flex: 1, flexDirection: "row", alignItems: "center" },
  taskDateLabel: { fontSize: 9, fontWeight: "600", letterSpacing: 1, marginBottom: 2 },
  taskDateValue: { fontSize: 13, fontWeight: "600" },
  editHint: { fontSize: 14, color: "#5A7A96" },
  taskSection: { width: "100%", marginTop: 16 },
  taskSectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 1.5, marginBottom: 10 },
  taskItem: { borderRadius: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  taskColorBar: { width: 4, alignSelf: "stretch" },
  taskItemContent: { flex: 1, padding: 12 },
  taskItemName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  taskItemDates: { fontSize: 11, marginBottom: 2 },
  taskItemDuration: { fontSize: 12, fontWeight: "600" },
  taskNum: { fontSize: 12, paddingRight: 12 },
  activeBadge: { backgroundColor: "#1A3A5C", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8, borderWidth: 0.5, borderColor: "#2E7DBC" },
  activeBadgeText: { fontSize: 9, fontWeight: "600", color: "#2E9BFF", letterSpacing: 1 },
  milestoneItem: { borderRadius: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", overflow: "hidden", paddingVertical: 12, paddingRight: 12 },
  milestoneColorBar: { width: 4, alignSelf: "stretch" },
  milestoneDiamondItem: { width: 10, height: 10, marginHorizontal: 12, transform: [{ rotate: "45deg" }] },
  milestoneContent: { flex: 1 },
  milestoneName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  milestoneDate: { fontSize: 11 },
  milestoneTag: { fontSize: 16, paddingLeft: 8 },
  savesHint: { fontSize: 11, textAlign: "center", marginTop: 8, marginBottom: 8 },
  viewBtnRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  ganttBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  ganttBtnIcon: { fontSize: 16 },
  ganttBtnText: { fontSize: 14, fontWeight: "500" },
  upgradeBtn: { width: "100%", backgroundColor: "#1A3A5C", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "#2E7DBC" },
  upgradeBtnText: { fontSize: 15, fontWeight: "700", color: "#2E9BFF", marginBottom: 4 },
  upgradeBtnSub: { fontSize: 12, color: "#5A7A96" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  modalBox: { width: "85%", backgroundColor: "#1C2B38", borderRadius: 20, padding: 8, borderWidth: 1, borderColor: "#2E7DBC" },
  modalTitle: { fontSize: 13, fontWeight: "600", color: "#5A7A96", letterSpacing: 1.5, textAlign: "center", paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#2A3F52" },
  modalOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 0.5, borderBottomColor: "#2A3F52" },
  modalOptionActive: { backgroundColor: "#1A3A5C" },
  modalOptionText: { fontSize: 17, color: "#FFFFFF", fontWeight: "400" },
  modalOptionTextActive: { color: "#2E9BFF", fontWeight: "600" },
  modalCheck: { fontSize: 17, color: "#2E9BFF", fontWeight: "600" },
  templateInputWrapper: { padding: 12 },
  templateInput: { backgroundColor: "#0F1923", borderRadius: 12, padding: 14, fontSize: 16, color: "#FFFFFF", borderWidth: 1, borderColor: "#2E7DBC" },
  saveOptionBtn: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginBottom: 10, backgroundColor: "#0F1923", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#2A3F52" },
  saveOptionIcon: { fontSize: 24, marginRight: 12 },
  saveOptionText: { flex: 1 },
  saveOptionTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF", marginBottom: 2 },
  saveOptionSub: { fontSize: 11, color: "#5A7A96" },
  cancelTemplateBtn: { marginHorizontal: 12, marginBottom: 16, padding: 14, alignItems: "center" },
  cancelTemplateBtnText: { fontSize: 14, color: "#5A7A96" },
  wheelContainer: { position: 'relative', alignSelf: 'center', width: _SW * 0.9 },
  // Touch target = CT×CT square at each outer corner; SVG (C×C) overflows inward.
  cornerBtn: { position: 'absolute', width: CT, height: CT, overflow: 'visible' },
  cornerTL: { top: -14 + _BTNSHIFT, left: -8 + _BTNSHIFT },
  cornerTR: { top: -14 + _BTNSHIFT, right: -8 + _BTNSHIFT },
  cornerBL: { bottom: -4 + _BTNSHIFT, left: -10 + _BTNSHIFT },
  cornerBR: { bottom: -4 + _BTNSHIFT, right: -10 + _BTNSHIFT },
  // SVG compensates by the same amount so the border stays visually anchored to the outer corner.
  cornerSvgTL: { position: 'absolute', top: -_BTNSHIFT, left: -_BTNSHIFT },
  cornerSvgTR: { position: 'absolute', top: -_BTNSHIFT, right: -_BTNSHIFT },
  cornerSvgBL: { position: 'absolute', bottom: -_BTNSHIFT, left: -_BTNSHIFT },
  cornerSvgBR: { position: 'absolute', bottom: -_BTNSHIFT, right: -_BTNSHIFT },
  // Labels at the true outer corner of each button (inside CT box)
  cornerContentTL: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cornerContentTR: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cornerContentBL: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cornerContentBR: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cornerLabel: { fontSize: 9, color: '#5A7A96', fontWeight: '600', textAlign: 'center' },
  cornerDot: { width: 8, height: 8, borderRadius: 4 },
  cornerDiamond: { width: 8, height: 8, backgroundColor: '#F0A500', transform: [{ rotate: '45deg' }] },
  cornerLockIcon: { width: 8, height: 9, borderRadius: 2, borderWidth: 1.5, borderColor: '#F0A500', backgroundColor: 'transparent' },
  cornerCalIcon: { width: 9, height: 9, borderRadius: 2, borderWidth: 1.5, backgroundColor: 'transparent' },
  // kept for any remaining references
  lockToggleText: { fontSize: 11, color: '#5A7A96', fontWeight: '500' },
  confirmBtn: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#2E7DBC', borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  durationEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  durationEditInput: { width: 72, backgroundColor: '#0F1923', borderRadius: 10, padding: 10, fontSize: 22, fontWeight: '700', color: '#FFFFFF', borderWidth: 1, borderColor: '#2E7DBC', textAlign: 'center' },
  durationEditUnits: { flex: 1, flexDirection: 'row', gap: 6 },
  unitBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#2A3F52', backgroundColor: '#0F1923', alignItems: 'center' },
  unitBtnActive: { borderColor: '#2E7DBC', backgroundColor: '#1A3A5C' },
  unitBtnText: { fontSize: 12, color: '#5A7A96', fontWeight: '500' },
  unitBtnTextActive: { color: '#2E9BFF', fontWeight: '600' },
  projectNameLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  projectNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8AAFC4',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  projectNameUnsaved: {
    color: '#3A5A72',
    fontStyle: 'italic',
  },
  readOnlyBadge: {
    backgroundColor: 'rgba(240,165,0,0.12)',
    borderWidth: 1,
    borderColor: '#F0A500',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readOnlyBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F0A500',
    letterSpacing: 1,
  },
  taskBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  pctBarTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pctBarTrack: { flex: 1, height: 5, backgroundColor: '#1C2B38', borderRadius: 3, overflow: 'hidden' },
  pctBarFill: { height: '100%', borderRadius: 3 },
  pctBarLabel: { fontSize: 11, fontWeight: '600', width: 30, textAlign: 'right' },
  taskActionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  taskActionSheet: { width: '100%', backgroundColor: '#1C2B38', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3F52' },
  taskActionHeader: { padding: 18, borderBottomWidth: 0.5, borderBottomColor: '#2A3F52', borderLeftWidth: 4, paddingLeft: 16 },
  taskActionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  taskActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  taskActionBtnIcon: { fontSize: 16, width: 22, textAlign: 'center', color: '#8AAFC4' },
  taskActionBtnText: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  taskActionDivider: { height: 0.5, backgroundColor: '#2A3F52', marginHorizontal: 16 },
  pctValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pctFineBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1C2B38', alignItems: 'center', justifyContent: 'center' },
  pctFineBtnText: { fontSize: 16, fontWeight: '700', color: '#8AAFC4' },
  pctPreviewTrack: { height: 10, backgroundColor: '#1C2B38', borderRadius: 5, overflow: 'hidden', marginBottom: 20 },
  pctPreviewFill: { height: '100%', borderRadius: 5 },
  pctGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  pctGridBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1C2B38', borderWidth: 1, borderColor: '#2A3F52', minWidth: 56, alignItems: 'center' },
  pctGridBtnText: { fontSize: 14, fontWeight: '600', color: '#8AAFC4' },
  pctModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pctModalSheet: { backgroundColor: '#0F1923', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: '#2E7DBC', padding: 24, paddingBottom: 40 },
  pctModalTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  pctModalSub: { fontSize: 12, color: '#5A7A96', marginBottom: 20 },
  pctValueDisplay: { fontSize: 48, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 4 },
  pctValueLabel: { fontSize: 11, color: '#5A7A96', textAlign: 'center', letterSpacing: 1.5, marginBottom: 20 },
  pctDoneBtn: { backgroundColor: '#2E7DBC', borderRadius: 12, padding: 14, alignItems: 'center' },
  pctDoneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  pctQuickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  pctQuickBtn: { flex: 1, marginHorizontal: 3, backgroundColor: '#1C2B38', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  pctQuickText: { fontSize: 13, fontWeight: '600', color: '#8AAFC4' },
});
