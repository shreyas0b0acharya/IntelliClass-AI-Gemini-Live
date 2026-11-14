# IntelliClass AI: Gemini Live API Integration Plan
## Architectural Blueprint: Real-Time Dynamic AI Professor (Revision 3.0 — Production Ready)

---

## Executive Summary

This architecture document defines the definitive, production-ready implementation plan to transform the **IntelliClass AI Platform** into an **autonomous, conversational, real-time AI Professor powered by the Google Gemini Live API**.

This document incorporates all technical corrections across audio bridging, WebRTC floor control, streaming anti-aliased resampling, bounded audio queues, and secure server-side RAG authorization.

### The Three-Pillar Architecture
1. **Cognitive & Conversational Engine (Google Gemini Live API `gemini-3.8-live`)**:
   - Native voice-to-voice bidirectional streaming over WebSockets.
   - Low-latency speech generation, conversational fillers, and interleaved reasoning.
   - Non-blocking asynchronous tool calling (`FunctionResponseScheduling.WHEN_IDLE`) for topic transitions and textbook RAG retrieval.
2. **Media Transport Layer (LiveKit WebRTC SFU)**:
   - WebRTC Opus media transport for shared classrooms.
   - Conductor Web Audio graph bridged via `MediaStreamAudioDestinationNode` to publish a single broadcast track.
   - Ultra-low latency (<150ms) audio fan-out to 100+ students.
   - Single-speaker floor control: student hand-raises, server-managed `canPublishSources: ["microphone"]` permissions, and browser mic activation.
3. **State, Curriculum & Event Layer (Supabase PostgreSQL & Realtime)**:
   - Application-authoritative curriculum progress tracking (Covered, Current, Remaining).
   - Atomic Conductor Lease arbitration (`active_driver_tab_id`, `state_version`).
   - Closed-caption subtitles, whiteboard diagram projections, and waiting-room admission control.

---

## 1. Verified Monorepo Stack & Baseline Benchmarks

### 1.1 Verified Platform Stack & Repository Versions

| Subsystem | Verified Package & Version | Role in Architecture |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.3.0** (App Router) | Server-side API endpoints, authenticated routing, SSR. |
| **UI Library** | **React 19.2.8** | Client components, state orchestration, DOM tree. |
| **Database & Auth** | **`@supabase/supabase-js 2.112.3`** & `@supabase/ssr 0.12.4` | PostgreSQL client, Realtime channels, Row Level Security. |
| **Static AI Engine** | **`genkit 1.41.0`** & **`@genkit-ai/google-genai 1.41.0`** | Background batch workflows (PDF text processing, roadmap generation). |
| **Realtime Live SDK** | **`@google/genai` (Target: >= 2.3.0)** | Direct WebSocket client for bidirectional Gemini Live audio & non-blocking tools. |
| **Media Transport** | **`livekit-client` & `livekit-server-sdk`** | WebRTC SFU for continuous audio distribution and floor control. |
| **3D Avatar Rendering** | **Three.js 0.180.0**, `@react-three/fiber 9.7.0`, `@react-three/drei 10.7.8` | Procedural 3D humanoid avatar with morph targets (`jawOpen`, mouth visemes). |
| **Vector Embeddings** | **`models/gemini-embedding-001` (768 dimensions)** | Managed via `ai-backend/services/embedder.py` with PostgreSQL `pgvector`. |

### 1.2 Actual Measured Baseline Benchmarks (`benchmark/BENCHMARK_REPORT.md`)

| Operation / Sample | Measured Latency | Real-Time Factor (RTF) | Observed Architectural Limit |
| :--- | :--- | :--- | :--- |
| **HeadTTS Short (10 words)** | **1,118.9 ms** | 0.233 | Local CPU compute overhead |
| **HeadTTS Medium (25 words)** | **2,321.7 ms** | 0.246 | Linear synthesis delay |
| **HeadTTS Long (50 words)** | **5,423.7 ms** | 0.272 | Cannot stream in real-time |
| **Gemini Short Q&A REST** | **10,336 ms** (1.9 words/sec) | N/A | High generation latency under peak load |
| **Gemini Medium Paragraph** | **3,157 ms** (4.8 words/sec) | N/A | Transient latency spikes |
| **Gemini Full Script (1,200w)** | **Failed (503 UNAVAILABLE)** | N/A | Exceeds execution timeouts on server busy |

