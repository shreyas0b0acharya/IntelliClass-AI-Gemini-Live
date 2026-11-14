# IntelliClass AI: Gemini Live API Integration Plan
## Architectural Blueprint: Real-Time Dynamic AI Professor (Revision 2.0)

---

## Executive Summary

This architecture document defines the comprehensive, production-ready implementation plan to transform the **IntelliClass AI Platform** into an **autonomous, conversational, real-time AI Professor powered by the Google Gemini Live API**.

Based on deep technical review and architectural corrections, this revised blueprint establishes a **clean three-pillar separation of concerns**:
1. **Google Gemini Live API (`gemini-3.8-live`)**: The cognitive and conversational engine. Drives dynamic spoken lectures, adapts pedagogical pacing in real-time, answers interruptions naturally, and suggests curriculum transitions.
2. **LiveKit WebRTC SFU (Media Transport Layer)**: The real-time audio distribution pipeline for shared classrooms. Handles WebRTC Opus audio fan-out from the AI Professor to 100+ students with ultra-low latency (<150ms) and orchestrates floor control for student voice participation.
3. **Supabase PostgreSQL & Realtime (State & Event Layer)**: The authoritative application persistence and orchestration backbone. Manages learning topic progress (Covered, Current, Remaining), conductor lease arbitration, live subtitles, whiteboard diagram projections, and participant admissions.

Rather than relying on brittle, 1,200-word pre-baked scripts and local chunked TTS synthesis, the professor operates on a **lightweight, adaptive topic roadmap (4–8 checkpoints)**. The professor speaks and listens in real time, seamlessly handles interruptions, and maintains progress across network disconnects and multi-tab conductor handoffs.

---

## 1. Existing Architecture Analysis & Environment Specification

### 1.1 Verified Platform Stack & Repository Versions

A complete audit of `IntelliClass-AI-MonoRepo-gemini-live` establishes the exact dependency baseline:

| Subsystem | Verified Package & Version | Role in Architecture |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.3.0** (App Router, Turbopack) | Server-side API endpoints, authenticated routing, SSR. |
| **UI Library** | **React 19.2.8** | Client components, state orchestration, DOM tree. |
| **Database & Auth** | **`@supabase/supabase-js 2.112.3`** & `@supabase/ssr 0.12.4` | PostgreSQL client, Realtime channels, Row Level Security. |
| **Static AI Engine** | **`genkit 1.41.0`** & **`@genkit-ai/google-genai 1.41.0`** | Background batch workflows (PDF text processing, roadmap generation). |
| **Realtime Live SDK** | **`@google/genai` (Target: >= 2.3.0)** | Direct WebSocket client for bidirectional Gemini Live audio & non-blocking tools. |
| **Media Transport** | **LiveKit Client / LiveKit Server SDK** (Target addition) | WebRTC SFU for continuous audio distribution and floor control. |
| **3D Avatar Rendering** | **Three.js 0.180.0**, `@react-three/fiber 9.7.0`, `@react-three/drei 10.7.8` | Procedural 3D humanoid avatar with morph targets (`jawOpen`, mouth visemes). |
| **Vector Embeddings** | **`models/gemini-embedding-001` (768 dimensions)** | Managed via `ai-backend/services/embedder.py` with PostgreSQL `pgvector`. |

### 1.2 Current Classroom Execution Flow & Limitations

1. **Course Ingestion**: Instructors upload PDFs. PyMuPDF extracts text; `gemini-embedding-001` generates 768-dimensional embeddings stored in Supabase `document_chunks`. Embedded figures are stored in `media_assets`.
2. **Script Generation**: In `model-next/app/course/[courseId]/sessions/new/page.tsx`, the lecturer selects files. The server calls `/api/classroom/[sessionId]/generate-script` -> `model-next/ai/flows/generate-script.ts`. Gemini produces a rigid, 1,200+ word monolithic text script with static cue tags (`[ENGAGEMENT]`, `[IMAGE: url | label]`).
3. **Sequential Conductor Playback**: `model-next/features/classroom/hooks/useClassroom.ts` parses the text into chunks (`LectureItem[]`), loops through them sequentially, and synthesizes audio chunk-by-chunk using HeadTTS (Kokoro-82M ONNX on port 8882) or ElevenLabs.
4. **Student Q&A Interruption**: When a student asks a doubt, the request hits `/api/classroom/[sessionId]/ask/route.ts` -> `model-next/ai/flows/answer-question.ts`. It performs a vector similarity search, calls Gemini via REST to generate text, synthesizes audio via HeadTTS, and schedules playback.

### 1.3 Real Measured Baseline Benchmarks

Actual measurements from `benchmark/BENCHMARK_REPORT.md`:

| Operation / Sample | Measured Wall-Clock Latency | Real-Time Factor (RTF) | Observed Failure Mode |
| :--- | :--- | :--- | :--- |
| **HeadTTS Short (10 words)** | **1,118.9 ms** | 0.233 | Local CPU compute overhead |
| **HeadTTS Medium (25 words)** | **2,321.7 ms** | 0.246 | Linear synthesis delay |
| **HeadTTS Long (50 words)** | **5,423.7 ms** | 0.272 | Cannot stream in real-time |
| **Gemini Short Q&A REST** | **10,336 ms** (1.9 words/sec) | N/A | High generation latency under peak load |
| **Gemini Medium Paragraph** | **3,157 ms** (4.8 words/sec) | N/A | Transient latency spikes |
| **Gemini Full Script (1,200w)** | **Failed (503 UNAVAILABLE)** | N/A | Exceeds execution timeouts on server busy |

