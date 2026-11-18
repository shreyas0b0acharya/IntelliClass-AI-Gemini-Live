import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_DIR = path.resolve(__dirname, "../.auth");
const TEACHER_AUTH_FILE = path.join(AUTH_DIR, "teacher.json");
const STUDENT_AUTH_FILE = path.join(AUTH_DIR, "student.json");

setup("authenticate as teacher", async ({ page }) => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill("#email", "acharyatechworld@gmail.com");
  await page.fill("#password", "123123");
  await page.click('button[type="submit"]');

  // Wait for login redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 35000 });
  await page.waitForSelector("text=IntelliClass AI", { timeout: 15000 });

  await page.context().storageState({ path: TEACHER_AUTH_FILE });
  console.log("✅ Teacher storageState saved to:", TEACHER_AUTH_FILE);
});

setup("authenticate as student", async ({ page }) => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill("#email", "shreyasb19386@gmail.com");
  await page.fill("#password", "123123");
  await page.click('button[type="submit"]');

  // Wait for login redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 35000 });
  await page.waitForLoadState("domcontentloaded");

  await page.context().storageState({ path: STUDENT_AUTH_FILE });
  console.log("✅ Student storageState saved to:", STUDENT_AUTH_FILE);
});
