import DateWheel, { Task, TASK_COLORS } from "@/components/datewheel";
import GanttChart from "@/components/GanttChart";
import { businessDaysWithHolidays } from "@/components/holidays";
import SettingsModal, { AppSettings } from "@/components/SettingsModal";
import TaskNameModal from "@/components/TaskNameModal";
import TemplatesModal, { saveTemplate, Template } from "@/components/TemplatesModal";
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

// --- Date Math Helpers ---
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDayName(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

const UNITS = ["Days", "Weeks", "Months", "Business Days"];

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  hapticsEnabled: true,
  holidayCountry: "NONE",
};

function calcDuration(
  start: Date,
  end: Date,
  unit: string,
  holidayCountry: string
) {
  if (end <= start) return "0";
  switch (unit) {
    case "Days": return String(daysBetween(start, end));
    case "Weeks": return String(weeksBetween(start, end));
    case "Months": return String(monthsBetween(start, end));
    case "Business Days": return String(businessDaysWithHolidays(start, end, holidayCountry));
    default: return "0";
  }
}

function calcTotalDuration(
  tasks: Task[],
  currentEnd: Date,
  unit: string,
  holidayCountry: string
): string {
  if (tasks.length === 0) return "";
  const firstStart = new Date(tasks[0].startDate);
  return calcDuration(firstStart, currentEnd, unit, holidayCountry);
}

