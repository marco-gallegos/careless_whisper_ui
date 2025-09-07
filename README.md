# Audio Translator

A modern React web application for recording audio and translating it to text using external AI services. Built with React 19, Vite with Rolldown, and Bootstrap.

## Features

- 🎤 **Audio Recording**: Record audio with live visualization
- 🔄 **Speech-to-Text Translation**: Convert audio to text using AI services
- 🔄 **Reprocess Translations**: Re-run translation on existing audio recordings
- 💾 **Local Storage**: Store recordings and translations locally using IndexedDB
- 📋 **Auto-Copy**: Automatically copy latest translation to clipboard
- 📚 **Translation History**: Browse and manage previous translations
- 📤 **Export Options**: Export data to JSON, SQLite, or MongoDB
- 🎨 **Modern UI**: Clean interface built with React Bootstrap
- 📖 **Storybook**: Component documentation and testing

## Tech Stack

- **React 19** - Latest React with concurrent features
- **Vite** - Fast build tool with Rolldown bundler
- **Bootstrap 5** - Responsive UI framework
- **Dexie** - IndexedDB wrapper for local storage
- **Storybook** - Component development environment

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd audio-translator
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure your API keys in `.env` file for translation services

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

### Translation Services

The app supports multiple translation services. Configure your preferred service in `.env`:

- **OpenAI Whisper**: Set `REACT_APP_OPENAI_API_KEY`
- **Google Speech-to-Text**: Set `REACT_APP_GOOGLE_API_KEY`  
- **Azure Speech Services**: Set `REACT_APP_AZURE_API_KEY` and `REACT_APP_AZURE_REGION`

### Mock Mode

By default, the app runs in mock mode with simulated translations. To use real translation services, update the `translateAudio` function in `src/services/translationService.js`.

## Usage

1. **Record Audio**: Click the record button to start recording
2. **Live Visualization**: Watch the audio waveform while recording
3. **Auto-Translation**: Audio is automatically sent for translation when recording stops
4. **Auto-Copy**: Latest translation is automatically copied to clipboard
5. **Browse History**: View all previous translations in the history panel
6. **Reprocess Translations**: Click the reprocess button on any translation to get a new AI-generated transcription
7. **Export Data**: Export your translations to various formats

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