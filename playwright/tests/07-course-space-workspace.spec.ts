import { test, expect } from "../fixtures/test-base";
import { getOrCreateTestCourse } from "../fixtures/classroom-helper";

test.describe("07. Course Space 5-Area Workspace & Lifecycle UI", () => {
  test.setTimeout(90000);

  test("teacher navigates all 5 Course Space areas and interacts with management controls", async ({
    teacherPage,
  }) => {
    // 1. Get or create test course space
    const courseId = await getOrCreateTestCourse(teacherPage);
    expect(courseId).toBeTruthy();

    // 2. Open Course Space
    await teacherPage.goto(`/course/${courseId}`);
    await teacherPage.waitForLoadState("domcontentloaded");

    // 3. Area 1: Overview Tab
    await expect(teacherPage.getByRole("tab", { name: /Overview/i })).toBeVisible({ timeout: 15000 });
    await expect(teacherPage.getByText(/Quick Actions/i)).toBeVisible();
    await expect(teacherPage.getByRole("link", { name: /Start a Class/i })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /Create Roadmap/i })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /Invite Students/i })).toBeVisible();

    // 4. Test Course Edit Dialog (Description & Teaching Instructions)
    const editBtn = teacherPage.getByRole("button", { name: /Edit/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      const editDialog = teacherPage.getByRole("dialog");
      await expect(editDialog).toBeVisible();
      await expect(editDialog.getByLabel(/Course Title/i)).toBeVisible();
      await expect(editDialog.getByLabel(/Course Overview/i)).toBeVisible();
      await expect(editDialog.getByLabel(/Teaching Instructions/i)).toBeVisible();
      // Close dialog
      await editDialog.getByRole("button", { name: /Cancel/i }).click();
    }

    // 5. Area 2: Roadmaps Tab
    const roadmapsTab = teacherPage.getByRole("tab", { name: /Roadmaps/i });
    await expect(roadmapsTab).toBeVisible();
    await roadmapsTab.click();
    await expect(teacherPage).toHaveURL(new RegExp(`tab=roadmaps`), { timeout: 10000 });
    await expect(
      teacherPage.locator("text=/Curriculum Roadmaps|No curriculum roadmaps created yet/i").first()
    ).toBeVisible({ timeout: 15000 });

    // 6. Area 3: Materials Tab
    const materialsTab = teacherPage.getByRole("tab", { name: /Materials/i });
    await expect(materialsTab).toBeVisible();
    await materialsTab.click();
    await expect(teacherPage).toHaveURL(new RegExp(`tab=materials`), { timeout: 10000 });
    await expect(
      teacherPage.locator("text=/Course Materials Library|Add Materials|Upload Syllabus/i").first()
    ).toBeVisible({ timeout: 15000 });

    // 7. Area 4: Students Tab
    const studentsTab = teacherPage.getByRole("tab", { name: /Students/i });
    await expect(studentsTab).toBeVisible();
    await studentsTab.click();
    await expect(teacherPage).toHaveURL(new RegExp(`tab=students`), { timeout: 10000 });
    await expect(
      teacherPage.locator("text=/Students Roster/i").first()
    ).toBeVisible({ timeout: 15000 });
    await expect(teacherPage.getByRole("tab", { name: /Enrolled/i })).toBeVisible();

    // 8. Area 5: Classes Tab & Filtering
    const classesTab = teacherPage.getByRole("tab", { name: /Classes/i });
    await expect(classesTab).toBeVisible();
    await classesTab.click();
    await expect(teacherPage).toHaveURL(new RegExp(`tab=classes`), { timeout: 10000 });
    await expect(teacherPage.getByRole("button", { name: /All \(/i })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /Scheduled \(/i })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /Drafts \(/i })).toBeVisible();
    await expect(teacherPage.getByRole("button", { name: /History \(/i })).toBeVisible();
    await expect(teacherPage.getByPlaceholder(/Search classes/i)).toBeVisible();
  });

  test("teacher manages student groups and adds students by pressing Enter", async ({
    teacherPage,
  }) => {
    // 1. Navigate to global Students & Groups page
    await teacherPage.goto("/students");
    await teacherPage.waitForLoadState("domcontentloaded");

    await expect(teacherPage.getByRole("heading", { name: /Students & Cohort Groups/i })).toBeVisible({ timeout: 15000 });
    await expect(teacherPage.getByRole("button", { name: /Create Student Group/i })).toBeVisible();

    // 2. Add student by email and press Enter
    const emailInput = teacherPage.getByPlaceholder(/student@university.edu/i);
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const testEmail = `student_${Date.now()}@example.com`;
      await emailInput.fill(testEmail);
      await emailInput.press("Enter");
      // Fast addition gives toast or adds to roster
      await expect(teacherPage.getByText(testEmail)).toBeVisible({ timeout: 8000 });
    }
  });

  test("new class creation automatically links roadmap sources and displays student groups", async ({
    teacherPage,
  }) => {
    const courseId = await getOrCreateTestCourse(teacherPage);
    await teacherPage.goto(`/course/${courseId}/sessions/new`);
    await teacherPage.waitForLoadState("domcontentloaded");

    // 1. Verify Compact / Clean Layout without manual file checkboxes
    await expect(teacherPage.getByText(/New AI Broadcast Lecture/i)).toBeVisible({ timeout: 15000 });
    await expect(teacherPage.getByLabel(/Lesson Topic/i)).toBeVisible();

    // 2. Verify Curriculum Roadmap Section
    await expect(teacherPage.getByText(/Curriculum Roadmap/i)).toBeVisible();

    // 3. Verify Student Groups Section
    await expect(teacherPage.getByText(/Grant Direct Access \(Student Groups\)/i)).toBeVisible();

    // 4. Verify manual document drag-drop is NOT on this class creation page
    await expect(teacherPage.getByText(/Drop new PDF document here/i)).toHaveCount(0);
  });

  test("completed and paused classes display notes preview and full notes modal in classes list", async ({
    teacherPage,
  }) => {
    const courseId = await getOrCreateTestCourse(teacherPage);
    await teacherPage.goto(`/course/${courseId}?tab=classes`);
    await teacherPage.waitForLoadState("domcontentloaded");

    // Look for any class with Class Notes badge or View Full Notes
    const notesBtn = teacherPage
      .locator('button:has-text("Class Notes"), button:has-text("View Full Notes")')
      .first();
    if (await notesBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await notesBtn.click();

      // Verify ClassNotesModal dialog opens
      const dialog = teacherPage.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Verify Notes dialog content
      await expect(
        dialog.getByText(/Total Checkpoints|Detailed Class Notes|Checkpoint Cards/i).first()
      ).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Copy/i })).toBeVisible();

      // Close modal
      const closeBtn = dialog.locator("button:has(svg.lucide-x)").first();
      await closeBtn.click();
      await expect(dialog).not.toBeVisible();
    }
  });
});
