/**
 * Device calendar helper.
 *
 * Creates real events in the phone's local calendar via expo-calendar.
 * This is NOT Google Calendar / Outlook Calendar — those need OAuth app
 * registration with real client IDs from the user. This uses whatever
 * calendar already exists on the device (works fully offline).
 */
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

let cachedCalendarId: string | null = null;

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Finds a writable calendar to add events to, creating a dedicated
 * "Hello Sara" calendar the first time if none is suitable.
 */
async function getWritableCalendarId(): Promise<string | null> {
  if (cachedCalendarId) return cachedCalendarId;

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  if (writable) {
    cachedCalendarId = writable.id;
    return writable.id;
  }

  if (Platform.OS === 'ios') {
    const defaultCal = await Calendar.getDefaultCalendarAsync();
    cachedCalendarId = defaultCal.id;
    return defaultCal.id;
  }

  // Android: create a local calendar to write into.
  const source = { isLocalAccount: true, name: 'Hello Sara', type: Calendar.SourceType.LOCAL };
  const newCalId = await Calendar.createCalendarAsync({
    title: 'Hello Sara',
    color: '#7C3AED',
    entityType: Calendar.EntityTypes.EVENT,
    source,
    name: 'helloSaraCalendar',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  cachedCalendarId = newCalId;
  return newCalId;
}

export interface CreateEventInput {
  title: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
}

/** Returns the created event id, or null if permission was denied. */
export async function createCalendarEvent(input: CreateEventInput): Promise<string | null> {
  const granted = await requestCalendarPermission();
  if (!granted) return null;

  const calendarId = await getWritableCalendarId();
  if (!calendarId) return null;

  const endDate = input.endDate || new Date(input.startDate.getTime() + 30 * 60_000);

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: input.title,
    notes: input.notes,
    startDate: input.startDate,
    endDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return eventId;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // already deleted or permission revoked — safe to ignore
  }
}
