import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Task } from "./datewheel";

const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: -1,
    name: "🏗️ Home Construction",
    currentTaskName: "Closeout & Punch List",
    unit: "Days",
    createdAt: "",
    tasks: [
      { id: 1, name: "Planning & Permits", startDate: "2024-01-01", endDate: "2024-02-15", color: "#2E9BFF", duration: "45", unit: "Days" },
      { id: 2, name: "Site Prep & Foundation", startDate: "2024-02-15", endDate: "2024-03-15", color: "#1DB8A0", duration: "28", unit: "Days" },
      { id: 3, name: "Framing & Roofing", startDate: "2024-03-15", endDate: "2024-05-01", color: "#8B5CF6", duration: "47", unit: "Days" },
      { id: 4, name: "Mechanical, Electrical & Plumbing", startDate: "2024-05-01", endDate: "2024-06-15", color: "#F97316", duration: "45", unit: "Days" },
      { id: 5, name: "Insulation & Drywall", startDate: "2024-06-15", endDate: "2024-07-15", color: "#EC4899", duration: "30", unit: "Days" },
      { id: 6, name: "Flooring, Cabinets & Fixtures", startDate: "2024-07-15", endDate: "2024-09-01", color: "#84CC16", duration: "47", unit: "Days" },
      { id: 7, name: "Paint & Interior Finish", startDate: "2024-09-01", endDate: "2024-10-01", color: "#2E9BFF", duration: "30", unit: "Days" },
    ],
  },
  {
    id: -2,
    name: "💻 Software Development",
    currentTaskName: "Launch & Monitoring",
    unit: "Days",
    createdAt: "",
    tasks: [
      { id: 1, name: "Discovery & Requirements", startDate: "2024-01-01", endDate: "2024-01-15", color: "#2E9BFF", duration: "14", unit: "Days" },
      { id: 2, name: "UI/UX Design", startDate: "2024-01-15", endDate: "2024-02-01", color: "#1DB8A0", duration: "17", unit: "Days" },
      { id: 3, name: "Backend Development", startDate: "2024-02-01", endDate: "2024-03-15", color: "#8B5CF6", duration: "43", unit: "Days" },
      { id: 4, name: "Frontend Development", startDate: "2024-03-01", endDate: "2024-04-15", color: "#F97316", duration: "45", unit: "Days" },
      { id: 5, name: "QA & Testing", startDate: "2024-04-15", endDate: "2024-05-01", color: "#EC4899", duration: "16", unit: "Days" },
      { id: 6, name: "Staging & Review", startDate: "2024-05-01", endDate: "2024-05-15", color: "#84CC16", duration: "14", unit: "Days" },
    ],
  },
  {
    id: -3,
    name: "📣 Marketing Campaign",
    currentTaskName: "Campaign Live",
    unit: "Days",
    createdAt: "",
    tasks: [
      { id: 1, name: "Strategy & Brief", startDate: "2024-01-01", endDate: "2024-01-14", color: "#2E9BFF", duration: "13", unit: "Days" },
      { id: 2, name: "Creative Development", startDate: "2024-01-14", endDate: "2024-02-04", color: "#1DB8A0", duration: "21", unit: "Days" },
      { id: 3, name: "Content Production", startDate: "2024-02-04", endDate: "2024-02-25", color: "#8B5CF6", duration: "21", unit: "Days" },
      { id: 4, name: "Review & Approvals", startDate: "2024-02-25", endDate: "2024-03-07", color: "#F97316", duration: "10", unit: "Days" },
      { id: 5, name: "Media Planning & Buying", startDate: "2024-03-07", endDate: "2024-03-21", color: "#EC4899", duration: "14", unit: "Days" },
    ],
  },
  {
    id: -4,
    name: "🎉 Event Planning",
    currentTaskName: "Event Day",
    unit: "Days",
    createdAt: "",
    tasks: [
      { id: 1, name: "Concept & Budget", startDate: "2024-01-01", endDate: "2024-01-21", color: "#2E9BFF", duration: "20", unit: "Days" },
      { id: 2, name: "Venue & Vendor Booking", startDate: "2024-01-21", endDate: "2024-02-21", color: "#1DB8A0", duration: "31", unit: "Days" },
      { id: 3, name: "Invitations & Marketing", startDate: "2024-02-21", endDate: "2024-03-14", color: "#8B5CF6", duration: "21", unit: "Days" },
      { id: 4, name: "Logistics & Run of Show", startDate: "2024-03-14", endDate: "2024-03-28", color: "#F97316", duration: "14", unit: "Days" },
      { id: 5, name: "Final Confirmations", startDate: "2024-03-28", endDate: "2024-04-04", color: "#EC4899", duration: "7", unit: "Days" },
    ],
  },
  {
    id: -5,
    name: "🏭 Manufacturing Run",
    currentTaskName: "Shipping & Delivery",
    unit: "Days",
    createdAt: "",
    tasks: [
      { id: 1, name: "Design & Engineering", startDate: "2024-01-01", endDate: "2024-02-01", color: "#2E9BFF", duration: "31", unit: "Days" },
      { id: 2, name: "Material Procurement", startDate: "2024-02-01", endDate: "2024-03-01", color: "#1DB8A0", duration: "28", unit: "Days" },
      { id: 3, name: "Prototype & Testing", startDate: "2024-03-01", endDate: "2024-03-22", color: "#8B5CF6", duration: "21", unit: "Days" },
      { id: 4, name: "Production Run", startDate: "2024-03-22", endDate: "2024-05-01", color: "#F97316", duration: "40", unit: "Days" },
      { id: 5, name: "Quality Control", startDate: "2024-05-01", endDate: "2024-05-15", color: "#EC4899", duration: "14", unit: "Days" },
    ],
  },
];
export interface Template {
  id: number;
  name: string;
  tasks: Task[];
  currentTaskName: string;
  unit: string;
  createdAt: string;
}

