import * as Notifications from 'expo-notifications';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

/**
 * Schedule a local notification for a task or milestone.
 * Fires at 9am, `leadDays` before the given date.
 * Returns the notification ID, or null if the reminder date is already past.
 */
export async function scheduleReminder(
  name: string,
  date: Date,
  leadDays: number
): Promise<string | null> {
  try {
    const reminderDate = new Date(date);
    reminderDate.setDate(reminderDate.getDate() - leadDays);
    reminderDate.setHours(9, 0, 0, 0);

    // Don't schedule if the reminder time has already passed
    if (reminderDate <= new Date()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Date Wheel Reminder',
        body: `"${name}" is due in ${leadDays === 1 ? '1 day' : `${leadDays} days`}`,
        sound: true,
        data: { name, date: date.toISOString() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
    return id;
  } catch (e) {
    console.log('Failed to schedule notification:', e);
    return null;
  }
}

/**
 * Cancel a previously scheduled notification by ID.
 */
export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {}
}

/**
 * Cancel all scheduled Date Wheel notifications.
 * Used on full reset.
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {}
}
