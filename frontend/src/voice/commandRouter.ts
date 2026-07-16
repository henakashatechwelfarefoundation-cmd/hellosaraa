/**
 * Voice command router — deterministic intent parser + executor.
 *
 * Given a transcript, it decides whether the user wants Sara to *do* something
 * (call, SMS, flashlight, search, note, reminder, brightness, etc.) or to chat.
 *
 * Everything that can be executed inside Expo runs immediately.
 * Everything that needs a native module is logged to /api/device/commands.
 */
import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { PermissionsAndroid, Platform } from 'react-native';

import { DeviceApi, NotesApi, RemindersApi } from '@/src/api/client';
import { createCalendarEvent } from '@/src/calendar/calendar';
import { scheduleReminderNotification } from '@/src/notifications/notifications';
import { storage } from '@/src/utils/storage';
import { formatTimeOfDay, parseTimeOfDay } from '@/src/voice/timeParser';
import { speak } from '@/src/voice/voice';

/** Common app package names (Android) / URL schemes (iOS) for "open X" voice commands. */
const APP_TARGETS: Record<string, { android: string; iosScheme?: string; label: string }> = {
  whatsapp: { android: 'com.whatsapp', iosScheme: 'whatsapp://', label: 'WhatsApp' },
  chrome: { android: 'com.android.chrome', iosScheme: 'googlechrome://', label: 'Chrome' },
  gmail: { android: 'com.google.android.gm', iosScheme: 'googlegmail://', label: 'Gmail' },
  camera: { android: 'com.android.camera', label: 'Camera' },
  settings: { android: 'com.android.settings', label: 'Settings' },
  maps: { android: 'com.google.android.apps.maps', iosScheme: 'maps://', label: 'Maps' },
  youtube: { android: 'com.google.android.youtube', iosScheme: 'youtube://', label: 'YouTube' },
  spotify: { android: 'com.spotify.music', iosScheme: 'spotify://', label: 'Spotify' },
  instagram: { android: 'com.instagram.android', iosScheme: 'instagram://', label: 'Instagram' },
  facebook: { android: 'com.facebook.katana', iosScheme: 'fb://', label: 'Facebook' },
  telegram: { android: 'org.telegram.messenger', iosScheme: 'tg://', label: 'Telegram' },
};

export type IntentType =
  | 'flashlight'
  | 'call'
  | 'sms'
  | 'email'
  | 'whatsapp'
  | 'open_app'
  | 'alarm'
  | 'search'
  | 'open_web'
  | 'note'
  | 'reminder'
  | 'brightness'
  | 'volume'
  | 'copy'
  | 'chat'
  | 'unknown';

export interface Intent {
  type: IntentType;
  payload: Record<string, any>;
  original: string;
  spoken?: string;
}

export interface RunResult {
  intent: Intent;
  handled: boolean;
  message: string;
}

// ---------- parser ----------