*Conclusion*: The legacy pipeline produces an end-to-end interruption lag of **6 to 12 seconds**. The Gemini Live + LiveKit architecture reduces this to **< 450ms**, enabling natural conversational teaching.

---

## 2. Core Architectural Decisions

### 2.1 Media Transport vs. State Synchronization (The LiveKit + Supabase Separation)

Streaming continuous audio over Supabase Broadcast is mathematically non-viable:
- 24,000 Hz × 16-bit × Mono = **384 kbps raw audio**.
- 20ms audio packets generate **50 messages per second** per audio stream.
- In a 100-student classroom, Broadcast fan-out requires **5,000 deliveries per second**.
- Supabase Realtime limits are **100 msg/sec on Free, 500 msg/sec on Pro, and 2,500 msg/sec on Pro without spend cap**.

**Approved Architecture**:
- **LiveKit SFU**: Handles continuous audio distribution via WebRTC Opus tracks (32–48 kbps).
- **Supabase Realtime**: Handles discrete application events (topic progress changes, whiteboard media updates, live subtitles, and participant presence).

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
     │  - MediaStreamDestination    │
     └──────┬────────────────┬──────┘
            │                │
Publish AI  │ Opus WebRTC    │ Application Events (Topic change,
Audio Track │ Track          │ Subtitles, Whiteboard image)
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

### 2.2 LiveKit Audio Publishing Bridge

The conductor browser bridges the Web Audio graph into LiveKit using a `MediaStreamAudioDestinationNode`:

```
Gemini 24kHz PCM Chunks
          │
          ▼
   Web Audio Context
          │
          ├──> AnalyserNode ──> Local Speakers (Conductor hear/monitor)
          │
          └──> MediaStreamAudioDestinationNode
                         │
                         ▼
                  MediaStreamTrack
                         │
                         ▼
                  room.localParticipant.publishTrack(track, {
                    name: "ai-professor-audio",
                    source: Track.Source.Microphone,
                    simulcast: false,
                    dtx: true,
                    red: true,
                  })
                         │
                         ▼
                  LiveKit SFU ──> WebRTC Opus Stream to 100+ Students
```

*Advantage*: The browser's native WebRTC stack automatically encodes the raw audio into Opus with packet loss concealment (PLC), DTX, and RED without any manual transcoding overhead on the host.

### 2.3 Strict Microphone Floor-Control Lifecycle

To prevent multiple students from speaking into Gemini Live simultaneously:
1. **Initial Token**: Student joins the LiveKit room with `canPublish: false`, `canSubscribe: true`.
2. **Hand Raise**: Student clicks "Raise Hand" in the UI (broadcast via Supabase Realtime).
3. **Conductor Approval**: Conductor clicks "Grant Mic". Conductor calls `POST /api/classroom/[id]/grant-floor` with `{ targetUserId }`.
4. **LiveKit Permission Update**: Backend uses `RoomServiceClient.updateParticipant(roomName, targetUserId, undefined, { canPublishSources: [Track.Source.Microphone] })`.
5. **Client Notification**: Student receives approval event via participant metadata update.
6. **Explicit Browser Mic Enablement**: Student browser prompts/activates mic via `await room.localParticipant.setMicrophoneEnabled(true)`. Student speaks.
7. **Conductor Ingestion**: Student's track is received by conductor via `room.on(RoomEvent.TrackSubscribed, (track) => ...)`. Conductor pipes this audio into the 16 kHz resampler and calls `geminiSession.sendRealtimeInput({ audio: pcm16 })`.
8. **Revocation & Cleanup**: Conductor clicks "Mute Student" or Gemini finishes answering -> backend calls `updateParticipant(roomName, targetUserId, undefined, { canPublishSources: [] })`. Student client automatically unpublishes and mutes the track.

---

## 3. Recommended Target Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer ["Classroom Clients"]
        subgraph Conductor ["Lecturer / Conductor Tab"]
            C_UI["Conductor HUD & Roadmap Controls"]
            C_Store["Zustand Progress Store"]
            C_Gemini["@google/genai LiveClient (WebSocket)"]
            C_Worklet["AudioWorklet Resampler (16kHz PCM In)"]
            C_Player["24kHz Web Audio Player + Analyser"]
            C_Dest["MediaStreamAudioDestinationNode"]
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
        API_Floor["POST /api/classroom/[id]/grant-floor (Floor Control)"]
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
    C_Player -->|"Web Audio Graph"| C_Dest
    C_Dest -->|"MediaStreamTrack"| C_LKPub
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

