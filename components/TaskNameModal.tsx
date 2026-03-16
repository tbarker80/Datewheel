import React, { useState } from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface Props {
  visible: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  taskNumber: number;
}

export default function TaskNameModal({
  visible,
  onConfirm,
  onCancel,
  taskNumber,
}: Props) {
  const [name, setName] = useState("");

  function handleConfirm() {
    const taskName = name.trim() || `Task ${taskNumber}`;
    setName("");
    onConfirm(taskName);
  }

  function handleCancel() {
    setName("");
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <View style={styles.box}>
          <Text style={styles.title}>NAME THIS TASK</Text>
          <Text style={styles.sub}>
            Leave blank to use "Task {taskNumber}"
          </Text>
          <TextInput
            style={styles.input}
            placeholder={`Task ${taskNumber}`}
            placeholderTextColor="#2A3F52"
            value={name}
            onChangeText={setName}
            autoFocus={true}
            maxLength={40}
            onSubmitEditing={handleConfirm}
          />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: "85%",
    backgroundColor: "#1C2B38",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2E7DBC",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sub: {
    fontSize: 12,
    color: "#2A3F52",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#0F1923",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2E7DBC",
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3F52",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    color: "#5A7A96",
    fontWeight: "500",
  },
  confirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#2E7DBC",
    alignItems: "center",
  },
  confirmText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});