// --- Main Screen ---
export default function Index() {
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
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [saveTemplateVisible, setSaveTemplateVisible] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTaskName, setCurrentTaskName] = useState("Current Task");
  const [ganttVisible, setGanttVisible] = useState(false);

  // Snapshot of tasks at drag start — prevents compounding
  const taskSnapshotRef = useRef<Task[]>([]);
  const activeStartSnapshotRef = useRef<string>("");
  const activeEndSnapshotRef = useRef<string>("");

  const duration = calcDuration(startDate, endDate, unit, settings.holidayCountry);
  const totalDuration = calcTotalDuration(tasks, endDate, unit, settings.holidayCountry);
  const theme = settings.darkMode ? darkTheme : lightTheme;
  const currentTaskColor = TASK_COLORS[tasks.length % TASK_COLORS.length];

  useEffect(() => {
    loadSettings();
    loadTasks();
  }, []);

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
        // Only load if it's a valid non-empty array
        if (Array.isArray(parsed)) {
          setTasks(parsed);
        }
      }
    } catch (e) {
      // If anything goes wrong, start fresh
      setTasks([]);
    }
  }

  async function saveTasks(newTasks: Task[]) {
    setTasks(newTasks);
    await AsyncStorage.setItem("tasks", JSON.stringify(newTasks));
  }

  // Called once when drag starts — snapshot current state
  function handleBoundaryDragStart(taskIndex: number) {
    taskSnapshotRef.current = tasks.map(t => ({ ...t }));
    activeStartSnapshotRef.current = startDate.toISOString();
    activeEndSnapshotRef.current = endDate.toISOString();
  }

  // Called on every drag frame — always calculates from snapshot
  async function handleBoundaryChange(taskIndex: number, newDate: Date) {
    const snapshot = taskSnapshotRef.current;
    if (!snapshot || snapshot.length === 0) return;

    const originalBoundaryDate = new Date(snapshot[taskIndex].endDate);
    const shiftMs = newDate.getTime() - originalBoundaryDate.getTime();
    const shiftDays = Math.round(shiftMs / (1000 * 60 * 60 * 24));
    if (shiftDays === 0) return;

    // Always rebuild from the SNAPSHOT, never from current state
    const updated = snapshot.map((task, i) => {
      if (i === taskIndex) {
        const newEnd = new Date(originalBoundaryDate);
        newEnd.setDate(newEnd.getDate() + shiftDays);
        return {
          ...task,
          endDate: newEnd.toISOString(),
          duration: String(daysBetween(new Date(task.startDate), newEnd)),
        };
      } else if (i > taskIndex) {
        const newStart = new Date(task.startDate);
        const newEnd = new Date(task.endDate);
        newStart.setDate(newStart.getDate() + shiftDays);
        newEnd.setDate(newEnd.getDate() + shiftDays);
        return {
          ...task,
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        };
      }
      return { ...task };
    });

    setTasks(updated);
    await AsyncStorage.setItem("tasks", JSON.stringify(updated));

    // Shift active task dates from snapshot too
    const snapActiveStart = new Date(activeStartSnapshotRef.current);
    const snapActiveEnd = new Date(activeEndSnapshotRef.current);
    snapActiveStart.setDate(snapActiveStart.getDate() + shiftDays);
    snapActiveEnd.setDate(snapActiveEnd.getDate() + shiftDays);
    setStartDate(snapActiveStart);
    setEndDate(snapActiveEnd);
  }

  async function shiftTasksToNewStart(newStart: Date) {
    if (tasks.length === 0) {
      setStartDate(newStart);
      return;
    }
    const firstTaskStart = new Date(tasks[0].startDate);
    const shiftMs = newStart.getTime() - firstTaskStart.getTime();
    const shiftDays = Math.round(shiftMs / (1000 * 60 * 60 * 24));
    if (shiftDays === 0) return;
    const shiftedTasks = tasks.map((task) => {
      const newTaskStart = new Date(task.startDate);
      const newTaskEnd = new Date(task.endDate);
      newTaskStart.setDate(newTaskStart.getDate() + shiftDays);
      newTaskEnd.setDate(newTaskEnd.getDate() + shiftDays);
      return {
        ...task,
        startDate: newTaskStart.toISOString(),
        endDate: newTaskEnd.toISOString(),
      };
    });
    await saveTasks(shiftedTasks);
    const newActiveStart = new Date(startDate);
    const newActiveEnd = new Date(endDate);
    newActiveStart.setDate(newActiveStart.getDate() + shiftDays);
    newActiveEnd.setDate(newActiveEnd.getDate() + shiftDays);
    setStartDate(newActiveStart);
    setEndDate(newActiveEnd);
  }

  function handleAddTask() {
    setTaskNameVisible(true);
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
    } else {
      const updated = tasks.map((t) =>
        t.id === editingTaskId ? { ...t, name } : t
      );
      await saveTasks(updated);
    }
    setEditingTaskId(null);
    setRenameModalVisible(false);
  }

  async function confirmAddTask(name: string) {
    if (settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const newTask: Task = {
      id: Date.now(),
      name: currentTaskName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      color: TASK_COLORS[tasks.length % TASK_COLORS.length],
      duration,
      unit,
    };
    const updated = [...tasks, newTask];
    await saveTasks(updated);
    setCurrentTaskName(name);
    const nextEnd = new Date(endDate);
    nextEnd.setDate(nextEnd.getDate() + 30);
    setStartDate(endDate);
    setEndDate(nextEnd);
    setTaskNameVisible(false);
  }

  async function deleteTask(id: number) {
    Alert.alert("Delete Task", "Remove this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = tasks.filter((t) => t.id !== id);
          await saveTasks(updated);
        },
      },
    ]);
  }

  function handleReset() {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert("Reset", "Clear all tasks and reset dates?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          const fresh = new Date();
          const future = new Date();
          future.setDate(fresh.getDate() + 30);
          setStartDate(fresh);
          setEndDate(future);
          setUnit("Days");
          setUnitIndex(0);
          setCurrentTaskName("Current Task");
          await saveTasks([]);
        },
      },
    ]);
  }

  function handleStartToday() {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    shiftTasksToNewStart(new Date());
  }

  function openPicker(field: string) {
    setPickingField(field);
    setPickerVisible(true);
  }

  function handleConfirm(date: Date) {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (pickingField === "start") {
      if (tasks.length > 0) {
        shiftTasksToNewStart(date);
      } else {
        setStartDate(date);
      }
    } else {
      setEndDate(date);
    }
    setPickerVisible(false);
  }

  function handleUnitToggle() {
    setUnitModalVisible(true);
  }

  async function handleSaveTemplate() {
    const name = templateName.trim() || `Template ${new Date().toLocaleDateString()}`;
    await saveTemplate(name, tasks, currentTaskName, unit);
    setTemplateName("");
    setSaveTemplateVisible(false);
    if (settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Saved!", `"${name}" has been saved as a template.`);
  }

  function handleLoadTemplate(template: Template) {
    const today = new Date();
    const daysBetweenDates = (s: string, e: string) => {
      const diff = new Date(e).getTime() - new Date(s).getTime();
      return Math.round(diff / (1000 * 60 * 60 * 24));
    };
    let currentStart = new Date(today);
    const rebuiltTasks: Task[] = template.tasks.map((task) => {
      const span = daysBetweenDates(task.startDate, task.endDate);
      const newStart = new Date(currentStart);
      const newEnd = new Date(currentStart);
      newEnd.setDate(newEnd.getDate() + span);
      currentStart = new Date(newEnd);
      return {
        ...task,
        id: Date.now() + Math.random(),
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
      };
    });
    saveTasks(rebuiltTasks);
    setStartDate(currentStart);
    const newEnd = new Date(currentStart);
    newEnd.setDate(newEnd.getDate() + 30);
    setEndDate(newEnd);
    setCurrentTaskName(template.currentTaskName);
    setUnit(template.unit);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={settings.darkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.bg}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleDate, { color: theme.text }]}>DATE</Text>
            <Text style={[styles.titleWheel, { color: theme.accent }]}>WHEEL</Text>
            <View style={styles.titleDot} />
          </View>
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={() => setSettingsVisible(true)}
          >
            <Text style={styles.gearIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Templates Banner */}
        <View style={styles.templateBanner}>
          <TouchableOpacity
            style={[styles.templateBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setTemplatesVisible(true)}
          >
            <Text style={styles.templateBtnIcon}>📋</Text>
            <Text style={[styles.templateBtnText, { color: theme.muted }]}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveTemplateBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setSaveTemplateVisible(true)}
          >
            <Text style={[styles.templateBtnText, { color: theme.accent }]}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleStartToday}
          >
            <Text style={[styles.quickBtnText, { color: theme.accent }]}>
              Start → Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleReset}
          >
            <Text style={[styles.quickBtnText, { color: theme.muted }]}>
              ↺ Reset
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
          totalDuration={totalDuration}
          holidayCountry={settings.holidayCountry}
          onUnitToggle={handleUnitToggle}
          onBoundaryDragStart={handleBoundaryDragStart}
          onBoundaryChange={handleBoundaryChange}
          onEndDateChange={(date) => {
            if (settings.hapticsEnabled)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEndDate(date);
          }}
          onStartDateChange={(date) => {
            if (settings.hapticsEnabled)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (tasks.length > 0) {
              shiftTasksToNewStart(date);
            } else {
              setStartDate(date);
            }
          }}
        />

        {/* Unit Selector Modal */}
        <Modal
          visible={unitModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setUnitModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setUnitModalVisible(false)}
          >
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
                  }}
                >
                  <Text style={[styles.modalOptionText, unit === u && styles.modalOptionTextActive]}>
                    {u}
                  </Text>
                  {unit === u && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Save Template Modal */}
        <Modal
          visible={saveTemplateVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSaveTemplateVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSaveTemplateVisible(false)}
          >
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>SAVE TEMPLATE</Text>
              <View style={styles.templateInputWrapper}>
                <TextInput
                  style={styles.templateInput}
                  placeholder="Template name..."
                  placeholderTextColor="#2A3F52"
                  value={templateName}
                  onChangeText={setTemplateName}
                  autoFocus={true}
                  maxLength={40}
                />
              </View>
              <TouchableOpacity
                style={styles.saveTemplateBtnConfirm}
                onPress={handleSaveTemplate}
              >
                <Text style={styles.saveTemplateBtnText}>Save Template</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelTemplateBtn}
                onPress={() => {
                  setTemplateName("");
                  setSaveTemplateVisible(false);
                }}
              >
                <Text style={styles.cancelTemplateBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Date Fields */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateField, { backgroundColor: theme.card }]}
            onPress={() => openPicker("start")}
          >
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>START</Text>
            <Text style={[styles.fieldValue, { color: theme.text }]}>
              {formatDate(startDate)}
            </Text>
            <Text style={[styles.fieldDay, { color: theme.muted }]}>
              {getDayName(startDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateField, {
              backgroundColor: theme.cardHighlight,
              borderWidth: 1,
              borderColor: theme.accent,
            }]}
            onPress={() => openPicker("end")}
          >
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>END</Text>
            <Text style={[styles.fieldValue, { color: theme.text }]}>
              {formatDate(endDate)}
            </Text>
            <Text style={[styles.fieldDay, { color: theme.muted }]}>
              {getDayName(endDate)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Current Task Button */}
        <TouchableOpacity
          style={[styles.currentTaskBtn, {
            borderLeftColor: currentTaskColor,
            backgroundColor: theme.card,
          }]}
          onPress={handleRenameCurrentTask}
        >
          <View style={[styles.taskColorDot, { backgroundColor: currentTaskColor }]} />
          <Text style={[styles.currentTaskText, { color: theme.text }]} numberOfLines={1}>
            {currentTaskName}
          </Text>
          <Text style={styles.editHint}>✎</Text>
        </TouchableOpacity>

        {/* Add New Task Button */}
        <TouchableOpacity
          style={[styles.addTaskBtn, { borderLeftColor: currentTaskColor }]}
          onPress={handleAddTask}
        >
          <View style={[styles.taskColorDot, { backgroundColor: currentTaskColor }]} />
          <Text style={styles.addTaskText}>+ Add New Task</Text>
          <Text style={styles.addTaskSub}>{duration} {unit}</Text>
        </TouchableOpacity>

        {/* Project Timeline */}
        <View style={styles.taskSection}>
          <Text style={[styles.taskSectionTitle, { color: theme.muted }]}>
            PROJECT TIMELINE
          </Text>

          {tasks.map((task, i) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskItem, { backgroundColor: theme.card }]}
              onLongPress={() => deleteTask(task.id)}
            >
              <View style={[styles.taskColorBar, { backgroundColor: task.color }]} />
              <View style={styles.taskItemContent}>
                <TouchableOpacity onPress={() => handleRenameTask(task.id)}>
                  <Text style={[styles.taskItemName, { color: theme.text }]}>
                    {task.name} <Text style={styles.editHint}>✎</Text>
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.taskItemDates, { color: theme.muted }]}>
                  {formatDate(new Date(task.startDate))} → {formatDate(new Date(task.endDate))}
                </Text>
                <Text style={[styles.taskItemDuration, { color: task.color }]}>
                  {task.duration} {task.unit}
                </Text>
              </View>
              <Text style={[styles.taskNum, { color: theme.muted }]}>
                #{i + 1}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Active current task */}
          <TouchableOpacity
            style={[styles.taskItem, { backgroundColor: theme.card }]}
            onPress={handleRenameCurrentTask}
          >
            <View style={[styles.taskColorBar, { backgroundColor: currentTaskColor }]} />
            <View style={styles.taskItemContent}>
              <Text style={[styles.taskItemName, { color: theme.text }]}>
                {currentTaskName} <Text style={styles.editHint}>✎</Text>
              </Text>
              <Text style={[styles.taskItemDates, { color: theme.muted }]}>
                {formatDate(startDate)} → {formatDate(endDate)}
              </Text>
              <Text style={[styles.taskItemDuration, { color: currentTaskColor }]}>
                {duration} {unit}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.savesHint, { color: theme.border }]}>
            Tap name to rename · Hold to delete
          </Text>

          {/* Gantt Chart Button */}
          <TouchableOpacity
            style={[styles.ganttBtn, { borderColor: theme.border }]}
            onPress={() => setGanttVisible(true)}
          >
            <Text style={styles.ganttBtnIcon}>📊</Text>
            <Text style={[styles.ganttBtnText, { color: theme.muted }]}>
              View Gantt Chart
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        <DateTimePickerModal
          isVisible={pickerVisible}
          mode="date"
          date={pickingField === "start" ? startDate : endDate}
          onConfirm={handleConfirm}
          onCancel={() => setPickerVisible(false)}
        />

      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        settings={settings}
        onClose={() => setSettingsVisible(false)}
        onChange={saveSettings}
      />

      {/* Task Name Modal */}
      <TaskNameModal
        visible={taskNameVisible}
        taskNumber={tasks.length + 1}
        onConfirm={confirmAddTask}
        onCancel={() => setTaskNameVisible(false)}
      />

      {/* Rename Modal */}
      <TaskNameModal
        visible={renameModalVisible}
        taskNumber={editingTaskId === null ? 0 : tasks.findIndex(t => t.id === editingTaskId) + 1}
        onConfirm={confirmRename}
        onCancel={() => {
          setEditingTaskId(null);
          setRenameModalVisible(false);
        }}
      />

      {/* Templates Modal */}
      <TemplatesModal
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
        onLoad={handleLoadTemplate}
      />
      {/* Gantt Chart */}
      <GanttChart
        visible={ganttVisible}
        onClose={() => setGanttVisible(false)}
        tasks={tasks}
        currentTaskName={currentTaskName}
        startDate={startDate}
        endDate={endDate}
        duration={duration}
        unit={unit}
        currentTaskColor={currentTaskColor}
      />
    </SafeAreaView>
  );
}

