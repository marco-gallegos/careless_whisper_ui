# PRD: Audio Translator (careless_whisper_ui)

Status: describes current behavior as of 2026-10-04. Not a roadmap.

## 1. Summary

A browser app to record audio and turn it into text. Recordings are always stored locally first; transcription is
a separate, retryable step performed by a configurable HTTP service. By default that service is the local
`careless_whisper` Whisper API running on the same Mac under launchd, so audio does not leave the machine.

## 2. Goals

- Never lose a recording: persist audio before any network call.
- Transcribe through a service the user controls; the endpoint must be swappable without code changes.
- Make failure cheap: if transcription fails, the user retries from the UI.
- Make the latest transcript instantly usable (auto-copy to clipboard).

## 3. Non-goals (current)

- No accounts, sync, or server-side storage; all data lives in the browser's IndexedDB.
- No streaming/live transcription; transcription starts after recording stops.
- No translation between languages, despite the "translation" naming in code. The service returns a transcript in the spoken language.
- No automatic retry/queue. Retry is manual.
- No Google/Azure providers (earlier config existed, never implemented).

## 4. Users

Single user (the owner) on a personal machine, using Chrome/Firefox/Safari with MediaRecorder support.

## 5. Core flow

```mermaid
flowchart TD
    A([User records audio]) --> B["Save recording to IndexedDB<br/>status: pending"]
    B -->|save fails| E1["Show error banner<br/>(nothing saved)"]
    B --> C["POST audio to transcription service<br/>(provider + URL from .env)"]
    C -->|2xx with text| D["Save transcript<br/>status: done"]
    D --> F["Copy text to clipboard"]
    C -->|network error or non-2xx| G["Keep recording<br/>status: failed + error message"]
    G --> H["History shows 'Not transcribed'"]
    H -->|user clicks Transcribe| C
    F --> I["History shows transcript"]
    I -->|user clicks Retranscribe| C
```

### Functional requirements

| # | Requirement |
| --- | --- |
| F1 | User can record audio with a live waveform visualization; mic permission is requested via the browser. |
| F2 | Recordings are `audio/webm;codecs=opus` and are saved to IndexedDB (Dexie) with duration and timestamp **before** transcription starts. Initial record: `status: "pending"`, `text: ""`. |
| F3 | After saving, the app calls the transcription service once. On success the record is updated with `text`, `status: "done"`, `error: null`. |
| F4 | On failure (network error or non-2xx) the record keeps its audio and gets `status: "failed"` plus the error message. No global error banner; the failure is shown on the record. |
| F5 | Each history item has a button: **Transcribe** (pending/failed) or **Retranscribe** (done). It re-sends the stored audio, and the new result replaces the text. The recording timestamp is not changed. |
| F6 | Successful non-empty transcripts are copied to the clipboard automatically. |
| F7 | History lists recordings newest first with play, copy (disabled when no text), transcribe/retranscribe, delete. Empty successful transcripts show "(no speech detected)". |
| F8 | Export history as JSON, SQLite script, or MongoDB script (generated client-side; no database connection is made). Reached from the navbar menu (☰ → Export data), which opens a modal (full screen on phones). |
| F9 | Records created before `status` existed are treated as `done`. |
| F10 | Only one transcription runs at a time (UI disables record/transcribe buttons while one is in progress). |

## 6. Transcription service contract

Configured via `.env` (all `VITE_`-prefixed, read at build/dev start):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_TRANSCRIPTION_PROVIDER` | `local` | Request shape: `local` or `openai` |
| `VITE_TRANSCRIPTION_API_URL` | provider default | Base URL override (any host) |
| `VITE_WHISPER_MODEL` | `base` / `whisper-1` | Model name |
| `VITE_TRANSCRIPTION_API_KEY` | empty | Optional `Authorization: Bearer` |

Providers (`src/services/translationService.js`):

- `local`: `POST {url}/transcribe-text-only?model={model}`, multipart field `file`. Response `{ "text", "language", "processing_time" }`.
- `openai`: `POST {url}/audio/transcriptions`, multipart fields `file`, `model`. Response `{ "text" }`. Works with any OpenAI-compatible server.

Both send the file as `audio.<ext>` derived from the blob MIME type (webm by default). The service must accept
webm; the local API accepts mp3, wav, m4a, ogg, flac, webm, mp4 and requires `ffmpeg`.

## 7. Local service (dependency)

Repo: `~/code/python/careless_whisper`. FastAPI + OpenAI Whisper, port **8765**, CORS open to all origins,
managed by launchd agent `com.marcogallegos.translateapi` (`RunAtLoad`, `KeepAlive`) via `make load|status|logs|reload|unload`.

## 8. Data model (IndexedDB `AudioTranslationDB.translations`)

| Field | Notes |
| --- | --- |
| `id` | `Date.now()` at record time (indexed key) |
| `timestamp` | ISO string of recording time (indexed) |
| `text` | Transcript, `""` until transcribed |
| `status` | `pending` / `done` / `failed` (not indexed) |
| `error` | Last failure message or `null` |
| `duration` | Seconds |
| `audioData` + `mimeType` | Audio bytes (ArrayBuffer) and type; turned back into a Blob on read |

No schema version bump was needed: `status` and `error` are non-indexed fields.

## 9. Known limitations / risks

- IndexedDB is per-browser/per-origin and can be cleared by the browser; export is the only backup.
- A page closed while status is `pending` leaves a record stuck as "Transcribing..."; the user can still click **Transcribe**.
- `VITE_TRANSCRIPTION_API_KEY` is shipped in the client bundle; do not use a real secret for a hosted build.
- The local API reloads the Whisper model on every request (caching is commented out in `api.py`), so each transcription pays the load time.
- The local API listens on `0.0.0.0` with open CORS; anyone on the network can use it.
- Blob URLs are recreated on every list reload and not revoked (small memory leak in long sessions).
- Stored audio can be large; there is no quota handling or retention policy.
- `prop-types` is imported by the context but is not declared in `package.json`.

## 10. Success criteria

- Stopping a recording always results in a saved item, even with the service down.
- With the service up, a transcript appears and is on the clipboard without further clicks.
- With the service down, the item shows "Not transcribed" and succeeds on **Transcribe** once the service is back.
- Pointing `VITE_TRANSCRIPTION_API_URL` at another compatible endpoint works with no code change.
