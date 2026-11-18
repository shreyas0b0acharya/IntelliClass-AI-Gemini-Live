import { test, expect } from "../fixtures/test-base";

test.describe("01. Authentication & Role-Based Permissions", () => {
  test("teacher can access lecturer dashboard with institutional permissions", async ({
    teacherPage,
  }) => {
    await teacherPage.goto("/dashboard");
    await teacherPage.waitForLoadState("domcontentloaded");

    // Verify teacher greeting and role-specific workspace controls
    await expect(teacherPage.getByRole("heading", { name: /Welcome back, Prof\. Acharya/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(teacherPage.getByRole("button", { name: /New Course/i })).toBeVisible();
    await expect(teacherPage.getByRole("heading", { name: /Academic Course Spaces/i })).toBeVisible();
  });

  test("student sees streamlined join portal without lecturer administrative controls", async ({
    studentPage,
  }) => {
    await studentPage.goto("/");
    await studentPage.waitForLoadState("domcontentloaded");

    // Student should see the Join Live Class interface
    await expect(studentPage.getByRole("heading", { name: /Join Live Class/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(studentPage.getByPlaceholder(/Enter meeting code\.\.\./i)).toBeVisible();

    // Student should not see lecturer course creation buttons on student view
    await expect(studentPage.getByRole("button", { name: /New Course/i })).not.toBeVisible();
  });

  test("unauthenticated visitor is redirected to institutional login", async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    await anonPage.goto("/dashboard");
    // Should be redirected to /login
    await expect(anonPage).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(anonPage.getByRole("heading", { name: /Sign In to IntelliClass/i })).toBeVisible();

    await anonContext.close();
  });
});
