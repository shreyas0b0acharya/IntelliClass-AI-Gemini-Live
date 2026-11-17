import { test, expect } from "../fixtures/test-base";
import { getOrCreateTestCourse, createAndLaunchLiveClassroom } from "../fixtures/classroom-helper";

test.describe("03. Student Join Flow & Green Room Experience", () => {
  test.setTimeout(120000);

  test("handles invalid session code gracefully with 404 Green Room error view", async ({
    studentPage,
  }) => {
    // Navigate with an invalid meeting code
    await studentPage.goto("/session/cls-invalid-code-999999");
    await studentPage.waitForLoadState("domcontentloaded");

    // Wait for connecting overlay to finish
    await studentPage
      .locator("text=/Connecting to AI Session/i")
      .waitFor({ state: "detached", timeout: 30000 })
      .catch(() => {});

    // Verify Session Not Found card
    const notFoundHeading = studentPage.getByRole("heading", { name: /Session Not Found/i });
    await expect(notFoundHeading).toBeVisible({ timeout: 25000 });

    const errorDesc = studentPage.getByText(/No lecture session found with this code/i);
    await expect(errorDesc).toBeVisible();

    const returnBtn = studentPage.getByRole("link", { name: /Return to Home/i });
    await expect(returnBtn).toBeVisible();
  });

  test("student views green room, verifies audio check, and joins live classroom with student role restrictions", async ({
    teacherPage,
    studentPage,
  }) => {
    // 1. Teacher creates course and launches Gemini Live classroom
    const courseId = await getOrCreateTestCourse(teacherPage);
    const sessionData = await createAndLaunchLiveClassroom(
      teacherPage,
      courseId,
      "Byzantine Fault Tolerance & Consensus Protocols"
    );

    expect(sessionData.sessionId).toBeTruthy();
    expect(sessionData.meetingCode).toBeTruthy();

    // 2. Student navigates to pre-join Green Room using meeting code
    await studentPage.goto(`/session/${sessionData.meetingCode}`);
    await studentPage.waitForLoadState("domcontentloaded");

    // Wait for Connecting overlay to resolve
    await studentPage
      .locator("text=/Connecting to AI Session/i")
      .waitFor({ state: "detached", timeout: 45000 })
      .catch(() => {});

    // Verify Green Room header & profile identity
    await expect(studentPage.locator("text=IntelliClass AI")).toBeVisible({ timeout: 30000 });
    await expect(studentPage.getByText(/Joining as/i)).toBeVisible();

    // Verify Session Topic & Code
    await expect(
      studentPage.getByRole("heading", { name: /Byzantine Fault Tolerance/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(studentPage.getByText(sessionData.meetingCode)).toBeVisible();

    // Verify Session Info capabilities
    await expect(studentPage.getByText("3D Avatar Stage:")).toBeVisible();
    await expect(studentPage.getByText("WebGL Realtime")).toBeVisible();
    await expect(studentPage.getByText("Live Q&A:")).toBeVisible();
    await expect(studentPage.getByText("Subtitles & Slides:")).toBeVisible();

    // Verify Speaker & Audio verification tool
    const audioTestBtn = studentPage.getByRole("button", { name: /Test Speaker & Audio/i });
    await expect(audioTestBtn).toBeVisible();
    await audioTestBtn.click();
    await expect(studentPage.getByText("Audio Ready")).toBeVisible({ timeout: 8000 });

    // 3. Click Join Classroom CTA
    const joinBtn = studentPage.getByRole("button", { name: /Join Session Room|Join Live Session/i });
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    // Verify student navigates into classroom
    await studentPage.waitForURL(new RegExp(`/classroom/${sessionData.sessionId}`), { timeout: 20000 });

    // Verify AudioUnlockModal appears for Student
    const unlockBtn = studentPage.getByRole("button", { name: /Enter Classroom & Enable Audio/i });
    await expect(unlockBtn).toBeVisible({ timeout: 15000 });
    await unlockBtn.click();

    // Verify student role isolation in the DOM:
    // Classroom root has data-role="student"
    const classroomRoot = studentPage.locator('[data-role="student"]');
    await expect(classroomRoot).toBeVisible({ timeout: 15000 });

    // Verify Student has NO lecturer conductor controls
    await expect(studentPage.getByRole("button", { name: /Start Lecture|Start Broadcast/i })).not.toBeVisible();
    await expect(studentPage.getByRole("button", { name: /Pause Lecture/i })).not.toBeVisible();
    await expect(studentPage.getByRole("button", { name: /End Lecture/i })).not.toBeVisible();
    await expect(studentPage.getByRole("button", { name: /Restart Broadcast/i })).not.toBeVisible();

    // Verify Student sees status indicator (Live or Standby)
    const statusBadge = studentPage.locator("text=/Live|Standby/i").first();
    await expect(statusBadge).toBeVisible({ timeout: 10000 });
  });
});