*Takeaway*: The legacy pipeline produces an end-to-end interruption lag of **6 to 12 seconds**. This completely destroys conversational classroom teaching.

---

## 2. Critical Architectural Corrections

### Correction A: Decouple Audio Media Transport from State Synchronization

#### The Flaw of Audio via Supabase Realtime
A naive proposal to stream 24 kHz PCM audio chunks over Supabase Broadcast fails at scale:
- 24,000 Hz × 16-bit × Mono = **384 kbps raw uncompressed audio**.
- 20ms audio packets generate **50 messages per second** per audio stream.
- In a 100-student classroom, Broadcast fan-out requires **5,000 deliveries per second**.
- Supabase Realtime default limits are **100 msg/sec on Free, 500 msg/sec on Pro, and 2,500 msg/sec on Pro without spend cap**. Broadcast fan-out counts against message quotas.
- Packet loss over WebSockets causes severe audio dropouts, buffer starvation, and ballooning ingress costs.

#### The Approved Solution: LiveKit SFU + Supabase Realtime
Media transport and application synchronization are cleanly decoupled:
- **LiveKit SFU (Selective Forwarding Unit)**: Handles WebRTC media transport. The conductor encodes the AI Professor's 24 kHz audio into **Opus (32–48 kbps)**, publishing an audio track to the LiveKit room. All 100+ students subscribe via low-latency WebRTC (<150ms).
- **Supabase Realtime**: Exclusively handles application state: topic progression events, HUD sync, subtitles, hand-raise requests, whiteboard media displays, and participant presence.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SHARED CLASSROOM MEDIA FLOW                      │
└────────────────────────────────────────────────────────────────────────┘

  [ Google Gemini Live API ] (Model: gemini-3.8-live)
            ▲                │
 16kHz PCM  │                │ 24kHz PCM Audio Stream
 User Voice │                ▼
     ┌──────────────────────────────┐
     │  Conductor Browser (Host)    │
     │  - Manages Gemini WebSocket  │
     │  - AudioWorklet Resampler    │
     │  - Web Audio Analyser (Lips) │
     └──────┬────────────────┬──────┘
            │                │
Publish AI  │ Opus WebRTC    │ Application Events (Topic change,
Audio Track │                │ Subtitles, Whiteboard image)
            ▼                ▼
     ┌─────────────┐  ┌─────────────────────────────────┐
     │ LiveKit SFU │  │  Supabase Realtime + PostgreSQL │
     └──────┬──────┘  └──────────────┬──────────────────┘
            │                        │
  WebRTC    │ Opus Audio             │ Broadcast Events
  Downlink  │ Stream                 │ (JSON < 10 msgs/min)
            ▼                        ▼
     ┌──────────────────────────────────────────────────┐
     │             100+ Student Viewports               │
     │  - Subscribes to LiveKit audio track             │
     │  - Listens to Supabase HUD & Whiteboard events   │
     │  - Requests mic access via Hand-Raise protocol   │
     └──────────────────────────────────────────────────┘
```

### Correction B: Verified Gemini Session Lifecycles & Rate Limits

- **Free-Tier Limits**: Rate limits in Google AI Studio are governed by **TPM (Tokens Per Minute)**, **RPM (Requests Per Minute)**, and **RPD (Requests Per Day)**. Hardcoded concurrency limits (such as "3 sessions") are not officially fixed and vary by account tier.
- **Session Duration Boundaries**:
  - Audio-only continuous session: **15 minutes** without context compression.
  - Audio + video session: **2 minutes** without context compression.
  - WebSocket connection lifetime: **~10 minutes**.
  - Session resumption handle validity: **2 hours** after termination.
- **Dynamic GoAway Handling**: Do not assume `GoAway` is fixed at 60 seconds. The client must read the actual `timeLeft` parameter in the `GoAway` frame and proactively initiate reconnection.
- **Resumption Non-Availability Guard**: Google documents that session resumption can be temporarily unavailable if the connection drops while the model is actively generating tokens or executing tool calls. **The database progress state must remain independently recoverable.**

### Correction C: Function-Calling Protocol Structure & Backend Authority

#### Valid Live SDK Tool Response Structure
The `@google/genai` Live SDK requires function responses structured within a `functionResponses` array, correlated with the original call `id` and `name`:

```typescript
import { FunctionResponseScheduling } from "@google/genai";

session.sendToolResponse({
  functionResponses: [
    {
      id: toolCall.id,
      name: toolCall.name,
      response: {
        result: { acknowledged: true, currentTopicId: "topic_2" },
      },
      scheduling: FunctionResponseScheduling.WHEN_IDLE,
    },
  ],
});
```

#### Application Authority over State Transitions
Gemini must **never** mutate database state directly. The application layer validates and authorizes all proposed transitions:

```
Gemini Live: Calls advance_topic({ completedTopicId: "t1", nextTopicId: "t2" })
                    │
                    ▼
