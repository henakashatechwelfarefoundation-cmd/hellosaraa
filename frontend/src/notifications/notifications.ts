/**
 * Local notification helper for reminders.
 *
 * Uses expo-notifications to schedule an on-device notification at a
 * reminder's `remind_at` time, and to cancel it if the reminder is deleted
 * or completed early. Purely local — no push server / Firebase needed.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let channelReady = false;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
  channelReady = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

/**
 * Schedule a local notification for a reminder. Returns the native
 * notification id (store it so we can cancel it later), or null if the
 * time is already in the past or permission was denied.
 */
export async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  body: string | undefined,
  remindAtISO: string,
): Promise<string | null> {
  const when = new Date(remindAtISO).getTime();
  if (when <= Date.now()) return null;

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  await ensureAndroidChannel();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ ${title}`,
      body: body || 'Reminder from Sara',
      data: { reminderId },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: 'reminders',
    },
  });

  return notificationId;
}

export async function cancelReminderNotification(notificationId: string | null | undefined) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // already fired or already cancelled — safe to ignore
  }
}
