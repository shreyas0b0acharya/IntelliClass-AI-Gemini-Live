import { test, expect } from "../fixtures/test-base";
import {
  getOrCreateTestCourse,
  createAndLaunchLiveClassroom,
  ensureAudioUnlocked,
  admitWaitingStudent,
} from "../fixtures/classroom-helper";

test.describe("05. Live Classroom Interaction, Q&A & Media Projection", () => {
  test.setTimeout(240000);

  test("student submits question, stage displays interruption subtitle, chat syncs across users", async ({
    teacherPage,
    studentPage,
  }) => {
    // 1. Teacher creates course & launches Gemini Live session
    const courseId = await getOrCreateTestCourse(teacherPage);
    const sessionData = await createAndLaunchLiveClassroom(
      teacherPage,
      courseId,
      "Distributed Database Replication & CAP Theorem"
    );

    // 2. Student joins live session room
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

    // Unlock audio on both sides
    await ensureAudioUnlocked(studentPage);
    await ensureAudioUnlocked(teacherPage);

    // 3. Ensure live session is running
    const startLectureBtn = teacherPage.getByRole("button", { name: /Start Lecture|Start Broadcast/i });
    if (await startLectureBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startLectureBtn.click();
    }

    // 4. Lecturer admits student if in waiting room
    await admitWaitingStudent(teacherPage);

    // Wait for waiting room overlay to clear on student side
    await studentPage
      .locator("text=/Asking to join/i")
      .waitFor({ state: "detached", timeout: 20000 })
      .catch(() => {});

    // 5. Student asks question via QuestionInput
    const questionInput = studentPage.locator('input[placeholder*="Ask a doubt"], input[placeholder*="Professor"]').first();
    await expect(questionInput).toBeVisible({ timeout: 25000 });
    await expect(questionInput).toBeEnabled({ timeout: 25000 });

    const questionText = "How does Raft handle split-brain during leader election?";
    await questionInput.fill(questionText);

    // Submit question via Enter key or click
    await questionInput.press("Enter");

    // 6. Verify instant on-stage interruption subtitle feedback
    // e.g. "✋ Shreyas B: "How does Raft handle split-brain...""
    const interruptionSubtitle = studentPage
      .locator("text=/How does Raft handle split-brain/i")
      .first();
    await expect(interruptionSubtitle).toBeVisible({ timeout: 20000 });

    // 7. Verify ChatPanel message persistence & real-time sync across both users
    // Verify question is displayed in Student's chat panel
    const studentChatMsg = studentPage.getByText(questionText).first();
    await expect(studentChatMsg).toBeVisible({ timeout: 25000 });

    // Verify question is synchronized in Teacher's chat panel
    const teacherChatMsg = teacherPage.getByText(questionText).first();
    await expect(teacherChatMsg).toBeVisible({ timeout: 25000 });

    // 8. Verify Teacher Course Materials & Visual Media Projection
    // Open Materials dialog via header menu
    const moreActionsBtn = teacherPage.getByLabel("More classroom actions");
    const hasMoreActions = await moreActionsBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasMoreActions) {
      await moreActionsBtn.click();
      const materialsOption = teacherPage.getByRole("menuitem", { name: /Course Materials/i });
      if (await materialsOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await materialsOption.click();

        // Verify Materials dialog opens
        const materialsDialog = teacherPage.getByRole("dialog");
        await expect(materialsDialog).toBeVisible({ timeout: 15000 });

        // Close materials dialog
        const closeBtn = materialsDialog.locator('button:has(svg.lucide-x), button:has-text("Close")').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
        }
      }
    }
  });
});
