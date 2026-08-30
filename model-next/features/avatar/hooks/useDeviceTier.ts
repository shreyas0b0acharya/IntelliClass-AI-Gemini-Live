"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type DeviceTier = "high" | "medium" | "low" | "fallback-2d";

export interface DeviceCapabilities {
  tier: DeviceTier;
  dpr: number;
  shadows: boolean;
  lodLevel: "high" | "medium" | "low";
  maxPrefetchDepth: number;
  enableProceduralFace: boolean;
  enableEyeMovement: boolean;
  enableBreathing: boolean;
  enableEnvironmentMap: boolean;
  stageType: "3d-full" | "3d-light" | "2d-backdrop";
  textureQuality: "2048" | "1024" | "512";
  targetFps: number;
}

const TIER_CONFIGS: Record<DeviceTier, Omit<DeviceCapabilities, "tier">> = {
  high: {
    dpr: typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1,
    shadows: true,
    lodLevel: "high",
    maxPrefetchDepth: 2,
    enableProceduralFace: true,
    enableEyeMovement: true,
    enableBreathing: true,
    enableEnvironmentMap: true,
    stageType: "3d-full",
    textureQuality: "2048",
    targetFps: 60,
  },
  medium: {
    dpr: 1.0,
    shadows: false,
    lodLevel: "medium",
    maxPrefetchDepth: 1,
    enableProceduralFace: true,
    enableEyeMovement: true,
    enableBreathing: true,
    enableEnvironmentMap: false,
    stageType: "3d-light",
    textureQuality: "1024",
    targetFps: 60,
  },
  low: {
    dpr: 0.85,
    shadows: false,
    lodLevel: "low",
    maxPrefetchDepth: 1,
    enableProceduralFace: false,
    enableEyeMovement: false,
    enableBreathing: true,
    enableEnvironmentMap: false,
    stageType: "2d-backdrop",
    textureQuality: "512",
    targetFps: 30,
  },
  "fallback-2d": {
    dpr: 1.0,
    shadows: false,
    lodLevel: "low",
    maxPrefetchDepth: 1,
    enableProceduralFace: false,
    enableEyeMovement: false,
    enableBreathing: false,
    enableEnvironmentMap: false,
    stageType: "2d-backdrop",
    textureQuality: "512",
    targetFps: 60,
  },
};

/**
 * Perform initial static capability sniffing (Safari/WebKit safe).
 */
function getInitialStaticTier(): DeviceTier {
  if (typeof window === "undefined") return "high";

  try {
    // 1. Check if user explicitly set low-tier or mobile preference in sessionStorage
    const storedTier = window.sessionStorage.getItem("intelliclass_device_tier") as DeviceTier | null;
    if (storedTier && TIER_CONFIGS[storedTier]) {
      return storedTier;
    }

    // 2. Hardware concurrency check
    const concurrency = navigator.hardwareConcurrency || 4;

    // 3. WebGL GPU vendor sniffing
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      return "fallback-2d";
    }

    const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo
      ? (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ""
      : "";

    const lowerRenderer = renderer.toLowerCase();

    // Known weak / budget GPUs
    const isBudgetGPU =
      lowerRenderer.includes("mali-400") ||
      lowerRenderer.includes("mali-450") ||
      lowerRenderer.includes("mali-g52") ||
      lowerRenderer.includes("mali-g51") ||
      lowerRenderer.includes("adreno 3") ||
      lowerRenderer.includes("adreno 505") ||
      lowerRenderer.includes("adreno 506") ||
      lowerRenderer.includes("adreno 610") ||
      lowerRenderer.includes("intel hd 4000") ||
      lowerRenderer.includes("intel hd 3000") ||
      lowerRenderer.includes("powervr");

    // Known high-end GPUs
    const isHighEndGPU =
      lowerRenderer.includes("apple m") ||
      lowerRenderer.includes("apple a15") ||
      lowerRenderer.includes("apple a16") ||
      lowerRenderer.includes("apple a17") ||
      lowerRenderer.includes("apple a18") ||
      lowerRenderer.includes("rtx") ||
      lowerRenderer.includes("gtx") ||
      lowerRenderer.includes("radeon") ||
      lowerRenderer.includes("adreno 7") ||
      lowerRenderer.includes("adreno 8") ||
      lowerRenderer.includes("mali-g7");

    // Mobile screen check
    const isMobileScreen = window.innerWidth <= 768;

    if (isBudgetGPU || (isMobileScreen && concurrency <= 4 && !isHighEndGPU)) {
      return "low";
    }

    if (isHighEndGPU && !isMobileScreen) {
      return "high";
    }

    if (isMobileScreen) {
      return "medium";
    }

    return "medium";
  } catch {
    return "medium";
  }
}