const PATTERNS: { type: IntentType; re: RegExp; extract?: (m: RegExpMatchArray) => Record<string, any> }[] = [
  { type: 'flashlight', re: /\b(flash\s?light|torch)\b.*\b(on|start|open|enable)\b|\b(on|start|enable)\b.*\b(flash\s?light|torch)\b|flashlight\s?on|torch\s?on/i, extract: () => ({ on: true }) },
  { type: 'flashlight', re: /\b(flash\s?light|torch)\b.*\b(off|stop|close|disable)\b|\b(off|stop|disable)\b.*\b(flash\s?light|torch)\b|flashlight\s?off|torch\s?off/i, extract: () => ({ on: false }) },

  { type: 'call', re: /\b(call|dial|phone)\b\s+(?:to\s+)?([\w\s\d+()-]{2,40})/i, extract: (m) => ({ target: m[2].trim() }) },
  { type: 'whatsapp', re: /\b(?:whatsapp|whats\s?app)\b\s+(?:message\s+)?(?:to\s+)?([^,]+?)(?:\s+(?:saying|that|about)\s+(.+))?$/i, extract: (m) => ({ target: m[1]?.trim(), body: m[2]?.trim() }) },
  { type: 'sms', re: /\b(send\s+(?:sms|message|text)|text|message)\b\s+(?:to\s+)?([^,]+?)(?:\s+(?:saying|that|about)\s+(.+))?$/i, extract: (m) => ({ target: m[2]?.trim(), body: m[3]?.trim() }) },
  { type: 'email', re: /\b(email|mail)\b\s+(?:to\s+)?([^\s,]+@[^\s,]+)(?:\s+.*)?$/i, extract: (m) => ({ target: m[2].trim() }) },
  { type: 'open_app', re: /\b(?:open|launch|start)\b\s+(?!https?:\/\/|www\.)([a-z\s]{2,30})(?:\s+app)?$/i, extract: (m) => ({ appName: m[1].trim().toLowerCase() }) },
  { type: 'alarm', re: /\b(?:alarm|alaram)\b/i, extract: (m) => ({ raw: m.input || '' }) },

  { type: 'search', re: /\b(google|search(?:\s+for)?|look\s+up|find)\b\s+(.+)/i, extract: (m) => ({ query: m[2].trim() }) },
  { type: 'open_web', re: /\b(open|go\s+to|visit)\b\s+(https?:\/\/\S+|(?:www\.)?[\w-]+\.[\w.]{2,})/i, extract: (m) => ({ url: m[2] }) },

  { type: 'note', re: /\b(?:note|write\s+(?:down|note)|save\s+note)\b\s*[:,-]?\s*(.+)/i, extract: (m) => ({ text: m[1].trim() }) },
  { type: 'reminder', re: /\b(?:remind\s+me|reminder|set\s+reminder)\b\s+(?:to\s+)?(.+?)(?:\s+(?:in|at|after)\s+(.+))?$/i, extract: (m) => ({ text: m[1].trim(), when: m[2]?.trim() }) },

  { type: 'brightness', re: /\b(brightness|screen)\b.*\b(up|higher|brighter|increase|max)\b/i, extract: () => ({ direction: 'up' }) },
  { type: 'brightness', re: /\b(brightness|screen)\b.*\b(down|lower|darker|decrease|min)\b/i, extract: () => ({ direction: 'down' }) },

  { type: 'volume', re: /\bvolume\b.*\b(up|higher|louder|increase|max)\b/i, extract: () => ({ direction: 'up' }) },
  { type: 'volume', re: /\bvolume\b.*\b(down|lower|quieter|decrease|min|mute)\b/i, extract: () => ({ direction: 'down' }) },

  { type: 'copy', re: /^copy\s+(.+)/i, extract: (m) => ({ text: m[1].trim() }) },
];

const NUM_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9',
};

function normalizeDigits(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => NUM_WORDS[w.toLowerCase()] || w)
    .join(' ');
}

export function parseIntent(text: string): Intent {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  for (const p of PATTERNS) {
    const m = cleaned.match(p.re);
    if (m) {
      const payload = p.extract ? p.extract(m) : {};
      return { type: p.type, payload, original: cleaned };
    }
  }
  return { type: 'chat', payload: {}, original: cleaned };
}

// ---------- executor ----------

type TorchHandle = { setOn: (on: boolean) => void } | null;

/** Runtime hooks the router uses to talk back to the app. */
export interface RouterContext {
  torch?: TorchHandle;
  onChat: (text: string) => Promise<void> | void;
  onOpenScreen?: (path: string) => void;
}

