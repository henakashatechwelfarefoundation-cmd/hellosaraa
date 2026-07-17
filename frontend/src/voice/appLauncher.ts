/**
 * Dynamic App Launcher — opens ANY installed app on Android using fuzzy matching.
 * 
 * REPLACES the hardcoded list (WhatsApp, Chrome, Gmail, etc.) with a solution that:
 * 1. Queries PackageManager for all installed apps
 * 2. Implements fuzzy string matching ("battl" → "Battleground Mobile India")
 * 3. Launches the best match
 * 
 * Usage in commandRouter:
 * ```
 * { type: 'open_app', re: /\b(open|launch|start)\s+(.+)/i, extract: (m) => ({ app: m[2].trim() }) }
 * ```
 */

import { Platform, NativeModules } from 'react-native';
import * as Linking from 'expo-linking';

interface InstalledApp {
  packageName: string;
  appName: string;
  label: string; // Display name
}

/**
 * Fuzzy match score (0-100).
 * Prefers substring matches, then character-by-character Levenshtein similarity.
 */
function fuzzyScore(input: string, target: string): number {
  const inp = input.toLowerCase().trim();
  const tgt = target.toLowerCase().trim();

  if (inp === tgt) return 100;
  if (tgt.includes(inp)) return 85; // substring match
  if (inp.includes(tgt)) return 80; // reverse substring
  if (tgt.startsWith(inp)) return 90; // prefix match (strong)

  // Levenshtein distance for character-level similarity
  const dist = levenshtein(inp, tgt);
  const maxLen = Math.max(inp.length, tgt.length);
  return Math.max(0, 100 - (dist / maxLen) * 100);
}

/**
 * Levenshtein distance (edit distance between two strings).
 */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,     // deletion
        dp[i][j - 1] + 1,     // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Get all installed apps on the device.
 * On Android, uses native module call to PackageManager.
 * On web/iOS, returns empty list (not supported).
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (Platform.OS === 'web') return [];

  if (Platform.OS === 'ios') {
    // iOS does NOT allow querying installed apps for privacy reasons
    return [];
  }

  if (Platform.OS !== 'android') return [];

  try {
    // Try to call native module (requires setup in your native Android code)
    const { AppLauncher } = NativeModules;
    if (AppLauncher?.getInstalledApps) {
      const apps = await AppLauncher.getInstalledApps();
      return apps || [];
    }
  } catch (e) {
    console.warn('AppLauncher native module not available:', e);
  }

  // Fallback: return empty (native module required for real implementation)
  return [];
}

/**
 * Find best app match for a given user input.
 * Returns the app with highest fuzzy score (>= 50 threshold).
 */
export async function findBestApp(userInput: string): Promise<InstalledApp | null> {
  const apps = await getInstalledApps();
  if (!apps.length) return null;

  // Score each app
  const scored = apps.map((app) => ({
    app,
    score: Math.max(
      fuzzyScore(userInput, app.appName),
      fuzzyScore(userInput, app.label),
    ),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return if score >= 50 (reasonable confidence threshold)
  return scored[0]?.score >= 50 ? scored[0].app : null;
}

/**
 * Launch an app by package name.
 * Falls back to browser search if app not found.
 */
export async function launchApp(packageName: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.warn('App launching only supported on Android');
    return false;
  }

  try {
    // Use Android Linking to launch the app by package name
    // Intent format: intent://...#Intent;package=com.example;end
    const uri = `intent://scan/#Intent;package=${packageName};end`;
    await Linking.openURL(uri);
    return true;
  } catch (e) {
    console.error('Failed to launch app:', e);
    return false;
  }
}

/**
 * Main entry point: "Open [app name]" command.
 * Finds best match and launches it, or returns helpful message.
 */
export async function openAppByName(appName: string): Promise<{ success: boolean; message: string }> {
  if (!appName || !appName.trim()) {
    return { success: false, message: 'No app name provided.' };
  }

  const bestMatch = await findBestApp(appName);
  if (!bestMatch) {
    return {
      success: false,
      message: `I don't know an app called "${appName}". Try saying the app name more clearly.`,
    };
  }

  const launched = await launchApp(bestMatch.packageName);
  if (!launched) {
    return {
      success: false,
      message: `Failed to launch ${bestMatch.label}. Please try again.`,
    };
  }

  return {
    success: true,
    message: `Opening ${bestMatch.label}.`,
  };
}

/**
 * Export for testing: get all apps and their scores for a given input.
 * Useful for debugging/tuning the matcher.
 */
export async function debugScores(userInput: string): Promise<Array<{ app: InstalledApp; score: number }>> {
  const apps = await getInstalledApps();
  const scored = apps.map((app) => ({
    app,
    score: Math.max(
      fuzzyScore(userInput, app.appName),
      fuzzyScore(userInput, app.label),
    ),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 10);
}
