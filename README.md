# Infernix Executor

A modern, feature-rich Roblox script executor built with Electron, React, and native C++ addons.

## 🚀 Features

- **Modern UI**: Built with React and Framer Motion for smooth animations
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **Native Integration**: C++ addon for robust script execution
- **Multi-Client Support**: Manage and execute scripts on multiple Roblox instances
- **Script Hub**: Built-in script library
- **AI Assistant**: Integrated AI help system
- **Settings Manager**: Customizable configuration

# Infernix Executor

Infernix Executor is a desktop application for managing and executing scripts in Roblox environments. It combines an Electron-based shell with a React user interface and native C++ components for performance-critical operations.

## Features

- Modern, responsive user interface built with React and Framer Motion
- Integrated Monaco editor with syntax highlighting and editing features
- Native C++ addon for reliable script execution
- Support for managing multiple client instances
- Built-in script library (Script Hub)
- Configurable settings and preferences

## Technology Stack

- Frontend: React 19, Vite
- Desktop: Electron 40
- Editor: Monaco Editor
- Native Integration: Node.js N-API C++ addon
- Icons: Lucide React

## Project Structure

```
infernix-executor/
├── electron/              # Electron main and preload scripts
├── src/                   # React frontend source
│   ├── components/        # UI components
│   └── assets/            # Static assets
├── native/                # Native C++ addon
│   └── infernix-addon/
│       └── src/           # C++ source code
└── public/                # Public assets
```

## Development

### Prerequisites

- Node.js 18 or later
- npm (or an alternative package manager)
- Python 3.x (required for building native addons)
- Visual Studio Build Tools (Windows) for native compilation

### Setup and Run

1. Clone the repository and change directory:

```bash
git clone <your-repo-url>
cd infernix-executor
```

2. Install dependencies:

```bash
npm install
```

3. Run in development mode (starts Vite and Electron):

```bash
npm run electron:dev
```

### Common Scripts

- `npm run dev` — Start Vite development server
- `npm run build` — Build renderer for production
- `npm run electron` — Launch Electron against built files
- `npm run electron:dev` — Start Vite and launch Electron for development
- `npm run lint` — Run linting checks

## Building the Native Addon

To build the native addon component:

```bash
cd native/infernix-addon
npm install
npm run build
```

## Components Overview

- `Dashboard` — Application overview and quick actions
- `EditorView` — Monaco-based script editor
- `ClientManager` — Manage connected Roblox instances
- `ScriptHub` — Browse and load scripts
- `Assistant` — Assistance and suggestions
- `SettingsView` — Application settings and preferences
- `TitleBar` — Custom window controls

## License and Legal

This repository includes licensing and usage terms. Review the `LICENSE.txt` and `EULA.txt` files for details. Use this software in accordance with all applicable laws and platform terms of service.

## Contributing

Contributions are welcome. Please open an issue or submit a pull request describing the proposed change.