async function extractPhone(target?: string): Promise<string | null> {
  if (!target) return null;
  const digits = normalizeDigits(target).replace(/[^\d+]/g, '');
  if (digits.length >= 4) return digits;

  // Try to resolve as a contact name (native only; no-op on web)
  if (Platform.OS === 'web') return null;
  try {
    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const query = target.replace(/[^A-Za-z\s'-]/g, '').trim();
    if (!query) return null;
    const { data } = await Contacts.getContactsAsync({
      name: query,
      fields: [Contacts.Fields.PhoneNumbers],
      pageSize: 5,
    });
    const first = data.find((c) => c.phoneNumbers && c.phoneNumbers.length > 0);
    const num = first?.phoneNumbers?.[0]?.number || null;
    return num ? num.replace(/[^\d+]/g, '') : null;
  } catch {
    return null;
  }
}

export async function executeIntent(intent: Intent, ctx: RouterContext): Promise<RunResult> {
  const t = intent.type;
  const p = intent.payload;

  try {
    if (t === 'flashlight') {
      if (ctx.torch) {
        ctx.torch.setOn(!!p.on);
        const msg = p.on ? 'Flashlight is on.' : 'Flashlight is off.';
        speak(msg);
        await DeviceApi.logCommand({ action: p.on ? 'flashlight_on' : 'flashlight_off', status: 'executed' });
        return { intent, handled: true, message: msg };
      }
      await DeviceApi.logCommand({ action: p.on ? 'flashlight_on' : 'flashlight_off', status: 'unsupported' });
      return { intent, handled: false, message: 'Flashlight needs the camera permission and a native build.' };
    }

    if (t === 'call') {
      const num = await extractPhone(p.target);
      if (!num) {
        await Linking.openURL('tel:');
        return { intent, handled: true, message: 'Opening dialer — I could not find that number.' };
      }
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
          { title: 'Phone permission', message: 'Sara needs permission to place calls for you.', buttonPositive: 'Allow' },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          try {
            // Real auto-dial — no dialer tap required.
            await IntentLauncher.startActivityAsync('android.intent.action.CALL', { data: `tel:${num}` });
            await DeviceApi.logComm({ action: 'call', contact_value: num, contact_name: p.target, status: 'confirmed' });
            const msg = `Calling ${p.target || num}.`;
            speak(msg);
            return { intent, handled: true, message: msg };
          } catch {
            // Fall through to dialer if ACTION_CALL is blocked (e.g. Play Protect policy).
          }
        }
      }
      // iOS (and Android fallback): opens the dialer pre-filled; user taps to confirm.
      await Linking.openURL(`tel:${num}`);
      await DeviceApi.logComm({ action: 'call', contact_value: num, contact_name: p.target, status: 'confirmed' });
      const msg = `Opening dialer for ${p.target || num}.`;
      speak(msg);
      return { intent, handled: true, message: msg };
    }

    if (t === 'sms') {
      const num = await extractPhone(p.target);
      const body = p.body ? `?body=${encodeURIComponent(p.body)}` : '';
      const url = `sms:${num || ''}${body}`;
      await Linking.openURL(url);
      await DeviceApi.logComm({ action: 'sms', contact_value: num || '', contact_name: p.target, message: p.body, status: 'confirmed' });
      speak('Opening messages.');
      return { intent, handled: true, message: 'Opening messages.' };
    }

    if (t === 'email') {
      const url = `mailto:${p.target}`;
      await Linking.openURL(url);
      await DeviceApi.logComm({ action: 'email', contact_value: p.target, status: 'confirmed' });
      return { intent, handled: true, message: `Opening email to ${p.target}.` };
    }

    if (t === 'whatsapp') {
      const num = await extractPhone(p.target);
      const phoneParam = num ? num.replace(/^\+/, '') : '';
      const text = p.body ? `&text=${encodeURIComponent(p.body)}` : '';
      const url = `whatsapp://send?phone=${phoneParam}${text}`;
      try {
        await Linking.openURL(url);
        await DeviceApi.logComm({ action: 'whatsapp', contact_value: num || '', contact_name: p.target, message: p.body, status: 'confirmed' });
        speak('Opening WhatsApp.');
        return { intent, handled: true, message: 'Opening WhatsApp.' };
      } catch {
        await DeviceApi.logComm({ action: 'whatsapp', contact_value: num || '', contact_name: p.target, message: p.body, status: 'failed' });
        return { intent, handled: false, message: 'WhatsApp is not installed on this device.' };
      }
    }

    if (t === 'open_app') {
      const key = Object.keys(APP_TARGETS).find((k) => p.appName.includes(k));
      if (!key) {
        await DeviceApi.logCommand({ action: 'open_app', payload: { name: p.appName }, status: 'unsupported' });
        return { intent, handled: false, message: `I don't know how to open "${p.appName}" yet.` };
      }
      const target = APP_TARGETS[key];
      try {
        if (Platform.OS === 'android') {
          await Linking.sendIntent('android.intent.action.MAIN', [
            { key: 'package', value: target.android },
          ]).catch(async () => {
            // Fallback: try the launch-by-package-name intent scheme.
            await Linking.openURL(`intent://#Intent;package=${target.android};end`);
          });
        } else if (target.iosScheme) {
          await Linking.openURL(target.iosScheme);
        }
        await DeviceApi.logCommand({ action: 'open_app', payload: { name: target.label }, status: 'executed' });
        speak(`Opening ${target.label}.`);
        return { intent, handled: true, message: `Opening ${target.label}.` };
      } catch {
        await DeviceApi.logCommand({ action: 'open_app', payload: { name: target.label }, status: 'failed' });
        return { intent, handled: false, message: `Couldn't open ${target.label} — is it installed?` };
      }
    }

    if (t === 'search') {
      const q = encodeURIComponent(p.query);
      await WebBrowser.openBrowserAsync(`https://www.google.com/search?q=${q}`);
      speak(`Searching for ${p.query}.`);
      return { intent, handled: true, message: `Searching Google for "${p.query}".` };
    }

    if (t === 'open_web') {
      let url = p.url as string;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      await WebBrowser.openBrowserAsync(url);
      return { intent, handled: true, message: `Opening ${url}.` };
    }

    if (t === 'alarm') {
      const time = parseTimeOfDay(p.raw || intent.original);
      if (!time) {
        return { intent, handled: false, message: "What time should I set the alarm for? Try 'set alarm for 9 baje subah'." };
      }
      if (Platform.OS !== 'android') {
        return { intent, handled: false, message: 'Voice-set alarms need an Android device.' };
      }
      try {
        await Linking.sendIntent('android.intent.action.SET_ALARM', [
          { key: 'android.intent.extra.alarm.HOUR', value: String(time.hour) },
          { key: 'android.intent.extra.alarm.MINUTES', value: String(time.minute) },
          { key: 'android.intent.extra.alarm.SKIP_UI', value: 'true' },
          { key: 'android.intent.extra.alarm.MESSAGE', value: 'Hello Sara' },
        ]);
        await DeviceApi.logCommand({ action: 'alarm_set', payload: { hour: time.hour, minute: time.minute }, status: 'executed' });
        const msg = `Alarm set for ${formatTimeOfDay(time)}.`;
        speak(msg);
        return { intent, handled: true, message: msg };
      } catch {
        await DeviceApi.logCommand({ action: 'alarm_set', payload: { hour: time.hour, minute: time.minute }, status: 'failed' });
        return { intent, handled: false, message: 'Could not set the alarm on this device.' };
      }
    }

    if (t === 'note') {
      await NotesApi.create({ title: p.text.slice(0, 60), content: p.text, tags: ['voice'], color: 'purple' });
      speak('Note saved.');
      return { intent, handled: true, message: 'Note saved.' };
    }

    if (t === 'reminder') {
      const wantsAlarm = /\balarm\b/i.test(intent.original);
      const wantsCalendar = /\bcalendar\b/i.test(intent.original);

      // Prefer an absolute time ("9 baje subah", "at 6pm") over a relative one ("in 30 min").
      const absoluteTime = parseTimeOfDay(intent.original);
      let atDate: Date;
      if (absoluteTime) {
        atDate = new Date();
        atDate.setHours(absoluteTime.hour, absoluteTime.minute, 0, 0);
        if (atDate.getTime() <= Date.now()) atDate.setDate(atDate.getDate() + 1); // already passed today -> tomorrow
      } else {
        const remindIn = parseWhen(p.when);
        atDate = new Date(Date.now() + remindIn * 60_000);
      }
      const at = atDate.toISOString();

      const created = await RemindersApi.create({ title: p.text, remind_at: at });
      const notifId = await scheduleReminderNotification(created.reminder_id, p.text, undefined, at);
      if (notifId) await storage.setItem(`hs.reminder.notif.${created.reminder_id}`, notifId);

      const extras: string[] = [];

      if (wantsAlarm && Platform.OS === 'android') {
        try {
          await Linking.sendIntent('android.intent.action.SET_ALARM', [
            { key: 'android.intent.extra.alarm.HOUR', value: String(atDate.getHours()) },
            { key: 'android.intent.extra.alarm.MINUTES', value: String(atDate.getMinutes()) },
            { key: 'android.intent.extra.alarm.SKIP_UI', value: 'true' },
            { key: 'android.intent.extra.alarm.MESSAGE', value: p.text },
          ]);
          extras.push('an alarm');
        } catch { /* alarm intent not supported on this device — notification still stands */ }
      }

      if (wantsCalendar) {
        const eventId = await createCalendarEvent({ title: p.text, startDate: atDate });
        if (eventId) extras.push('a calendar event');
      }

      const timeLabel = absoluteTime ? formatTimeOfDay(absoluteTime) : (p.when || 'in 30 minutes');
      const extraLabel = extras.length ? ` with ${extras.join(' and ')}` : '';
      const msg = `Reminder set for ${timeLabel}${extraLabel}.`;
      speak(msg);
      return { intent, handled: true, message: msg };
    }

    if (t === 'brightness') {
      if (Platform.OS !== 'web') {
        try {
          const cur = await Brightness.getBrightnessAsync();
          const next = Math.max(0, Math.min(1, cur + (p.direction === 'up' ? 0.2 : -0.2)));
          await Brightness.setBrightnessAsync(next);
          await DeviceApi.logCommand({ action: p.direction === 'up' ? 'brightness_up' : 'brightness_down', status: 'executed' });
          speak(`Brightness ${p.direction}.`);
          return { intent, handled: true, message: `Brightness ${p.direction}.` };
        } catch {}
      }
      await DeviceApi.logCommand({ action: p.direction === 'up' ? 'brightness_up' : 'brightness_down', status: 'unsupported' });
      return { intent, handled: false, message: 'Brightness control needs a native build.' };
    }

    if (t === 'volume') {
      await DeviceApi.logCommand({ action: p.direction === 'up' ? 'volume_up' : 'volume_down', status: 'unsupported' });
      return { intent, handled: false, message: 'Volume needs a native build.' };
    }

    if (t === 'copy') {
      await Clipboard.setStringAsync(p.text);
      speak('Copied.');
      return { intent, handled: true, message: 'Copied to clipboard.' };
    }

    // Fallback: forward to chat
    await ctx.onChat(intent.original);
    return { intent, handled: true, message: 'Asking Sara…' };
  } catch (e: any) {
    return { intent, handled: false, message: e?.message || 'Command failed.' };
  }
}

function parseWhen(when?: string): number {
  if (!when) return 30;
  const lower = when.toLowerCase();
  const m = lower.match(/(\d+)\s*(min|minute|hour|hr|day)/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    if (unit.startsWith('hour') || unit === 'hr') return n * 60;
    if (unit.startsWith('day')) return n * 60 * 24;
    return n;
  }
  if (lower.includes('tomorrow')) return 60 * 20;
  if (lower.includes('hour')) return 60;
  return 30;
}
