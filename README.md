# EverVoice

A modern desktop application to process voice notes with custom actions powered by AI.

<br/>

## 🥇 Gold Sponsor

<table>
  <tr>
    <td align="center">
      <a href="https://www.kiberatung.de?utm_source=evervoice&utm_medium=readme&utm_campaign=sponsor">
        <strong>Everlast AI</strong>
        <br/>
        <sub>Mehr Umsatz mit durchdachten KI-Strategien</sub>
      </a>
    </td>
  </tr>
</table>

<br/>

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/evervoice)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-1.77+-DEA584?logo=rust&logoColor=black)](https://www.rust-lang.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/yourusername/evervoice/releases)

<br/>

## Table of Contents

- [The Problem](#the-problem)
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Data Flow](#data-flow)
  - [Key Components](#key-components)
- [Tech Stack](#tech-stack)
- [Design Decisions](#design-decisions)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [Recording](#recording)
  - [Transcription](#transcription)
  - [Summarization](#summarization)
  - [ 🔥 Custom Actions](#custom-actions)
  - [History](#history)
  - [Settings](#settings)
- [Project Structure](#project-structure)
- [Development](#development)
- [Data Storage](#data-storage)
- [API Usage](#api-usage)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contributing](#contributing)

<br/>

## The Problem

**Voice-to-text workflows are fragmented and interrupt your focus.**

Knowledge workers, content creators, and professionals frequently need to capture spoken thoughts, meeting notes, or ideas. Current solutions force you to:

- Switch between multiple apps (recorder → transcription service → text editor)
- Manually upload audio files to web-based transcription services
- Wait for email notifications when transcription completes
- Copy-paste text between applications

This context-switching breaks concentration and slows down workflows. Additionally, many transcription services store your audio in the cloud, raising privacy concerns for sensitive content.

**EverVoice solves this** by providing an all-in-one desktop app that stays out of your way. Press a global hotkey from any application, speak, and get transcribed text with one click—all without leaving your current task. Your recordings stay on your machine.

## Overview

EverVoice is a cross-platform desktop app built with Tauri that captures voice recordings, transcribes them using OpenAI Whisper, and provides AI-powered text processing capabilities. It features a clean, modern UI with real-time waveform visualization and seamless workflow integration through global hotkeys.

## Features

- **Voice Recording** - Record audio with real-time waveform visualization and intuitive controls (start, pause, resume, stop)
- **AI Transcription** - Convert speech to text using OpenAI Whisper API with automatic language detection
- **Smart Summarization** - Generate concise Markdown summaries of transcriptions using GPT-4
- **Recording History** - Browse and manage past recordings with playback support
- **Global Hotkeys** - Start/stop recording from any application using customizable keyboard shortcuts
- **Custom Actions** - Configure external API integrations to process transcriptions with your own services
- **Cross-Platform** - Runs on Windows, macOS, and Linux

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        EverVoice App                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Frontend (WebView)                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │   React     │  │   Zustand   │  │  Web Audio API  │   │  │
│  │  │ Components  │←→│   Stores    │  │  (Recording)    │   │  │
│  │  └─────────────┘  └──────┬──────┘  └────────┬────────┘   │  │
│  │                          │                   │            │  │
│  │                    ┌─────┴───────────────────┴─────┐      │  │
│  │                    │      Tauri IPC Bridge         │      │  │
│  └────────────────────┴───────────────┬───────────────┴──────┘  │
│                                       │                         │
│  ┌────────────────────────────────────┴──────────────────────┐  │
│  │                    Backend (Rust)                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │ Transcription│  │ Summarization│  │ Global Hotkey  │   │  │
│  │  │   Module     │  │    Module    │  │    Handler     │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────────────┘   │  │
│  │         │                 │                               │  │
│  │  ┌──────┴─────────────────┴───────┐  ┌────────────────┐   │  │
│  │  │        OpenAI API Client       │  │  File Storage  │   │  │
│  │  └────────────────────────────────┘  │  (Local Disk)  │   │  │
│  │                                      └────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     OpenAI API        │
                    │  ┌───────┐ ┌───────┐  │
                    │  │Whisper│ │GPT-4o │  │
                    │  └───────┘ └───────┘  │
                    └───────────────────────┘
```

### Data Flow

```
User speaks → Microphone → MediaRecorder API → WebM File (local)
                                                     │
                                                     ▼
                              Tauri invoke ← Transcribe Button
                                    │
                                    ▼
                            Rust Backend
                                    │
                                    ▼
                         OpenAI Whisper API
                                    │
                                    ▼
                         Transcription Text
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
               Display         Summarize      Custom Action
                               (GPT-4o)       (External API)
                                    │
                                    ▼
                              Clipboard
```

### Key Components

| Component | Responsibility |
|-----------|---------------|
| `useAudioRecorder` | Manages MediaRecorder lifecycle, captures audio stream |
| `useWaveformAnalyzer` | Processes audio data for real-time visualization |
| `recording-store` | Central state for recording status, duration, file path |
| `history-store` | Manages past recordings, selected item, playback state |
| `settings-store` | Persists user preferences via Tauri plugin-store |
| `transcription.rs` | Calls OpenAI Whisper API, handles multipart upload |
| `summarization.rs` | Calls OpenAI Chat API for text summarization |
| `global_hotkey.rs` | Registers system-wide shortcuts, emits events |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Backend | Tauri 2, Rust |
| APIs | OpenAI Whisper, OpenAI GPT-4 |

## Design Decisions

### Why Tauri instead of Electron?

| Aspect | Tauri | Electron |
|--------|-------|----------|
| Bundle size | ~3 MB | ~150 MB |
| Memory usage | ~30 MB | ~100+ MB |
| Security | Rust backend, no Node.js in main process | Full Node.js access |
| Native APIs | Via Rust crates | Via Node.js modules |

EverVoice needs to run in the background efficiently. Tauri's minimal footprint makes it ideal for an always-ready utility app. The Rust backend also provides memory safety and prevents the API key from being exposed to the renderer process.

### Why Zustand instead of Redux?

- **Minimal boilerplate** - No action creators, reducers, or middleware setup
- **Small bundle** - ~1 KB vs ~7 KB for Redux Toolkit
- **Simple async** - No thunks or sagas needed; just async functions in actions
- **Multiple stores** - Natural separation (recording, history, settings) without combineReducers

### Why local storage instead of cloud sync?

- **Privacy** - Voice recordings may contain sensitive information
- **Offline-first** - Works without internet (except for OpenAI API calls)
- **Simplicity** - No user accounts, authentication, or sync conflicts
- **Speed** - No upload latency for recordings

### Why WebM format for recordings?

- **Browser-native** - MediaRecorder outputs WebM by default, no transcoding needed
- **Whisper compatible** - OpenAI Whisper accepts WebM directly
- **Good compression** - Opus codec provides quality audio at small file sizes

### Why manual transcription trigger?

- **User control** - Review recording before spending API credits
- **Privacy** - Accidentally recorded audio isn't auto-uploaded
- **Cost awareness** - Users consciously decide when to use paid API

### Why shadcn/ui?

- **Copy-paste components** - Full ownership, no version lock-in
- **Tailwind-native** - Consistent with existing styling approach
- **Accessible** - Built on Radix UI primitives with ARIA support
- **Customizable** - Easy to modify without fighting a component library

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.77+
- [OpenAI API Key](https://platform.openai.com/api-keys)

### Platform-specific

**Windows:**
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

**macOS:**
- Xcode Command Line Tools (`xcode-select --install`)

**Linux:**
- `webkit2gtk-4.1`, `libayatana-appindicator3-1` (or `libappindicator3-1`)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/evervoice.git
   cd evervoice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**

   Launch the app and open Settings to enter your OpenAI API key, or the app will prompt you on first transcription attempt.

4. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

5. **Build for production**
   ```bash
   npm run tauri build
   ```

   The built application will be in `src-tauri/target/release/bundle/`.

## Usage

### Recording

1. Click the **Start** button or press your configured global hotkey (default: `Ctrl+Shift+R`)
2. Speak into your microphone - watch the real-time waveform visualization
3. Use **Pause** to temporarily stop, then **Resume** to continue
4. Click **Stop** when finished

### Transcription

1. After stopping a recording, click the **Transcribe** button
2. Wait for OpenAI Whisper to process your audio
3. View the transcription in the main display area

### Summarization

1. After transcription completes, click **Summarize & Copy**
2. The AI-generated Markdown summary is automatically copied to your clipboard

### 🔥 Custom Actions

Custom Actions let you send transcriptions to any external API with one click—your personal automation powerhouse.

**Use Cases:**
- Send notes to your personal knowledge base (Notion, Obsidian, etc.)
- Trigger workflows in Zapier, Make, or n8n
- Post to Slack, Discord, or other messaging platforms
- Feed transcriptions into your own AI pipelines
- Integrate with CRM systems or project management tools

**Setup:**

1. Open **Settings** → **Custom Actions**
2. Click **Add Action**
3. Enter a **Name** (appears as button label) and **URL** (your API endpoint)
4. Save and close Settings

**How it works:**

When you click a Custom Action button, EverVoice sends a POST request:

```http
POST https://your-api-endpoint.com/webhook
Content-Type: application/json

{
  "text": "Your transcribed text appears here..."
}
```

**Example: Send to Notion via Make.com**

1. Create a Make.com scenario with a Webhook trigger
2. Copy the webhook URL
3. Add as Custom Action: Name = "Save to Notion", URL = webhook URL
4. Connect the webhook to a Notion "Create Page" module
5. Now every transcription can be saved to Notion with one click

### History

- Access past recordings from the sidebar on the left
- Click any recording to view its transcription
- Use the play button to listen to the audio
- Delete recordings you no longer need

### Settings

Open Settings (gear icon) to configure:

| Setting | Description |
|---------|-------------|
| OpenAI API Key | Required for transcription and summarization |
| Max Recording Duration | Auto-stop limit (default: 30 minutes) |
| Global Hotkey | Keyboard shortcut for quick recording toggle |
| Custom Actions | External API endpoints for custom text processing |

## Project Structure

```
evervoice/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui primitives
│   │   └── settings/     # Settings-related components
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand state stores
│   ├── lib/              # Utilities and Tauri API wrapper
│   └── types/            # TypeScript type definitions
├── src-tauri/
│   ├── src/              # Rust backend source
│   │   ├── main.rs       # Application entry point
│   │   ├── lib.rs        # Tauri plugin setup
│   │   ├── commands.rs   # IPC command handlers
│   │   ├── transcription.rs
│   │   ├── summarization.rs
│   │   ├── history.rs
│   │   ├── settings.rs
│   │   ├── file_storage.rs
│   │   └── global_hotkey.rs
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── public/               # Static assets
└── package.json
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run
```

### Code Quality

```bash
# Lint code
npm run lint
```

### Rust Backend

```bash
# Run Rust tests
cd src-tauri && cargo test

# Check Rust code
cd src-tauri && cargo check
```

## Data Storage

EverVoice stores data locally:

| Platform | Location |
|----------|----------|
| Windows | `%APPDATA%\EverVoice\` |
| macOS | `~/Library/Application Support/EverVoice/` |
| Linux | `~/.config/EverVoice/` |

- `recordings/` - Audio files (WebM format)
- `settings.json` - App configuration
- `history.json` - Recording metadata and transcriptions

## API Usage

EverVoice uses the OpenAI API for:

1. **Whisper** - Audio transcription (charged per audio minute)
2. **GPT-4o-mini** - Text summarization (charged per token)

Refer to [OpenAI Pricing](https://openai.com/pricing) for current rates.

## Troubleshooting

**Microphone not detected**
- Check browser/system permissions for microphone access
- Ensure no other application is exclusively using the microphone

**Transcription fails**
- Verify your OpenAI API key is valid and has credits
- Check your internet connection
- Ensure the recording is not empty or corrupted

**Global hotkey not working**
- Another application may be using the same shortcut
- Try a different key combination in Settings
- On macOS, grant accessibility permissions to EverVoice

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