// --- Themes ---
const darkTheme = {
  bg: "#0F1923",
  card: "#1C2B38",
  cardHighlight: "#1A3A5C",
  text: "#FFFFFF",
  muted: "#5A7A96",
  accent: "#2E9BFF",
  border: "#2A3F52",
};

const lightTheme = {
  bg: "#F0F4F8",
  card: "#FFFFFF",
  cardHighlight: "#E8F4FF",
  text: "#1A2A3A",
  muted: "#7A95A8",
  accent: "#1A6FBF",
  border: "#D0DDE8",
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  container: {
    alignItems: "center",
    padding: 16,
    paddingBottom: 60,
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleDate: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 3,
  },
  titleWheel: {
    fontSize: 24,
    fontWeight: "300",
    letterSpacing: 3,
  },
  titleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2E9BFF",
    marginLeft: 2,
    marginBottom: 2,
  },
  gearBtn: { padding: 8 },
  gearIcon: { fontSize: 24, color: "#5A7A96" },
  templateBanner: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
    marginBottom: 8,
  },
  templateBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  saveTemplateBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  templateBtnIcon: { fontSize: 14 },
  templateBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 12,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  dateRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginBottom: 12,
  },
  dateField: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  fieldDay: {
    fontSize: 11,
    marginTop: 2,
  },
  currentTaskBtn: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  currentTaskText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  editHint: {
    fontSize: 14,
    color: "#5A7A96",
  },
  addTaskBtn: {
    width: "100%",
    backgroundColor: "#1C2B38",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  taskColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  addTaskText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  addTaskSub: {
    fontSize: 13,
    color: "#5A7A96",
  },
  taskSection: {
    width: "100%",
    marginTop: 16,
  },
  taskSectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  taskItem: {
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  taskColorBar: {
    width: 4,
    alignSelf: "stretch",
  },
  taskItemContent: {
    flex: 1,
    padding: 12,
  },
  taskItemName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  taskItemDates: {
    fontSize: 11,
    marginBottom: 2,
  },
  taskItemDuration: {
    fontSize: 12,
    fontWeight: "600",
  },
  taskNum: {
    fontSize: 12,
    paddingRight: 12,
  },
  activeBadge: {
    backgroundColor: "#1A3A5C",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
    borderWidth: 0.5,
    borderColor: "#2E7DBC",
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#2E9BFF",
    letterSpacing: 1,
  },
  savesHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: {
    width: "80%",
    backgroundColor: "#1C2B38",
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: "#2E7DBC",
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
    textAlign: "center",
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A3F52",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A3F52",
  },
  modalOptionActive: { backgroundColor: "#1A3A5C" },
  modalOptionText: {
    fontSize: 17,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  modalOptionTextActive: {
    color: "#2E9BFF",
    fontWeight: "600",
  },
  modalCheck: {
    fontSize: 17,
    color: "#2E9BFF",
    fontWeight: "600",
  },
  templateInputWrapper: { padding: 12 },
  templateInput: {
    backgroundColor: "#0F1923",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2E7DBC",
  },
  saveTemplateBtnConfirm: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#2E7DBC",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  saveTemplateBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cancelTemplateBtn: {
    marginHorizontal: 12,
    marginBottom: 16,
    padding: 14,
    alignItems: "center",
  },
  cancelTemplateBtnText: {
    fontSize: 14,
    color: "#5A7A96",
  },
  ganttBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  ganttBtnIcon: {
    fontSize: 16,
  },
  ganttBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
});