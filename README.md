# Audio Translator

A React web application for recording audio and transcribing it to text using a **local Whisper service** running on this machine ([careless_whisper](../../python/careless_whisper), managed by launchd). No audio leaves your computer. Built with React 18, Vite, and Bootstrap.

## Features

- 🎤 **Audio Recording**: Record audio with live visualization
- 🔄 **Speech-to-Text Translation**: Convert audio to text using the local Whisper API
- 🔄 **Reprocess Translations**: Re-run translation on existing audio recordings
- 💾 **Local Storage**: Store recordings and translations locally using IndexedDB
- 📋 **Auto-Copy**: Automatically copy latest translation to clipboard
- 📚 **Translation History**: Browse and manage previous translations
- ⭐ **Favorites & tags**: Star transcripts, then tag favorites and filter by tag in the admin pages
- 🗂️ **Transcripts admin**: Search, filter, tag and delete transcripts (`#/admin`, `#/admin/tags`)
- 🌐 **Translate / Agent buttons**: Send a transcript to your own configurable endpoints
- ⚙️ **Settings UI**: Override the `.env` defaults from the browser
- 📤 **Export Options**: Export data to JSON, SQLite, or MongoDB
- 🎨 **Modern UI**: Clean interface built with React Bootstrap
- 📖 **Storybook**: Component documentation and testing

## Tech Stack

