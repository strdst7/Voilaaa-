# Voilaa! 🎬 ✨

> **YouTube to Interactive Learning App Converter**  
> _A high-fidelity full-stack educational playground that instantly transforms YouTube videos into rich, customized, interactive HTML structures powered by Google Gemini AI._

---

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Core Features](#-core-features)
3. [System Architecture](#%EF%B8%8F-system-architecture)
4. [Tech Stack](#%EF%B8%8F-tech-stack)
5. [Interface Customization](#-interface-customization)
6. [Environmental Setup & Configuration](#-environmental-setup--configuration)
7. [Running the Application](#-running-the-application)
8. [Deployment & Production Commands](#-deployment--production-commands)

---

## 🌟 Overview

**Voilaa!** is an interactive educational software engineering sandbox. It takes standard YouTube instructional videos, tutorials, or lectures, parses their contexts, and digests them through Google Gemini. The result is a fully sandboxed, highly responsive, interactive custom learning application (quizzes, live simulations, flashcard decks, formula calculators, and data visualizations) built directly from the semantic core of the video lessons.

---

## 🎨 Core Features

### 📡 YouTube Resource Processor
- Automatically parses and validates multiple YouTube video formats (Standard, Short, Embedded).
- Resolves video metadata, custom embed configurations, and title information.

### 🧠 Gemini AI Synthesis Playground
- **Dual-Model Cognitive Chain**: Separates logical planning from visual synthesis:
  - **Semantic Analyst**: (Gemini 1.5 Flash/Pro) Analyzes the core knowledge parameters and develops the structural design specifications.
  - **Software Architect**: (Gemini 1.5 Pro) Generates pristine code outputs based on design specifications.
- **Parametric Controllers**: Refine AI creativity (Temperature/Signal Variance) and lesson depth (Academic Intensity: Concise, Balanced, Detailed) inside a dedicated parameters drawer.

### 🖥️ Workspace Visual Sandbox
- **Render Perspective**: Real-time iframe execution for fully functional, highly interactive components without client-side safety leakage.
- **Source Code / Monaco Integration**: A full-sized embedded Monaco Editor console displaying or permitting modification of the raw generated HTML/JS/CSS structures with hot-save states.
- **Specification View**: Inspect or edit the underlying learning curriculum & logic guidelines produced by the **Semantic Analyst**.
- **Distraction-free Modes**:
  - **Zen Mode**: Fades surrounding widgets to place absolute visual emphasis on the current lesson asset.
  - **Workspace Fullscreen**: Expands the live interactive element to utilize the entire grid viewport.

---

## ⚙️ System Architecture

Voilaa! operates on a coordinated client-server architecture:

```
        ▲  [Client] React v18 + Vite (SPA)
        │  ├── App.tsx: Controls application layout, theme settings, and UI visual loops.
        │  ├── ContentContainer.tsx: Coordinates Render/Code/Spec tabs, Monaco hooks, and parameter overlays.
        │  └── lib/youtube.ts: Parsing utilities for media resource resolution.
        │
        ▼  [Server] Express v5 + @google/genai SDK
           ├── server.ts: Launches production runtime, serving built files and mock-seeding endpoints.
           └── lib/textGeneration.ts: Coordinates secure server-side communications with Google Gemini API endpoints.
```

---

## 🛠️ Tech Stack

- **UI Framework**: React 18 / Vite (Fast, single-screen rendering)
- **Styling**: Tailwind CSS (Sophisticated utility classes, adaptive custom themes)
- **Transitions**: `motion` (Optimized, responsive slide and fade feedback)
- **UI Icons**: `lucide-react` (Crisp vector action items)
- **Data Engineering**: `recharts` (Smooth vector analytical plots)
- **Editor**: `@monaco-editor/react` (Live developer-grade editor container)
- **AI Orchestration**: Official modern `@google/genai` TypeScript SDK
- **Backend Enclosure**: Node.js Express server running fully compatible wildcard routes (`*all`)

---

## ✨ Interface Customization

Voilaa! has been visually tailored to prioritize high contrast, visual rhythm, and clean display patterns:

- **Ambient Matte Charcoal Theme**: The dark theme incorporates deep charcoal backgrounds with soft gray panel borders, optimized for long technical sessions.
- **Elegant Typography Pairing**: Uses refined display typography paired with `JetBrains Mono` status readouts for an architectural aesthetic.
- **Status Watermark**: Includes a minimal, clean, low-opacity trademark banner at the base of the control frames.

---

## 🔑 Environmental Setup & Configuration

Configure your environment keys inside a local `.env` secure configuration file.

Copy the provided placeholder configuration:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
- `GEMINI_API_KEY`: Your private Google Gemini Developer Credential. (Kept fully secure on your server wrapper without public client-side exposure).
- `VITE_EXAMPLES_API_URL`: Path to pre-loaded visual training examples (defaults to `/api/examples`).

---

## 🚀 Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Live Development Server
Start the client-server coordination layer in active HMR development mode:
```bash
npm run dev
```
Navigate to: [http://localhost:3000](http://localhost:3000)

### 3. Static Code Linter
Verify code hygiene and TypeScript declaration health:
```bash
npm run lint
```

---

## 📦 Deployment & Production Commands

Prepare Voilaa! for deployment on hosting systems or production servers (such as GCP Cloud Run or Docker nodes).

### Production Compiles
```bash
npm run build
```
This prepares compiled client-side assets in `/dist` and cleans structural TypeScript dependencies.

### Production Start
```bash
npm run start
```
Starts Node server execution. Mounts standard optimized production static file handlers alongside API handlers.
