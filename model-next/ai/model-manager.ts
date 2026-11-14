import "server-only";

// Ordered hierarchy of preferred generation models from best & stable to fast fallbacks
export const PREFERRED_MODELS: readonly string[] = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
] as const;

export interface ModelManagerStatus {
  primaryModel: string;
  fallbackChain: string[];
  lastCheckedAt: string | null;
  isChecking: boolean;
}

// In-memory state holding the currently active primary and fallback chain
let primaryModel: string = "gemini-3.5-flash";
let fallbackChain: string[] = [...PREFERRED_MODELS];
let lastCheckedAt: string | null = null;
let isChecking: boolean = false;
let checkPromise: Promise<ModelManagerStatus> | null = null;

export function getPrimaryModel(): string {
  return primaryModel;
}

export function getAvailableModels(): string[] {
  return [primaryModel, ...fallbackChain.filter((m) => m !== primaryModel)];
}

export function getModelManagerStatus(): ModelManagerStatus {
  return {
    primaryModel,
    fallbackChain: getAvailableModels(),
    lastCheckedAt,
    isChecking,
  };
}

/**
 * Probes and discovers all available Gemini models on server startup or on demand.
 * Sets the highest-priority healthy model as primary, and configures the fallback chain.
 */
export async function checkAndSetAvailableModels(): Promise<ModelManagerStatus> {
  if (isChecking && checkPromise) {
    return checkPromise;
  }

  checkPromise = (async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ [AI Model Manager] GEMINI_API_KEY not found in environment.");
      return getModelManagerStatus();
    }

    isChecking = true;
    console.log("\n====================================================================");
    console.log("🔍 [AI Model Manager] Auto-checking available Gemini models on startup...");

    try {
      // 1. Fetch live models catalog from Google AI API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(25000) }
      );

      if (!response.ok) {
        console.warn(`⚠️ [AI Model Manager] Model catalog returned HTTP ${response.status}`);
        return getModelManagerStatus();
      }

      const data = await response.json();
      const liveModels = new Set<string>(
        (data.models || [])
          .filter((m: { supportedGenerationMethods?: string[] }) =>
            m.supportedGenerationMethods?.includes("generateContent")
          )
          .map((m: { name: string }) => m.name.replace("models/", ""))
      );

      // Match candidates with active models in the account
      const matched = PREFERRED_MODELS.filter((m) => liveModels.has(m));
      if (matched.length > 0) {
        fallbackChain = matched;
      }

      console.log(
        `📋 [AI Model Manager] Found ${matched.length} generation models in account:`,
        matched
      );

      // 2. Health probe candidate models sequentially to find the top active model
      let workingModel: string | null = null;

      for (const candidate of matched) {
        try {
          process.stdout.write(`⏱️ [AI Model Manager] Probing ${candidate}... `);
          const probeStart = Date.now();
          const probeRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "ping" }] }],
              }),
              signal: AbortSignal.timeout(15000),
            }
          );

          const latency = Date.now() - probeStart;

          if (probeRes.ok) {
            console.log(`✅ ACTIVE (${latency}ms)`);
            workingModel = candidate;
            break; // Found the highest-priority healthy model! Stop probing immediately.
          } else {
            const errData = await probeRes.json().catch(() => ({}));
            const errMsg = errData.error?.message?.slice(0, 70) || `HTTP ${probeRes.status}`;
            console.log(`❌ UNAVAILABLE (${errMsg})`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`❌ FAILED (${msg.slice(0, 60)})`);
        }
      }

      if (workingModel) {
        primaryModel = workingModel;
        fallbackChain = [
          workingModel,
          ...fallbackChain.filter((m) => m !== workingModel),
        ];
      } else {
        console.log(
          `ℹ️ [AI Model Manager] All probed candidates were busy/timed out. Using fallback chain with ${primaryModel} default.`
        );
      }

      lastCheckedAt = new Date().toISOString();
      console.log("--------------------------------------------------------------------");
      console.log(`⚡ Primary Model Selected: ${primaryModel}`);
      console.log(`🔄 Fallback Chain: ${fallbackChain.join(" ➔ ")}`);
      console.log("====================================================================\n");
    } catch (error) {
      console.error("❌ [AI Model Manager] Error during model discovery:", error);
    } finally {
      isChecking = false;
      checkPromise = null;
    }

    return getModelManagerStatus();
  })();

  return checkPromise;
}

/**
 * Executes an AI operation with automatic model fallback.
 * If the current primary model fails with high demand (503/429/Unavailable),
 * it seamlessly tries the next model in the fallback chain and promotes the working model.
 */
export async function executeWithModelFallback<T>(
  taskName: string,
  execute: (modelName: string) => Promise<T>
): Promise<{ result: T; usedModel: string }> {
  const modelsToTry = getAvailableModels();
  let lastError: unknown = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      console.log(`🤖 [${taskName}] Invoking with model "${model}"...`);
      const startTime = Date.now();
      const result = await execute(model);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [${taskName}] Succeeded with "${model}" in ${elapsed}s!`);

      // Promote working model to primary if it wasn't already
      if (model !== primaryModel) {
        console.log(`🔄 [AI Model Manager] Promoting "${model}" to primary model for subsequent calls.`);
        primaryModel = model;
      }

      return { result, usedModel: model };
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetriable =
        msg.includes("503") ||
        msg.includes("high demand") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("Service Unavailable") ||
        msg.includes("429") ||
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("fetch failed") ||
        msg.includes("Headers Timeout");

      const nextModel = modelsToTry[i + 1];
      if (nextModel && isRetriable) {
        console.warn(
          `⚠️ [${taskName}] "${model}" unavailable (${msg.slice(0, 90)}...). Auto-falling back to "${nextModel}"...`
        );
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All available Gemini models failed for ${taskName}.`);
}
