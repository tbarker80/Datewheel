import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

interface Props {
  visible: boolean;
  defaultDate?: Date;
  onConfirm: (name: string, date: Date) => void;
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

  // Sync date when defaultDate changes
  React.useEffect(() => {
    if (visible) {
      setDate(defaultDate || new Date());
      setName('');
    }
  }, [visible, defaultDate]);

  function handleConfirm() {
    const finalName = name.trim() || 'Milestone';
    onConfirm(finalName, date);
    setName('');
    setDate(defaultDate || new Date());
  }

  function handleCancel() {
    setName('');
    setDate(defaultDate || new Date());
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
  confirmBtn: {
    marginHorizontal: 12,
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