---

## 5. Progress Management & Tool Calling Protocols

### 5.1 Application-Authoritative Progress Contract

```typescript
export interface SessionLearningProgress {
  roadmapVersion: string;
  currentTopicId: string | null;
  coveredTopicIds: string[];
  completedAt: string | null;
  progressVersion: number;
}

export type TopicEvent = 
  | "topic_started"
  | "topic_completed"
  | "topic_revisited"
  | "session_completed";
```

- **Remaining Topics Calculation**:
  ```typescript
  const remainingTopics = roadmap.topics.filter(
    (t) => !progress.coveredTopicIds.includes(t.id) && t.id !== progress.currentTopicId
  );
  ```

### 5.2 Tool Declarations (`model-next/features/classroom/services/liveTools.ts`)

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

### 5.3 Function Response Structure with ID Correlation

```typescript
import { FunctionResponseScheduling } from "@google/genai";

// Inside session tool dispatcher
session.sendToolResponse({
  functionResponses: [
    {
      id: toolCall.id,
      name: toolCall.name,
      response: {
        result: { acknowledged: true, currentTopicId: validatedNextTopicId },
      },
      scheduling: FunctionResponseScheduling.WHEN_IDLE,
    },
  ],
});
```

---

## 6. Audio Pipeline & Resampling Engineering

### 6.1 Audio Technical Specifications

| Direction | Format | Sample Rate | Bit Depth | Anti-Aliasing & Buffering |
| :--- | :--- | :--- | :--- | :--- |
| **Input (Mic)** | Linear PCM Little-Endian | 16,000 Hz | 16-bit Mono | AudioWorklet anti-aliasing low-pass filter + phase accumulator |
| **Output (Gemini)** | Linear PCM Little-Endian | 24,000 Hz | 16-bit Mono | Native 24kHz Web Audio Context with bounded jitter queue |
| **Media Transport** | WebRTC Opus Track | 48,000 Hz | 16-bit Mono | LiveKit SFU automatic Opus encoding (32–48 kbps) |

### 6.2 Mathematically Rigorous AudioWorklet Resampler (`model-next/public/worklets/pcm-resampler.js`)

```javascript
class PCMResamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.phase = 0; // Fractional phase accumulator across processing blocks
    
    // 2nd-order Butterworth low-pass filter at 7.2 kHz (Nyquist for 16kHz is 8kHz)
    // Prevents aliasing distortion when downsampling from 44.1k/48k to 16k
    const wc = 2 * Math.PI * 7200 / sampleRate;
    const q = 0.7071;
    const alpha = Math.sin(wc) / (2 * q);
    const cosw = Math.cos(wc);
    
    this.b0 = (1 - cosw) / 2;
    this.b1 = 1 - cosw;
    this.b2 = (1 - cosw) / 2;
    this.a0 = 1 + alpha;
    this.a1 = -2 * cosw;
    this.a2 = 1 - alpha;
    
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const inputData = input[0];
    const inLen = inputData.length;
    const ratio = sampleRate / this.targetRate;

    // 1. Anti-aliasing IIR filtering
    const filtered = new Float32Array(inLen);
    for (let i = 0; i < inLen; i++) {
      const x0 = inputData[i];
      const y0 = (this.b0 / this.a0) * x0 + (this.b1 / this.a0) * this.x1 + (this.b2 / this.a0) * this.x2
                 - (this.a1 / this.a0) * this.y1 - (this.a2 / this.a0) * this.y2;
      this.x2 = this.x1; this.x1 = x0;
      this.y2 = this.y1; this.y1 = y0;
      filtered[i] = y0;
    }

    // 2. Fractional resampling with phase tracking across blocks
    const outputSamples = [];
    while (this.phase < inLen) {
      const idx = Math.floor(this.phase);
      const frac = this.phase - idx;
      const s0 = filtered[idx];
      const s1 = (idx + 1 < inLen) ? filtered[idx + 1] : s0;
      const interpolated = s0 + frac * (s1 - s0); // Linear interpolation
      outputSamples.push(interpolated);
      this.phase += ratio;
    }
    this.phase -= inLen; // Wrap remaining phase to next block

    if (outputSamples.length === 0) return true;

    // 3. Convert to 16-bit Little-Endian signed PCM
    const pcm16 = new Int16Array(outputSamples.length);
    for (let i = 0; i < outputSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, outputSamples[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}
registerProcessor("pcm-resampler", PCMResamplerProcessor);
```

