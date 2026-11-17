import { Page, expect } from "@playwright/test";

export interface TestSessionData {
  courseId: string;
  sessionId: string;
  meetingCode: string;
  topic: string;
}

/**
 * Finds an existing course or creates a new one for testing.
 */
export async function getOrCreateTestCourse(teacherPage: Page): Promise<string> {
  await teacherPage.goto("/dashboard");
  await teacherPage.waitForLoadState("domcontentloaded");

  // Check if course already exists attached to DOM (sidebar or dashboard cards)
  const courseLinks = teacherPage.locator('a[href^="/course/"]');
  const count = await courseLinks.count();
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const href = await courseLinks.nth(i).getAttribute("href");
      if (href && href.startsWith("/course/") && !href.includes("/new")) {
        const id = href.split("/course/")[1].split("/")[0].split("?")[0];
        if (id && id.length > 5) return id;
      }
    }
  }

  // Create course via dashboard modal
  const createBtn = teacherPage.getByRole("button", { name: /New Course|Create First Course|Add Course Space/i }).first();
  await createBtn.click();
  await teacherPage.waitForSelector("#course-title", { timeout: 8000 });
  await teacherPage.fill("#course-title", "Testing Gemini Live Systems");
  await teacherPage.getByRole("button", { name: /Create Course/i }).click();

  // Wait for new card or navigation
  await teacherPage.waitForURL(/\/course\/[a-f0-9-]+/, { timeout: 15000 }).catch(() => {});
  if (teacherPage.url().includes("/course/")) {
    return teacherPage.url().split("/course/")[1].split("/")[0].split("?")[0];
  }

  const newCard = teacherPage.locator('a[href^="/course/"]').first();
  await newCard.waitFor({ state: "attached", timeout: 25000 });
  const href = await newCard.getAttribute("href");
  return href!.split("/course/")[1].split("/")[0].split("?")[0];
}

/**
 * Dismisses the AudioUnlockModal if and when it mounts.
 */
export async function ensureAudioUnlocked(page: Page) {
  const audioUnlockBtn = page.getByRole("button", { name: /Enter Classroom & Enable Audio/i });
  try {
    await audioUnlockBtn.waitFor({ state: "visible", timeout: 15000 });
    await audioUnlockBtn.click();
    await audioUnlockBtn.waitFor({ state: "detached", timeout: 10000 });
  } catch {
    // Already unlocked or bypassed
  }
}

/**
 * Admits any waiting student into the classroom.
 */
export async function admitWaitingStudent(teacherPage: Page) {
  // 1. Check for Accept button on toast
  const acceptToastBtn = teacherPage.getByRole("button", { name: "Accept" });
  if (await acceptToastBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptToastBtn.click();
    return;
  }

  // 2. Open Participants modal and click Admit All / Accept
  const participantsBtn = teacherPage.locator('button[title*="Participants"]').first();
  if (await participantsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await participantsBtn.click();
    const modal = teacherPage.getByRole("dialog");
    if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
      const admitBtn = modal.getByRole("button", { name: /Admit All|Accept/i }).first();
      if (await admitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await admitBtn.click();
      }
      const closeBtn = modal.locator('button:has(svg.lucide-x), button:has-text("Close")').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }
  }
}

/**
 * Creates a new Gemini Live classroom session via the Teacher Studio UI,
 * generates the topic roadmap, and launches the live broadcast.
 */
export async function createAndLaunchLiveClassroom(
  teacherPage: Page,
  courseId: string,
  topic = "Raft Distributed Consensus & State Machine Replication"
): Promise<TestSessionData> {
  await teacherPage.goto(`/course/${courseId}/sessions/new`);
  await teacherPage.waitForLoadState("domcontentloaded");

  // Wait for loading spinner to detach
  await teacherPage
    .locator("text=Loading Lecture Studio...")
    .waitFor({ state: "detached", timeout: 30000 })
    .catch(() => {});

  // Select Gemini Live mode card
  const liveModeCard = teacherPage.getByTestId("mode-card-gemini-live");
  await expect(liveModeCard).toBeVisible({ timeout: 30000 });
  await liveModeCard.click();

  // Enter topic
  const topicInput = teacherPage.locator("#topic");
  await expect(topicInput).toBeVisible({ timeout: 15000 });
  await topicInput.fill(topic);

  // Submit
  const submitBtn = teacherPage.getByRole("button", { name: /Create Live Gemini Classroom/i });
  await submitBtn.click();

  // Wait for dynamic roadmap modal
  const modalHeading = teacherPage.getByRole("heading", { name: /Gemini Live Lecture Roadmap/i });
  await expect(modalHeading).toBeVisible({ timeout: 90000 });

  // Click "Start Live Broadcast"
  const startBtn = teacherPage.getByRole("button", { name: /Start Live Broadcast/i });
  await expect(startBtn).toBeEnabled({ timeout: 15000 });
  await startBtn.click();

  // Wait for navigation into classroom
  await teacherPage.waitForURL(/\/classroom\/[a-f0-9-]+/, { timeout: 25000 });
  const url = teacherPage.url();
  const sessionId = url.split("/classroom/")[1].split("/")[0];

  // Ensure AudioUnlockModal is unlocked
  await ensureAudioUnlocked(teacherPage);

  // Fetch session details (meeting code) from API
  const sessionRes = await teacherPage.request.get(`/api/classroom/${sessionId}`);
  const sessionJson = await sessionRes.json();
  const meetingCode = sessionJson.session?.meeting_code || sessionId.slice(0, 8);

  return {
    courseId,
    sessionId,
    meetingCode,
    topic,
  };
}
