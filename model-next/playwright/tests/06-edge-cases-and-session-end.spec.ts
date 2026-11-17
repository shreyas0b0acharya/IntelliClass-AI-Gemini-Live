import { test, expect } from "../fixtures/test-base";
import {
  getOrCreateTestCourse,
  createAndLaunchLiveClassroom,
  ensureAudioUnlocked,
  admitWaitingStudent,
} from "../fixtures/classroom-helper";

test.describe("06. Edge Cases, Conductor Lease Arbitration & Session Completion", () => {
  test.setTimeout(300000);

  test("multi-tab conductor lease arbitration and student session completion forced exit", async ({
    teacherContext,
    teacherPage,
    studentPage,
  }) => {
    // 1. Teacher creates course and launches Gemini Live classroom
    const courseId = await getOrCreateTestCourse(teacherPage);
    const sessionData = await createAndLaunchLiveClassroom(
      teacherPage,
      courseId,
      "Distributed Consensus Finality & Failure Recovery"
    );

    // 2. Multi-tab Conductor Arbitration:
    // Open a second tab in the same teacher context
    const secondTeacherTab = await teacherContext.newPage();
    await secondTeacherTab.goto(`/classroom/${sessionData.sessionId}`);
    await secondTeacherTab.waitForLoadState("domcontentloaded");

    // Dismiss AudioUnlockModal in second tab if present
    await ensureAudioUnlocked(secondTeacherTab);

    // Both teacher tabs should load stage and display the topic without throwing errors
    await expect(
      secondTeacherTab.getByRole("heading", { name: /Distributed Consensus/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      teacherPage.getByRole("heading", { name: /Distributed Consensus/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // 3. Student joins classroom
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

    // Student unlocks audio
    await ensureAudioUnlocked(studentPage);
    await ensureAudioUnlocked(teacherPage);

    // 4. Ensure class is running
    const startLectureBtn = teacherPage.getByRole("button", { name: /Start Broadcast|Start Lecture/i });
    if (await startLectureBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startLectureBtn.click();
    }
    await admitWaitingStudent(teacherPage);

    // Verify student sees "Live" indicator
    await expect(studentPage.locator("text=Live").first()).toBeVisible({ timeout: 30000 });

    // 5. Conductor Ends Session:
    // Click "End Class" button on Teacher page
    const endClassBtn = teacherPage.getByRole("button", { name: /End Class/i });
    await expect(endClassBtn).toBeVisible({ timeout: 15000 });
    await endClassBtn.click();

    // 6. Verify Teacher View: Session Ended Overlay appears
    const teacherEndedHeading = teacherPage.getByRole("heading", { name: /Session Ended/i }).first();
    await expect(teacherEndedHeading).toBeVisible({ timeout: 15000 });
    await expect(teacherPage.getByRole("button", { name: /Restart Broadcast/i })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /Return to Course/i })).toBeVisible();

    // 7. Verify Student View: Forced Conclusion Screen & Return to Home
    // Student sees "Lecture Session Concluded" overlay
    const studentEndedHeading = studentPage.getByRole("heading", {
      name: /Lecture Session Concluded/i,
    }).first();
    await expect(studentEndedHeading).toBeVisible({ timeout: 20000 });

    // Student has "Return to Home" button or is redirected to "/"
    const returnHomeBtn = studentPage.getByRole("button", { name: /Return to Home/i });
    if (await returnHomeBtn.isVisible().catch(() => false)) {
      await returnHomeBtn.click({ force: true });
    }

    await studentPage.waitForURL(
      (url) => url.pathname === "/" || url.pathname === "/dashboard",
      { timeout: 15000 }
    );
    expect(studentPage.url()).toBeTruthy();

    await secondTeacherTab.close();
  });
});
