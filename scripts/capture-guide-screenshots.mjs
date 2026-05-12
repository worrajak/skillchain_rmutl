/**
 * Capture screenshots for role guides.
 *
 * Logs in as each role with known test credentials, navigates to key pages,
 * and saves trimmed images to public/guides/img/<role>/<NN-name>.png
 *
 * Run while `npm run dev` is up.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public", "guides", "img");
const BASE = process.env.BASE_URL || "http://localhost:3000";

// iPhone 17 Pro viewport (mobile-first capture)
const VIEWPORT = { width: 402, height: 874 };
const DEVICE_SCALE = 2;

const PASSWORD = "Test1234!";

const ROLES = {
  student: {
    email: "artid_lu67@live.rmutl.ac.th",
    landing: "/student/dashboard",
    captures: [
      { name: "01-login", url: "/login", afterLogin: false, scrollY: 0 },
      { name: "02-jobs", url: "/student/jobs", clickAfter: "หางานทำ", scrollY: 0 },
      { name: "03-work", url: "/student/jobs", clickAfter: "งานของฉัน", scrollY: 0 },
      { name: "04-submit", url: "/student/jobs", clickAfter: "งานของฉัน", scrollY: 600 },
      { name: "05-review", url: "/profile", scrollY: 0 },
      { name: "06-wallet", url: "/wallet", scrollY: 0 },
    ],
  },
  employer: {
    email: "bizz@rmutl.ac.th",
    landing: "/employer/dashboard",
    captures: [
      { name: "01-login", url: "/login", afterLogin: false, scrollY: 0 },
      { name: "02-new-job", url: "/employer/jobs/new", scrollY: 0 },
      { name: "03-pending", url: "/employer/dashboard", scrollY: 0 },
      { name: "04-track", url: "/employer/dashboard", scrollY: 400 },
      { name: "05-confirm", url: "/employer/dashboard", scrollY: 0 },
      { name: "06-paid", url: "/wallet", scrollY: 0 },
    ],
  },
  project_staff: {
    email: "ampai.pu@rmutl.ac.th",
    landing: "/project-staff/dashboard",
    captures: [
      { name: "01-review", url: "/project-staff/review-jobs", scrollY: 0 },
      { name: "02-approve", url: "/project-staff/approvals", scrollY: 0 },
      { name: "03-track", url: "/project-staff/active-jobs", scrollY: 0 },
      { name: "04-release", url: "/project-staff/trpb", scrollY: 0 },
      { name: "05-batch", url: "/project-staff/gov-batches", scrollY: 0 },
      { name: "06-sign", url: "/project-staff/gov-batches", scrollY: 200 },
    ],
  },
  rmutl_staff: {
    // RMUTL staff uses project-staff layout, so capture same/similar pages
    email: "rmutl@test.com",
    landing: "/project-staff/dashboard",
    captures: [
      { name: "01-dashboard", url: "/project-staff/dashboard", scrollY: 0 },
      { name: "02-new-job", url: "/project-staff/jobs/new", scrollY: 0 },
      { name: "03-track", url: "/project-staff/active-jobs", scrollY: 0 },
      { name: "04-batches", url: "/project-staff/gov-batches", scrollY: 0 },
      { name: "05-reports", url: "/project-staff/dashboard", scrollY: 600 },
      { name: "06-sign", url: "/project-staff/gov-batches", scrollY: 200 },
    ],
  },
  teacher: {
    email: "worrajak@rmutl.ac.th", // superadmin (no teacher account); use it
    password: "Prach4843#*",
    landing: "/teacher/dashboard",
    captures: [
      { name: "01-login", url: "/login", afterLogin: false, scrollY: 0 },
      { name: "02-new-job", url: "/teacher/dashboard", scrollY: 0 },
      { name: "03-students", url: "/teacher/students", scrollY: 0 },
      { name: "04-portfolio", url: "/teacher/students", scrollY: 0 },
      { name: "05-evaluate", url: "/teacher/evaluation", scrollY: 0 },
      { name: "06-credential", url: "/teacher/dashboard", scrollY: 0 },
    ],
  },
};

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for cookie to be set
  await page.waitForTimeout(2500);
}

async function captureScrolledScreenshot(page, outPath, scrollY = 0) {
  if (scrollY > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: outPath, fullPage: false });
}

async function captureRole(browser, roleKey, role) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  });
  const page = await ctx.newPage();
  const outDir = join(PUBLIC_DIR, roleKey);
  mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${roleKey} ===`);
  const password = role.password || PASSWORD;

  for (let i = 0; i < role.captures.length; i++) {
    const cap = role.captures[i];
    try {
      // Capture login screen BEFORE logging in (for step 01-login)
      if (cap.afterLogin === false && cap.url === "/login") {
        await page.goto(`${BASE}${cap.url}`);
        await page.waitForTimeout(1500);
        const out = join(outDir, `${cap.name}.png`);
        await captureScrolledScreenshot(page, out, cap.scrollY);
        console.log(`  ✓ ${cap.name}.png`);
        // Then login for subsequent steps
        await login(page, role.email, password);
        continue;
      }

      // Ensure logged in
      if (i === 0 || page.url().includes("/login")) {
        await login(page, role.email, password);
      }

      // Navigate
      await page.goto(`${BASE}${cap.url}`);
      await page.waitForTimeout(2200);

      // Click optional tab/button
      if (cap.clickAfter) {
        try {
          const locator = page.locator(`button:has-text("${cap.clickAfter}"), a:has-text("${cap.clickAfter}")`).first();
          await locator.click({ timeout: 3000 });
          await page.waitForTimeout(1500);
        } catch {
          // ignore — keep screenshot anyway
        }
      }

      const out = join(outDir, `${cap.name}.png`);
      await captureScrolledScreenshot(page, out, cap.scrollY);
      console.log(`  ✓ ${cap.name}.png`);
    } catch (e) {
      console.warn(`  ✗ ${cap.name}: ${e.message}`);
    }
  }

  await ctx.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [roleKey, role] of Object.entries(ROLES)) {
      await captureRole(browser, roleKey, role);
    }
  } finally {
    await browser.close();
  }
  console.log("\n✅ All screenshots captured to public/guides/img/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
