import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const LEAD_TIME_OPTIONS = [
  { label: '1 day before',   days: 1 },
  { label: '3 days before',  days: 3 },
  { label: '1 week before',  days: 7 },
  { label: '2 weeks before', days: 14 },
];

export interface TaskEditValues {
  name: string;
  percentComplete: number;
  reminderDays: number | null; // null = no reminder
}

interface Props {
  visible: boolean;
  taskNumber: number;
  initialName?: string;
  initialPercent?: number;
  initialReminderDays?: number;
  taskColor: string;
  isPro: boolean;
  onSave: (values: TaskEditValues) => void;
  onCancel: () => void;
}

export default function TaskEditModal({
  visible,
  taskNumber,
  initialName,
  initialPercent = 0,
  initialReminderDays,
  taskColor,
  isPro,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName ?? '');
  const [pct, setPct] = useState(initialPercent);
  const [reminderEnabled, setReminderEnabled] = useState(initialReminderDays !== undefined);
  const [reminderDays, setReminderDays] = useState(initialReminderDays ?? 3);

  React.useEffect(() => {
    if (visible) {
      setName(initialName ?? '');
      setPct(initialPercent);
      setReminderEnabled(initialReminderDays !== undefined);
      setReminderDays(initialReminderDays ?? 3);
    }
  }, [visible, initialName, initialPercent, initialReminderDays]);

  function handleSave() {
    onSave({
      name: name.trim() || `Task ${taskNumber}`,
      percentComplete: Math.max(0, Math.min(100, pct)),
      reminderDays: reminderEnabled ? reminderDays : null,
    });
  }

  const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onCancel} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <Text style={styles.sectionLabel}>EDIT TASK</Text>

            {/* Name */}
            <TextInput
              style={styles.input}
              placeholder={`Task ${taskNumber}`}
              placeholderTextColor="#2A3F52"
              value={name}
              onChangeText={setName}
              autoFocus={false}
              maxLength={40}
              returnKeyType="done"
            />

            {/* % Complete */}
            <Text style={styles.sectionLabel}>% COMPLETE</Text>

            <View style={styles.pctValueRow}>
              <TouchableOpacity style={styles.pctFineBtn} onPress={() => setPct(v => clampPct(v - 1))}>
                <Text style={styles.pctFineBtnText}>−1</Text>
              </TouchableOpacity>
              <Text style={[styles.pctValueDisplay, { color: taskColor }]}>{pct}%</Text>
              <TouchableOpacity style={styles.pctFineBtn} onPress={() => setPct(v => clampPct(v + 1))}>
                <Text style={styles.pctFineBtnText}>+1</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pctPreviewTrack}>
              <View style={[styles.pctPreviewFill, { width: `${pct}%` as any, backgroundColor: taskColor }]} />
            </View>

            <View style={styles.pctGridWrap}>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.pctGridBtn, pct === v && { backgroundColor: taskColor, borderColor: taskColor }]}
                  onPress={() => setPct(v)}
                >
                  <Text style={[styles.pctGridBtnText, pct === v && { color: '#FFFFFF' }]}>{v}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reminder */}
            <Text style={styles.sectionLabel}>REMINDER</Text>

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleLabel}>
                  Enable Reminder{!isPro ? '  🔒 Pro' : ''}
                </Text>
                <Text style={styles.toggleSub}>Notify before this task ends</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={v => { if (isPro) setReminderEnabled(v); }}
                trackColor={{ false: '#2A3F52', true: '#2E7DBC' }}
                thumbColor={reminderEnabled ? '#FFFFFF' : '#5A7A96'}
                disabled={!isPro}
              />
            </View>

            {reminderEnabled && (
              <View style={styles.leadTimeContainer}>
                {LEAD_TIME_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.days}
                    style={[styles.leadTimeBtn, reminderDays === opt.days && styles.leadTimeBtnActive]}
                    onPress={() => setReminderDays(opt.days)}
                  >
                    <Text style={[styles.leadTimeBtnText, reminderDays === opt.days && styles.leadTimeBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: taskColor }]} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#0F1923',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#2E7DBC',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#1C2B38',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E7DBC',
    marginBottom: 20,
  },
  pctValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pctFineBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1C2B38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctFineBtnText: { fontSize: 15, fontWeight: '700', color: '#8AAFC4' },
  pctValueDisplay: { fontSize: 44, fontWeight: '700' },
  pctPreviewTrack: {
    height: 8,
    backgroundColor: '#1C2B38',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  pctPreviewFill: { height: '100%', borderRadius: 4 },
  pctGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pctGridBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1C2B38',
    borderWidth: 1,
    borderColor: '#2A3F52',
    minWidth: 52,
    alignItems: 'center',
  },
  pctGridBtnText: { fontSize: 13, fontWeight: '600', color: '#8AAFC4' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#2A3F52',
    marginBottom: 4,
  },
  toggleLeft: { flex: 1 },
  toggleLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  toggleSub: { fontSize: 11, color: '#5A7A96', marginTop: 2 },
  leadTimeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
    marginBottom: 16,
  },
  leadTimeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3F52',
    backgroundColor: '#1C2B38',
  },
  leadTimeBtnActive: { borderColor: '#2E7DBC', backgroundColor: '#1A3A5C' },
  leadTimeBtnText: { fontSize: 12, color: '#5A7A96', fontWeight: '500' },
  leadTimeBtnTextActive: { color: '#2E9BFF', fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3F52',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: '#5A7A96', fontWeight: '500' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
});