export function useDeviceTier() {
  const [tier, setTier] = useState<DeviceTier>(() => getInitialStaticTier());
  const [isCalibrated, setIsCalibrated] = useState(false);

  const frameTimesRef = useRef<number[]>([]);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef<number>(0);
  const isBenchmarkingRef = useRef(true);

  // Runtime monitor state
  const slowFrameCountRef = useRef(0);
  const fastFrameCountRef = useRef(0);
  const lastTierChangeTimeRef = useRef(Date.now());
  const isSpeakingRef = useRef(false);

  // Inform the tier monitor of lecture speech state to defer upgrades to sentence boundaries
  const setSpeakingState = useCallback((speaking: boolean) => {
    isSpeakingRef.current = speaking;
  }, []);

  // Update tier safely
  const updateTier = useCallback((newTier: DeviceTier) => {
    setTier((current) => {
      if (current === newTier) return current;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("intelliclass_device_tier", newTier);
      }
      lastTierChangeTimeRef.current = Date.now();
      return newTier;
    });
  }, []);

  /**
   * Continuous frame-time recording and warm-up micro-benchmark.
   * Called by the main render loop or requestAnimationFrame.
   */
  const recordFrame = useCallback(
    (now: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = now;
        return;
      }

      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Ignore unreasonable deltas (e.g. background tab return)
      if (delta > 200 || delta < 2) return;

      frameCountRef.current += 1;
      const count = frameCountRef.current;

      // ── Layer 2: 30-Frame Warm-up Discard Benchmark ──
      // Discard frames 1-30 (one-time shader compile & GPU buffer upload stalls)
      // Benchmark frames 31-50 (20 steady-state frames)
      if (isBenchmarkingRef.current) {
        if (count > 30 && count <= 50) {
          frameTimesRef.current.push(delta);
        } else if (count > 50) {
          isBenchmarkingRef.current = false;
          setIsCalibrated(true);

          if (frameTimesRef.current.length > 0) {
            const avgDelta =
              frameTimesRef.current.reduce((a, b) => a + b, 0) /
              frameTimesRef.current.length;

            if (avgDelta <= 18.0) {
              // > 55 FPS steady
              if (window.innerWidth > 768) {
                updateTier("high");
              } else {
                updateTier("medium");
              }
            } else if (avgDelta <= 33.3) {
              // 30 - 55 FPS
              updateTier("medium");
            } else {
              // < 30 FPS
              updateTier("low");
            }
          }
        }
        return;
      }

      // ── Layer 3: Runtime Performance Monitoring with Hysteresis ──
      const timeSinceLastChange = Date.now() - lastTierChangeTimeRef.current;

      if (delta > 40.0) {
        // Under 25 FPS: increment slow frame counter
        slowFrameCountRef.current += 1;
        fastFrameCountRef.current = 0;

        // Downgrade immediately if struggling for ~3 consecutive seconds (75 slow frames)
        if (slowFrameCountRef.current > 75) {
          slowFrameCountRef.current = 0;
          if (tier === "high") {
            updateTier("medium");
          } else if (tier === "medium") {
            updateTier("low");
          } else if (tier === "low") {
            updateTier("fallback-2d");
          }
        }
      } else if (delta <= 18.0) {
        // Solid 60 FPS: increment fast frame counter
        fastFrameCountRef.current += 1;
        slowFrameCountRef.current = 0;

        // Upgrade rule: Requires 10s cooldown + 300 consecutive fast frames
        // AND must NOT be mid-speech (to prevent mid-sentence popping)
        if (
          fastFrameCountRef.current > 300 &&
          timeSinceLastChange > 10000 &&
          !isSpeakingRef.current
        ) {
          fastFrameCountRef.current = 0;
          if (tier === "low" && window.innerWidth > 640) {
            updateTier("medium");
          } else if (tier === "medium" && window.innerWidth > 1024) {
            updateTier("high");
          }
        }
      }
    },
    [tier, updateTier]
  );

  // Fallback animation frame monitor if WebGL is paused or not driving recordFrame
  useEffect(() => {
    let animId: number;
    let isActive = true;

    const tick = (now: number) => {
      if (!isActive) return;
      recordFrame(now);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      isActive = false;
      cancelAnimationFrame(animId);
    };
  }, [recordFrame]);

  const capabilities: DeviceCapabilities = {
    tier,
    ...TIER_CONFIGS[tier],
  };

  return {
    tier,
    capabilities,
    isCalibrated,
    updateTier,
    recordFrame,
    setSpeakingState,
  };
}
