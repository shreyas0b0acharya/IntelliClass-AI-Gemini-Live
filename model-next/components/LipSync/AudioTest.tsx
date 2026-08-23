import { useState } from "react";
import { getAudioContext, unlockAudioContext } from "./audioManager";

interface AudioTestProps {
    currentAudioPath?: string;
}

export default function AudioTest({ currentAudioPath }: AudioTestProps) {
    const [overrideUrl, setOverrideUrl] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const activeUrl = overrideUrl !== null ? overrideUrl : (currentAudioPath ?? "");
    const hasAudio = Boolean(activeUrl && activeUrl.trim());

    const handleAnalyze = async () => {
        const urlToFetch = activeUrl.trim();
        if (!urlToFetch) {
            setIsError(true);
            setStatusMessage("No audio path specified.");
            return;
        }

        setIsAnalyzing(true);
        setIsError(false);
        setStatusMessage("Fetching and analyzing audio...");

        try {
            unlockAudioContext();
            const context = getAudioContext();
            if (context.state === "suspended") {
                await context.resume();
            }

            const response = await fetch(urlToFetch);

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status} (${response.statusText || "File Not Found"})`
                );
            }

            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
                throw new Error("Received HTML error page instead of audio file");
            }

            const buffer = await response.arrayBuffer();
            if (buffer.byteLength === 0) {
                throw new Error("Received empty audio file (0 bytes)");
            }

            const audioBuffer = await context.decodeAudioData(buffer.slice(0));
            const channel = audioBuffer.getChannelData(0);

            let max = 0;
            let sumSquares = 0;

            for (let i = 0; i < channel.length; i++) {
                const value = Math.abs(channel[i]);
                if (value > max) {
                    max = value;
                }
                sumSquares += channel[i] * channel[i];
            }

            const rms = Math.sqrt(sumSquares / channel.length);

            console.log("========== AUDIO ANALYSIS ==========");
            console.log("URL:", urlToFetch);
            console.log("Duration:", audioBuffer.duration.toFixed(3), "s");
            console.log("Sample rate:", audioBuffer.sampleRate, "Hz");
            console.log("Channels:", audioBuffer.numberOfChannels);
            console.log("Samples:", channel.length);
            console.log("MAX amplitude:", max.toFixed(4));
            console.log("RMS:", rms.toFixed(4));

            if (max < 0.001) {
                console.error("❌ AUDIO IS ESSENTIALLY SILENT");
                setIsError(true);
                setStatusMessage(`⚠️ Audio is silent (Max: ${max.toFixed(4)})`);
            } else {
                console.log("✅ AUDIO CONTAINS SOUND");
                setIsError(false);
                setStatusMessage(
                    `✅ ${audioBuffer.duration.toFixed(2)}s | Max: ${max.toFixed(3)} | RMS: ${rms.toFixed(3)}`
                );
            }

            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);

            source.onended = () => {
                console.log("Audio test playback finished");
            };

            source.start(0);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error("Audio analysis failed:", error);
            setIsError(true);
            setStatusMessage(`❌ ${msg}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 left-4 z-50">
                <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-lg border hover:bg-gray-50"
                >
                    🔊 Audio Test
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 w-96 rounded-xl bg-white p-4 shadow-2xl border border-gray-100">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">
                    Audio Test & Diagnostics
                </p>
                <div className="flex items-center gap-2">
                    {overrideUrl !== null && (
                        <button
                            type="button"
                            onClick={() => {
                                setOverrideUrl(null);
                                setStatusMessage(null);
                            }}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                        title="Minimize"
                    >
                        ➖
                    </button>
                </div>
            </div>

            <input
                value={activeUrl}
                onChange={(e) => {
                    setOverrideUrl(e.target.value);
                    setStatusMessage(null);
                }}
                className="mb-2 w-full rounded border border-gray-300 p-2 text-xs font-mono outline-none focus:border-black"
                placeholder="Active audio path (e.g. /api/media/audio/xyz.wav)..."
            />

            <audio
                controls
                preload="none"
                src={hasAudio ? activeUrl : undefined}
                className="w-full mb-2"
            />

            <button
                type="button"
                disabled={!hasAudio || isAnalyzing}
                className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleAnalyze}
            >
                {isAnalyzing ? "Analyzing..." : "Analyze + Play Audio"}
            </button>

            {statusMessage && (
                <div
                    className={`mt-2 rounded p-2 text-xs font-mono break-all ${
                        isError
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-green-50 text-green-700 border border-green-200"
                    }`}
                >
                    {statusMessage}
                </div>
            )}
        </div>
    );
}