export interface Project {
  id: number;
  name: string;
  tasks: Task[];
  currentTaskName: string;
  unit: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onLoadTemplate: (template: Template) => void;
  onLoadProject: (project: Project) => void;
}

export async function saveTemplate(
  name: string,
  tasks: Task[],
  currentTaskName: string,
  unit: string
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem("templates");
    const existing: Template[] = stored ? JSON.parse(stored) : [];
    const newTemplate: Template = {
      id: Date.now(),
      name,
      tasks,
      currentTaskName,
      unit,
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      }),
    };
    await AsyncStorage.setItem("templates", JSON.stringify([newTemplate, ...existing]));
  } catch (e) {}
}

export async function saveProject(
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

export default function TemplatesModal({ visible, onClose, onLoadTemplate, onLoadProject }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'templates'>('projects');

  async function loadAll() {
    try {
      const storedTemplates = await AsyncStorage.getItem("templates");
      const storedProjects = await AsyncStorage.getItem("projects");
      setTemplates(storedTemplates ? JSON.parse(storedTemplates) : []);
      setProjects(storedProjects ? JSON.parse(storedProjects) : []);
    } catch (e) {
      setTemplates([]);
      setProjects([]);
    }
    setLoaded(true);
  }

  async function deleteTemplate(id: number) {
    Alert.alert("Delete Template", "Remove this template?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const updated = templates.filter(t => t.id !== id);
          setTemplates(updated);
          await AsyncStorage.setItem("templates", JSON.stringify(updated));
        },
      },
    ]);
  }

  async function deleteProject(id: number) {
    Alert.alert("Delete Project", "Remove this project?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const updated = projects.filter(p => p.id !== id);
          setProjects(updated);
          await AsyncStorage.setItem("projects", JSON.stringify(updated));
        },
      },
    ]);
  }

  function handleLoadTemplate(template: Template) {
    Alert.alert(
      "Load Template",
      `Start a new project from "${template.name}"? This will clear your current tasks.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load", onPress: () => { onLoadTemplate(template); onClose(); } },
      ]
    );
  }

  function handleLoadProject(project: Project) {
    Alert.alert(
      "Open Project",
      `Open "${project.name}"? This will replace your current work.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open", onPress: () => { onLoadProject(project); onClose(); } },
      ]
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      onShow={loadAll}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>OPEN PROJECT</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'projects' && styles.tabActive]}
              onPress={() => setActiveTab('projects')}
            >
              <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>
                Projects
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'templates' && styles.tabActive]}
              onPress={() => setActiveTab('templates')}
            >
              <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>
                Templates
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <>
                {loaded && projects.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📁</Text>
                    <Text style={styles.emptyTitle}>No saved projects</Text>
                    <Text style={styles.emptySub}>
                      Tap Save → Save as Project to save your current work with actual dates.
                    </Text>
                  </View>
                )}
                {projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.item}
                    onPress={() => handleLoadProject(project)}
                    onLongPress={() => deleteProject(project.id)}
                  >
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemName}>{project.name}</Text>
                      <Text style={styles.itemMeta}>
                        {project.tasks.length + 1} tasks · {project.unit}
                      </Text>
                      <Text style={styles.itemDates}>
                        {formatDate(project.startDate)} → {formatDate(project.endDate)}
                      </Text>
                      <Text style={styles.itemUpdated}>
                        Saved {project.updatedAt}
                      </Text>
                      <View style={styles.taskPreview}>
                        {project.tasks.slice(0, 5).map((task, i) => (
                          <View key={i} style={[styles.taskDot, { backgroundColor: task.color }]} />
                        ))}
                        {project.tasks.length > 5 && (
                          <Text style={styles.moreText}>+{project.tasks.length - 5}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.loadArrow}>↗</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <>
                {loaded && templates.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyTitle}>No saved templates yet</Text>
                    <Text style={styles.emptySub}>
                      Tap Save → Save as Template to create a reusable project structure.
                    </Text>
                  </View>
                )}
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.item}
                    onPress={() => handleLoadTemplate(template)}
                    onLongPress={() => deleteTemplate(template.id)}
                  >
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemName}>{template.name}</Text>
                      <Text style={styles.itemMeta}>
                        {template.tasks.length + 1} tasks · {template.unit} · {template.createdAt}
                      </Text>
                      <View style={styles.taskPreview}>
                        {template.tasks.slice(0, 5).map((task, i) => (
                          <View key={i} style={[styles.taskDot, { backgroundColor: task.color }]} />
                        ))}
                        {template.tasks.length > 5 && (
                          <Text style={styles.moreText}>+{template.tasks.length - 5}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.loadArrow}>↗</Text>
                  </TouchableOpacity>
                ))}

                {/* Built-in templates — always visible, cannot be deleted */}
                <Text style={styles.builtInLabel}>EXAMPLE TEMPLATES</Text>
                {BUILT_IN_TEMPLATES.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[styles.item, styles.builtInItem]}
                    onPress={() => handleLoadTemplate(template)}
                  >
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemName}>{template.name}</Text>
                      <Text style={styles.itemMeta}>
                        {template.tasks.length + 1} tasks · {template.unit}
                      </Text>
                      <View style={styles.taskPreview}>
                        {template.tasks.slice(0, 5).map((task, i) => (
                          <View key={i} style={[styles.taskDot, { backgroundColor: task.color }]} />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.loadArrow}>↗</Text>
                  </TouchableOpacity>
                ))}

                <Text style={styles.hint}>Tap to open · Hold to delete your templates</Text>
              </>
            )}

            <Text style={styles.hint}>Tap to open · Hold to delete</Text>
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0F1923",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#2E7DBC",
    maxHeight: "85%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A3F52",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#2E7DBC",
    borderRadius: 8,
  },
  closeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#2A3F52",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2E9BFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#5A7A96",
  },
  tabTextActive: {
    color: "#2E9BFF",
    fontWeight: "600",
  },
  scroll: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: "#5A7A96",
    textAlign: "center",
    lineHeight: 20,
  },
  item: {
    backgroundColor: "#1C2B38",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#2A3F52",
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: "#5A7A96",
    marginBottom: 2,
  },
  itemDates: {
    fontSize: 12,
    color: "#2E9BFF",
    marginBottom: 2,
  },
  itemUpdated: {
    fontSize: 11,
    color: "#2A3F52",
    marginBottom: 6,
  },
  taskPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  moreText: {
    fontSize: 11,
    color: "#5A7A96",
    marginLeft: 4,
  },
  loadArrow: {
    fontSize: 18,
    color: "#2E9BFF",
    marginLeft: 12,
  },
  hint: {
    fontSize: 11,
    color: "#2A3F52",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  builtInLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 8,
  },
  builtInItem: {
    borderColor: "#2E7DBC",
    borderWidth: 0.5,
    opacity: 0.85,
  },
});