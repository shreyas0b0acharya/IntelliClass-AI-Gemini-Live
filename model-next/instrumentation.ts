export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { checkAndSetAvailableModels } = await import("@/ai/model-manager");
      // Asynchronously trigger check on server start without blocking boot time
      checkAndSetAvailableModels().catch((err) => {
        console.warn("⚠️ [Instrumentation] AI Model Manager startup check warning:", err);
      });
    } catch (err) {
      console.warn("⚠️ [Instrumentation] Could not initialize AI Model Manager:", err);
    }
  }
}

