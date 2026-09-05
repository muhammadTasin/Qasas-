import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
const db = new PrismaClient({ datasources: { db: { url } } });

test("desktop and mobile presentation of the same database stories in both themes", async ({ page, browser }) => {
  const email = `visual-${randomUUID()}@example.invalid`;
  let userId = "";
  await mkdir("/tmp/qasas-ui-restore/final", { recursive: true });
  try {
    await page.goto("/signup");
    await page.getByPlaceholder("Name (optional)").fill("Local visual fixture");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("local-visual-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/signin$/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("local-visual-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    userId = (await db.user.findUniqueOrThrow({ where: { email } })).id;
    // Synthetic test-only stories. No live or Stitch story data is copied.
    const titles = ["A letter to the morning", "The places we carry", "বৃষ্টির পরের বিকেল", "Between the pages", "Notes from a quiet walk"];
    await db.story.createMany({ data: titles.map(title => ({ authorId: userId, title, content: "This is a local visual-test story. Its words test the rhythm, wrapping and spacing of a real database card. The same record appears in both Original Qasas and Journal.\n\nNo production story or design-reference content is used." })) });
    await page.goto("/write");
    await page.getByLabel("Story title", { exact: true }).fill("Where the afternoon settles");
    await page.getByLabel("Story content").fill("A local test of the reading surface. The light falls across an open page; outside, the afternoon grows quiet.\n\nএই লেখাটি কেবল স্থানীয় পরীক্ষার জন্য। বাংলা ও ইংরেজি লেখা একই গল্পের পাতায় দেখা যায়।");
    await page.getByRole("button", { name: "Publish Story" }).click();
    await expect(page).toHaveURL(/\/stories\/[^/]+$/);
    const storyPath = new URL(page.url()).pathname;
    const measurements: Record<string, unknown> = {};
    for (const theme of ["qasas", "journal"]) {
      await page.context().addCookies([{ name: "qasas-theme", value: theme, url: "http://localhost:3000" }]);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [name, path] of [["home", "/"], ["story", storyPath], ["me", "/me"], ["signin", "/signin"]]) {
          await page.goto(path);
          await page.evaluate(async () => { await document.fonts.ready; scrollTo({ top: 0, behavior: "instant" }); });
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: `/tmp/qasas-ui-restore/final/${theme}-${name}-${width}.png` });
          if (name === "home") {
            await expect(page.locator("article.story-card")).toHaveCount(6);
            measurements[`${theme}-${width}`] = await page.evaluate(() => {
              const selectors = ["nav", ".home-hero h1", ".home-hero p", "#feed", ".story-card", ".story-card h3", "footer > div"];
              return selectors.map(selector => {
                const el = [...document.querySelectorAll<HTMLElement>(selector)].find(e => e.getBoundingClientRect().width > 0)!;
                const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
                return { selector, width: rect.width, x: rect.x, y: rect.y, padding: style.padding, radius: style.borderRadius, font: style.fontFamily, size: style.fontSize, line: style.lineHeight, color: style.color };
              });
            });
            await page.locator("footer").scrollIntoViewIfNeeded();
            await page.screenshot({ path: `/tmp/qasas-ui-restore/final/${theme}-footer-${width}.png` });
          }
        }
      }
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(storyPath);
        await page.getByRole("button", { name: "Insights", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/qasas-ui-restore/final/${theme}-insights-${width}.png` });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    }
    await writeFile("/tmp/qasas-ui-restore/final/local-metrics.json", JSON.stringify(measurements, null, 2));
    // Leave the cache empty as well as deleting only this suite's own fixtures.
    await db.story.deleteMany({ where: { authorId: userId, id: { not: storyPath.split("/").at(-1) } } });
    await page.goto(storyPath); await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    const anonymous = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const guest = await anonymous.newPage(); await guest.goto("/");
    await expect(guest.getByText(/Unique Voices/i)).toHaveCount(0); await anonymous.close();
  } finally {
    if (userId) { await db.story.deleteMany({ where: { authorId: userId } }); await db.user.delete({ where: { id: userId } }); }
    await db.$disconnect();
  }
});
