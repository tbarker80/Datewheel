import React, { useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

const LEAD_TIME_OPTIONS = [
  { label: '1 day before',   days: 1 },
  { label: '3 days before',  days: 3 },
  { label: '1 week before',  days: 7 },
  { label: '2 weeks before', days: 14 },
];

interface Props {
  visible: boolean;
  itemName: string;
  initialReminderDays?: number;
  onConfirm: (days: number | null) => void;
  onCancel: () => void;
}

export default function ReminderModal({ visible, itemName, initialReminderDays, onConfirm, onCancel }: Props) {
  const [enabled, setEnabled] = useState(initialReminderDays !== undefined);
  const [selectedDays, setSelectedDays] = useState(initialReminderDays ?? 3);

  React.useEffect(() => {
    if (visible) {
      setEnabled(initialReminderDays !== undefined);
      setSelectedDays(initialReminderDays ?? 3);
    }
  }, [visible, initialReminderDays]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.box} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>SET REMINDER</Text>
          <Text style={styles.itemName} numberOfLines={2}>{itemName}</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleLabel}>Enable Reminder</Text>
              <Text style={styles.toggleSub}>Notify before this ends</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: '#2A3F52', true: '#2E7DBC' }}
              thumbColor={enabled ? '#FFFFFF' : '#5A7A96'}
            />
          </View>

          {enabled && (
            <View style={styles.leadTimeContainer}>
              {LEAD_TIME_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.days}
                  style={[styles.leadTimeBtn, selectedDays === opt.days && styles.leadTimeBtnActive]}
                  onPress={() => setSelectedDays(opt.days)}
                >
                  <Text style={[styles.leadTimeBtnText, selectedDays === opt.days && styles.leadTimeBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(enabled ? selectedDays : null)}>
              <Text style={styles.confirmText}>Save</Text>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: '85%',
    backgroundColor: '#1C2B38',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2E7DBC',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
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
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3F52',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#5A7A96',
    fontWeight: '500',
  },
  confirmBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2E7DBC',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
