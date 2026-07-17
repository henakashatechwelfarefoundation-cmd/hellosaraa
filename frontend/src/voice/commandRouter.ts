/**
 * Voice command router — UPDATED VERSION WITH DYNAMIC APP LAUNCHING
 * 
 * NEW: Added "open_app" intent to open ANY installed app using fuzzy matching.
 * 
 * Changes from original:
 * - Added "open_app" to IntentType
 * - Added regex pattern for "open app" commands
 * - Integrated with appLauncher module for dynamic app discovery
 * - Removed hardcoded app list
 */

import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { DeviceApi, NotesApi, RemindersApi } from '@/src/api/client';
import { speak } from '@/src/voice/voice';
import { openAppByName } from '@/src/voice/appLauncher'; // NEW IMPORT

export type IntentType =
  | 'flashlight'
  | 'call'
  | 'sms'
  | 'email'
  | 'search'
  | 'open_web'
  | 'open_app'  // ← NEW
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
  // Existing patterns...
  { type: 'flashlight', re: /\b(flash\s?light|torch)\b.*\b(on|start|open|enable)\b|\b(on|start|enable)\b.*\b(flash\s?light|torch)\b|flashlight\s?on|torch\s?on/i, extract: () => ({ on: true }) },
  { type: 'flashlight', re: /\b(flash\s?light|torch)\b.*\b(off|stop|close|disable)\b|\b(off|stop|disable)\b.*\b(flash\s?light|torch)\b|flashlight\s?off|torch\s?off/i, extract: () => ({ on: false }) },

  { type: 'call', re: /\b(call|dial|phone)\b\s+(?:to\s+)?([\w\s\d+()-]{2,40})/i, extract: (m) => ({ target: m[2].trim() }) },
  { type: 'sms', re: /\b(send\s+(?:sms|message|text)|text|message)\b\s+(?:to\s+)?([^,]+?)(?:\s+(?:saying|that|about)\s+(.+))?$/i, extract: (m) => ({ target: m[2]?.trim(), body: m[3]?.trim() }) },
  { type: 'email', re: /\b(email|mail)\b\s+(?:to\s+)?([^\s,]+@[^\s,]+)(?:\s+.*)?$/i, extract: (m) => ({ target: m[2].trim() }) },

  { type: 'search', re: /\b(google|search(?:\s+for)?|look\s+up|find)\b\s+(.+)/i, extract: (m) => ({ query: m[2].trim() }) },
  { type: 'open_web', re: /\b(open|go\s+to|visit)\b\s+(https?:\/\/\S+|(?:www\.)?[\w-]+\.[\w.]{2,})/i, extract: (m) => ({ url: m[2] }) },

  // NEW: Open any app with fuzzy matching
  // Matches: "open whatsapp", "launch instagram", "start battleground", etc.
  { type: 'open_app', re: /\b(open|launch|start|run)\s+(.+)/i, extract: (m) => ({ app: m[2].trim() }) },

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
      const url = `tel:${num || ''}`;
      await Linking.openURL(url);
      await DeviceApi.logComm({ action: 'call', contact_value: num || '', contact_name: p.target, status: 'confirmed' });
      const msg = num ? `Calling ${p.target}.` : `Opening dialer.`;
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

    // NEW: Dynamic app opening with fuzzy matching
    if (t === 'open_app') {
      const result = await openAppByName(p.app);
      await DeviceApi.logCommand({
        action: 'open_app',
        payload: { app_name: p.app, matched_app: result.success ? p.app : null },
        status: result.success ? 'executed' : 'failed',
      });
      speak(result.message);
      return { intent, handled: result.success, message: result.message };
    }

    if (t === 'note') {
      await NotesApi.create({ title: p.text.slice(0, 60), content: p.text, tags: ['voice'], color: 'purple' });
      speak('Note saved.');
      return { intent, handled: true, message: 'Note saved.' };
    }

    if (t === 'reminder') {
      const remindIn = parseWhen(p.when);
      const at = new Date(Date.now() + remindIn * 60_000).toISOString();
      await RemindersApi.create({ title: p.text, remind_at: at });
      speak(`Reminder set for ${p.when || 'in 30 minutes'}.`);
      return { intent, handled: true, message: `Reminder set for ${p.when || 'in 30 minutes'}.` };
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
