import { checkAndSetAvailableModels } from "../ai/model-manager.ts";
import { generateTeachingScript } from "../ai/flows/generate-script.ts";

async function runTest() {
  console.log("====================================================================");
  console.log("🧪 STEP 1: Running Model Discovery & Health Check");
  console.log("====================================================================");

  const status = await checkAndSetAvailableModels();
  console.log("Primary Model:", status.primaryModel);
  console.log("Fallback Chain:", status.fallbackChain);

  console.log("\n====================================================================");
  console.log("🧪 STEP 2: Testing Script Generation with Dynamic Model Execution");
  console.log("====================================================================");

  const t0 = Date.now();
  const result = await generateTeachingScript({
    courseId: "test-course-id",
    topic: "Introduction to Dynamic Programming",
    lecturerName: "Prof. Rajesh Kumar",
    directText: "Dynamic Programming is an algorithmic technique for solving optimization problems by breaking them into simpler subproblems and storing the results of subproblems to avoid redundant calculations. The two key properties are Overlapping Subproblems and Optimal Substructure. Famous examples include the Fibonacci sequence, Knapsack problem, and Shortest Path algorithms.",
  });

  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n====================================================================");
  console.log("🎉 SCRIPT GENERATION TEST RESULTS");
  console.log("====================================================================");
  console.log(`- Status: ${result.status}`);
  console.log(`- Model Used: ${result.modelUsed}`);
  console.log(`- Execution Time: ${duration}s`);
  console.log(`- Chunks Grounded: ${result.chunksUsed}`);
  console.log(`- Script Word Count: ${result.script.split(/\s+/).length} words`);
  console.log(`- Script Character Count: ${result.script.length} chars`);
  console.log("\n--- SCRIPT EXCERPT (First 400 characters) ---");
  console.log(result.script.substring(0, 400) + "...\n");

  const hasGreeting = result.script.toLowerCase().includes("rajesh") || result.script.toLowerCase().includes("class");
  const hasPause = result.script.includes("[PAUSE]");
  const hasEngagement = result.script.includes("[ENGAGEMENT]");
  const isCleanOfMarkdown = !/[*#`_~]/.test(result.script);

  console.log("Quality Checklist:");
  console.log(`  [${hasGreeting ? "x" : " "}] Lecturer persona greeting`);
  console.log(`  [${hasPause ? "x" : " "}] [PAUSE] pacing tags present`);
  console.log(`  [${hasEngagement ? "x" : " "}] [ENGAGEMENT] checkpoint questions present`);
  console.log(`  [${isCleanOfMarkdown ? "x" : " "}] Clean spoken text (zero markdown syntax)`);
  console.log("====================================================================\n");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