Conductor Client: Validates nextTopicId against SessionRoadmap
                    │
                    ▼
Next.js API: POST /api/classroom/[id]/advance-topic
                    │
                    ├── 1. Validates Conductor Lease (active_driver_tab_id, lease expiration)
                    ├── 2. Verifies state_version (CAS increment)
                    └── 3. Updates sessions.current_topic_id & covered_topic_ids
                    │
                    ▼
Supabase Realtime: Broadcasts TOPIC_CHANGED event to all student HUDs
                    │
                    ▼
Conductor Client: Returns functionResponse to Gemini -> Gemini begins teaching t2
```

### Correction D: Application-Managed Learning Progress Contract

Instead of duplicating full topic arrays, the database maintains a compact, normalized state:

```typescript
export interface SessionLearningProgress {
  roadmapVersion: string;
  currentTopicId: string | null;
  coveredTopicIds: string[];
  completedAt: string | null;
  progressVersion: number;
}
```

- **Remaining Topics**: Derived dynamically: `roadmap.topics.filter(t => !coveredTopicIds.includes(t.id) && t.id !== currentTopicId)`.
- **Explicit Topic Events**:
  ```typescript
  export type TopicEvent = 
    | "topic_started"
    | "topic_completed"
    | "topic_revisited"
    | "session_completed";
  ```
  *Advantage*: `session_completed` cleanly finalizes the lecture without forcing Gemini to supply an artificial `nextTopicId` when finishing the final topic.

### Correction E: Backend-Secured RAG Retrieval Architecture

Vector similarity search must not be exposed directly to unauthenticated client execution:

```
Gemini Live: Calls search_course_materials({ query: "pipeline data hazards" })
                    │
                    ▼
Conductor Client: Invokes authenticated Next.js route:
                  POST /api/classroom/[sessionId]/search-materials
                    │
                    ├── 1. Authenticates conductor session token
                    ├── 2. Verifies course enrollment & tenancy
                    ├── 3. Executes RPC match_documents(query_embedding, 0.65, 3, courseId)
                    └── 4. Returns top 3 grounded text chunks
                    │
                    ▼
Conductor Client: Returns functionResponse to Gemini
                    │
                    ▼
