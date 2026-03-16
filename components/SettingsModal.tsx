import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface AppSettings {
  darkMode: boolean;
  hapticsEnabled: boolean;
  holidayCountry: string;
}

interface Props {
  visible: boolean;
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

const COUNTRIES = [
  { code: "NONE", label: "None" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "MX", label: "Mexico" },
  { code: "CN", label: "China" },
];

export default function SettingsModal({
  visible,
  settings,
  onClose,
  onChange,
}: Props) {
  function update(key: keyof AppSettings, value: any) {
    onChange({ ...settings, [key]: value });
  }

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
            <Text style={styles.headerTitle}>SETTINGS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* UI Section */}
            <Text style={styles.sectionTitle}>APPEARANCE</Text>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Dark Mode</Text>
                <Text style={styles.rowSub}>Switch to light theme</Text>
              </View>
              <Switch
                value={settings.darkMode}
                onValueChange={(v) => update("darkMode", v)}
                trackColor={{ false: "#2A3F52", true: "#2E7DBC" }}
                thumbColor={settings.darkMode ? "#FFFFFF" : "#5A7A96"}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Haptic Feedback</Text>
                <Text style={styles.rowSub}>Feel snaps and actions</Text>
              </View>
              <Switch
                value={settings.hapticsEnabled}
                onValueChange={(v) => update("hapticsEnabled", v)}
                trackColor={{ false: "#2A3F52", true: "#2E7DBC" }}
                thumbColor={settings.hapticsEnabled ? "#FFFFFF" : "#5A7A96"}
              />
            </View>

            {/* Holidays Section */}
            <Text style={styles.sectionTitle}>HOLIDAYS</Text>
            <Text style={styles.sectionSub}>
              Exclude public holidays from business day calculations
            </Text>

            {COUNTRIES.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={styles.row}
                onPress={() => update("holidayCountry", country.code)}
              >
                <Text style={styles.rowLabel}>{country.label}</Text>
                <View
                  style={[
                    styles.radio,
                    settings.holidayCountry === country.code &&
                      styles.radioActive,
                  ]}
                >
                  {settings.holidayCountry === country.code && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </TouchableOpacity>
            ))}

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
    paddingBottom: 40,
    maxHeight: "85%",
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionSub: {
    fontSize: 12,
    color: "#2A3F52",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1C2B38",
  },
  rowLeft: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  rowSub: {
    fontSize: 12,
    color: "#5A7A96",
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#2A3F52",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#2E9BFF",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2E9BFF",
  },
});