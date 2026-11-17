import { GoogleGenAI, type Session, type LiveServerMessage } from "@google/genai";
import {
  advanceTopicDeclaration,
  searchCourseMaterialsDeclaration,
  projectMediaDeclaration,
} from "./liveTools";
import { BoundedLiveAudioPlayer, getTimeTag } from "./liveAudioPlayer";
import { LiveCaptionManager } from "./liveCaptionManager";

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
  onInputTranscriptionReceived?: (text: string) => void;
  onFirstAudioChunkReceived?: () => void;
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
  private pendingMessagesQueue: string[] = [];
  private audioPacketsSentCount: number = 0;
  private firstAudioChunkReported: boolean = false;
  public captionManager: LiveCaptionManager;

  constructor(options: GeminiLiveClientOptions) {
    this.options = options;
    this.captionManager = new LiveCaptionManager({
      onUpdate: (caption) => {
        this.options.onSubtitleReceived?.(caption);
      },
    });
  }

  public async connect(): Promise<void> {
    const { token, model, voiceName = "Puck", systemInstruction } = this.options;

    console.log(
      `${getTimeTag()} 🔌 [Gemini Live Client] Connecting to Gemini Live WebSocket... (model="${model}", voice="${voiceName}")`
    );

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
      inputAudioTranscription: {},
      outputAudioTranscription: {},
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

    try {
      const session = await ai.live.connect({
        model,
        // @ts-expect-error Types in v3.3.0 support responseModalities
        config: liveConfig,
        callbacks: {
          onopen: () => {
            console.log(`${getTimeTag()} 🟢 [Gemini Live Client] WebSocket handshake established successfully!`);
            this.isConnected = true;
            this.options.onOpen?.();
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription?.text) {
              console.log(`${getTimeTag()} 📝 [Gemini Live Subtitle]: "${msg.serverContent.outputTranscription.text}"`);
            }
            if (msg.serverContent?.inputTranscription?.text) {
              console.log(`${getTimeTag()} 🙋 [Gemini Live Input]: Student Speech Recognized: "${msg.serverContent.inputTranscription.text}"`);
            }
            if (msg.serverContent?.modelTurn?.parts) {
              const hasAudio = msg.serverContent.modelTurn.parts.some((p) => Boolean(p.inlineData?.data));
              if (hasAudio) {
                if (!this.firstAudioChunkReported) {
                  this.firstAudioChunkReported = true;
                  console.log(`${getTimeTag()} 🔊 [Gemini Live Audio]: FIRST streaming audio PCM chunk received from model!`);
                  this.options.onFirstAudioChunkReceived?.();
                }
              }
            }
            this.handleServerMessage(msg);
          },
          onerror: (err: unknown) => {
            console.error(`${getTimeTag()} 🔴 [Gemini Live Client Error]:`, err);
            this.options.onError?.(err);
          },
          onclose: (e: unknown) => {
            console.warn(`${getTimeTag()} ⚪ [Gemini Live Client Closed]:`, e);
            this.isConnected = false;
            this.options.onClose?.(e);
          },
        },
      });

      // Synchronously bind the live session reference
      this.session = session;
      this.isConnected = true;
      console.log(`${getTimeTag()} ✅ [Gemini Live Client] Session bound and ready. Checking queued messages...`);

      // Flush any queued text messages now that session is 100% ready
      this.flushPendingMessages();
    } catch (connectErr) {
      console.error(`${getTimeTag()} ❌ [Gemini Live Client] Connection failed:`, connectErr);
      this.isConnected = false;
      this.session = null;
      throw connectErr;
    }
  }

  private flushPendingMessages() {
    if (!this.session || !this.isConnected) return;
    while (this.pendingMessagesQueue.length > 0) {
      const queuedText = this.pendingMessagesQueue.shift();
      if (queuedText) {
        console.log(`${getTimeTag()} 📤 [Gemini Live Client] Sending queued message (${queuedText.length} chars)`);
        this.sendTextMessageDirect(queuedText);
      }
    }
  }

  private handleServerMessage(msg: LiveServerMessage) {
    const { player } = this.options;

    // 1. Handle Interruption: immediately flush the playback buffer and captions
    if (msg.serverContent?.interrupted) {
      console.log(`${getTimeTag()} ⚡ [Gemini Live Client] Turn INTERRUPTED by user/student speech! Flushing audio player.`);
      player.flush();
      this.captionManager.onInterrupted();
      this.options.onInterrupted?.();
    }

    // 2. Process Model Turn: Audio Chunks & Subtitles
    if (msg.serverContent?.outputTranscription?.text) {
      const text = msg.serverContent.outputTranscription.text;
      this.options.onTextReceived?.(text);
      this.captionManager.addToken(text);
    }

    if (msg.serverContent?.inputTranscription?.text) {
      const text = msg.serverContent.inputTranscription.text;
      this.options.onInputTranscriptionReceived?.(text);
    }

    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const binaryStr = atob(part.inlineData.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          // Guard against uneven byte length
          const sampleCount = Math.floor(bytes.byteLength / 2);
          const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
          player.playChunk(pcm16, player.currentGenerationId);
        }

        if (part.text) {
          this.options.onTextReceived?.(part.text);
          // If outputTranscription is omitted by model, route part.text into captionManager
          if (!msg.serverContent?.outputTranscription?.text) {
            this.captionManager.addToken(part.text);
          }
        }
      }
    }

    if (msg.serverContent?.turnComplete) {
      console.log(`${getTimeTag()} 🏁 [Gemini Live Client] Model finished turn (turnComplete=true)`);
      this.captionManager.onTurnComplete();
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

    console.log(`${getTimeTag()} 🛠️ [Gemini Live Tool Call]: ${name} (id: ${id}) with args:`, args);

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
              name,
              response: {
                output: {
                  status: "advanced",
                  currentTopicId: args.nextTopicId,
                },
              },
            },
          ],
        });
      } else if (name === "search_course_materials") {
        const query = (args.query as string) || "";
        let materials: unknown[] = [];
        try {
          const res = await fetch(
            `/api/classroom/${this.options.sessionId}/materials/search?q=${encodeURIComponent(query)}`
          );
          if (res.ok) {
            const data = await res.json();
            materials = data.materials || [];
          }
        } catch (searchErr) {
          console.warn(`${getTimeTag()} Course material search error:`, searchErr);
        }

        this.session.sendToolResponse({
          functionResponses: [
            {
              id,
              name,
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
              name,
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
      console.error(`${getTimeTag()} Error executing tool call ${name}:`, toolErr);
    }
  }

  /**
   * Sends 16kHz 16-bit mono PCM audio chunk to Gemini Live
   */
  public sendAudioChunk(pcm16ArrayBuffer: ArrayBuffer) {
    if (!this.session || !this.isConnected) return;

    this.audioPacketsSentCount++;
    if (this.audioPacketsSentCount === 1 || this.audioPacketsSentCount % 20 === 0) {
      console.log(
        `${getTimeTag()} 🎤 [Gemini Live Client] Streaming mic audio chunk #${this.audioPacketsSentCount} (${pcm16ArrayBuffer.byteLength} bytes) to Gemini Live`
      );
    }

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
   * Notifies Gemini Live that user microphone streaming has paused/ended.
   */
  public sendAudioStreamEnd() {
    if (!this.session || !this.isConnected) return;
    console.log(`${getTimeTag()} 🛑 [Gemini Live Client] Sending audioStreamEnd to Gemini Live`);
    this.session.sendRealtimeInput({
      audioStreamEnd: true,
    });
    this.audioPacketsSentCount = 0;
  }

  /**
   * Sends text prompt to Gemini Live (e.g. to start lecture, advance topic, or ask doubt).
   */
  public sendTextMessage(text: string) {
    if (!this.session || !this.isConnected) {
      console.log(`${getTimeTag()} ⏳ [Gemini Live Client] Session not ready yet. Queuing text message (${text.length} chars)`);
      this.pendingMessagesQueue.push(text);
      return;
    }
    this.sendTextMessageDirect(text);
  }

  private sendTextMessageDirect(text: string) {
    if (!this.session) return;
    console.log(`${getTimeTag()} 🎙️ [Gemini Live Client] Dispatching prompt turn to Gemini Live: "${text.slice(0, 120)}..."`);
    try {
      this.session.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      });
      console.log(`${getTimeTag()} ✅ [Gemini Live Client] Successfully dispatched client content turn (turnComplete=true)`);
    } catch (err) {
      console.warn(`${getTimeTag()} ⚠️ [Gemini Live Client] sendClientContent fallback to sendRealtimeInput:`, err);
      this.session.sendRealtimeInput({ text });
    }
  }

  public disconnect() {
    console.log(`${getTimeTag()} 🔌 [Gemini Live Client] Disconnecting session...`);
    this.isConnected = false;
    if (this.session) {
      try {
        this.session.close();
      } catch {}
      this.session = null;
    }
    this.captionManager.destroy();
    this.options.player.flush();
    this.firstAudioChunkReported = false;
    this.audioPacketsSentCount = 0;
  }
}
