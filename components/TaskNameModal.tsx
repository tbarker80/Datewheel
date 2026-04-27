import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const DURATION_UNITS = ['Days', 'Weeks', 'Months'] as const;
type DurationUnit = typeof DURATION_UNITS[number];

function toCalendarDays(value: number, unit: DurationUnit): number {
  if (unit === 'Weeks')  return value * 7;
  if (unit === 'Months') return value * 30;
  return value;
}

interface Props {
  visible: boolean;
  onConfirm: (name: string, durationDays?: number) => void;
  onCancel: () => void;
  taskNumber: number;
  initialName?: string;
  showDuration?: boolean;
}

export default function TaskNameModal({
  visible,
  onConfirm,
  onCancel,
  taskNumber,
  initialName,
  showDuration = false,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [durationValue, setDurationValue] = useState("30");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("Days");

  React.useEffect(() => {
    if (visible) {
      setName(initialName ?? "");
      if (showDuration) {
        setDurationValue("30");
        setDurationUnit("Days");
      }
    }
  }, [visible, initialName, showDuration]);

  function reset() {
    setName("");
    setDurationValue("30");
    setDurationUnit("Days");
  }

  function handleConfirm() {
    const taskName = name.trim() || `Task ${taskNumber}`;
    const durationDays = showDuration ? toCalendarDays(Math.max(1, parseInt(durationValue) || 30), durationUnit) : undefined;
    reset();
    onConfirm(taskName, durationDays);
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleCancel}>
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

          {/* Duration picker — only shown when adding a new task */}
          {showDuration && (
            <View style={styles.durationSection}>
              <Text style={styles.durationLabel}>Duration</Text>
              <View style={styles.durationRow}>
                <TextInput
                  style={styles.durationInput}
                  value={durationValue}
                  onChangeText={v => setDurationValue(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
                <View style={styles.durationUnits}>
                  {DURATION_UNITS.map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitBtn, durationUnit === u && styles.unitBtnActive]}
                      onPress={() => setDurationUnit(u)}
                    >
                      <Text style={[styles.unitBtnText, durationUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>{showDuration ? 'Add Task' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  durationSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
  },
  durationLabel: {
    fontSize: 13,
    color: '#5A7A96',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  durationInput: {
    width: 64,
    backgroundColor: '#0F1923',
    borderRadius: 10,
    padding: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E7DBC',
    textAlign: 'center',
  },
  durationUnits: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3F52',
    backgroundColor: '#0F1923',
    alignItems: 'center',
  },
  unitBtnActive: {
    borderColor: '#2E7DBC',
    backgroundColor: '#1A3A5C',
  },
  unitBtnText: {
    fontSize: 12,
    color: '#5A7A96',
    fontWeight: '500',
  },
  unitBtnTextActive: {
    color: '#2E9BFF',
    fontWeight: '600',
  },
});