- **React 18**
- **Vite** - Fast build tool
- **Bootstrap 5** - Responsive UI framework
- **Dexie** - IndexedDB wrapper for local storage
- **Storybook** - Component development environment

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- The local transcription service installed and running (see [Local Transcription Service](#local-transcription-service))

### Installation

1. Clone the repository and enter it:
```bash
git clone <repository-url>
cd careless_whisper_ui
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. (Optional) Adjust `.env` if your service runs elsewhere or you want a different model. Defaults work with the stock launchd setup.

### Development

Start the development server:
```bash
npm run dev
```

Start Storybook:
```bash
npm run storybook
```

### Build

Build for production:
```bash
npm run build
```

## Configuration

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_TRANSCRIPTION_PROVIDER` | `local` | `local` (careless_whisper API) or `openai` (any OpenAI-compatible server) |
| `VITE_TRANSCRIPTION_API_URL` | provider default (`/whisper`, proxied to `http://localhost:8765` / `https://api.openai.com/v1`) | Base URL override, use your own endpoint |
| `WHISPER_PROXY_TARGET` | `http://localhost:8765` | Where the dev/preview server forwards `/whisper/*` (not exposed to the browser) |
| `VITE_WHISPER_MODEL` | `base` (local) / `whisper-1` (openai) | Model name sent to the service |
| `VITE_TRANSCRIPTION_API_KEY` | _empty_ | Optional bearer token (bundled into client code, not a secret) |

Vite only exposes variables prefixed with `VITE_`; restart `npm run dev` after changing `.env`.

Google Speech-to-Text and Azure Speech were listed in earlier versions but never implemented, so they were removed.
To add a provider, add an entry to `providers` in `src/services/translationService.js`.

### Settings UI (overrides)

Open the menu (☰) → **Settings**. Every value defaults to what is in `.env`; anything you enter overrides it. An empty
field means "use the default" and the placeholder shows what that default is. Overrides are saved in this browser's
`localStorage` (API keys included, in plain text) and take effect immediately; **Reset to defaults** clears them.

| Setting | `.env` default |
| --- | --- |
| Transcription provider / base URL / model / API key | `VITE_TRANSCRIPTION_PROVIDER`, `VITE_TRANSCRIPTION_API_URL`, `VITE_WHISPER_MODEL`, `VITE_TRANSCRIPTION_API_KEY` |
| Translation URL / target language / API key | `VITE_TRANSLATE_API_URL`, `VITE_TRANSLATE_TARGET_LANGUAGE` (default `English`), `VITE_TRANSLATE_API_KEY` |
| Agent URL / API key | `VITE_AGENT_API_URL`, `VITE_AGENT_API_KEY` |

### Translate and Agent buttons

Each history item with a transcript has **Translate** and **Agent** buttons. Each one `POST`s JSON to its configured
URL (the full URL; nothing is appended), with `Authorization: Bearer <key>` if a key is set:

```jsonc
// Translate
{ "action": "translate", "text": "<transcript>", "target_language": "English", "id": 1728000000000, "timestamp": "<ISO>" }
// Agent
{ "action": "agent_instruction", "text": "<transcript as the instruction>", "id": 1728000000000, "timestamp": "<ISO>" }
```

The reply can be plain text, a JSON string, or a JSON object with the result as a string in the first of
`text`, `translation`, `translatedText`, `result`, `output`, `response`, `answer`, `message`, `content`. The result is
saved on the record and shown under it (with a Copy link). Errors (not configured, unreachable, non-2xx, no text) show in the
error banner. If an endpoint is on another origin it must allow CORS from this app.

### Recording flow

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

1. Record → the audio is saved to IndexedDB immediately (status `pending`).
2. The app tries to transcribe it. On success the text is saved on the record (`done`) and copied to the clipboard.
3. On failure the recording stays saved with status `failed` and the error message. Use the **Transcribe** button in the history to retry.

See [docs/PRD.md](docs/PRD.md) for the full product description.

### Local Transcription Service

With the `local` provider, `src/services/translationService.js` sends each recording as multipart form data to
`POST {VITE_TRANSCRIPTION_API_URL}/transcribe-text-only?model={VITE_WHISPER_MODEL}` and uses the
returned `text`. Recordings are `audio/webm;codecs=opus`, which the API accepts (it needs `ffmpeg`).

The service lives in `~/code/python/careless_whisper` and runs as a launchd agent
(`com.marcogallegos.translateapi`). From that directory:

```bash
make load      # install the plist into ~/Library/LaunchAgents and start it
make status    # show launchd state, PID and recent logs
make logs      # tail stdout/stderr
make reload    # restart after changing api.py or the plist
make unload    # stop it
```

Verify it is up:

```bash
curl http://localhost:8765/health
```

The agent has `KeepAlive` and `RunAtLoad`, so it restarts on crash and at login.

### Using the app from a phone (or another device)

Two browser rules apply: the microphone only works on a **secure origin** (https or `localhost`), and an https page
can't call an `http://` LAN address. So:

1. Start the dev server with HTTPS and LAN access:
   ```bash
   npm run dev:lan
   ```
   It prints a `Network: https://<your-mac-ip>:3000/` address. Open that on the phone (same Wi-Fi). The certificate is
   self-signed, so accept the browser warning once.
2. The default transcription URL is the same-origin path `/whisper`, which the Vite dev/preview server forwards to the
   local service (`http://localhost:8765`, override with `WHISPER_PROXY_TARGET` in `.env`). The phone never talks to the
   Whisper API directly. If your `.env` still has `VITE_TRANSCRIPTION_API_URL=http://localhost:8765`, change it to
   `/whisper` (or delete the line), or set the URL to empty in Settings; otherwise the phone will try its own `localhost`.
3. The Translate/Agent endpoints you configure are called straight from the phone's browser, so they must be reachable
   from the phone, allow CORS, and be `https://` (an https page can't call plain `http://` addresses).

`npm run dev` (plain http, localhost only) is still the normal desktop workflow.

### Troubleshooting

- **`ERR_SSL_PROTOCOL_ERROR` ("localhost sent an invalid response")** – the browser is using `https://` against a server that only speaks `http://`. `npm run dev` serves plain **http** (`http://localhost:3000`); only `npm run dev:lan` serves https. Type the `http://` address explicitly (or `http://127.0.0.1:3000`) if the browser autocompletes `https://`.

- **"Recording needs a secure connection" / `Cannot read properties of undefined (reading 'getUserMedia')`** – the page was opened over plain `http://` on a LAN address. Use `npm run dev:lan` and the `https://` address.

- **"Cannot reach transcription service"** – the agent is not running or the URL is wrong. Run `make status` in the service repo and `curl http://localhost:8765/health`.
- **`400 Unsupported file format`** – the API only accepts mp3, wav, m4a, ogg, flac, webm, mp4.
- **Slow first request** – the API loads the Whisper model on every request (model caching is commented out in `api.py`); use a smaller model (`tiny`/`base`) for faster results.
- **CORS errors** – the API allows all origins; if you still see one, the service is probably down (the browser reports it as CORS).

## Usage

1. **Record Audio**: Click the record button to start recording
2. **Live Visualization**: Watch the audio waveform while recording
3. **Auto-Translation**: Audio is automatically sent for translation when recording stops
4. **Auto-Copy**: Latest translation is automatically copied to clipboard
5. **Browse History**: View all previous translations in the history panel
6. **Reprocess Translations**: Click the reprocess button on any translation to re-run Whisper on the stored audio
7. **Export Data**: Open the menu (☰, top right) → **Export data** to export your translations in various formats

## Favorites, tags and the admin pages

Use the ☰ menu → **Transcripts admin** / **Tag manager** (routes `#/admin` and `#/admin/tags`).

- **Favorite**: the ⭐ button on a history item or admin row toggles it.
- **Tag manager** (`#/admin/tags`): create tags (name + color), rename/recolor, delete (always asks for confirmation; the
  transcripts are kept). Each tag shows how many transcripts/favorites use it, with a **Favorites** link that opens the
  filtered list.
- **Tagging**: only favorites can be tagged. In the Transcripts tab, click the tags button on a favorite to pick tags
  or create one on the spot. Un-favoriting keeps the tags but hides them on the home page.
- **Filtering** (`#/admin`): search (transcript, translation, agent reply, tags), **Favorites only**, tag chips (match
  any selected), sort by date, **Clear filters**. Links like `#/admin?fav=1&tag=work` preselect filters.
- Tags and favorites are stored locally (IndexedDB, same place as the recordings) and are included in the JSON export.
  There is no backend for them yet; see the PRD for the proposed API.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `R` | Start / stop recording |
| `Space` then `C` | Copy the latest recording's transcript |
| `Space` then `P` | Play / stop the latest recording |
| `Space` then `D` | Delete the latest recording (asks for confirmation) |
| `Y` / `N` | Confirm / cancel in the delete dialog (`Esc` also cancels) |

`Space` is a leader key: press it, then the letter within one second (holding `Space` while pressing the letter
also works). "Latest" is the newest item in the history, marked with a **Latest** badge. Because of this, `Space` no
longer toggles recording; use `R`.

Shortcuts are ignored while typing in a field, while a dialog is open (except `Y`/`N` in the delete dialog), with
Ctrl/Cmd/Alt/Shift held, and on key-repeat. Hints only appear on devices with a keyboard/mouse. After a mouse click the
clicked record/action button is blurred, so a later `Space` can't re-trigger it.

**Deleting always asks for confirmation**, whether by button or shortcut. "No" has the default focus, so a stray
Enter never deletes.

## Export Options

- **JSON**: Standard JSON format for backup or data analysis
- **SQLite**: SQL script to import into SQLite database
- **MongoDB**: JavaScript script for MongoDB import

## Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

Requires modern browser with MediaRecorder API support.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests and stories for new components
5. Submit a pull request

## License

MIT License - see LICENSE file for details