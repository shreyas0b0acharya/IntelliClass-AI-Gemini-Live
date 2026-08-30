"use client";

import { useState } from "react";
import { getAudioContext, unlockAudioContext } from "../services/audioManager";

interface AudioTestProps {
  currentAudioPath?: string;
}

export function AudioTest({ currentAudioPath }: AudioTestProps) {
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
      console.error("Audio analysis failed:", error);
      setIsError(true);
      setStatusMessage(
        `❌ ${error instanceof Error ? error.message : "Decoding failed"}`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur-md border border-gray-200/50 w-80 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800">Diagnostics: Web Audio Channel</span>
        <button
          type="button"
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-gray-500 hover:text-black font-mono cursor-pointer"
        >
          {isMinimized ? "[+]" : "[-]"}
        </button>
      </div>

      {!isMinimized && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-gray-500">Audio URL Source</label>
            <input
              type="text"
              value={activeUrl}
              onChange={(e) => setOverrideUrl(e.target.value)}
              placeholder="e.g. /audio/tts.wav"
              className="px-2 py-1 border rounded text-xs bg-white text-gray-900 border-gray-300"
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!hasAudio || isAnalyzing}
            className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {isAnalyzing ? "Analyzing & Playing..." : "Analyze & Play Node"}
          </button>

          {statusMessage && (
            <div
              className={`p-1.5 rounded text-[11px] font-mono break-all ${
                isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}
            >
              {statusMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AudioTest;
