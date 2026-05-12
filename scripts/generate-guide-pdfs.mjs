/**
 * Generate 1-page A4 PDFs from the guide preview pages.
 *
 * Hits http://localhost:3000/guides/<role>/preview, prints to PDF, saves to
 * public/guides/<role>.pdf — so visiting /guides/student.pdf serves the latest.
 *
 * Run while `npm run dev` is up (after capture-guide-screenshots.mjs).
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "guides");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:3000";
const ROLES = ["student", "employer", "project_staff", "rmutl_staff", "teacher"];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (const role of ROLES) {
    const url = `${BASE}/guides/${role}/preview`;
    console.log(`→ ${role}: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for fonts + QR images to load
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);

    // Strip global chrome (navbar, mobile tab bar, print-only button) before PDF
    await page.addStyleTag({
      content: `
        body > nav, body > section, body > div.no-print { display: none !important; }
        body > div.md\\:hidden, body > div[class*="md:hidden"] { display: none !important; }
        body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
        .guide-root { box-shadow: none !important; }
      `,
    });
    // Also remove any element that was hidden but still in flow
    await page.evaluate(() => {
      const root = document.querySelector(".guide-root");
      if (!root) return;
      Array.from(document.body.children).forEach((el) => {
        if (el === root) return;
        if (el instanceof HTMLElement) el.style.display = "none";
      });
    });
    await page.waitForTimeout(300);

    const outPath = join(OUT_DIR, `${role}.pdf`);
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
    console.log(`  ✓ ${outPath}`);
  }

  await browser.close();
  console.log("\n✅ All PDFs generated in public/guides/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
