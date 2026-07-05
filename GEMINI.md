# Escrcpy - Graphical User Interface for Scrcpy

Escrcpy is an Electron-based graphical user interface for [scrcpy](https://github.com/Genymobile/scrcpy), designed to facilitate the display and control of Android devices. It features intelligent control via AutoGLM, automated workflows, and multi-device management.

## Project Overview

- **Main Goal:** Provide a powerful, user-friendly, and cross-platform GUI for Android device control and mirroring.
- **Key Technologies:**
  - **Runtime/Framework:** Electron, Vue 3, Vite, Node.js.
  - **Device Interaction:** `scrcpy`, `adbkit`, `gnirehtet` (reverse tethering).
  - **Intelligence:** `AutoGLM.js` for natural language command processing.
  - **Tooling:** Bun (package manager), Turbo (monorepo orchestration), ESLint, Prettier.
  - **Frontend UI:** Element Plus, UnoCSS, VueUse.

## Architecture

The project is structured as a monorepo:

- **`desktop/`**: The main Electron application.
  - **`electron/`**: Main and Preload processes.
  - **`src/`**: Core renderer process (Vue 3).
  - **`pages/`**: Multiple renderer entry points for specialized windows:
    - `main`: Device list and core management.
    - `control`: Floating device control bar.
    - `explorer`: File management for devices.
    - `copilot`: AI-powered device control interface.
    - `terminal`: Device shell access.
- **`packages/`**: Shared libraries and utilities:
  - `autoglm.js`: Integration for smart device control.
  - `electron-ipcx`: IPC communication utilities.
  - `electron-setup`: Electron application setup helpers.
- **`docs/`**: Documentation built with VitePress.

## Getting Started

### Prerequisites

- **Node.js:** v20 or higher.
- **Bun:** Recommended package manager (version 1.3.10 specified).
- **Git:** For source control.
- **Android Device:** With USB Debugging enabled.

### Installation

```bash
# Install dependencies using Bun
bun install
```

## Commands

Commands are generally run from the root directory using `bun`.

- **Development:**
  - `bun dev`: Starts the development environment (Electron app + dependencies).
- **Building:**
  - `bun run build`: Builds the project for the host platform.
  - `bun run build:win`: Builds the application for Windows.
  - `bun run build:mac`: Builds the application for macOS.
  - `bun run build:linux`: Builds the application for Linux.
- **Quality Control:**
  - `bun run lint`: Runs ESLint across the project.
  - `bun run lint:fix`: Lints and automatically fixes errors.
  - `bun run format`: Formats code using Prettier.
- **Testing:**
  - `bun run test` (in specific packages): Runs Vitest.
- **Documentation:**
  - `bun run docs:dev`: Starts the VitePress documentation server.

## Development Conventions

- **State Management:** Uses **Pinia** with persistence (via `pinia-plugin-persistedstate`).
- **Styling:** Uses **UnoCSS** for utility-first styling and **SCSS** for complex styles.
- **Routing:** Uses **unplugin-vue-router** for file-based routing in the renderer.
- **Commit Messages:** Follows **Angular's commit message conventions**.
- **Linting:** Strict ESLint configuration (`@antfu/eslint-config`).
- **Electron Communication:** Uses specialized IPC abstractions (`@escrcpy/electron-ipcx`).
- **Build System:** `Turbo` caches builds and linting results for efficiency.

## Key Components & Paths

- **Electron Entry:** `desktop/electron/main.js`.
- **Preload Script:** `desktop/electron/preload.js`.
- **Renderer Main:** `desktop/src/main.js`.
- **Device Management Logic:** `desktop/electron/modules/control/index.js` (and similar modules).
- **ADB Integration:** `desktop/electron/middleware/adb/index.js`.
- **AutoGLM Integration:** `packages/autoglm.js`.

## Debugging

- **DevTools:** Available in all renderer windows (main, control, etc.).
- **Logs:** Electron logs are typically managed via `electron-log`.
- **Debug Mode:** Can be toggled in application preferences.
- **IPC Tracking:** Inspect `electron-ipcx` usage for cross-process communication debugging.
