import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
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

interface Props {
  visible: boolean;
  onClose: () => void;
  onLoad: (template: Template) => void;
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
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    const updated = [newTemplate, ...existing];
    await AsyncStorage.setItem("templates", JSON.stringify(updated));
  } catch (e) {
    console.log("Error saving template", e);
  }
}

export default function TemplatesModal({ visible, onClose, onLoad }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function loadTemplates() {
    try {
      const stored = await AsyncStorage.getItem("templates");
      if (stored) setTemplates(JSON.parse(stored));
      else setTemplates([]);
    } catch (e) {
      setTemplates([]);
    }
    setLoaded(true);
  }

  async function deleteTemplate(id: number) {
    Alert.alert("Delete Template", "Remove this template?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = templates.filter((t) => t.id !== id);
          setTemplates(updated);
          await AsyncStorage.setItem("templates", JSON.stringify(updated));
        },
      },
    ]);
  }

  function handleLoad(template: Template) {
    Alert.alert(
      "Load Template",
      `Start a new project from "${template.name}"? This will clear your current tasks.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load",
          onPress: () => {
            onLoad(template);
            onClose();
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      onShow={loadTemplates}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>TEMPLATES</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {loaded && templates.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No templates yet</Text>
                <Text style={styles.emptySub}>
                  Build a project timeline and tap Save to create a reusable template.
                </Text>
              </View>
            )}

            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateItem}
                onPress={() => handleLoad(template)}
                onLongPress={() => deleteTemplate(template.id)}
              >
                <View style={styles.templateLeft}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateMeta}>
                    {template.tasks.length + 1} tasks · {template.unit} · {template.createdAt}
                  </Text>
                  <View style={styles.taskPreview}>
                    {[...template.tasks].slice(0, 5).map((task, i) => (
                      <View
                        key={i}
                        style={[styles.taskDot, { backgroundColor: task.color }]}
                      />
                    ))}
                    {template.tasks.length > 5 && (
                      <Text style={styles.moreText}>+{template.tasks.length - 5}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.loadArrow}>↗</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.hint}>Tap to load · Hold to delete</Text>
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
    maxHeight: "80%",
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
  templateItem: {
    backgroundColor: "#1C2B38",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#2A3F52",
  },
  templateLeft: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  templateMeta: {
    fontSize: 12,
    color: "#5A7A96",
    marginBottom: 8,
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