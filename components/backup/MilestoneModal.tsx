import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const LEAD_TIME_OPTIONS = [
  { label: '1 day before',   days: 1 },
  { label: '3 days before',  days: 3 },
  { label: '1 week before',  days: 7 },
  { label: '2 weeks before', days: 14 },
];

interface Props {
  visible: boolean;
  defaultDate?: Date;
  onConfirm: (name: string, date: Date, reminderDays: number | null) => void;
  onCancel: () => void;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function MilestoneModal({ visible, defaultDate, onConfirm, onCancel }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(defaultDate || new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState(3);

  React.useEffect(() => {
    if (visible) {
      setDate(defaultDate || new Date());
      setName('');
      setReminderEnabled(false);
      setSelectedDays(3);
    }
  }, [visible, defaultDate]);

  function handleConfirm() {
    const finalName = name.trim() || 'Milestone';
    const reminderDays = reminderEnabled ? selectedDays : null;
    onConfirm(finalName, date, reminderDays);
    setName('');
    setDate(defaultDate || new Date());
    setReminderEnabled(false);
    setSelectedDays(3);
  }

  function handleCancel() {
    setName('');
    setDate(defaultDate || new Date());
    setReminderEnabled(false);
    setSelectedDays(3);
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
        <TouchableOpacity
          style={styles.box}
          activeOpacity={1}
          onPress={() => {}}
        >
          <Text style={styles.title}>ADD MILESTONE</Text>

          {/* Name input */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Milestone name..."
              placeholderTextColor="#2A3F52"
              value={name}
              onChangeText={setName}
              autoFocus={true}
              maxLength={40}
            />
          </View>

          {/* Date picker */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>DATE</Text>
            <TouchableOpacity
              style={styles.dateTouchable}
              onPress={() => setDatePickerVisible(true)}
            >
              <Text style={styles.dateText}>{formatDate(date)}</Text>
              <Text style={styles.dateArrow}>▾</Text>
            </TouchableOpacity>
          </View>

          {/* Diamond preview */}
          <View style={styles.previewRow}>
            <View style={styles.diamond} />
            <Text style={styles.previewText}>
              {name.trim() || 'Milestone'} · {formatDate(date)}
            </Text>
          </View>

          {/* Reminder toggle */}
          <View style={styles.reminderRow}>
            <View style={styles.reminderLeft}>
              <Text style={styles.reminderLabel}>Add Reminder</Text>
              <Text style={styles.reminderSub}>Notify before this milestone</Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: '#2A3F52', true: '#2E7DBC' }}
              thumbColor={reminderEnabled ? '#FFFFFF' : '#5A7A96'}
            />
          </View>

          {/* Lead time picker */}
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

          {/* Buttons */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Add Milestone</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <DateTimePickerModal
            isVisible={datePickerVisible}
            mode="date"
            date={date}
            onConfirm={(d) => { setDate(d); setDatePickerVisible(false); }}
            onCancel={() => setDatePickerVisible(false)}
          />
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
    padding: 8,
    borderWidth: 1,
    borderColor: '#2E7DBC',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 1.5,
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
  },
  inputWrapper: {
    padding: 12,
    paddingBottom: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5A7A96',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F1923',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E7DBC',
  },
  dateTouchable: {
    backgroundColor: '#0F1923',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2E7DBC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { fontSize: 16, color: '#FFFFFF' },
  dateArrow: { fontSize: 14, color: '#2E9BFF' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  diamond: {
    width: 12,
    height: 12,
    backgroundColor: '#F0A500',
    transform: [{ rotate: '45deg' }],
  },
  previewText: { fontSize: 13, color: '#5A7A96', flex: 1 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#2A3F52',
  },
  reminderLeft: { flex: 1 },
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
    paddingHorizontal: 12,
    paddingBottom: 12,
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
  confirmBtn: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#2E7DBC',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  cancelBtn: {
    marginHorizontal: 12,
    marginBottom: 16,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: '#5A7A96' },
});
