import DateWheel from "@/components/datewheel";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";

// --- Date Math Helpers ---
function daysBetween(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function businessDaysBetween(start: Date, end: Date) {
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function weeksBetween(start: Date, end: Date) {
  return (daysBetween(start, end) / 7).toFixed(1);
}

function monthsBetween(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDayName(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

const UNITS = ["Days", "Weeks", "Months", "Business Days"];

function calcDuration(start: Date, end: Date, unit: string) {
  if (end <= start) return "0";
  switch (unit) {
    case "Days": return String(daysBetween(start, end));
    case "Weeks": return String(weeksBetween(start, end));
    case "Months": return String(monthsBetween(start, end));
    case "Business Days": return String(businessDaysBetween(start, end));
    default: return "0";
  }
}

// --- Main Screen ---
export default function Index() {
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 30);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(future);
  const [unit, setUnit] = useState("Days");
  const [unitIndex, setUnitIndex] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingField, setPickingField] = useState("start");
  const [saves, setSaves] = useState<any[]>([]);

  const duration = calcDuration(startDate, endDate, unit);

  useEffect(() => {
    loadSaves();
  }, []);

  async function loadSaves() {
    try {
      const stored = await AsyncStorage.getItem("saves");
      if (stored) setSaves(JSON.parse(stored));
    } catch (e) {
      console.log("Error loading saves", e);
    }
  }

  async function saveCalculation() {
    const newSave = {
      id: Date.now(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      unit,
      duration,
      label: `${formatDate(startDate)} → ${formatDate(endDate)}`,
    };
    const updated = [newSave, ...saves];
    setSaves(updated);
    await AsyncStorage.setItem("saves", JSON.stringify(updated));
  }

  async function deleteSave(id: number) {
    Alert.alert("Delete", "Remove this saved calculation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = saves.filter((s) => s.id !== id);
          setSaves(updated);
          await AsyncStorage.setItem("saves", JSON.stringify(updated));
        },
      },
    ]);
  }

  function restoreSave(save: any) {
    setStartDate(new Date(save.startDate));
    setEndDate(new Date(save.endDate));
    setUnit(save.unit);
  }

  function openPicker(field: string) {
    setPickingField(field);
    setPickerVisible(true);
  }

  function handleConfirm(date: Date) {
    if (pickingField === "start") {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
    setPickerVisible(false);
  }

  function handleUnitToggle() {
    const next = (unitIndex + 1) % UNITS.length;
    setUnitIndex(next);
    setUnit(UNITS[next]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1923" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* App Title */}
        <Text style={styles.title}>Date Wheel</Text>

        {/* The Wheel */}
        <DateWheel
          startDate={startDate}
          endDate={endDate}
          duration={duration}
          unit={unit}
          onUnitToggle={handleUnitToggle}
          onEndDateChange={(date) => setEndDate(date)}
          onStartDateChange={(date) => setStartDate(date)}
        />

        {/* Start Date Field */}
        <TouchableOpacity style={styles.field} onPress={() => openPicker("start")}>
          <Text style={styles.fieldLabel}>START DATE</Text>
          <Text style={styles.fieldValue}>{formatDate(startDate)}</Text>
          <Text style={styles.fieldDay}>{getDayName(startDate)}</Text>
        </TouchableOpacity>

        {/* End Date Field */}
        <TouchableOpacity style={styles.field} onPress={() => openPicker("end")}>
          <Text style={styles.fieldLabel}>END DATE</Text>
          <Text style={styles.fieldValue}>{formatDate(endDate)}</Text>
          <Text style={styles.fieldDay}>{getDayName(endDate)}</Text>
        </TouchableOpacity>

        {/* Today Shortcut Buttons */}
        <View style={styles.todayRow}>
          <TouchableOpacity style={styles.todayBtn} onPress={() => setStartDate(new Date())}>
            <Text style={styles.todayBtnText}>Start → Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.todayBtn} onPress={() => setEndDate(new Date())}>
            <Text style={styles.todayBtnText}>End → Today</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={saveCalculation}>
          <Text style={styles.saveBtnText}>+ Save This Calculation</Text>
        </TouchableOpacity>

        {/* Saved Calculations List */}
        {saves.length > 0 && (
          <View style={styles.savesSection}>
            <Text style={styles.savesTitle}>SAVED CALCULATIONS</Text>
            {saves.map((save) => (
              <TouchableOpacity
                key={save.id}
                style={styles.saveItem}
                onPress={() => restoreSave(save)}
                onLongPress={() => deleteSave(save.id)}
              >
                <View style={styles.saveItemLeft}>
                  <Text style={styles.saveItemLabel}>{save.label}</Text>
                  <Text style={styles.saveItemSub}>
                    {save.duration} {save.unit}
                  </Text>
                </View>
                <Text style={styles.saveItemArrow}>↗</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.savesHint}>Tap to restore · Hold to delete</Text>
          </View>
        )}

        {/* Date Picker */}
        <DateTimePickerModal
          isVisible={pickerVisible}
          mode="date"
          date={pickingField === "start" ? startDate : endDate}
          onConfirm={handleConfirm}
          onCancel={() => setPickerVisible(false)}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0F1923",
  },
  scroll: {
    flex: 1,
  },
  container: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 24,
    letterSpacing: 2,
  },
  field: {
    width: "100%",
    backgroundColor: "#1C2B38",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 26,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  fieldDay: {
    fontSize: 13,
    color: "#5A7A96",
    marginTop: 4,
  },
  todayRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  todayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1C2B38",
    borderWidth: 1,
    borderColor: "#2A3F52",
  },
  todayBtnText: {
    fontSize: 12,
    color: "#2E9BFF",
    fontWeight: "500",
  },
  saveBtn: {
    marginTop: 16,
    width: "100%",
    backgroundColor: "#2E7DBC",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  savesSection: {
    width: "100%",
    marginTop: 32,
  },
  savesTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5A7A96",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  saveItem: {
    backgroundColor: "#1C2B38",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saveItemLeft: {
    flex: 1,
  },
  saveItemLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  saveItemSub: {
    fontSize: 12,
    color: "#5A7A96",
  },
  saveItemArrow: {
    fontSize: 16,
    color: "#2E9BFF",
    marginLeft: 12,
  },
  savesHint: {
    fontSize: 11,
    color: "#2A3F52",
    textAlign: "center",
    marginTop: 8,
  },
});