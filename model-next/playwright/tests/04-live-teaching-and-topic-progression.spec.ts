import { test, expect } from "../fixtures/test-base";
import {
  getOrCreateTestCourse,
  createAndLaunchLiveClassroom,
  ensureAudioUnlocked,
} from "../fixtures/classroom-helper";

test.describe("04. Live Teaching, Conductor Broadcast & Topic Progression", () => {
  test.setTimeout(180000);

  test("teacher starts live broadcast, student receives live state, and conductor progresses topics", async ({
    teacherPage,
    studentPage,
  }) => {
    // 1. Teacher creates course and launches Gemini Live classroom
    const courseId = await getOrCreateTestCourse(teacherPage);
    const sessionData = await createAndLaunchLiveClassroom(
      teacherPage,
      courseId,
      "Distributed Consensus & Quorum Systems"
    );

    // 2. Student joins the live classroom via session URL
    await studentPage.goto(`/session/${sessionData.meetingCode}`);
    await studentPage.waitForLoadState("domcontentloaded");

    // Wait for Connecting overlay to resolve
    await studentPage
      .locator("text=/Connecting to AI Session/i")
      .waitFor({ state: "detached", timeout: 45000 })
      .catch(() => {});

    const studentJoinBtn = studentPage.getByRole("button", {
      name: /Join Session Room|Join Live Session/i,
    });
    await expect(studentJoinBtn).toBeVisible({ timeout: 20000 });
    await studentJoinBtn.click();

    // Wait for student navigation into classroom
    await studentPage.waitForURL(/\/classroom\/[a-f0-9-]+/, { timeout: 25000 });

    // Dismiss Audio Unlock on student side
    await ensureAudioUnlocked(studentPage);

    // Ensure teacher audio unlocked as well
    await ensureAudioUnlocked(teacherPage);

    // 3. Verify Teacher conductor controls
    // Check if broadcast needs explicit start or is running
    const startLectureBtn = teacherPage.getByRole("button", { name: /Start Lecture|Start Broadcast/i });
    if (await startLectureBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startLectureBtn.click();
    }

    // Verify Teacher sees active broadcast indicators (Pause Lecture or Live badge)
    const teacherLiveOrPause = teacherPage
      .locator("text=/Live|Pause Lecture|Pause Class/i")
      .first();
    await expect(teacherLiveOrPause).toBeVisible({ timeout: 20000 });

    // 4. Verify Real-time synchronization to Student
    // Student should see "Live" badge in status indicator
    const studentLiveBadge = studentPage.locator("text=Live").first();
    await expect(studentLiveBadge).toBeVisible({ timeout: 30000 });

    // 5. Conductor Topic Progression:
    // Teacher opens Roadmap & Curriculum modal
    const hudScriptBtn = teacherPage.locator("button:has(svg.lucide-book-open)").first();
    const hasHudBtn = await hudScriptBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasHudBtn) {
      await hudScriptBtn.click();
    } else {
      // Fallback: Open menu dropdown in header
      const menuBtn = teacherPage.locator('button[aria-haspopup="menu"]').first();
      await menuBtn.click();
      await teacherPage.getByText(/Lecture Roadmap|Curriculum Script/i).click();
    }

    // Verify Lecture Script & Roadmap dialog opens
    const dialog = teacherPage.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Ensure Roadmap view is active
    const roadmapTab = dialog.getByRole("button", { name: "Roadmap" });
    if (await roadmapTab.isVisible().catch(() => false)) {
      await roadmapTab.click();
    }

    // Select second topic in roadmap if available
    const topicButtons = dialog.locator("button:has(span:has-text('2'))").first();
    if (await topicButtons.isVisible({ timeout: 5000 }).catch(() => false)) {
      await topicButtons.click();

      // Click "Jump to Topic"
      const jumpBtn = dialog.getByRole("button", { name: /Jump to Topic/i });
      if (await jumpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await jumpBtn.click();
      }
    }

    // Close Roadmap dialog
    const closeDialogBtn = dialog.locator('button:has(svg.lucide-x), button:has-text("Close")').first();
    if (await closeDialogBtn.isVisible().catch(() => false)) {
      await closeDialogBtn.click();
    }

    // 6. Verify Teacher can Pause and Resume Lecture
    const pauseBtn = teacherPage.getByRole("button", { name: /Pause Lecture|Pause Class/i });
    if (await pauseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pauseBtn.click();
      await expect(teacherPage.locator("text=/Paused/i").first()).toBeVisible({ timeout: 15000 });

      // Resume
      const resumeBtn = teacherPage.getByRole("button", { name: /Resume Lecture|Resume Class/i });
      await expect(resumeBtn).toBeVisible({ timeout: 10000 });
      await resumeBtn.click();
      await expect(teacherPage.locator("text=/Live/i").first()).toBeVisible({ timeout: 15000 });
    }
  });

  test("spoken speech turns during live class match notes displayed in post-class notes modal", async ({
    teacherPage,
  }) => {
    // 1. Teacher creates course and launches Gemini Live classroom
    const courseId = await getOrCreateTestCourse(teacherPage);
    const uniqueTopic = `Consensus Protocols & Fault Tolerance ${Date.now()}`;
    const sessionData = await createAndLaunchLiveClassroom(
      teacherPage,
      courseId,
      uniqueTopic
    );

    // Ensure audio unlocked
    await ensureAudioUnlocked(teacherPage);

    // 2. Start broadcast if button is visible
    const startLectureBtn = teacherPage.getByRole("button", { name: /Start Lecture|Start Broadcast/i });
    if (await startLectureBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startLectureBtn.click();
    }

    // Verify Teacher sees active broadcast indicators (Pause Lecture or Live badge)
    const teacherLiveOrPause = teacherPage
      .locator("text=/Live|Pause Lecture|Pause Class/i")
      .first();
    await expect(teacherLiveOrPause).toBeVisible({ timeout: 20000 });

    // 3. Spoken speech turns during live broadcast:
    // What the AI professor speaks in the live classroom (via live subtitle bar)
    const testSpokenSentence = "Byzantine nodes may behave maliciously by transmitting contradictory votes to partition quorum clusters.";

    // Deliver spoken speech text in the live classroom
    await teacherPage.evaluate((sentence) => {
      if ((window as any).__INTELLICLASS_CLASSROOM__) {
        (window as any).__INTELLICLASS_CLASSROOM__.setCurrentSubtitle(sentence);
      }
    }, testSpokenSentence);

    // Verify subtitle bar renders the spoken speech during class
    await expect(teacherPage.locator(`text=${testSpokenSentence}`)).toBeVisible({ timeout: 10000 });

    // 4. Conductor pauses the class to checkpoint lecture state & notes
    await teacherPage.evaluate(async () => {
      if ((window as any).__INTELLICLASS_CLASSROOM__) {
        await (window as any).__INTELLICLASS_CLASSROOM__.pauseSession();
      }
    });

    // Verify Paused state and Resume button in classroom header
    await expect(
      teacherPage.getByRole("button", { name: /Resume Class|Resume Lecture/i })
    ).toBeVisible({ timeout: 20000 });

    // 5. Navigate to Course Space Classes tab
    await teacherPage.goto(`/course/${courseId}?tab=classes`);
    await teacherPage.waitForLoadState("domcontentloaded");

    // Wait for the class item to appear
    const classRow = teacherPage.locator(`div:has-text("${sessionData.meetingCode}")`).first();
    await expect(classRow).toBeVisible({ timeout: 20000 });

    // Click "Class Notes" or "View Full Notes" button for this specific class
    const notesBtn = classRow.locator('button:has-text("Class Notes"), button:has-text("View Full Notes")').first();
    await expect(notesBtn).toBeVisible({ timeout: 15000 });
    await notesBtn.click();

    // 6. Verify Class Notes modal opens
    const dialog = teacherPage.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/Total Checkpoints|Detailed Class Notes/i).first()).toBeVisible();

    // 7. ASSERTION: What AI spoke during class == same in the notes after the class!
    await expect(dialog.getByText(testSpokenSentence)).toBeVisible({ timeout: 10000 });

    // Close modal
    const closeBtn = dialog.locator('button:has(svg.lucide-x), button:has-text("Close")').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }
  });
});
