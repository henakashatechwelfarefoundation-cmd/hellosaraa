/**
 * Parses spoken time-of-day phrases (Hindi/Hinglish + English) into a 24-hour
 * {hour, minute} pair. Used by the voice command router for "set alarm at 9am",
 * "9 baje subah alarm laga do", "shaam 6 baje reminder", etc.
 *
 * Best-effort: ambiguous phrasing (no AM/PM or period word) defaults to AM
 * and the router speaks back the interpreted time so the user can correct it.
 */
export interface TimeOfDay {
  hour: number;   // 0-23
  minute: number; // 0-59
}

const PERIOD_WORDS: Record<string, 'am' | 'pm' | 'pm-evening'> = {
  subah: 'am', subh: 'am', savere: 'am', morning: 'am',
  dopahar: 'pm', dopaher: 'pm', afternoon: 'pm', noon: 'pm',
  shaam: 'pm-evening', sham: 'pm-evening', evening: 'pm-evening',
  raat: 'pm-evening', rat: 'pm-evening', night: 'pm-evening',
};

function applyPeriod(hour: number, period: 'am' | 'pm' | 'pm-evening' | null): number {
  if (period === null) return hour; // caller decides default
  if (period === 'am') return hour === 12 ? 0 : hour;
  // 'pm' (dopahar/noon) and 'pm-evening' (shaam/raat) both push into 24h PM range
  if (hour === 12) return 12;
  return hour < 12 ? hour + 12 : hour;
}

/**
 * Extracts a time from free text. Returns null if no time phrase was found.
 */
export function parseTimeOfDay(text: string): TimeOfDay | null {
  const lower = text.toLowerCase();

  // Find a period word anywhere in the phrase (Hindi or English).
  let period: 'am' | 'pm' | 'pm-evening' | null = null;
  for (const [word, p] of Object.entries(PERIOD_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) { period = p; break; }
  }

  // English am/pm suffix, e.g. "9pm", "9:30 am"
  const ampmMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const suffix = ampmMatch[3];
    if (suffix === 'pm' && hour !== 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    return { hour: clampHour(hour), minute: clampMin(minute) };
  }

  // "9 baje", "9:30 baje", "9 bajke 30 minute"
  const bajeMatch = lower.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(?:baje|bajkar|bajke)\b(?:\s*(\d{1,2})\s*(?:minute|min))?/);
  if (bajeMatch) {
    let hour = parseInt(bajeMatch[1], 10);
    const minute = bajeMatch[2] ? parseInt(bajeMatch[2], 10) : (bajeMatch[3] ? parseInt(bajeMatch[3], 10) : 0);
    hour = applyPeriod(hour, period ?? 'am'); // default AM if no period word found
    return { hour: clampHour(hour), minute: clampMin(minute) };
  }

  // Bare "at 9", "9 o'clock" with a period word nearby (e.g. "raat 9 o'clock")
  const bareMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:o'?clock)?\b/);
  if (bareMatch && (period || /\bat\b|o'?clock/.test(lower))) {
    let hour = parseInt(bareMatch[1], 10);
    const minute = bareMatch[2] ? parseInt(bareMatch[2], 10) : 0;
    hour = applyPeriod(hour, period ?? 'am');
    return { hour: clampHour(hour), minute: clampMin(minute) };
  }

  return null;
}

function clampHour(h: number): number { return Math.max(0, Math.min(23, h)); }
function clampMin(m: number): number { return Math.max(0, Math.min(59, m)); }

export function formatTimeOfDay(t: TimeOfDay): string {
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  const suffix = t.hour < 12 ? 'AM' : 'PM';
  const mm = t.minute.toString().padStart(2, '0');
  return `${h12}:${mm} ${suffix}`;
}