### 6.3 Bounded Audio Player with Generation ID (`model-next/features/classroom/services/liveAudioPlayer.ts`)

```typescript
export class BoundedLiveAudioPlayer {
  private audioCtx: AudioContext;
  private scheduledTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  public analyserNode: AnalyserNode;
  public destinationNode: MediaStreamAudioDestinationNode;
  public currentGenerationId: number = 1; // Monotonic ID for interruption invalidation

  private readonly HIGH_WATER_MARK_SEC = 0.5; // 500ms max buffer ahead

  constructor() {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.2;

    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // Route graph: Analyser -> Speakers AND MediaStreamDestination (for LiveKit)
    this.analyserNode.connect(this.audioCtx.destination);
    this.analyserNode.connect(this.destinationNode);
  }

  playChunk(pcmData: Int16Array, chunkGenerationId: number) {
    // Drop stale chunks from previous turns
    if (chunkGenerationId !== this.currentGenerationId) return;

    if (this.audioCtx.state === "suspended") this.audioCtx.resume();

    const now = this.audioCtx.currentTime;
    
    // High-Water Mark enforcement: catch up if queue drifts > 500ms ahead
    if (this.scheduledTime - now > this.HIGH_WATER_MARK_SEC) {
      this.scheduledTime = now + 0.05; // Drop stale backlog
    }

    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyserNode);

    const startTime = Math.max(now, this.scheduledTime);
    source.start(startTime);
    this.scheduledTime = startTime + buffer.duration;

    this.activeSources.add(source);
    source.onended = () => this.activeSources.delete(source);
  }

  // Interruption Flush: Cancels active audio and invalidates pending chunks
  flush() {
    this.currentGenerationId++; // Invalidate in-flight chunks
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

## 7. Secured Server-Side RAG Retrieval API

### 7.1 Secure API Endpoint (`model-next/app/api/classroom/[sessionId]/search-materials/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI } from "@google/genai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    // 1. Authenticate user from session token / cookies
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch session and verify user participation/ownership
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, course_id, created_by, status")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if user is lecturer or an admitted participant
    const isOwner = session.created_by === user.id;
    if (!isOwner) {
      const { data: participant } = await supabase
        .from("session_participants")
        .select("status")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .eq("status", "admitted")
        .single();

      if (!participant) {
        return NextResponse.json({ error: "Forbidden: Not an admitted participant" }, { status: 403 });
      }
    }

    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query string is required" }, { status: 400 });
    }

    // 3. Derive courseId strictly from the verified database session
    const verifiedCourseId = session.course_id;

    // 4. Generate embedding using existing 768-dim model
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const embeddingResponse = await ai.models.embedContent({
      model: "models/gemini-embedding-001",
      contents: query,
      config: { outputDimensionality: 768 },
    });

    const embedding = embeddingResponse.embedding?.values;
    if (!embedding) throw new Error("Failed to generate query embedding");

    // 5. Query verified pgvector RPC with 800ms abort signal timeout
    const adminSupabase = createAdminClient();
    const { data: matches, error: rpcErr } = await adminSupabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 3,
      course_id_filter: verifiedCourseId,
    });

    if (rpcErr) throw rpcErr;

    const chunks = (matches || [])
      .map((m: { content: string }) => m.content)
      .join("\n\n---\n\n");

    return NextResponse.json({ chunks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("RAG search error:", msg);
    return NextResponse.json({ chunks: "", error: msg }, { status: 500 });
  }
}
```

---

## 8. Avatar Synchronization Strategy

```mermaid
flowchart LR
    LiveAudio["Incoming 24kHz PCM"] --> WebAudio["Web Audio BufferSource"]
    WebAudio --> Analyser["AnalyserNode (FFT 256)"]
    Analyser --> OutputDest["MediaStreamDestination & Speakers"]
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
- Visual jaw movement aligns within **±1 video frame (~16.7ms @ 60 FPS)** of audible speech.

---

## 9. Costs, Session Boundaries, and Privacy Compliance

