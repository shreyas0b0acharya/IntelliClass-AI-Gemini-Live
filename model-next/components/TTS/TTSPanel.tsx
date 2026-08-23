import { useState } from "react";
import type { HeadTTSData } from "../LipSync/lipSync.types";
import { unlockAudioContext } from "../LipSync/audioManager";

interface TTSResult {
    audioPath: string;
    lipSyncData: HeadTTSData;
}

interface TTSPanelProps {
    onSpeakText: (text: string, voice?: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    isGenerating?: boolean;
    statusText?: string;
    // Backwards compatibility
    onGenerated?: (result: TTSResult) => void;
    disabled?: boolean;
}

const KOKORO_VOICES = [
    { id: "af_bella", label: "Bella (US Female - Default)" },
    { id: "am_fenrir", label: "Fenrir (US Male)" },
];

export default function TTSPanel({
    onSpeakText,
    onStop,
    isSpeaking = false,
    isGenerating = false,
    statusText = "",
    disabled = false,
}: TTSPanelProps) {
    const [text, setText] = useState("");
    const [voice, setVoice] = useState("af_bella");

    const handleSpeak = () => {
        const value = text.trim();
        if (!value || isGenerating || disabled) {
            return;
        }
        unlockAudioContext();
        onSpeakText(value, voice);
    };

    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSpeak();
        }
    };

    const isActive = isSpeaking || isGenerating;

    return (
        <div className="flex w-80 flex-col gap-2 rounded-lg bg-white p-3 shadow-lg">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-700">Voice Persona</label>
                <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    disabled={isActive || disabled}
                    className="rounded-md border p-1.5 text-xs outline-none focus:border-black disabled:bg-gray-50"
                >
                    {KOKORO_VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.label}
                        </option>
                    ))}
                </select>
            </div>

            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter text for the avatar to say..."
                rows={4}
                disabled={isActive || disabled}
                className="resize-none rounded-md border p-2 text-sm outline-none focus:border-black disabled:bg-gray-50"
            />

            {isActive ? (
                <div className="flex flex-col gap-1.5">
                    <button
                        type="button"
                        onClick={onStop}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800"
                    >
                        ⏹ Stop Speech
                    </button>
                    {statusText && (
                        <div className="flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-blue-600" />
                            <span>{statusText}</span>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleSpeak}
                    disabled={disabled || !text.trim()}
                    className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:bg-gray-800"
                >
                    ⚡ Speak (Instant Stream)
                </button>
            )}

            <p className="text-xs text-gray-500">
                Text is split into sentences to start audio playback almost instantly.
            </p>
        </div>
    );
}