Gemini Live: Spoken explanation incorporates verified course facts
```

- Initial in-context prompt: Loads **only** the lightweight roadmap, course title, target objectives, and diagram labels. Detailed textbook excerpts are fetched on-demand.
- Timeout protection: Backend vector search is bounded by an **800ms abort signal**. If timeout occurs, Gemini gracefully falls back to general pedagogical reasoning.

### Correction F: Realistic Web Audio Avatar Lip-Sync

- **Acoustic Reality**: Fast Fourier Transform (FFT) frequency bands do not reliably map to linguistic phonemes (e.g., low frequency does not uniquely mean `aa`, high frequency does not uniquely mean `E`).
- **Approved Approach**:
  - Use time-domain PCM Root-Mean-Square (RMS) amplitude to drive jaw opening (`jawOpen` / `mouthOpen`).
  - Apply asymmetric smoothing: **fast attack** (0.8) to snap open on speech transients, and **smooth release** (0.3) to prevent unnatural chattering.
  - Modulate gentle conversational vowel cadence (`viseme_aa`, `viseme_E`, `viseme_ou`) scaled by audio energy.
  - Benchmarked visual offset: Synchronized directly to the Web Audio hardware playback clock.

### Correction G: Real Pricing & Privacy Specifications

#### Gemini 3.8 Live Paid-Tier Rates (Google AI Studio)
| Modality / Stream | Unit Rate | Rate per Minute |
| :--- | :--- | :--- |
| **Audio Input** | $3.00 / 1M tokens | **$0.005 / min** |
| **Audio Output** | $12.00 / 1M tokens | **$0.018 / min** |
| **Continuous Audio (Both)** | Combined in/out | **~$0.023 / min** |
| **Text Input** | $0.75 / 1M tokens | — |
| **Text Output** | $4.50 / 1M tokens | — |

#### 30-Minute Shared Classroom Cost Scenarios
| Classroom Activity Scenario | Audio Input | Audio Output | Estimated API Cost |
| :--- | :---: | :---: | :---: |
| **High Lecture / Low Interruption** | 30 min | 20 min | **$0.51** |
| **Balanced Dialogue / Q&A** | 30 min | 15 min | **$0.42** |
| **Continuous Professor Speaking** | 30 min | 30 min | **$0.69** |

*Privacy Requirement*: Under Google's Free-Tier terms, user data and prompts may be used to train Google models. In the Paid Tier, inputs and outputs are not used for model training. **For student voices and identifiable classroom recordings, the system must enforce Paid-Tier API keys and obtain user consent.**

---

## 3. Recommended Target Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Classroom Clients"]
        subgraph Conductor ["Lecturer / Conductor Tab"]
            C_UI["Conductor HUD & Roadmap Controls"]
            C_Store["Zustand Progress Store"]
            C_Gemini["@google/genai LiveClient (WebSocket)"]
            C_Worklet["AudioWorklet Resampler (16kHz PCM In)"]
            C_Player["24kHz Web Audio Player + Analyser"]
            C_Avatar["Three.js Avatar (RMS Lip Sync)"]
            C_LKPub["LiveKit Audio Publisher (Opus)"]
        end

        subgraph Students ["100+ Student Viewports"]
            S_UI["Student HUD & Subtitles"]
            S_LKSub["LiveKit Audio Subscriber"]
            S_Mic["Student Mic (Push-to-Talk / Floor Request)"]
            S_Store["Student Zustand Mirror"]
        end
    end

    subgraph MediaPlane ["Realtime Media Plane (LiveKit SFU)"]
        LK_Room["LiveKit Room (classroom:sessionId)"]
        LK_Track["AI Professor Audio Track (Opus 48kbps)"]
        LK_Floor["Active Student Audio Track"]
    end

    subgraph BackendPlane ["Next.js 16 Application Backend"]
        API_Token["POST /api/classroom/[id]/live-token (Ephemeral Token)"]
        API_LK["POST /api/classroom/[id]/livekit-token"]
        API_Roadmap["POST /api/classroom/[id]/generate-roadmap"]
        API_Advance["POST /api/classroom/[id]/advance-topic (CAS Leased)"]
        API_RAG["POST /api/classroom/[id]/search-materials (Vector Search)"]
    end

    subgraph GoogleAI ["Google AI Infrastructure"]
        GeminiLive["Gemini Live API (wss://generativelanguage.googleapis.com)
Model: gemini-3.8-live"]
    end

    subgraph SupabaseDB ["Supabase Cloud"]
        DB_Postgres["PostgreSQL (sessions, topics, document_chunks)"]
        DB_Realtime["Supabase Realtime (presence, TOPIC_CHANGED, SUBTITLE)"]
    end

    %% Audio & Media Connections
    C_Gemini <-->|"Bidirectional WebSocket (16kHz in, 24kHz out)"| GeminiLive
    C_Player -->|"Route Local Stream"| C_LKPub
    C_LKPub -->|"Publish Track"| LK_Track
    LK_Track -->|"WebRTC Fan-out (<150ms)"| S_LKSub
    S_Mic -->|"Grant Floor Access"| LK_Floor
    LK_Floor -->|"Route Active Speaker"| C_Worklet
    C_Worklet -->|"sendRealtimeInput(audio)"| C_Gemini

    %% Tool & Backend Calls
    C_Gemini -.->|"Tool: search_course_materials"| C_Store
    C_Store -->|"Fetch Chunks"| API_RAG
    API_RAG -->|"RPC match_documents"| DB_Postgres

    C_Gemini -.->|"Tool: advance_topic"| C_Store
    C_Store -->|"Authorize Update"| API_Advance
    API_Advance -->|"Persist Progress"| DB_Postgres
    API_Advance -->|"Broadcast TOPIC_CHANGED"| DB_Realtime
    DB_Realtime -->|"Sync HUD"| S_Store

    %% Avatar & Controls
    C_Player -->|"RMS Energy"| C_Avatar
```

---

## 4. Lightweight Topic-Roadmap Architecture

### 4.1 Schema Definition (`model-next/features/classroom/types/roadmap.ts`)

```typescript
export interface VisualAssetRef {
  id: string;
  url: string;
  label: string;
  caption?: string;
}

export interface RoadmapSubtopic {
  id: string;
  title: string;
  keyConcepts: string[];
}

export interface RoadmapTopic {
  id: string;
  order: number;
  title: string;
  description: string;
  learningObjectives: string[];
  subtopics: RoadmapSubtopic[];
  suggestedAnalogies: string[];
  suggestedVisualAssets: VisualAssetRef[];
  estimatedDurationMinutes: number;
}

export interface SessionRoadmap {
  version: "2.0";
  courseId: string;
  sessionId: string;
  lectureTopic: string;
  totalEstimatedMinutes: number;
  topics: RoadmapTopic[];
}
```

### 4.2 Generation Flow (`model-next/ai/flows/generate-roadmap.ts`)

```typescript
import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithModelFallback } from "@/ai/model-manager";
import type { SessionRoadmap } from "@/features/classroom/types/roadmap";

export const GenerateRoadmapInputSchema = z.object({
  courseId: z.string(),
  topic: z.string(),
  sources: z.array(z.object({ fileName: z.string() })).optional(),
  customPrompt: z.string().optional(),
  targetDurationMinutes: z.number().default(30),
});

export const GenerateRoadmapOutputSchema = z.object({
  status: z.literal("success"),
  roadmap: z.custom<SessionRoadmap>(),
  chunksUsed: z.number(),
  modelUsed: z.string(),
});
```

*Efficiency Gain*: Instead of generating 1,200+ spoken words, Gemini outputs structured JSON in **~1,100ms** (an **85% reduction in latency and tokens**), with zero risk of TTS pronunciation artifacts.

---

