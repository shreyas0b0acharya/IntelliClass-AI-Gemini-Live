import { GoogleGenAI, type Session, type LiveServerMessage } from "@google/genai";
import {
  advanceTopicDeclaration,
  searchCourseMaterialsDeclaration,
  projectMediaDeclaration,
} from "./liveTools";
import { BoundedLiveAudioPlayer } from "./liveAudioPlayer";

export interface GeminiLiveClientOptions {
  token: string;
  model: string;
  sessionId: string;
  voiceName?: string;
  systemInstruction?: string;
  player: BoundedLiveAudioPlayer;
  onOpen?: () => void;
  onClose?: (event: unknown) => void;
  onError?: (error: unknown) => void;
  onInterrupted?: () => void;
  onTextReceived?: (text: string) => void;
  onSubtitleReceived?: (text: string) => void;
  onTurnComplete?: () => void;
  onAdvanceTopic?: (args: {
    event: string;
    completedTopicId?: string;
    nextTopicId?: string;
    transitionReason?: string;
  }) => Promise<void> | void;
  onProjectMedia?: (assetId: string, caption?: string) => Promise<void> | void;
}

export class GeminiLiveClient {
  private session: Session | null = null;
  private options: GeminiLiveClientOptions;
  private isConnected: boolean = false;

  constructor(options: GeminiLiveClientOptions) {
    this.options = options;
  }

  public async connect(): Promise<void> {
    const { token, model, voiceName = "Puck", systemInstruction, player } = this.options;

    const ai = new GoogleGenAI({
      apiKey: token,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const liveConfig = {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction }] }
        : undefined,
      tools: [
        {
          functionDeclarations: [
            advanceTopicDeclaration,
            searchCourseMaterialsDeclaration,
            projectMediaDeclaration,
          ],
        },
      ],
    };

    this.session = await ai.live.connect({
      model,
      // @ts-expect-error Types in v3.3.0 support responseModalities
      config: liveConfig,
      callbacks: {
        onopen: () => {
          this.isConnected = true;
          this.options.onOpen?.();
        },
        onmessage: (msg: LiveServerMessage) => {
          this.handleServerMessage(msg);
        },
        onerror: (err: unknown) => {
          console.error("Gemini Live connection error:", err);
          this.options.onError?.(err);
        },
        onclose: (e: unknown) => {
          this.isConnected = false;
          this.options.onClose?.(e);
        },
      },
    });
  }

  private handleServerMessage(msg: LiveServerMessage) {
    const { player } = this.options;

    // 1. Handle Interruption: immediately flush the playback buffer
    if (msg.serverContent?.interrupted) {
      player.flush();
      this.options.onInterrupted?.();
    }

    // 2. Process Model Turn: Audio Chunks & Subtitles
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const binaryStr = atob(part.inlineData.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const pcm16 = new Int16Array(bytes.buffer);
          player.playChunk(pcm16, player.currentGenerationId);
        }

        if (part.text) {
          this.options.onTextReceived?.(part.text);
          this.options.onSubtitleReceived?.(part.text);
        }
      }
    }

    if (msg.serverContent?.turnComplete) {
      this.options.onTurnComplete?.();
    }

    // 3. Process Non-Blocking Tool Calls
    if (msg.toolCall?.functionCalls && this.session) {
      for (const call of msg.toolCall.functionCalls) {
        this.executeToolCall(call);
      }
    }
  }

  private async executeToolCall(call: { id?: string; name?: string; args?: Record<string, unknown> }) {
    if (!this.session || !call.id || !call.name) return;
    const { id, name, args = {} } = call;

    try {
      if (name === "advance_topic") {
        await this.options.onAdvanceTopic?.(args as {
          event: string;
          completedTopicId?: string;
          nextTopicId?: string;
          transitionReason?: string;
        });

        this.session.sendToolResponse({
          functionResponses: [
            {
              id,
              response: {
                output: {
                  success: true,
                  acknowledgedEvent: args.event,
                  currentTopicId: args.nextTopicId,
                },
              },
            },
          ],
        });
      } else if (name === "search_course_materials") {
        const query = (args.query as string) || "";
        let materials = "";

        try {
          const res = await fetch(`/api/classroom/${this.options.sessionId}/search-materials`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, topK: 3 }),
          });
          if (res.ok) {
            const data = await res.json();
            materials = data.materials || "No relevant textbook excerpts found.";
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch course materials for Gemini Live:", fetchErr);
          materials = "Unable to access textbook materials at this moment.";
        }

        this.session.sendToolResponse({
          functionResponses: [
            {
              id,
              response: {
                output: {
                  materials,
                },
              },
            },
          ],
        });
      } else if (name === "project_media") {
        const assetId = (args.assetId as string) || "";
        const caption = (args.caption as string) || "";

        await this.options.onProjectMedia?.(assetId, caption);

        this.session.sendToolResponse({
          functionResponses: [
            {
              id,
              response: {
                output: {
                  status: "displayed",
                  assetId,
                },
              },
            },
          ],
        });
      }
    } catch (toolErr) {
      console.error(`Error executing tool call ${name}:`, toolErr);
    }
  }

  /**
   * Sends 16kHz 16-bit mono PCM audio chunk to Gemini Live
   */
  public sendAudioChunk(pcm16ArrayBuffer: ArrayBuffer) {
    if (!this.session || !this.isConnected) return;

    const bytes = new Uint8Array(pcm16ArrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    this.session.sendRealtimeInput({
      audio: {
        data: base64,
        mimeType: "audio/pcm;rate=16000",
      },
    });
  }

  /**
   * Sends text prompt to Gemini Live (e.g. to start lecture or ask question)
   */
  public sendTextMessage(text: string) {
    if (!this.session || !this.isConnected) return;
    this.session.sendRealtimeInput({ text });
  }

  public disconnect() {
    this.isConnected = false;
    if (this.session) {
      try {
        this.session.close();
      } catch {}
      this.session = null;
    }
    this.options.player.flush();
  }
}
