import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Props {
  visible: boolean;
  taskName: string;       // name of the task that FOLLOWS the boundary
  prevTaskName: string;   // name of the task that PRECEDES the boundary
  initialLagDays: number; // current value, negative = overlap, positive = gap
  onConfirm: (lagDays: number) => void;
  onClear: () => void;    // remove the lag relationship entirely (flush)
  onCancel: () => void;
}

export default function LagEditModal({
  visible,
  taskName,
  prevTaskName,
  initialLagDays,
  onConfirm,
  onClear,
  onCancel,
}: Props) {
  const [days, setDays] = useState(String(Math.abs(initialLagDays)));
  const [isOverlap, setIsOverlap] = useState(initialLagDays < 0);

  useEffect(() => {
    if (visible) {
      setDays(String(Math.abs(initialLagDays)));
      setIsOverlap(initialLagDays < 0);
    }
  }, [visible, initialLagDays]);

  function handleConfirm() {
    const num = parseInt(days);
    if (isNaN(num) || num < 0) return;
    const lagDays = isOverlap ? -num : num;
    onConfirm(lagDays);
  }

  const sign = isOverlap ? '-' : '+';
  const num = parseInt(days) || 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.box} activeOpacity={1} onPress={() => {}}>

          <Text style={styles.title}>EDIT LEAD / LAG</Text>

          <Text style={styles.description}>
            Between <Text style={styles.bold}>{prevTaskName}</Text> and <Text style={styles.bold}>{taskName}</Text>
          </Text>

          {/* Overlap / Gap toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isOverlap && styles.toggleBtnActive]}
              onPress={() => setIsOverlap(true)}
            >
              <Text style={[styles.toggleBtnText, isOverlap && styles.toggleBtnTextActive]}>
                ⚡ Overlap
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isOverlap && styles.toggleBtnActiveGap]}
              onPress={() => setIsOverlap(false)}
            >
              <Text style={[styles.toggleBtnText, !isOverlap && styles.toggleBtnTextActiveGap]}>
                ↔ Gap
              </Text>
            </TouchableOpacity>
          </View>

          {/* Day input */}
          <View style={styles.inputRow}>
            <Text style={styles.signLabel}>{sign}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setDays(d => String(Math.max(0, (parseInt(d) || 0) - 1)))}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={days}
              onChangeText={v => setDays(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              maxLength={3}
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setDays(d => String((parseInt(d) || 0) + 1))}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.daysLabel}>days</Text>
          </View>

          {/* Preview */}
          <Text style={styles.preview}>
            {num === 0
              ? 'Tasks will be flush (no overlap or gap)'
              : isOverlap
              ? `${taskName} starts ${num} day${num !== 1 ? 's' : ''} before ${prevTaskName} ends`
              : `${taskName} starts ${num} day${num !== 1 ? 's' : ''} after ${prevTaskName} ends`
            }
          </Text>

          {/* Buttons */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Apply</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
            <Text style={styles.clearBtnText}>Remove Relationship (flush)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

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
  description: {
    fontSize: 13,
    color: '#8AAFC4',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    lineHeight: 20,
  },
  bold: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3F52',
    alignItems: 'center',
    backgroundColor: '#0F1923',
  },
  toggleBtnActive: {
    borderColor: '#EF4444',
    backgroundColor: '#2A1010',
  },
  toggleBtnActiveGap: {
    borderColor: '#F0A500',
    backgroundColor: '#1A1200',
  },
  toggleBtnText: {
    fontSize: 13,
    color: '#5A7A96',
    fontWeight: '500',
  },
  toggleBtnTextActive: {
    color: '#EF4444',
    fontWeight: '700',
  },
  toggleBtnTextActiveGap: {
    color: '#F0A500',
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  signLabel: {
    fontSize: 28,
    fontWeight: '300',
    color: '#5A7A96',
    width: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0F1923',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E7DBC',
    textAlign: 'center',
    width: 100,
  },
  daysLabel: {
    fontSize: 16,
    color: '#5A7A96',
    fontWeight: '500',
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F1923',
    borderWidth: 1,
    borderColor: '#2A3F52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 22,
    fontWeight: '300',
    color: '#8AAFC4',
    lineHeight: 26,
  },
  preview: {
    fontSize: 12,
    color: '#5A7A96',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  confirmBtn: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#2E7DBC',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearBtn: {
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: '#0F1923',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#2A3F52',
  },
  clearBtnText: {
    fontSize: 13,
    color: '#5A7A96',
  },
  cancelBtn: {
    marginHorizontal: 12,
    marginBottom: 14,
    padding: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#5A7A96',
  },
});
