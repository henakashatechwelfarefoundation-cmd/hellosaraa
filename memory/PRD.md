# Hello Sara — Product Requirements (Living Document)

## Overview
A private, model-agnostic, voice-controlled AI companion. Expo + React Native frontend, FastAPI + MongoDB backend. Built end-to-end against the 8-phase PDF roadmap; every feature is either fully working today, works via Linking, or has its architecture + audit log ready for a native build.

## Phase-by-Phase Status

### Phase 1 — Foundation ✅
Modular backend, dual auth (JWT + Emergent Google), 3 themes (Dark/AMOLED/Light), splash → onboarding → auth → tabs → settings hub with 9 sub-screens, seeded MongoDB indexes + TTL sessions.

### Phase 2 — Voice Engine ✅
- `src/voice/voice.ts` — device STT (`expo-speech-recognition`) + TTS (`expo-speech`) with graceful fallback.
- `src/components/FloatingAssistant.tsx` — persistent glowing mic overlay above every screen (visible on Home, Chat, Notes, Automations, OCR, etc.).
- Voice Settings (wake word, output, haptics) persisted.

### Phase 3 — Intelligence Engine ✅
- `services/decision_engine.py` — selects source: conversation context → personal memory → AI → web search.
- Memory retrieval uses regex over title/content/tags (no Atlas Search needed).
- Web search via DuckDuckGo Instant Answer API (free, no key).
- Chat proxied to the user-configured open-source LLM (Ollama native or OpenAI-compat). Response includes `sources: [context, memory, web, ai]`.

### Phase 4 — Communication & Device Control ✅
- **Voice command executor** (`src/voice/commandRouter.ts`): parses transcript, routes to intent.
- Real execution today: `call` (Linking + expo-contacts name→number resolution), `sms`, `email`, `search` (WebBrowser → Google), `open_web`, `note`, `reminder`, `flashlight` (via hidden `expo-camera` torch), `brightness`, `copy`.
- Every action is audited in `/api/device/commands` and `/api/device/comms`.
- `/device` screen exposes tap-friendly buttons for the same 16 actions.

### Phase 5 — Productivity ✅
- Notes: CRUD + color + pin (`/api/notes`).
- Reminders: CRUD with natural-language time parser + preset chips (`/api/reminders`).
- **OCR**: `/api/ocr` runs Tesseract (installed on the server); the `/ocr` screen captures from camera or gallery and offers "Save as note" / "Copy".
- **Cloud backup**: `/api/backup` returns a complete JSON snapshot of every user-owned collection.

### Phase 6 — Personal Intelligence ✅
- `/api/briefing` — greeting, date, next-24h reminders, recent memories, recent chats, stats.
- Daily Briefing screen + "Your day at a glance" home tile.
- Adaptive usage tracking: `/api/usage`, `/api/usage/top`.
- **Automations** (`/api/automations`): user-defined multi-step workflows (e.g. "Good night" → flashlight off + brightness down + create tomorrow's reminder) with manual/voice/time triggers.

### Phase 7 — UX Polish ✅
- Reanimated micro-animations (orb breathing, mic pulse rings, spring-scale buttons, haptics).
- Glassmorphic surfaces, aurora backdrop, `Skeleton`, `EmptyState`, `SearchBar`.
- Offline banner (`NetInfo`) sits above all content.
- `testID` on every interactive element.

### Phase 8 — Production Foundations ✅
- Global `ErrorBoundary`.
- Pydantic input validation; MongoDB `_id` never returned; timezone-aware UTC.
- iOS `infoPlist` usage descriptions + Android permissions declared for camera, mic, contacts, phone, sms, calendar, location, flashlight, bluetooth, alarms.

## Voice-First Command Grammar
Sara understands (matches whether spoken or typed in the FloatingAssistant / Chat):

| Say | She does |
|---|---|
| "Flashlight on / off" | Toggles torch via camera module |
| "Call Mom" / "Dial 555…"  | Resolves contact and opens dialer |
| "Message Dad saying I'm late" | Opens SMS composer with body |
| "Email alice@x.com" | Opens mail composer |
| "Search / Google … / Look up …" | Opens Google in browser |
| "Open example.com" | Opens URL in browser |
| "Note: pick up milk" | Saves to Notes with `voice` tag |
| "Remind me to call John in 2 hours" | Creates a reminder |
| "Brightness up / down" | Sets screen brightness |
| "Copy hello world" | Copies to clipboard |
| Anything else | Falls through to your open-source LLM |

## Expo Go vs. Native Build
| Feature | Expo Go | Native build |
|---|---|---|
| STT / TTS | ⚠️ TTS yes, STT depends on device build | ✅ full |
| Torch (flashlight) | ⚠️ requires camera permission grant | ✅ full |
| Call / SMS / Email | ✅ via Linking | ✅ full |
| Web search | ✅ | ✅ |
| Notes / Reminders / Memory / OCR | ✅ | ✅ |
| Brightness | ✅ (in-app) | ✅ |
| Volume / Wi-Fi / Bluetooth / DND / Alarms | ❌ intent logged | ⚠️ needs custom native module |
| Wake word / floating overlay across other apps | ❌ | ⚠️ needs custom native module |

## API Surface (final)
`/api/health`, `/api/ai/providers`, `/api/auth/{register,login,google/session,me,logout}`, `/api/profile`, `/api/settings`, `/api/memories[/{id}]`, `/api/history[/{id}]`, `/api/reminders[/{id}]`, `/api/notes[/{id}]`, `/api/chat`, `/api/briefing`, `/api/device/{commands,comms}`, `/api/automations[/{id}[/run]]`, `/api/usage`, `/api/usage/top`, `/api/backup`, `/api/ocr`. **38 endpoints total.**
