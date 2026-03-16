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
                    <Text style={styles.emptyTitle}>No templates yet</Text>
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
});