## 5. Complete Teaching Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Lecturer as Lecturer (Conductor)
    actor Student as Student Audience (LiveKit)
    participant Client as Conductor Client
    participant API as Next.js API Routes
    participant LK as LiveKit SFU Server
    participant DB as Supabase PostgreSQL & Realtime
    participant Live as Gemini Live API (WebSocket)

    Note over Lecturer, Live: Phase 1: Setup & Topic Sequence Preparation
    Lecturer->>Client: Create lecture with Topic & Course PDFs
    Client->>API: POST /api/classroom/[id]/generate-roadmap
    API->>DB: Query document_chunks & media_assets
    API->>API: Genkit generates 4-8 topic checkpoints
    API->>DB: Save roadmap in sessions.roadmap
    API-->>Client: Return SessionRoadmap

    Note over Lecturer, Live: Phase 2: Dual Token Acquisition & Connection
    Lecturer->>Client: Click "Start Live Class"
    Client->>API: POST /api/classroom/[id]/live-token
    API->>API: Mint Gemini Ephemeral Token (gemini-3.8-live, tools, AudioOut)
    API-->>Client: Ephemeral Token
    Client->>API: POST /api/classroom/[id]/livekit-token
    API-->>Client: LiveKit Publisher Token
    Client->>Live: Connect WebSocket (wss://generativelanguage.googleapis.com)
    Client->>LK: Connect LiveKit Room & Publish Audio Track
    Live-->>Client: Session Established (Save resumption handle)
    Client->>DB: Update sessions.status = 'running', active_driver_tab_id

    Note over Client, Live: Phase 3: Dynamic Teaching & Progress Tracking
    Client->>Live: sendRealtimeInput({ text: "Begin lecture. Welcome class and introduce Topic 1." })
    Live-->>Client: 24kHz PCM Audio Stream + Output Subtitles
    Client->>LK: Send audio to LiveKit track (Opus encoded)
    LK-->>Student: WebRTC Audio Stream (<150ms)
    Client->>DB: Broadcast SUBTITLE via Supabase Realtime
    DB-->>Student: Live Subtitles

    Note over Live, DB: Autonomous Topic Transition
    Live->>Client: Tool Call: advance_topic({ completedTopicId: "t1", nextTopicId: "t2" })
    Client->>API: POST /api/classroom/[id]/advance-topic (CAS Leased)
    API->>DB: Update sessions.current_topic_id = 't2'
    API->>DB: Realtime Broadcast TOPIC_CHANGED
    DB-->>Student: Update SessionProgressHUD (Covered: Topic 1, Current: Topic 2)
    Client->>Live: sendToolResponse({ functionResponses: [{ id, name, response: { acknowledged: true } }] })

    Note over Student, Live: Phase 4: Student Voice Interruption & Floor Control
    Student->>DB: Request Mic (Hand Raise via Realtime)
    Lecturer->>Client: Approve Student Question
    Student->>LK: Stream Mic Audio to Room
    LK->>Client: Receive Student Audio
    Client->>Live: sendRealtimeInput({ audio: studentPCM16, audioStreamEnd: true })
    Live-->>Client: Interrupted Signal -> Stop AI playback
    Live->>Client: Tool Call: search_course_materials({ query: "specific equation" })
    Client->>API: POST /api/classroom/[id]/search-materials
    API->>DB: Execute match_documents RPC
    API-->>Client: Top grounded chunks
    Client->>Live: sendToolResponse({ functionResponses: [{ id, name, response: { chunks } }] })
    Live-->>Client: Spoken answer to student + Smooth return to Topic 2

    Note over Lecturer, Live: Phase 5: Lesson Conclusion
    Live->>Client: Tool Call: advance_topic({ event: "session_completed" })
    Client->>API: POST /api/classroom/[id]/advance-topic (Complete session)
    API->>DB: Update sessions.status = 'ended', completed_at = now()
    Client->>Live: Close WebSocket connection
    Client->>LK: Disconnect Room
```

---

## 6. Progress Management & Tool Calling Protocols

### 6.1 State Contract

```typescript
export interface SessionLearningProgress {
  roadmapVersion: string;
  currentTopicId: string | null;
  coveredTopicIds: string[];
  completedAt: string | null;
  progressVersion: number;
}
```

### 6.2 Tool Definitions (`model-next/features/classroom/services/liveTools.ts`)

```typescript
import { FunctionDeclaration, Type } from "@google/genai";

export const advanceTopicDeclaration: FunctionDeclaration = {
  name: "advance_topic",
  description: "Transition progress when completing a topic, starting the next topic, or ending the session.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      event: {
        type: Type.STRING,
        enum: ["topic_started", "topic_completed", "topic_revisited", "session_completed"],
        description: "Pedagogical progress event.",
      },
      completedTopicId: {
        type: Type.STRING,
        description: "ID of the completed topic.",
      },
      nextTopicId: {
        type: Type.STRING,
        description: "ID of the topic being started (omit if event is session_completed).",
      },
      transitionReason: {
        type: Type.STRING,
        description: "Pedagogical reason for the transition.",
      },
    },
    required: ["event"],
  },
};

export const searchCourseMaterialsDeclaration: FunctionDeclaration = {
  name: "search_course_materials",
  description: "Retrieve specific factual context, formulas, or excerpts from uploaded course textbooks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Targeted search query for semantic vector lookup.",
      },
    },
    required: ["query"],
  },
};

