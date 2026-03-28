import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const LEAD_TIME_OPTIONS = [
  { label: '1 day before',    days: 1 },
  { label: '3 days before',   days: 3 },
  { label: '1 week before',   days: 7 },
  { label: '2 weeks before',  days: 14 },
];

interface Props {
  visible: boolean;
  onConfirm: (name: string, reminderDays: number | null) => void;
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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState(3);

  function reset() {
    setName("");
    setReminderEnabled(false);
    setSelectedDays(3);
  }

  function handleConfirm() {
    const taskName = name.trim() || `Task ${taskNumber}`;
    const reminderDays = reminderEnabled ? selectedDays : null;
    reset();
    onConfirm(taskName, reminderDays);
  }

  function handleCancel() {
    reset();
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
        <TouchableOpacity style={styles.box} activeOpacity={1} onPress={() => {}}>
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

          {/* Reminder toggle */}
          <View style={styles.reminderRow}>
            <View style={styles.reminderLeft}>
              <Text style={styles.reminderLabel}>Add Reminder</Text>
              <Text style={styles.reminderSub}>Notify before task ends</Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: '#2A3F52', true: '#2E7DBC' }}
              thumbColor={reminderEnabled ? '#FFFFFF' : '#5A7A96'}
            />
          </View>

          {/* Lead time picker — only shown when reminder is on */}
          {reminderEnabled && (
            <View style={styles.leadTimeContainer}>
              {LEAD_TIME_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.days}
                  style={[
                    styles.leadTimeBtn,
                    selectedDays === option.days && styles.leadTimeBtnActive,
                  ]}
                  onPress={() => setSelectedDays(option.days)}
                >
                  <Text style={[
                    styles.leadTimeBtnText,
                    selectedDays === option.days && styles.leadTimeBtnTextActive,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#2A3F52',
  },
  reminderLeft: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reminderSub: {
    fontSize: 11,
    color: '#5A7A96',
    marginTop: 2,
  },
  leadTimeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
    marginBottom: 8,
  },
  leadTimeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3F52',
    backgroundColor: '#0F1923',
  },
  leadTimeBtnActive: {
    borderColor: '#2E7DBC',
    backgroundColor: '#1A3A5C',
  },
  leadTimeBtnText: {
    fontSize: 12,
    color: '#5A7A96',
    fontWeight: '500',
  },
  leadTimeBtnTextActive: {
    color: '#2E9BFF',
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
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
