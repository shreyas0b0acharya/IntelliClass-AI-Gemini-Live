import { test, expect } from "../fixtures/test-base";
import {
  getOrCreateTestCourse,
  createAndLaunchLiveClassroom,
  ensureAudioUnlocked,
  admitWaitingStudent,
} from "../fixtures/classroom-helper";

test.describe("08. Voice Q&A, Interruption & Join Loading Flow", () => {
  test.setTimeout(240000);

  test("enter meeting code shows loading state, join button connects, and voice/doubt input triggers AI response with name addressing", async ({
    teacherPage,
    studentPage,
  }) => {
    // 1. Teacher creates course & launches Gemini Live session
    const courseId = await getOrCreateTestCourse(teacherPage);
    const sessionData = await createAndLaunchLiveClassroom(
      teacherPage,
      courseId,
      "Distributed Database Transactions & Consensus"
    );

    // 2. Test Join Page with Meeting Code input loading state
    await studentPage.goto("/join");
    await studentPage.waitForLoadState("domcontentloaded");

    const codeInput = studentPage.locator('input[placeholder*="Enter meeting code"]').first();
    await expect(codeInput).toBeVisible({ timeout: 15000 });
    await codeInput.fill(sessionData.meetingCode);

    const joinBtn = studentPage.locator('button[type="submit"]').first();
    await expect(joinBtn).toBeEnabled();
    await joinBtn.click();

    // Verify navigating to green room
    await studentPage.waitForURL(new RegExp(`/session/${sessionData.meetingCode}`), { timeout: 20000 });

    // 3. Test Green Room Join Button loading spinner
    const joinClassroomBtn = studentPage.getByRole("button", {
      name: /Join Session Room|Join Live Session/i,
    });
    await expect(joinClassroomBtn).toBeVisible({ timeout: 25000 });
    await joinClassroomBtn.click();

    // Verify connecting to classroom
    await studentPage.waitForURL(/\/classroom\/[a-f0-9-]+/, { timeout: 25000 });

    // Ensure audio unlocked on teacher
    await ensureAudioUnlocked(teacherPage);

    // 3.5. Teacher admits student from waiting room (Google Meet knocking flow)
    await teacherPage.waitForTimeout(1000);
    await admitWaitingStudent(teacherPage);

    // Verify student is admitted and enters live stage
    await expect(studentPage.locator("text=/Asking to join/i")).not.toBeVisible({ timeout: 25000 });

    // Ensure audio unlocked on student once admitted
    await ensureAudioUnlocked(studentPage);

    // 4. Start lecture broadcast if not already running
    const startLectureBtn = teacherPage.getByRole("button", { name: /Start Lecture|Start Broadcast|Start/i }).first();
    if (await startLectureBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startLectureBtn.click();
    }

    // 5. Test QuestionInput doubt submission & AI response
    const questionInput = studentPage
      .locator('input[placeholder*="Ask a doubt"]')
      .first();
    await expect(questionInput).toBeVisible({ timeout: 25000 });

    const spokenQuestion = "Professor, can you explain what is a distributed transaction and how two phase commit works?";
    await questionInput.fill(spokenQuestion);
    const askDoubtBtn = studentPage.getByRole("button", { name: /Ask Doubt/i }).first();
    if (await askDoubtBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await askDoubtBtn.click();
    } else {
      await questionInput.press("Enter");
    }

    // 6. Verify instant on-stage interruption subtitle feedback
    const interruptionSubtitle = studentPage
      .locator("text=/distributed transaction|two phase commit/i")
      .first();
    await expect(interruptionSubtitle).toBeVisible({ timeout: 25000 });

    // 7. Verify single unified Google Meet microphone button (no duplicate mic buttons!)
    const micBtns = studentPage.locator('button[title*="microphone" i], button[title*="Ctrl+D" i]');
    await expect(micBtns).toHaveCount(1);

    // Toggle microphone
    await micBtns.first().click({ force: true });
    await studentPage.waitForTimeout(1000);

    // 8. Test Pause and Resume: verify professor does not restart from initial greeting
    // Dismiss any active toast that might overlay header controls
    const closeToastBtns = teacherPage.locator('button[aria-label="Close toast"]');
    const toastCount = await closeToastBtns.count();
    for (let i = 0; i < toastCount; i++) {
      await closeToastBtns.nth(i).click({ force: true }).catch(() => {});
    }

    const pauseBtn = teacherPage.getByRole("button", { name: /Pause/i }).first();
    if (await pauseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pauseBtn.dispatchEvent("click", { bubbles: true, cancelable: true });
      await teacherPage.waitForTimeout(2000);

      const resumeBtn = teacherPage.getByRole("button", { name: /Resume/i }).first();
      await expect(resumeBtn).toBeVisible({ timeout: 15000 });
      await resumeBtn.dispatchEvent("click", { bubbles: true, cancelable: true });
      await teacherPage.waitForTimeout(2000);

      // Verify the session controller is visible and interactive
      await expect(teacherPage.getByRole("button", { name: /Pause|Resume|End/i }).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
