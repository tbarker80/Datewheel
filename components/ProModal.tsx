import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useProStatus } from './ProContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProModal({ visible, onClose, onSuccess }: Props) {
  const { purchasePro, restorePurchase, grantProAlreadyPaid, price } = useProStatus();
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');

  async function handlePurchase() {
    setLoading(true);
    setLoadingAction('purchase');
    try {
      await purchasePro();
      setLoading(false);
      Alert.alert(
        '🎉 Welcome to Pro!',
        'All Pro features are now unlocked. Thank you for your support!',
        [{ text: 'Let\'s go!', onPress: onSuccess }]
      );
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Purchase failed', e.message || 'Something went wrong. Please try again.');
    }
  }

  async function handleRestore() {
    setLoading(true);
    setLoadingAction('restore');
    try {
      await restorePurchase();
      setLoading(false);
      Alert.alert(
        '✅ Purchase Restored!',
        'Your Pro access has been restored.',
        [{ text: 'Great!', onPress: onSuccess }]
      );
    } catch (e) {
      setLoading(false);
      Alert.alert(
        'Nothing to restore',
        'No Pro purchase was found for this account. If you paid the original $0.99, tap "I Already Paid" instead.'
      );
    }
  }

  async function handleAlreadyPaid() {
    Alert.alert(
      'I Already Paid',
      'We honor all original purchases. Tap confirm to unlock Pro for free.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await grantProAlreadyPaid();
            Alert.alert(
              '✅ Pro Unlocked!',
              'Thank you for your early support!',
              [{ text: 'Let\'s go!', onPress: onSuccess }]
            );
          },
        },
      ]
    );
  }

  const features = [
    { icon: '💾', text: 'Save & open named projects' },
    { icon: '📋', text: 'Reusable project templates' },
    { icon: '📊', text: 'Export to PDF, CSV, XLSX & iCal' },
    { icon: '📂', text: 'Open & reload saved projects' },
    { icon: '🔔', text: 'Task & milestone reminders' },
    { icon: '{}', text: 'Export raw data as JSON' },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.proTag}>PRO</Text>
              <Text style={styles.title}>Save & Export Your Projects</Text>
              <Text style={styles.subtitle}>One-time purchase — yours forever</Text>
            </View>
          </View>

          {/* Features */}
          <View style={styles.features}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={[styles.purchaseBtn, loading && loadingAction === 'purchase' && styles.btnLoading]}
            onPress={handlePurchase}
            disabled={loading}
          >
            {loading && loadingAction === 'purchase' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.purchaseBtnText}>Unlock Pro — {price}</Text>
                <Text style={styles.purchaseBtnSub}>One-time payment, no subscription</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleRestore}
              disabled={loading}
            >
              {loading && loadingAction === 'restore' ? (
                <ActivityIndicator color="#5A7A96" size="small" />
              ) : (
                <Text style={styles.secondaryBtnText}>Restore Purchase</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.divider}>·</Text>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleAlreadyPaid}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>I Already Paid</Text>
            </TouchableOpacity>
          </View>

          <Text>
  {Platform.OS === 'ios' 
    ? 'Payment processed by Apple. No recurring charges.' 
    : 'Payment processed by Google Play. No recurring charges.'}
</Text>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1923',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#2E7DBC',
    paddingBottom: 40,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2A3F52',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    color: '#5A7A96',
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  proTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E9BFF',
    letterSpacing: 2,
    backgroundColor: '#1A3A5C',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#2E7DBC',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#5A7A96',
  },
  features: {
    padding: 20,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 30,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  purchaseBtn: {
    marginHorizontal: 20,
    backgroundColor: '#2E7DBC',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnLoading: {
    opacity: 0.7,
  },
  purchaseBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  purchaseBtnSub: {
    fontSize: 12,
    color: '#8AAFC4',
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  secondaryBtn: {
    padding: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    color: '#5A7A96',
  },
  divider: {
    color: '#2A3F52',
    fontSize: 16,
  },
  legalText: {
    fontSize: 11,
    color: '#2A3F52',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});