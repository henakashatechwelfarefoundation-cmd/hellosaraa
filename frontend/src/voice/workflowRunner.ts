/**
 * Workflow executor — runs an automation's steps sequentially through the
 * same CommandRouter the voice/text interfaces use. Skips unknown steps.
 */
import { executeIntent, Intent, IntentType, RouterContext } from './commandRouter';

export interface WorkflowStep {
  action: string;
  payload?: Record<string, any>;
}

const KNOWN: IntentType[] = [
  'flashlight', 'call', 'sms', 'email', 'search', 'open_web',
  'note', 'reminder', 'brightness', 'volume', 'copy',
];

function toIntent(step: WorkflowStep): Intent {
  const action = step.action || '';
  // Map common action keys to CommandRouter intents.
  if (action.startsWith('flashlight_')) {
    return { type: 'flashlight', payload: { on: action.endsWith('_on') }, original: action };
  }
  if (action.startsWith('brightness_')) {
    return { type: 'brightness', payload: { direction: action.endsWith('_up') ? 'up' : 'down' }, original: action };
  }
  if (action.startsWith('volume_')) {
    return { type: 'volume', payload: { direction: action.endsWith('_up') ? 'up' : 'down' }, original: action };
  }
  if ((KNOWN as string[]).includes(action)) {
    return { type: action as IntentType, payload: step.payload || {}, original: action };
  }
  return { type: 'unknown', payload: step.payload || {}, original: action };
}

export async function runWorkflow(
  steps: WorkflowStep[],
  ctx: RouterContext,
): Promise<{ ran: number; skipped: number }> {
  let ran = 0;
  let skipped = 0;
  for (const step of steps) {
    const intent = toIntent(step);
    if (intent.type === 'unknown') { skipped++; continue; }
    const res = await executeIntent(intent, ctx);
    if (res.handled) ran++; else skipped++;
    // small delay so system UI (e.g. dialer opening) doesn't collide
    await new Promise((r) => setTimeout(r, 300));
  }
  return { ran, skipped };
}
