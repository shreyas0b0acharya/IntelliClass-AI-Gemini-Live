import { test as base, expect, Page, BrowserContext } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.resolve(__dirname, "../.auth");
export const TEACHER_STORAGE_STATE = path.join(AUTH_DIR, "teacher.json");
export const STUDENT_STORAGE_STATE = path.join(AUTH_DIR, "student.json");

type ClassroomFixtures = {
  teacherPage: Page;
  studentPage: Page;
  teacherContext: BrowserContext;
  studentContext: BrowserContext;
};

export const test = base.extend<ClassroomFixtures>({
  teacherContext: async ({ browser }, provide) => {
    const context = await browser.newContext({
      storageState: TEACHER_STORAGE_STATE,
      permissions: ["microphone", "camera"],
    });
    await provide(context);
    await context.close();
  },

  studentContext: async ({ browser }, provide) => {
    const context = await browser.newContext({
      storageState: STUDENT_STORAGE_STATE,
      permissions: ["microphone", "camera"],
    });
    await provide(context);
    await context.close();
  },

  teacherPage: async ({ teacherContext }, provide) => {
    const page = await teacherContext.newPage();
    await provide(page);
    await page.close();
  },

  studentPage: async ({ studentContext }, provide) => {
    const page = await studentContext.newPage();
    await provide(page);
    await page.close();
  },
});

export { expect };
