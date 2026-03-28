import DateWheel, { Milestone, Task, TASK_COLORS } from "@/components/datewheel";
import GanttChart from "@/components/GanttChart";
import { businessDaysWithHolidays } from "@/components/holidays";
import MilestoneModal from "@/components/MilestoneModal";
import { useProStatus } from "@/components/ProContext";
import ProModal from "@/components/ProModal";
import SettingsModal, { AppSettings } from "@/components/SettingsModal";
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
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
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
const MAX_UNDO_LEVELS = 5;

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  hapticsEnabled: true,
  holidayCountry: "NONE",
};

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
  endDate: Date
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem("projects");
    const existing: Project[] = stored ? JSON.parse(stored) : [];
    const now = new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    const newProject: Project = {
      id: Date.now(),
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
  } catch (e) {}
}

export default function Index() {
  const { isPro } = useProStatus();

  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 30);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(future);
  const [unit, setUnit] = useState("Days");
  const [unitIndex, setUnitIndex] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingField, setPickingField] = useState("start");
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [taskNameVisible, setTaskNameVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [openVisible, setOpenVisible] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [ganttVisible, setGanttVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [currentTaskName, setCurrentTaskName] = useState("Current Task");
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [durationEditVisible, setDurationEditVisible] = useState(false);
  const [durationEditValue, setDurationEditValue] = useState('');
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
  const endDateRef = useRef<Date>(future);
  const taskSnapshotRef = useRef<Task[]>([]);
  const activeStartSnapshotRef = useRef<string>("");
  const activeEndSnapshotRef = useRef<string>("");
  const milestonesRef = useRef<Milestone[]>([]);
  const currentTaskNameRef = useRef<string>("Current Task");
  const savedTappedTaskIdRef = useRef<number | null>(null);

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
                setCurrentTaskName(file.currentTaskName || 'Current Task');
                currentTaskNameRef.current = file.currentTaskName || 'Current Task';
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

  function handleUndo() {
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
    AsyncStorage.setItem("tasks", JSON.stringify(last.tasks));
    AsyncStorage.setItem("milestones", JSON.stringify(last.milestones));
  }

  async function loadSettings() {
    try {
      const stored = await AsyncStorage.getItem("settings");
      if (stored) setSettings(JSON.parse(stored));
    } catch (e) {}
  }

  async function saveSettings(newSettings: AppSettings) {
    setSettings(newSettings);
    await AsyncStorage.setItem("settings", JSON.stringify(newSettings));
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
    } catch (e) {}
  }

  async function requestReviewIfAppropriate(taskCount: number) {
    try {
      if (taskCount === 3) {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (isAvailable) {
          await StoreReview.requestReview();
        }
      }
    } catch (e) {}
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
    setEndDate(date);
    endDateRef.current = date;
  }

  async function saveTasks(newTasks: Task[]) {
    setTasksSync(newTasks);
    await AsyncStorage.setItem("tasks", JSON.stringify(newTasks));
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
    const shiftedTasks = tasksRef.current.map((task) => {
      const newStart = new Date(task.startDate);
      const newEnd = new Date(task.endDate);
      newStart.setDate(newStart.getDate() + shiftDays);
      newEnd.setDate(newEnd.getDate() + shiftDays);
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
  }

  function handleDurationConfirm() {
    const num = parseInt(durationEditValue);
    if (isNaN(num) || num <= 0) {
      setDurationEditVisible(false);
      return;
    }
    saveUndoSnapshot();
    const newEnd = new Date(startDateRef.current);
    switch (unit) {
      case 'Days':
      case 'Business Days':
        newEnd.setDate(newEnd.getDate() + num);
        break;
      case 'Weeks':
        newEnd.setDate(newEnd.getDate() + num * 7);
        break;
      case 'Months':
        newEnd.setMonth(newEnd.getMonth() + num);
        break;
    }
    setEndDateSync(newEnd);
    setDurationEditVisible(false);
    setDurationEditValue('');
  }

  function requirePro(action: () => void) {
    if (isPro) { action(); } else { setProModalVisible(true); }
  }

  function handleAddTask() {
    if (tasksRef.current.length === 0) {
      setTaskNameVisible(true);
    } else {
      requirePro(() => setTaskNameVisible(true));
    }
  }

  function handleRenameCurrentTask() {
    setEditingTaskId(null);
    setRenameModalVisible(true);
  }

  function handleRenameTask(id: number) {
    setEditingTaskId(id);
    setRenameModalVisible(true);
  }

  async function confirmRename(name: string) {
    if (editingTaskId === null) {
      setCurrentTaskName(name);
      currentTaskNameRef.current = name;
    } else {
      const updated = tasksRef.current.map((t) =>
        t.id === editingTaskId ? { ...t, name } : t
      );
      await saveTasks(updated);
    }
    setEditingTaskId(null);
    setRenameModalVisible(false);
  }

  async function confirmAddTask(name: string) {
    saveUndoSnapshot();
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newTask: Task = {
      id: Date.now(),
      name: currentTaskNameRef.current,
      startDate: startDateRef.current.toISOString(),
      endDate: endDateRef.current.toISOString(),
      color: TASK_COLORS[tasksRef.current.length % TASK_COLORS.length],
      duration,
      unit,
    };
    const updated = [...tasksRef.current, newTask];
    await saveTasks(updated);
    await requestReviewIfAppropriate(updated.length);
    setCurrentTaskName(name);
    currentTaskNameRef.current = name;
    const nextEnd = new Date(endDateRef.current);
    nextEnd.setDate(nextEnd.getDate() + 30);
    setStartDateSync(endDateRef.current);
    setEndDateSync(nextEnd);
    setTaskNameVisible(false);
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

  async function deleteTask(id: number) {
    Alert.alert("Delete Task", "Remove this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          saveUndoSnapshot();
          const updated = tasksRef.current.filter((t) => t.id !== id);
          await saveTasks(updated);
        },
      },
    ]);
  }

  async function deleteMilestone(id: number) {
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
          setCurrentTaskName("Current Task");
          currentTaskNameRef.current = "Current Task";
          setMilestonesSync([]);
          await saveTasks([]);
          await AsyncStorage.removeItem("milestones");
        },
      },
    ]);
  }

  function openPicker(field: string) {
    setPickingField(field);
    setPickerVisible(true);
  }

  function handleConfirm(date: Date) {
    saveUndoSnapshot();
    if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tappedTask) {
      const updated = tasksRef.current.map(t => {
        if (t.id !== tappedTaskId) return t;
        if (pickingField === "start") {
          return { ...t, startDate: date.toISOString(), duration: String(daysBetween(date, new Date(t.endDate))) };
        } else {
          return { ...t, endDate: date.toISOString(), duration: String(daysBetween(new Date(t.startDate), date)) };
        }
      });
      saveTasks(updated);
    } else {
      if (pickingField === "start") {
        if (tasksRef.current.length > 0) {
          shiftTasksToNewStart(date);
        } else {
          setStartDateSync(date);
        }
      } else {
        setEndDateSync(date);
      }
    }
    setPickerVisible(false);
  }

  function handleUnitToggle() {
    savedTappedTaskIdRef.current = tappedTaskId;
    setUnitModalVisible(true);
  }

  async function handleSaveAsProject() {
    const name = saveName.trim() || `Project ${new Date().toLocaleDateString()}`;
    await saveProject(name, tasksRef.current, currentTaskNameRef.current, unit, startDateRef.current, endDateRef.current);
    setSaveName(""); setSaveVisible(false);
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", `"${name}" saved as a project.`);
  }

  async function handleSaveAsTemplate() {
    const name = saveName.trim() || `Template ${new Date().toLocaleDateString()}`;
    await saveTemplate(name, tasksRef.current, currentTaskNameRef.current, unit);
    setSaveName(""); setSaveVisible(false);
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

  async function handleExportPDF() {
    if (settings.hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const allTasks = [
      ...tasksRef.current,
      { id: -1, name: currentTaskNameRef.current, startDate: startDateRef.current.toISOString(), endDate: endDateRef.current.toISOString(), color: currentTaskColor, duration, unit },
    ];
    const SVG_SIZE = 400;
    const R = SVG_SIZE / 2;
    const RING_R = R - 24;
    const TOTAL_DAYS = 365;
    const MONTHS = [
      { name: 'Jan', days: 31 }, { name: 'Feb', days: 28 }, { name: 'Mar', days: 31 },
      { name: 'Apr', days: 30 }, { name: 'May', days: 31 }, { name: 'Jun', days: 30 },
      { name: 'Jul', days: 31 }, { name: 'Aug', days: 31 }, { name: 'Sep', days: 30 },
      { name: 'Oct', days: 31 }, { name: 'Nov', days: 30 }, { name: 'Dec', days: 31 },
    ];
    function dayToAngle(day: number) { return (day / TOTAL_DAYS) * 360 - 90; }
    function angleToXY(deg: number, radius: number) {
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
      const sa = dayToAngle(startDay);
      const ea = dayToAngle(endDay);
      const s = angleToXY(sa, RING_R);
      const e = angleToXY(ea, RING_R);
      const large = ((spanDays / TOTAL_DAYS) * 360) > 180 ? 1 : 0;
      return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${RING_R} ${RING_R} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
    }
    let monthStarts: number[] = [];
    let running = 0;
    MONTHS.forEach(m => { monthStarts.push(running); running += m.days; });
    const monthDividers = monthStarts.map(dayStart => {
      const angle = dayToAngle(dayStart);
      const inner = angleToXY(angle, RING_R - 14);
      const outer = angleToXY(angle, RING_R + 14);
      return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="#2E7DBC" stroke-width="0.5" stroke-opacity="0.5"/>`;
    }).join('');
    const monthLabels = MONTHS.map((month, i) => {
      const midDay = monthStarts[i] + month.days / 2;
      const angle = dayToAngle(midDay);
      const pos = angleToXY(angle, RING_R - 38);
      const rotation = angle + 90;
      return `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" font-size="9" font-weight="600" fill="#8AAFC4" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotation.toFixed(1)}, ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})">${month.name}</text>`;
    }).join('');
    const taskArcs = allTasks.map(task => {
      const path = buildArc(getDOY(new Date(task.startDate)), getDOY(new Date(task.endDate)));
      if (!path) return '';
      return `<path d="${path}" fill="none" stroke="${task.color}" stroke-width="28" stroke-opacity="${task.id === -1 ? '0.85' : '0.7'}" stroke-linecap="butt"/>`;
    }).join('');
    const boundaryDots = tasksRef.current.map(task => {
      const angle = dayToAngle(getDOY(new Date(task.endDate)));
      const pos = angleToXY(angle, RING_R);
      return `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="6" fill="${task.color}" stroke="white" stroke-width="1.5" stroke-opacity="0.6"/>`;
    }).join('');
    const startPos = angleToXY(dayToAngle(getDOY(startDateRef.current)), RING_R);
    const startDot = `<circle cx="${startPos.x.toFixed(1)}" cy="${startPos.y.toFixed(1)}" r="8" fill="#2E9BFF" stroke="white" stroke-width="1.5" stroke-opacity="0.6"/>`;
    const endPos = angleToXY(dayToAngle(getDOY(endDateRef.current)), RING_R);
    const endDot = `<circle cx="${endPos.x.toFixed(1)}" cy="${endPos.y.toFixed(1)}" r="10" fill="#F0A500" fill-opacity="0.9" stroke="white" stroke-width="1.5" stroke-opacity="0.6"/>`;
    const todayAngle = dayToAngle(getDOY(new Date()));
    const todayInner = angleToXY(todayAngle, RING_R - 14);
    const todayOuter = angleToXY(todayAngle, RING_R + 14);
    const todayDotPos = angleToXY(todayAngle, RING_R);
    const todayMarker = `<line x1="${todayInner.x.toFixed(1)}" y1="${todayInner.y.toFixed(1)}" x2="${todayOuter.x.toFixed(1)}" y2="${todayOuter.y.toFixed(1)}" stroke="#F0A500" stroke-width="2" stroke-opacity="0.9" stroke-linecap="round"/><circle cx="${todayDotPos.x.toFixed(1)}" cy="${todayDotPos.y.toFixed(1)}" r="3" fill="#F0A500" fill-opacity="0.9"/>`;
    const milestoneSVG = milestonesRef.current.map(m => {
      const angle = dayToAngle(getDOY(new Date(m.date)));
      const pos = angleToXY(angle, RING_R - 18);
      const size = 5;
      return `<polygon points="${pos.x},${(pos.y - size).toFixed(1)} ${(pos.x + size).toFixed(1)},${pos.y} ${pos.x},${(pos.y + size).toFixed(1)} ${(pos.x - size).toFixed(1)},${pos.y}" fill="${m.color}" stroke="white" stroke-width="1"/>`;
    }).join('');
    const hubRadius = R - 72;
    const centerText = `<circle cx="${R}" cy="${R}" r="${hubRadius}" fill="#0F1923" stroke="#2E7DBC" stroke-width="1.5"/><text x="${R}" y="${R - 18}" font-size="32" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">${totalDuration || duration}</text><text x="${R}" y="${R + 14}" font-size="11" font-weight="600" fill="#2E9BFF" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">${unit.toUpperCase()}</text>${totalDuration ? `<text x="${R}" y="${R + 36}" font-size="10" fill="#5A7A96" text-anchor="middle" dominant-baseline="middle">TOTAL</text>` : ''}`;
    const wheelSVG = `<svg width="${SVG_SIZE}" height="${SVG_SIZE}" xmlns="http://www.w3.org/2000/svg" style="background:#0F1923; border-radius:50%;"><circle cx="${R}" cy="${R}" r="${RING_R}" fill="none" stroke="#1C2B38" stroke-width="28"/>${taskArcs}<circle cx="${R}" cy="${R}" r="${RING_R + 14}" fill="none" stroke="#2E7DBC" stroke-width="0.5" stroke-opacity="0.4"/><circle cx="${R}" cy="${R}" r="${RING_R - 14}" fill="none" stroke="#2E7DBC" stroke-width="0.5" stroke-opacity="0.4"/>${monthDividers}${monthLabels}${todayMarker}${centerText}${boundaryDots}${milestoneSVG}${startDot}${endDot}</svg>`;
    const taskRows = allTasks.map((task, i) => `<tr style="background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'}"><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0;"><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 12px; height: 12px; border-radius: 50%; background: ${task.color}; flex-shrink: 0;"></div><span style="font-weight: 600; color: #0d1b2a;">${task.name}${task.id === -1 ? ' <span style="background:#1a6fbf;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;">ACTIVE</span>' : ''}</span></div></td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #5a7a96;">${formatDate(new Date(task.startDate))}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #5a7a96;">${formatDate(new Date(task.endDate))}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: ${task.color};">${task.duration} ${task.unit}</td></tr>`).join('');
    const milestoneRows = milestonesRef.current.length > 0 ? `<h2 style="font-size: 14px; font-weight: 700; color: #5a7a96; letter-spacing: 2px; margin: 32px 0 12px 0; text-transform: uppercase;">Milestones</h2><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #1a6fbf;"><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">MILESTONE</th><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">DATE</th><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">DAY</th></tr></thead><tbody>${milestonesRef.current.map((m, i) => `<tr style="background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'}"><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0;"><span style="font-weight: 600; color: #0d1b2a;">◆ ${m.name}</span></td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #5a7a96;">${formatDate(new Date(m.date))}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #5a7a96;">${getDayName(new Date(m.date))}</td></tr>`).join('')}</tbody></table>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; color: #0d1b2a; padding: 40px; }</style></head><body><div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0;"><div><div style="font-size: 28px; font-weight: 800; letter-spacing: 2px; margin-bottom: 4px;"><span style="color: #0d1b2a;">DATE</span><span style="color: #1a6fbf;">WHEEL</span></div><div style="font-size: 13px; color: #5a7a96;">Project Timeline Report</div></div><div style="text-align: right;"><div style="font-size: 12px; color: #5a7a96;">Generated ${formatDate(new Date())}</div></div></div><div style="display: flex; gap: 32px; align-items: center; margin-bottom: 32px;"><div style="flex-shrink: 0;">${wheelSVG}</div><div style="flex: 1;"><div style="margin-bottom: 16px; background: #f0f7ff; border-radius: 12px; padding: 16px; border-left: 4px solid #1a6fbf;"><div style="font-size: 10px; font-weight: 700; color: #5a7a96; letter-spacing: 1.5px; margin-bottom: 6px;">TIMELINE START</div><div style="font-size: 16px; font-weight: 700; color: #0d1b2a;">${formatDate(timelineStart)}</div><div style="font-size: 12px; color: #5a7a96;">${getDayName(timelineStart)}</div></div><div style="margin-bottom: 16px; background: #f0f7ff; border-radius: 12px; padding: 16px; border-left: 4px solid #1a6fbf;"><div style="font-size: 10px; font-weight: 700; color: #5a7a96; letter-spacing: 1.5px; margin-bottom: 6px;">TIMELINE END</div><div style="font-size: 16px; font-weight: 700; color: #0d1b2a;">${formatDate(timelineEnd)}</div><div style="font-size: 12px; color: #5a7a96;">${getDayName(timelineEnd)}</div></div><div style="background: #f0f7ff; border-radius: 12px; padding: 16px; border-left: 4px solid #1a6fbf;"><div style="font-size: 10px; font-weight: 700; color: #5a7a96; letter-spacing: 1.5px; margin-bottom: 6px;">TOTAL DURATION</div><div style="font-size: 16px; font-weight: 700; color: #1a6fbf;">${totalDuration || duration} ${unit}</div><div style="font-size: 12px; color: #5a7a96;">${allTasks.length} tasks${milestonesRef.current.length > 0 ? ` · ${milestonesRef.current.length} milestones` : ''}</div></div></div></div><h2 style="font-size: 14px; font-weight: 700; color: #5a7a96; letter-spacing: 2px; margin-bottom: 12px; text-transform: uppercase;">Project Tasks</h2><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #1a6fbf;"><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">TASK</th><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">START</th><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">END</th><th style="padding: 10px 14px; text-align: left; color: white; font-size: 11px;">DURATION</th></tr></thead><tbody>${taskRows}</tbody></table>${milestoneRows}<div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;"><div style="font-size: 11px; color: #b0c8e0;">Created with Date Wheel</div><div style="font-size: 11px; color: #b0c8e0;">${formatDate(new Date())}</div></div></body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `DateWheel_${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')}.pdf`;
      const destPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: destPath });
      await Sharing.shareAsync(destPath, { mimeType: 'application/pdf', dialogTitle: 'Export Date Wheel Project as PDF', UTI: 'com.adobe.pdf' });
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
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={settings.darkMode ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleDate, { color: theme.text }]}>DATE</Text>
            <Text style={[styles.titleWheel, { color: theme.accent }]}>WHEEL</Text>
            <View style={styles.titleDot} />
          </View>
          <View style={styles.headerRight}>
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
            <TouchableOpacity style={styles.gearBtn} onPress={() => setSettingsVisible(true)}>
              <Text style={styles.gearIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Open / Save Banner */}
        <View style={styles.templateBanner}>
          <TouchableOpacity
            style={[styles.templateBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => requirePro(() => setOpenVisible(true))}
          >
            <Text style={styles.templateBtnIcon}>📂</Text>
            <Text style={[styles.templateBtnText, { color: theme.muted }]}>Open</Text>
            {!isPro && <Text style={styles.lockIcon}>🔒</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveTemplateBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setSaveVisible(true)}
          >
            <Text style={[styles.templateBtnText, { color: theme.accent }]}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.card, borderColor: theme.border, opacity: canUndo ? 1 : 0.4 }]}
            onPress={handleUndo}
            disabled={!canUndo}
          >
            <Text style={[styles.quickBtnText, { color: canUndo ? theme.accent : theme.muted }]}>↩ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleReset}
          >
            <Text style={[styles.quickBtnText, { color: theme.muted }]}>↺ Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline dates */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateField, { backgroundColor: theme.card }]}
            onPress={() => openPicker("start")}
          >
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>TIMELINE START</Text>
            <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(timelineStart)}</Text>
            <Text style={[styles.fieldDay, { color: theme.muted }]}>{getDayName(timelineStart)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateField, { backgroundColor: theme.card }]}
            onPress={() => openPicker("end")}
          >
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>TIMELINE END</Text>
            <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(timelineEnd)}</Text>
            <Text style={[styles.fieldDay, { color: theme.muted }]}>{getDayName(timelineEnd)}</Text>
          </TouchableOpacity>
        </View>

        {/* Lock toggle */}
        <View style={styles.lockRow}>
          <TouchableOpacity
            style={[styles.lockToggle, isLocked && styles.lockToggleActive]}
            onPress={() => {
              setIsLocked(!isLocked);
              if (settings.hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.lockToggleIcon}>{isLocked ? '🔒' : '🔓'}</Text>
            <Text style={[styles.lockToggleText, isLocked && { color: '#F0A500' }]}>
              {isLocked ? 'Timeline Locked — drag wheel to shift' : 'Lock Timeline'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* The Wheel */}
        <DateWheel
          startDate={startDate}
          endDate={endDate}
          duration={duration}
          unit={unit}
          tasks={tasks}
          milestones={milestones}
          totalDuration={totalDuration}
          holidayCountry={isPro ? settings.holidayCountry : "NONE"}
          highlightedTaskId={tappedTaskId}
          highlightedTaskDuration={highlightedTaskDuration}
          onUnitToggle={handleUnitToggle}
          onBoundaryDragStart={handleBoundaryDragStart}
          onBoundaryChange={handleBoundaryChange}
          onEndDragStart={handleEndDragStart}
          onDragEnd={handleDragEnd}
          onDragActive={handleDragActive}
          onTaskTap={handleTaskTap}
          isLocked={isLocked}
          onTimelineShift={handleTimelineShift}
          onDurationTap={() => {
            setDurationEditValue(duration);
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

        {/* Active task dates */}
        <View style={[styles.taskDateRow, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={styles.taskDateField} onPress={() => openPicker("start")}>
            <Text style={[styles.taskDateLabel, { color: theme.muted }]}>{activeTaskLabel.toUpperCase()} START</Text>
            <Text style={[styles.taskDateValue, { color: theme.text }]}>{formatDate(activeTaskStart)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.taskDateField, { borderLeftWidth: 0.5, borderLeftColor: theme.border }]}
            onPress={() => openPicker("end")}
          >
            <Text style={[styles.taskDateLabel, { color: theme.muted }]}>{activeTaskLabel.toUpperCase()} END</Text>
            <Text style={[styles.taskDateValue, { color: isDragging ? theme.accent : theme.text }]}>{formatDate(activeTaskEnd)}</Text>
          </TouchableOpacity>
        </View>

        {/* Add Task + Add Milestone row */}
        <View style={styles.addRow}>
          <TouchableOpacity
            style={[styles.addTaskBtn, { borderLeftColor: currentTaskColor }]}
            onPress={handleAddTask}
          >
            <View style={[styles.taskColorDot, { backgroundColor: currentTaskColor }]} />
            <Text style={styles.addTaskText}>+ Task</Text>
            <Text style={styles.addTaskSub}>
              {tasksRef.current.length === 0 ? `${duration} ${unit}` : isPro ? `${duration} ${unit}` : '🔒'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addMilestoneBtn}
            onPress={() => requirePro(() => {
            setMilestoneModalVisible(true);
          })}
          >
            <View style={styles.milestoneDiamond} />
            <Text style={styles.addMilestoneText}>{isPro ? '+ Milestone' : '🔒 Milestone'}</Text>
          </TouchableOpacity>
        </View>

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
              <View style={styles.templateInputWrapper}>
                <TextInput
                  style={styles.templateInput}
                  value={durationEditValue}
                  onChangeText={setDurationEditValue}
                  keyboardType="numeric"
                  autoFocus={true}
                  selectTextOnFocus={true}
                  maxLength={4}
                  placeholder="Enter duration..."
                  placeholderTextColor="#2A3F52"
                />
              </View>
              <Text style={{ textAlign: 'center', color: '#5A7A96', fontSize: 12, marginBottom: 12 }}>
                {unit} from {formatDate(startDate)}
              </Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleDurationConfirm}>
                <Text style={styles.confirmBtnText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelTemplateBtn} onPress={() => setDurationEditVisible(false)}>
                <Text style={styles.cancelTemplateBtnText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Save Modal */}
        <Modal visible={saveVisible} transparent={true} animationType="fade" onRequestClose={() => setSaveVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSaveVisible(false)}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>SAVE & EXPORT</Text>
              <View style={styles.templateInputWrapper}>
                <TextInput
                  style={styles.templateInput}
                  placeholder="Project name..."
                  placeholderTextColor="#2A3F52"
                  value={saveName}
                  onChangeText={setSaveName}
                  autoFocus={true}
                  maxLength={40}
                />
              </View>
              <TouchableOpacity style={styles.saveOptionBtn} onPress={handleSaveAsProject}>
                <Text style={styles.saveOptionIcon}>📁</Text>
                <View style={styles.saveOptionText}>
                  <Text style={styles.saveOptionTitle}>Save as Project</Text>
                  <Text style={styles.saveOptionSub}>Saves actual dates — open and continue later</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveOptionBtn} onPress={handleSaveAsTemplate}>
                <Text style={styles.saveOptionIcon}>📋</Text>
                <View style={styles.saveOptionText}>
                  <Text style={styles.saveOptionTitle}>Save as Template</Text>
                  <Text style={styles.saveOptionSub}>Saves structure only — reuse for new projects</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveOptionBtn} onPress={() => { setSaveVisible(false); handleExportCSV(); }}>
                <Text style={styles.saveOptionIcon}>📤</Text>
                <View style={styles.saveOptionText}>
                  <Text style={styles.saveOptionTitle}>Export as CSV</Text>
                  <Text style={styles.saveOptionSub}>Share with Excel, Sheets, MS Project & more</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveOptionBtn} onPress={() => { setSaveVisible(false); handleExportPDF(); }}>
                <Text style={styles.saveOptionIcon}>📄</Text>
                <View style={styles.saveOptionText}>
                  <Text style={styles.saveOptionTitle}>Export as PDF</Text>
                  <Text style={styles.saveOptionSub}>Professional report with task summary</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveOptionBtn, { marginBottom: 8 }]} onPress={() => { setSaveVisible(false); handleShareProject(); }}>
                <Text style={styles.saveOptionIcon}>🔗</Text>
                <View style={styles.saveOptionText}>
                  <Text style={styles.saveOptionTitle}>Share Project File</Text>
                  <Text style={styles.saveOptionSub}>Send to another Date Wheel user to import</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelTemplateBtn} onPress={() => { setSaveName(""); setSaveVisible(false); }}>
                <Text style={styles.cancelTemplateBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Project Timeline */}
        <View style={styles.taskSection}>
          <Text style={[styles.taskSectionTitle, { color: theme.muted }]}>PROJECT TIMELINE</Text>

          {tasks.map((task, i) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskItem, { backgroundColor: theme.card }]}
              onLongPress={() => deleteTask(task.id)}
            >
              <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
              <View style={styles.taskItemContent}>
                <TouchableOpacity onPress={() => handleRenameTask(task.id)}>
                  <Text style={[styles.taskItemName, { color: theme.text }]}>{task.name} <Text style={styles.editHint}>✎</Text></Text>
                </TouchableOpacity>
                <Text style={[styles.taskItemDates, { color: theme.muted }]}>
                  {formatDate(new Date(task.startDate))} → {formatDate(new Date(task.endDate))}
                </Text>
                <Text style={[styles.taskItemDuration, { color: task.color }]}>{task.duration} {task.unit}</Text>
              </View>
              <Text style={[styles.taskNum, { color: theme.muted }]}>#{i + 1}</Text>
            </TouchableOpacity>
          ))}

          {/* Active current task */}
          <TouchableOpacity
            style={[styles.taskItem, { backgroundColor: theme.card }]}
            onPress={handleRenameCurrentTask}
          >
            <View style={[styles.taskColorBar, { backgroundColor: currentTaskColor }]} />
            <View style={styles.taskItemContent}>
              <Text style={[styles.taskItemName, { color: theme.text }]}>{currentTaskName} <Text style={styles.editHint}>✎</Text></Text>
              <Text style={[styles.taskItemDates, { color: theme.muted }]}>{formatDate(startDate)} → {formatDate(endDate)}</Text>
              <Text style={[styles.taskItemDuration, { color: currentTaskColor }]}>{duration} {unit}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </TouchableOpacity>

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
                <Text style={[styles.milestoneTag, { color: milestone.color }]}>◆</Text>
              </TouchableOpacity>
            ))}

          <Text style={[styles.savesHint, { color: theme.border }]}>Tap name to rename · Hold to delete</Text>

          <TouchableOpacity
            style={[styles.ganttBtn, { borderColor: theme.border }]}
            onPress={() => requirePro(() => setGanttVisible(true))}
          >
            <Text style={styles.ganttBtnIcon}>📊</Text>
            <Text style={[styles.ganttBtnText, { color: theme.muted }]}>
              View Gantt Chart{!isPro ? ' 🔒' : ''}
            </Text>
          </TouchableOpacity>

          {!isPro && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => setProModalVisible(true)}
            >
              <Text style={styles.upgradeBtnText}>✨ Unlock Pro Features</Text>
              <Text style={styles.upgradeBtnSub}>Multi-task, Gantt, Templates & more</Text>
            </TouchableOpacity>
          )}
        </View>

        <DateTimePickerModal
          isVisible={pickerVisible}
          mode="date"
          date={pickingField === "start" ? activeTaskStart : activeTaskEnd}
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
          onConfirm={(d) => {
            if (editingMilestoneId !== null) {
              saveUndoSnapshot();
              const updated = milestonesRef.current.map(m =>
                m.id === editingMilestoneId ? { ...m, date: d.toISOString() } : m
              );
              setMilestonesSync(updated);
              AsyncStorage.setItem("milestones", JSON.stringify(updated));
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

      <SettingsModal visible={settingsVisible} settings={settings} onClose={() => setSettingsVisible(false)} onChange={saveSettings} />
      <TaskNameModal visible={taskNameVisible} taskNumber={tasks.length + 1} onConfirm={confirmAddTask} onCancel={() => setTaskNameVisible(false)} />
      <TaskNameModal
        visible={renameModalVisible}
        taskNumber={editingTaskId === null ? 0 : tasks.findIndex(t => t.id === editingTaskId) + 1}
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
      <ProModal
        visible={proModalVisible}
        onClose={() => setProModalVisible(false)}
        onSuccess={() => setProModalVisible(false)}
      />
      <MilestoneModal
        visible={milestoneModalVisible}
        defaultDate={endDateRef.current}
        onConfirm={confirmAddMilestone}
        onCancel={() => setMilestoneModalVisible(false)}
      />
      <TaskNameModal
        visible={renamingMilestone !== null}
        taskNumber={0}
        onConfirm={confirmRenameMilestone}
        onCancel={() => setRenamingMilestone(null)}
      />
    </SafeAreaView>
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
  lockIcon: { fontSize: 12, marginLeft: 4 },
  templateBanner: { flexDirection: "row", width: "100%", gap: 8, marginBottom: 8 },
  templateBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 0.5 },
  saveTemplateBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 0.5, flexDirection: "row", gap: 4 },
  templateBtnIcon: { fontSize: 14 },
  templateBtnText: { fontSize: 13, fontWeight: "500" },
  quickRow: { flexDirection: "row", gap: 10, width: "100%", marginBottom: 12 },
  quickBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  quickBtnText: { fontSize: 13, fontWeight: "500" },
  dateRow: { flexDirection: "row", width: "100%", gap: 10, marginBottom: 12 },
  dateField: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center" },
  fieldLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 1.5, marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: "600" },
  fieldDay: { fontSize: 11, marginTop: 2 },
  taskDateRow: { flexDirection: "row", width: "100%", borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  taskDateField: { flex: 1, padding: 10, alignItems: "center" },
  taskDateLabel: { fontSize: 9, fontWeight: "600", letterSpacing: 1, marginBottom: 2 },
  taskDateValue: { fontSize: 13, fontWeight: "600" },
  addRow: { flexDirection: "row", width: "100%", gap: 8, marginBottom: 8 },
  addTaskBtn: { flex: 2, backgroundColor: "#1C2B38", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", borderLeftWidth: 4 },
  taskColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  addTaskText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF", flex: 1 },
  addTaskSub: { fontSize: 13, color: "#5A7A96" },
  addMilestoneBtn: { flex: 1, backgroundColor: "#1C2B38", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderLeftWidth: 4, borderLeftColor: "#F0A500" },
  milestoneDiamond: { width: 10, height: 10, backgroundColor: "#F0A500", transform: [{ rotate: "45deg" }] },
  addMilestoneText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
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
  ganttBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginTop: 8 },
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
  lockRow: { width: '100%', alignItems: 'flex-start', marginBottom: 8, marginTop: -4 },
  lockToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2A3F52' },
  lockToggleActive: { borderColor: '#F0A500', backgroundColor: '#1A1500' },
  lockToggleIcon: { fontSize: 14 },
  lockToggleText: { fontSize: 11, color: '#5A7A96', fontWeight: '500' },
  confirmBtn: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#2E7DBC', borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
