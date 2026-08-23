# IntelliClass AI &mdash; Polyglot Monorepo

<div align="center">

![IntelliClass AI](https://img.shields.io/badge/Architecture-Polyglot_Monorepo-blue.svg)
![Next.js 16](https://img.shields.io/badge/Frontend-Next.js_16_React_19-black.svg)
![FastAPI](https://img.shields.io/badge/AI_Engine-FastAPI_Python_3.10-009688.svg)
![HeadTTS](https://img.shields.io/badge/Microservice-Kokoro_TTS_ONNX-orange.svg)
![PNPM Workspaces](https://img.shields.io/badge/Package_Manager-pnpm_v11-f69220.svg)

**Intelligent AI Lecturer with Real-time 3D Lip-Synced Avatar, Multi-Modal PDF Visual RAG, and WebGL Classroom Studio.**

</div>

---

## 🏛️ System Architecture & Ports

```
                               ┌──────────────────────────────────────────────┐
                               │               Client Browser                 │
                               │        (React 19 / WebGL 3D Avatar)          │
                               └──────────────┬───────────────────────────────┘
                                              │
                                              │ HTTP / WebSockets
                                              ▼
                               ┌──────────────────────────────────────────────┐
                               │          Next.js Frontend & API Gateway      │
                               │               (model-next :3000)             │
                               └──────┬───────────────────────────────┬───────┘
                                      │                               │
                      HTTP / Synthesize Proxies          REST RAG / Extraction
                                      │                               │
                                      ▼                               ▼
       ┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────────────┐
       │             HeadTTS Microservice             │  │            FastAPI AI Backend                │
       │               (HeadTTS :8882)                │  │             (ai-backend :8000)               │
       │  • Kokoro ONNX Text-to-Speech                │  │  • PyMuPDF Visual Asset & Text Extraction    │
       │  • Viseme & Phoneme Timestamp Generation     │  │  • Gemini 2.5 Flash Script Generation & RAG  │
       │  • WAV Audio Stream Buffer                   │  │  • Vector Chunk Embeddings Storage           │
       └──────────────────────────────────────────────┘  └──────────────────────┬───────────────────────┘
                                                                                │
                                                                                ▼
                                                                 ┌──────────────────────────────┐
                                                                 │      Supabase Cloud DB       │
                                                                 │   (Postgres, Auth, Storage)  │
                                                                 └──────────────────────────────┘
```

| Service | Directory | Tech Stack | Local Port | Health Check |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend & Studio** | [`model-next`](./model-next) | Next.js 16, React 19, Three.js / R3F, Tailwind CSS | `http://localhost:3000` | `GET /api/health` |
| **AI RAG Engine** | [`ai-backend`](./ai-backend) | Python 3.10+, FastAPI, PyMuPDF, Google Gemini SDK | `http://localhost:8000` | `GET /health` |
| **Lip-Sync TTS Engine** | [`HeadTTS`](./HeadTTS) | Node.js, Transformers.js, Kokoro TTS (ONNX) | `http://localhost:8882` | `GET /health` |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `v18.x` or `v20.x+`
- **pnpm**: `v9.x` or `v11.x` (`npm install -g pnpm`)
- **Python**: `3.10+`

### 2. Installation
From the root of the repository:

```bash
# 1. Install Node workspace dependencies
pnpm install

# 2. Setup Python virtual environment & AI backend dependencies
pnpm setup:python
```

### 3. Environment Configuration
Copy environment blueprints to their respective folders:

```bash
# Frontend
cp .env.example model-next/.env.local

# AI Backend
cp .env.example ai-backend/.env
```

### 4. Running the Complete System

```bash
# Run all 3 services concurrently in one terminal
pnpm dev
```

Or run services individually:

```bash
pnpm dev:frontend   # Starts Next.js on :3000
pnpm dev:tts        # Starts HeadTTS on :8882
pnpm dev:ai         # Starts FastAPI AI Backend on :8000
```

### 5. Health Verification
Verify all 3 services are responding:

```bash
pnpm health
```

---

## 🛠️ Monorepo Scripts Reference

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts Next.js frontend, HeadTTS, and FastAPI simultaneously |
| `pnpm dev:frontend` | Starts `model-next` development server |
| `pnpm dev:tts` | Starts `HeadTTS` ONNX synthesis server |
| `pnpm dev:ai` | Starts `ai-backend` FastAPI server with auto-reload |
| `pnpm build` | Builds `model-next` for production |
| `pnpm typecheck` | Validates TypeScript across all workspaces |
| `pnpm health` | Polls all 3 service health endpoints and prints status |
| `pnpm setup:python` | Creates `.venv` in `ai-backend` and installs dependencies |
| `pnpm clean` | Cleans `.next`, `dist`, `__pycache__`, and build caches |
| `pnpm clean:deep` | Deep reset (removes `node_modules` and Python `.venv`) |

---

## 🪟 Windows One-Click Launchers

You can launch the complete ecosystem with live health checks using our dedicated Windows scripts:

- **PowerShell**: `./scripts/start-all.ps1`
- **Command Prompt**: `./scripts/start-all.bat`

---

## 🎨 3D Models & Animations

> [!IMPORTANT]
> For the 3D character models (`.glb` / `.gltf`), textures, and custom skeletal animation files, please **ask the repository owner**.

