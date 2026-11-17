import { test, expect } from "../fixtures/test-base";
import { getOrCreateTestCourse } from "../fixtures/classroom-helper";

test.describe("02. Classroom Creation & Dynamic Roadmap Generation", () => {
  let createdCourseId: string;
  let createdSessionId: string;

  test("teacher creates course space, configures Gemini Live mode, and generates dynamic roadmap", async ({
    teacherPage,
  }) => {
    test.setTimeout(120000);
    // 1. Get or create test course space
    createdCourseId = await getOrCreateTestCourse(teacherPage);
    expect(createdCourseId).toBeTruthy();

    // 2. Navigate directly to course space
    await teacherPage.goto(`/course/${createdCourseId}`);
    await teacherPage.waitForLoadState("domcontentloaded");

    // 3. Click "+ New AI Lecture" link
    const newLectureBtn = teacherPage.locator('a[href$="/sessions/new"]');
    await expect(newLectureBtn).toBeVisible({ timeout: 15000 });
    await newLectureBtn.click();
    await teacherPage.waitForURL(new RegExp(`/course/${createdCourseId}/sessions/new`), { timeout: 15000 });

    // 4. Verify Delivery Engine is active Gemini Live via data-testid
    const liveModeCard = teacherPage.getByTestId("mode-card-gemini-live");
    await expect(liveModeCard).toBeVisible({ timeout: 15000 });
    await expect(teacherPage.getByRole("button", { name: /Create Live Gemini Classroom/i })).toBeVisible();

    // 4. Fill lecture topic
    const topicInput = teacherPage.locator("#topic");
    await topicInput.fill("Raft Consensus & Distributed Log Replication");

    // 5. Submit in Gemini Live mode
    const submitBtn = teacherPage.getByRole("button", { name: /Create Live Gemini Classroom/i });
    await submitBtn.click();

    // Verify loading progress state
    await expect(
      teacherPage.getByText(/Generating Topic Roadmap|AI Professor is generating/i)
    ).toBeVisible({ timeout: 10000 });

    // 6. Verify Roadmap Modal Opens
    const modalHeading = teacherPage.getByRole("heading", { name: /Gemini Live Lecture Roadmap/i });
    await expect(modalHeading).toBeVisible({ timeout: 90000 });

    // Verify Live AI Metrics & Badge within the dialog
    const dialog = teacherPage.getByRole("dialog");
    await expect(dialog.getByText("Gemini Live", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Gemini Live AI (Adaptive)")).toBeVisible();
    await expect(dialog.getByText(/Core Modules|Core Topics/i)).toBeVisible();

    // Verify Start Live Broadcast CTA is active
    const startBroadcastBtn = teacherPage.getByRole("button", { name: /Start Live Broadcast/i });
    await expect(startBroadcastBtn).toBeVisible();
    await expect(startBroadcastBtn).toBeEnabled();

    // 7. Click Start Live Broadcast and enter classroom
    await startBroadcastBtn.click();
    await teacherPage.waitForURL(/\/classroom\/[a-f0-9-]+/, { timeout: 20000 });

    const classroomUrl = teacherPage.url();
    createdSessionId = classroomUrl.split("/classroom/")[1].split("/")[0];
    expect(createdSessionId).toBeTruthy();

    // Verify 3D Avatar Stage & Header loaded
    await expect(
      teacherPage.getByRole("heading", { name: /Raft Consensus/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });
});