export const projectMediaDeclaration: FunctionDeclaration = {
  name: "project_media",
  description: "Display an extracted textbook figure or diagram on the student whiteboard.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetId: {
        type: Type.STRING,
        description: "UUID of the media asset from the roadmap.",
      },
      caption: {
        type: Type.STRING,
        description: "Spoken description of the figure.",
      },
    },
    required: ["assetId"],
  },
};
```

---

## 7. Floor Control & Adaptive Learning Workflow

### 7.1 Single-Speaker Classroom Floor Control
To prevent multiple students from speaking into the Gemini Live conversation at once:
1. Students join the LiveKit room with microphone muted by default.
2. A student clicks "Raise Hand" in the UI (broadcast via Supabase Realtime).
3. The conductor sees the hand-raise queue on the HUD and clicks "Grant Mic".
4. The backend issues a LiveKit participant permission update enabling the student's mic track.
5. The student's voice streams via LiveKit to the conductor browser.
6. The conductor downsizes the audio to 16 kHz PCM and sends it via `sendRealtimeInput()` to Gemini.
7. Gemini answers the question. When the student is done, the conductor releases the floor, muting the student track.

### 7.2 Maintained Learning Context
In addition to the raw WebSocket history, the conductor maintains a lightweight learning context:
- `coveredTopicIds`: Set of finished topics.
- `struggledConcepts`: Terms or formulas where students asked clarification questions.
- `activeTopicIndex`: Current pedagogical focus.

When a student asks to revisit a topic, Gemini handles it naturally and, if necessary, emits `advance_topic({ event: "topic_revisited", nextTopicId: "t1" })`. The HUD updates backwards without corrupting session history.

---

## 8. Audio Pipeline & Interruption Engineering

### 8.1 Technical Specifications

| Direction | Source / Sink | Format | Sample Rate | Bit Depth | Resampling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Input (Mic)** | Conductor / Active Student | Linear PCM Little-Endian | 16,000 Hz | 16-bit Mono | AudioWorklet Resampler (44.1k/48k -> 16k) |
| **Output (Gemini)** | Gemini Live WebSocket | Linear PCM Little-Endian | 24,000 Hz | 16-bit Mono | Native 24kHz Web Audio Context |
| **Distribution** | LiveKit SFU to Students | Opus WebRTC Track | Dynamic (48kHz) | 16-bit Mono | Browser WebRTC Opus Encoder (32–48 kbps) |

### 8.2 Low-Latency Resampling Worklet (`model-next/public/worklets/pcm-resampler.js`)

```javascript
class PCMResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputData = input[0]; // Float32Array from microphone
    const sampleRateRatio = currentFrame / this.targetSampleRate; // Context rate down to 16k
    
    // Decimate / resample to 16,000 Hz
    const resampledLength = Math.round(inputData.length / (sampleRate / 16000));
    const pcm16 = new Int16Array(resampledLength);
    
    for (let i = 0; i < resampledLength; i++) {
      const srcIdx = Math.round(i * (sampleRate / 16000));
      const s = Math.max(-1, Math.min(1, inputData[srcIdx]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}
registerProcessor("pcm-resampler", PCMResamplerProcessor);
```

### 8.3 Bounded Audio Jitter Buffer & Instant Flush

```typescript
export class LiveAudioPlayer {
  private audioCtx: AudioContext;
  private scheduledTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  public analyserNode: AnalyserNode;

  constructor() {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.2;
    this.analyserNode.connect(this.audioCtx.destination);
  }

  playChunk(pcmData: Int16Array) {
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();

    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyserNode);

    const now = this.audioCtx.currentTime;
    const startTime = Math.max(now, this.scheduledTime);
    source.start(startTime);
    this.scheduledTime = startTime + buffer.duration;

    this.activeSources.add(source);
    source.onended = () => this.activeSources.delete(source);
  }

  // Interruption Handling: Fired immediately on server interrupted signal
  flush() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources.clear();
    this.scheduledTime = 0;
  }
}
```

---

## 9. RAG & Course-Material Integration

### 9.1 Server-Side RAG Handler (`app/api/classroom/[sessionId]/search-materials/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI } from "@google/genai";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { query, courseId } = await req.json();

    if (!query || !courseId) {
      return NextResponse.json({ error: "Missing query or courseId" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Generate query embedding using existing 768-dim model
    const embeddingResponse = await ai.models.embedContent({
      model: "models/gemini-embedding-001",
      contents: query,
      config: { outputDimensionality: 768 },
    });

    const embedding = embeddingResponse.embedding?.values;
    if (!embedding) throw new Error("Failed to generate embedding");

    // Execute PostgreSQL pgvector RPC match_documents
    const { data: matches, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 3,
      course_id_filter: courseId,
    });

    if (error) throw error;

    const chunks = (matches || []).map((m: { content: string }) => m.content).join("\n\n---\n\n");
    return NextResponse.json({ chunks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("RAG search error:", msg);
    return NextResponse.json({ chunks: "", error: msg }, { status: 500 });
  }
}
```

---

## 10. File-by-File Impact Matrix

| File Path | Action | Architectural Scope & Responsibility |
| :--- | :--- | :--- |
| `model-next/ai/model-manager.ts` | **Retain (REST Only)** | Retains static generation fallback for text prompts. Do NOT mix Live API checks here. |
| `model-next/features/classroom/services/geminiLiveClient.ts` | **New** | Dedicated Live API connection wrapper, ephemeral token setup, and reconnection logic. |
| `model-next/ai/flows/generate-script.ts` | **Retain as Fallback** | Retain for legacy/scripted mode; do not delete until Live mode is fully verified. |
| `model-next/ai/flows/generate-roadmap.ts` | **New** | Fast JSON topic roadmap generation. |
| `model-next/app/api/classroom/[sessionId]/ask/route.ts` | **Retain (Chat Fallback)** | Keeps text-based student chat working when Live voice is inactive. |
| `model-next/app/api/classroom/[sessionId]/search-materials/route.ts` | **New** | Authenticated server-side RAG tool handler for live voice queries. |
| `model-next/app/api/classroom/[sessionId]/live-token/route.ts` | **New** | Generates short-lived ephemeral tokens via `ai.authTokens.create`. |
| `model-next/app/api/classroom/[sessionId]/livekit-token/route.ts` | **New** | Issues LiveKit WebRTC room tokens for conductors and students. |
| `model-next/features/classroom/hooks/useClassroom.ts` | **Refactor** | Implements `teachingMode` abstraction (`"live"` vs `"scripted"`). In live mode, delegates audio to LiveKit and progression to `useGeminiLiveSession`. |
| `model-next/features/classroom/hooks/useSpeechQueue.ts` | **Retain as Fallback** | Active in scripted mode; bypassed in Live mode. |
| `model-next/features/avatar/hooks/useLipSync.ts` | **Modify** | Adds real-time RMS amplitude jaw-opening driver connected to `LiveAudioPlayer.analyserNode`. |
| `ai-backend/services/embedder.py` | **Retain** | Preserves `gemini-embedding-001` (768 dimensions) without breaking database vectors. |
| `db/migrations/000_initial_schema.sql` | **Active Migration** | Single source of truth for full database schema. |

---

## 11. New Modules and Dependencies

### 11.1 New NPM Dependencies (`model-next/package.json`)
```bash
pnpm add @google/genai livekit-client livekit-server-sdk
```

### 11.2 Directory Additions
```
model-next/
├── features/
│   ├── classroom/
│   │   ├── services/
│   │   │   ├── geminiLiveClient.ts       # Live WebSocket manager
│   │   │   ├── liveTools.ts              # Function declarations
│   │   │   ├── livekitService.ts         # LiveKit audio track publishing
│   │   │   ├── liveAudioPlayer.ts        # 24kHz Web Audio + Analyser
│   │   │   └── liveAudioRecorder.ts      # AudioWorklet 16kHz resampler
│   │   ├── hooks/
│   │   │   └── useGeminiLiveSession.ts   # Conductor Live orchestration hook
│   │   └── types/
│   │       └── roadmap.ts                # Roadmap & learning progress types
├── public/
│   └── worklets/
│       └── pcm-resampler.js              # 16kHz audio decimation worklet
└── app/
    └── api/
        └── classroom/
            └── [sessionId]/
                ├── live-token/route.ts
                ├── livekit-token/route.ts
                ├── generate-roadmap/route.ts
                ├── advance-topic/route.ts
                └── search-materials/route.ts
```

---

## 12. Database Changes & Configuration

### 12.1 Database Migration Reference
The baseline schema is captured in:
- `db/migrations/000_initial_schema.sql`
- `supabase/migrations/20261115000000_initial_schema.sql`

Compatible with Supabase CLI:
```powershell
npx supabase db push
```

### 12.2 Environment Variables Required

```env
# Google AI Studio / Gemini API
GEMINI_API_KEY="AIzaSy..."
GEMINI_LIVE_MODEL="gemini-3.8-live"

# LiveKit WebRTC SFU Cloud or Self-Hosted
LIVEKIT_API_KEY="APIdummykey..."
LIVEKIT_API_SECRET="sec_dummysecret..."
NEXT_PUBLIC_LIVEKIT_URL="wss://intelliclass-live.livekit.cloud"

# Supabase Database & Auth
NEXT_PUBLIC_SUPABASE_URL="https://ougxttjcgonjgstksham.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
DATABASE_URL="postgresql://postgres.ougxttjcgonjgstksham:wsxtgbqazB5%236914@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

---

## 13. Avatar Synchronization Strategy

```mermaid
flowchart LR
    LiveAudio["Incoming 24kHz PCM"] --> WebAudio["Web Audio BufferSource"]
    WebAudio --> Analyser["AnalyserNode (FFT 256)"]
    Analyser --> Speakers["Local Speakers (Conductor)"]
    Analyser --> RMS["Time-Domain RMS Energy Calculator"]
    RMS --> Smooth["Asymmetric Smoother:
- Attack: 0.8 (Rapid opening)
- Release: 0.3 (Gentle close)"]
    Smooth --> Morph["Three.js Morph Targets:
- jawOpen (0.02 - 0.22)
- viseme_aa (RMS scaled)
- viseme_ou (sub-harmonic)"]
    Morph --> Render["Three.js SkinnedMesh (60 FPS)"]
```

- Synchronized directly to the Web Audio clock.
- Eliminates inaccurate linguistic claims (no claiming 300Hz is always vowel `aa`).
- Benchmarking criteria: Visual jaw movement aligns within **±1 video frame (~16.7ms @ 60 FPS)** of audible speech.

---

## 14. Architecture Decisions & Trade-Off Matrix

| Evaluation Dimension | Direct Browser Live WebSocket + LiveKit SFU (Approved) | Pure Supabase Realtime Audio | Node.js Backend WebSocket Proxy |
| :--- | :--- | :--- | :--- |
| **Audio Fan-Out** | **WebRTC Opus (32–48 kbps)**. Scalable to 500+ students per room. | Raw PCM broadcast. Exceeds message quotas (>50 msgs/sec). | High Node.js memory pressure and bandwidth costs. |
| **Classroom Floor Control** | Native WebRTC track enabling/disabling per student. | Uncontrolled text/audio packet flooding. | Complex server-side audio multiplexing. |
| **Audio Latency** | **< 150ms** global delivery to students. | Unbounded buffer delays (>1.5s). | 350–600ms due to double-hop. |
| **AI Billing Model** | **1 Gemini session** per classroom. | 1 Gemini session per classroom. | 1 Gemini session per classroom. |
| **Reliability** | Production-proven SFU architecture. | Packet loss & disconnects under load. | Single point of server failure. |

---

## 15. Costs, Quotas, Privacy, and Scalability

### 15.1 Cost Modeling (30-Minute Lecture)
- **Gemini Live API**: ~$0.42 to $0.69 (at $0.005/min input, $0.018/min output).
- **LiveKit Cloud Media Transport**: 1 publisher + 100 subscribers @ 48 kbps Opus = ~216 MB per 30 minutes. Cost: **<$0.08 per session**.
- **Total Infrastructure Cost**: **~$0.50 to $0.77 per complete 30-minute interactive college lecture** serving 100 students.

### 15.2 Privacy Compliance
- Student microphone feeds forwarded to the Live API must have clear UI indicators and consent prompts.
- Production accounts must use Paid-Tier Google AI keys to ensure audio data is not logged or retained for model training.

---

## 16. Phased Implementation Roadmap

```mermaid
flowchart TD
    P0["Phase 0: Proof of Concept (Days 1-3)
- Gemini Live bidirectional WebSocket
- AudioWorklet 16kHz resampler
- LiveKit audio publishing to 2 student tabs"]
    
    P1["Phase 1: Lightweight Roadmap & Progress (Days 4-6)
- SessionRoadmap schema & Genkit flow
- Database migration & Roadmap UI Modal
- advance_topic tool declaration & CAS lease"]

    P2["Phase 2: Conductor Core & Avatar (Days 7-9)
- useGeminiLiveSession hook
- LiveAudioPlayer with instant interruption flush
- Three.js RMS jaw-sync avatar driver"]

    P3["Phase 3: Multi-Student LiveKit & Floor Control (Days 10-12)
- Student LiveKit audio track subscription
- Hand-raise request and mic granting
- Authenticated server RAG search-materials"]

    P4["Phase 4: Resilience, Fallback & Verification (Days 13-14)
- Session resumption & GoAway handling
- Scripted teaching mode fallback
- Latency & audio quality benchmarking"]

    P0 --> P1 --> P2 --> P3 --> P4
```

---

## 17. Testing Strategy & Measurable Acceptance Criteria

### 17.1 Empirical Benchmarks

| Milestone / Metric | Target Acceptance Criteria | Verification Method |
| :--- | :--- | :--- |
| **AI Professor Audio Latency** | First audio packet received within **< 450ms** of user speech completion. | Wall-clock timestamp logging in Conductor client. |
| **Student Fan-Out Latency** | LiveKit WebRTC audio reaches student viewports within **< 180ms**. | WebRTC stats (`getStats()`) round-trip time. |
| **Interruption Responsiveness** | Conductor audio playback silenced within **< 80ms** of `interrupted: true`. | Timestamp delta between event and `audioPlayer.flush()`. |
| **Avatar Visual Sync** | Jaw animation matches audible volume within **±1 frame (~16.7ms @ 60 FPS)**. | High-speed video screen recording / frame analysis. |
| **Roadmap Generation** | 4–8 topics generated in **< 2,000ms** (vs >8,000ms for legacy script). | API response timer on `/api/classroom/[id]/generate-roadmap`. |
| **Tool Response Loop** | Function responses acknowledged by Gemini in **< 150ms**. | Live SDK `onmessage` tool confirmation latency. |
| **Session Disconnect Recovery** | Reconnects via `resumptionHandle` within **< 3 seconds** without repeating covered topics. | Simulated network toggle during active lecture. |

---

## Conclusion

This revised plan delivers an architecturally sound, scalable, and cost-effective system. By using **Google Gemini Live API** for cognitive conversation, **LiveKit SFU** for real-time WebRTC audio distribution, and **Supabase** for authoritative curriculum state, IntelliClass AI gains genuine real-time interactivity while avoiding network and messaging bottlenecks.