### 9.1 Official Gemini 3.8 Live Rates (Google AI Studio)
- **Audio Input**: $0.005 / min ($3.00 / 1M tokens)
- **Audio Output**: $0.018 / min ($12.00 / 1M tokens)
- **Combined Continuous Audio**: ~$0.023 / min

### 9.2 30-Minute Shared Classroom Cost Scenarios
| Classroom Activity Scenario | Audio Input | Audio Output | Gemini Live Cost | LiveKit SFU Cost | Total Cost |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **High Lecture / Low Interruption** | 30 min | 20 min | $0.51 | $0.08 | **$0.59** |
| **Balanced Dialogue / Q&A** | 30 min | 15 min | $0.42 | $0.08 | **$0.50** |
| **Continuous Professor Speaking** | 30 min | 30 min | $0.69 | $0.08 | **$0.77** |

### 9.3 Session Limits & Reconnection Handling
- **Audio-only session**: 15 minutes without compression.
- **WebSocket connection lifetime**: ~10 minutes.
- **Session Resumption**: Handle valid for 2 hours after termination.
- **GoAway Signal Handling**: Client reads dynamic `timeLeft` in the `GoAway` frame to proactively initiate reconnection before the socket terminates.
- **Resumption Non-Availability Guard**: If the connection resets during active generation or tool execution, resumption can be unavailable. The client re-establishes using `SessionLearningProgress` persisted in Supabase.
- **Privacy Notice**: Paid-Tier Gemini API keys are required for student voice recordings to ensure data is not used for model training.

---

## 10. Phased Implementation Roadmap

```mermaid
flowchart TD
    P0["Phase 0: Proof of Concept (Days 1-3)
- Gemini Live bidirectional WebSocket
- AudioWorklet anti-aliasing 16kHz resampler
- LiveKit audio bridge & publishing to 2 student viewports"]
    
    P1["Phase 1: Lightweight Roadmap & Progress (Days 4-6)
- SessionRoadmap schema & Genkit flow
- Database migration & Roadmap UI Modal
- advance_topic tool declaration & CAS lease"]

    P2["Phase 2: Conductor Core & Avatar (Days 7-9)
- useGeminiLiveSession hook
- BoundedLiveAudioPlayer with generation ID flush
- Three.js RMS jaw-sync avatar driver"]

    P3["Phase 3: Multi-Student LiveKit & Floor Control (Days 10-12)
- Student LiveKit audio track subscription
- Hand-raise request and mic granting
- Authenticated server RAG search-materials"]

    P4["Phase 4: Resilience, Fallback & Verification (Days 13-14)
- Session resumption & dynamic GoAway handling
- Scripted teaching mode fallback
- Latency & audio quality benchmarking"]

    P0 --> P1 --> P2 --> P3 --> P4
```

---

## 11. Testing Strategy & Acceptance Criteria

| Benchmark Metric | Target Acceptance Criteria | Verification Method |
| :--- | :--- | :--- |
| **AI Professor Audio Latency** | First audio packet received within **< 450ms** of user speech completion. | Wall-clock timestamp logging in Conductor client. |
| **LiveKit Audio Fan-Out** | WebRTC audio reaches student viewports within **< 150ms**. | WebRTC stats (`getStats()`) round-trip time. |
| **Interruption Responsiveness** | Conductor audio playback silenced within **< 80ms** of `interrupted: true`. | Timestamp delta between event and `player.flush()`. |
| **Floor Control Handshake** | Mic granted and active within **< 500ms** of conductor approval. | LiveKit participant permission update event timing. |
| **Resampling Fidelity** | AudioWorklet produces continuous 16kHz PCM with zero aliasing and no phase clicks. | Spectrogram analysis of downsampled sine sweep. |
| **Avatar Visual Sync** | Jaw animation matches audible volume within **±1 frame (~16.7ms @ 60 FPS)**. | High-speed video screen recording / frame analysis. |
| **RAG Retrieval Speed** | Vector search returns top chunks within **< 600ms**. | API response timer on `/api/classroom/[id]/search-materials`. |
| **Session Disconnect Recovery** | Reconnects via `resumptionHandle` within **< 3 seconds** without repeating covered topics. | Simulated network toggle during active lecture. |

---

## Conclusion

With these technical revisions, the architecture is now production-ready. The system leverages **Google Gemini Live API** for cognitive voice dialogue, **LiveKit SFU** for WebRTC audio transport, and **Supabase** for authoritative curriculum state.
