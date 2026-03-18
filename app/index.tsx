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
import * as Haptics from "expo-haptics";
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
  const [tappedTaskId, setTappedTaskId] = useState<number | null>(null);
  const [dragDisplayDates, setDragDisplayDates] = useState<{
    start: Date;
    end: Date;
    label: string;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const tasksRef = useRef<Task[]>([]);
  const startDateRef = useRef<Date>(today);
  const endDateRef = useRef<Date>(future);
  const taskSnapshotRef = useRef<Task[]>([]);
  const activeStartSnapshotRef = useRef<string>("");
  const activeEndSnapshotRef = useRef<string>("");
  const milestonesRef = useRef<Milestone[]>([]);
  const currentTaskNameRef = useRef<string>("Current Task");

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

  useEffect(() => {
    loadSettings();
    loadTasks();
    loadMilestones();
  }, []);

  // Push current state onto undo stack before any destructive action
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
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const [last, ...rest] = undoStack;
    setUndoStack(rest);

    // Restore all state
    const restoredTasks = last.tasks;
    const restoredMilestones = last.milestones;
    const restoredStart = new Date(last.startDate);
    const restoredEnd = new Date(last.endDate);
    const restoredName = last.currentTaskName;

    setTasksSync(restoredTasks);
    setMilestonesSync(restoredMilestones);
    setStartDateSync(restoredStart);
    setEndDateSync(restoredEnd);
    setCurrentTaskName(restoredName);
    currentTaskNameRef.current = restoredName;

    AsyncStorage.setItem("tasks", JSON.stringify(restoredTasks));
    AsyncStorage.setItem("milestones", JSON.stringify(restoredMilestones));
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
      setTappedTaskId(null);
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
    setTappedTaskId(null);
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
    Alert.alert("Delete Milestone", "Remove this milestone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          saveUndoSnapshot();
          const updated = milestonesRef.current.filter(m => m.id !== id);
          setMilestonesSync(updated);
          await AsyncStorage.setItem("milestones", JSON.stringify(updated));
        },
      },
    ]);
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
    if (pickingField === "start") {
      setStartDateSync(date);
    } else {
      setEndDateSync(date);
    }
    setPickerVisible(false);
  }

  function handleUnitToggle() {
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
            onPress={() => requirePro(() => setSaveVisible(true))}
          >
            <Text style={[styles.templateBtnText, { color: theme.accent }]}>Save</Text>
            {!isPro && <Text style={styles.lockIconSmall}>🔒</Text>}
          </TouchableOpacity>
        </View>

        {/* Quick Actions — Undo replaces Start Today */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, {
              backgroundColor: theme.card,
              borderColor: canUndo ? theme.accent : theme.border,
              opacity: canUndo ? 1 : 0.4,
            }]}
            onPress={handleUndo}
            disabled={!canUndo}
          >
            <Text style={[styles.quickBtnText, { color: canUndo ? theme.accent : theme.muted }]}>
              ↩ Undo
            </Text>
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
            style={[styles.dateField, { backgroundColor: theme.cardHighlight, borderWidth: 1, borderColor: theme.accent }]}
            onPress={() => openPicker("end")}
          >
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>TIMELINE END</Text>
            <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(timelineEnd)}</Text>
            <Text style={[styles.fieldDay, { color: theme.muted }]}>{getDayName(timelineEnd)}</Text>
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
          onUnitToggle={handleUnitToggle}
          onBoundaryDragStart={handleBoundaryDragStart}
          onBoundaryChange={handleBoundaryChange}
          onEndDragStart={handleEndDragStart}
          onDragEnd={handleDragEnd}
          onDragActive={handleDragActive}
          onTaskTap={handleTaskTap}
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
          <View style={styles.taskDateField}>
            <Text style={[styles.taskDateLabel, { color: theme.muted }]}>
              {activeTaskLabel.toUpperCase()} START
            </Text>
            <Text style={[styles.taskDateValue, { color: theme.text }]}>{formatDate(activeTaskStart)}</Text>
          </View>
          <View style={[styles.taskDateField, { borderLeftWidth: 0.5, borderLeftColor: theme.border }]}>
            <Text style={[styles.taskDateLabel, { color: theme.muted }]}>
              {activeTaskLabel.toUpperCase()} END
            </Text>
            <Text style={[styles.taskDateValue, { color: isDragging ? theme.accent : theme.text }]}>{formatDate(activeTaskEnd)}</Text>
          </View>
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
            onPress={() => requirePro(() => setMilestoneModalVisible(true))}
          >
            <View style={styles.milestoneDiamond} />
            <Text style={styles.addMilestoneText}>
              {isPro ? '+ Milestone' : '🔒 Milestone'}
            </Text>
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
                  onPress={() => { setUnit(u); setUnitIndex(UNITS.indexOf(u)); setUnitModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, unit === u && styles.modalOptionTextActive]}>{u}</Text>
                  {unit === u && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Save Modal */}
        <Modal visible={saveVisible} transparent={true} animationType="fade" onRequestClose={() => setSaveVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSaveVisible(false)}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>SAVE</Text>
              <View style={styles.templateInputWrapper}>
                <TextInput
                  style={styles.templateInput}
                  placeholder="Name..."
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
              <TouchableOpacity style={[styles.saveOptionBtn, { marginBottom: 8 }]} onPress={handleSaveAsTemplate}>
                <Text style={styles.saveOptionIcon}>📋</Text>
                <View style={styles.saveOptionText}>
                  <Text style={styles.saveOptionTitle}>Save as Template</Text>
                  <Text style={styles.saveOptionSub}>Saves structure only — reuse for new projects</Text>
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
                onLongPress={() => deleteMilestone(milestone.id)}
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
          date={pickingField === "start" ? startDate : endDate}
          onConfirm={handleConfirm}
          onCancel={() => setPickerVisible(false)}
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
        onConfirm={confirmAddMilestone}
        onCancel={() => setMilestoneModalVisible(false)}
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
  lockIconSmall: { fontSize: 10, marginLeft: 2 },
  templateBanner: { flexDirection: "row", width: "100%", gap: 8, marginBottom: 8 },
  templateBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 0.5 },
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
});