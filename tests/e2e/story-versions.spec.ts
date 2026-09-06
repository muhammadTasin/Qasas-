import { test, expect, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/qasas_test") throw new Error("Dedicated localhost qasas_test database required.");
if (!process.env.NEXTAUTH_SECRET) throw new Error("Use the local server's test NEXTAUTH_SECRET.");
const db = new PrismaClient({ datasources: { db: { url } } });
const users: string[] = [];
const baseURL = "http://localhost:3000";
const originalContent = "Original story text.\nhttps://example.invalid/image.png\n<script>window.historyPreviewExecuted = true</script>";
async function author(context: BrowserContext) {
  const user = await db.user.create({ data: { email: `history-e2e-${randomUUID()}@example.invalid`, name: "History author" } });
  users.push(user.id);
  const token = await encode({ token: { sub: user.id }, secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
  return user;
}
test.afterAll(async () => {
  await db.story.deleteMany({ where: { authorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

for (const [theme, width] of [["qasas", 1280], ["qasas", 375], ["journal", 1280], ["journal", 375]] as const) {
test(`${theme} ${width}: publish, edit, preview and restore through the owner UI`, async ({ page, browser }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.context().addCookies([{ name: "qasas-theme", value: theme, url: baseURL }]);
  const user = await author(page.context());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const title = `Version history ${randomUUID()}`;
  await page.goto("/write");
  await page.getByLabel("Story title", { exact: true }).fill(title);
  await page.getByLabel("Story content").fill(originalContent);
  await page.getByRole("button", { name: "Publish Story" }).click();
  await expect(page).toHaveURL(/\/stories\/[^/]+$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  // Browser FormData serializes line endings as CRLF; compare restores with the
  // original persisted story bytes rather than the pre-submission textarea.
  const storedOriginal = (await db.story.findUniqueOrThrow({ where: { id } })).content;
  const editURL = `/stories/${id}/edit`;
  await page.goto(editURL);
  await page.getByLabel("Story title", { exact: true }).fill(`${title} revised`);
  await page.getByLabel("Story content").fill("Second version with revised story contents.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${id}$`));
  await page.goto(editURL);
  const unsaved = "Unsaved text stays in the editor while previewing.";
  await page.getByLabel("Story content").fill(unsaved);
  await page.getByRole("button", { name: "Version History", exact: true }).click();
  await expect(page.getByText("Version 2 · Current published", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View version 1", exact: true }).click();
  const preview = page.getByLabel("Version 1 preview", { exact: true });
  await expect(preview.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(preview).toContainText(originalContent);
  expect(await page.evaluate(() => "historyPreviewExecuted" in window)).toBe(false);
  await expect(page.getByLabel("Story content")).toHaveValue(unsaved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/qasas-version-history-${theme}-${width}.png`, fullPage: true });
  const list = await page.request.get(`/api/stories/${id}/versions`);
  expect(list.status()).toBe(200);
  expect(list.headers()["cache-control"]).toBe("private, no-store");
  expect(JSON.stringify(await list.json())).not.toContain(originalContent);
  const snapshot = await page.request.get(`/api/stories/${id}/versions/1`);
  expect(snapshot.headers()["cache-control"]).toBe("private, no-store");
  expect((await snapshot.json()).content).toBe(storedOriginal);
  const guest = await browser.newContext();
  try {
    for (const path of [`/api/stories/${id}/versions`, `/api/stories/${id}/versions/1`]) {
      const denied = await guest.request.get(path);
      expect(denied.status()).toBe(401);
      expect(denied.headers()["cache-control"]).toBe("private, no-store");
      expect(await denied.text()).not.toContain(title);
    }
    await author(guest);
    for (const path of [`/api/stories/${id}/versions`, `/api/stories/${id}/versions/1`]) expect((await guest.request.get(path)).status()).toBe(404);
    const otherPage = await guest.newPage();
    await otherPage.goto(editURL);
    await expect(otherPage.getByRole("button", { name: "Version History", exact: true })).toHaveCount(0);
  } finally { await guest.close(); }
  await preview.getByRole("button", { name: "Restore this version", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${id}$`));
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const restored = await db.story.findUniqueOrThrow({ where: { id } });
  expect(restored.currentVersion).toBe(3);
  expect(restored.content).toBe(storedOriginal);
  expect(restored.authorId).toBe(user.id);
  expect(await db.storyVersion.count({ where: { storyId: id } })).toBe(3);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${title} revised`, exact: true })).toHaveCount(0);
  await page.goto(editURL);
  await page.getByRole("button", { name: "Version History", exact: true }).click();
  await expect(page.getByText("Version 3 · Current published", { exact: true })).toBeVisible();
  await expect(page.getByText("Restored from version 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "View version 2", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
}

test("forged restore forms and stale editor submissions are rejected on the server", async ({ page, browser }) => {
  const owner = await author(page.context());
  const ownStory = await db.story.create({ data: { authorId: owner.id, title: "Owner story", content: originalContent,
    currentVersion: 2, versions: { create: [1, 2].map(version => ({ version, title: `Owner version ${version}`, content: originalContent })) } } });
  const other = await browser.newContext();
  try {
    const stranger = await author(other);
    const otherStory = await db.story.create({ data: { authorId: stranger.id, title: "Stranger story", content: originalContent } });
    await page.goto(`/stories/${ownStory.id}/edit`);
    await page.getByRole("button", { name: "Version History", exact: true }).click();
    await page.getByRole("button", { name: "View version 1", exact: true }).click();
    const preview = page.getByLabel("Version 1 preview", { exact: true });
    await preview.locator('[name="storyId"]').evaluate((node, id) => { (node as HTMLInputElement).value = id; }, otherStory.id);
    await preview.getByRole("button", { name: "Restore this version" }).click();
    await expect(preview.getByRole("alert")).toContainText("belongs to you");
    expect((await db.story.findUniqueOrThrow({ where: { id: otherStory.id } })).title).toBe("Stranger story");
    await page.goto(`/stories/${ownStory.id}/edit`);
    await db.story.update({ where: { id: ownStory.id }, data: { currentVersion: 3, title: "Newer work" } });
    await page.getByLabel("Story title", { exact: true }).fill("Stale tab attempt");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("changed in another tab");
    await expect(page.getByLabel("Story title", { exact: true })).toHaveValue("Stale tab attempt");
    expect((await db.story.findUniqueOrThrow({ where: { id: ownStory.id } })).title).toBe("Newer work");
  } finally { await other.close(); }
});

test("total views footer never fetches for guests, fails closed, and clears on logout", async ({ page }) => {
  let requests = 0;
  page.on("request", request => { if (request.url().endsWith("/api/site/stats")) requests++; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Qasas.", exact: true })).toBeVisible();
  await expect(page.locator("footer").getByText(/Total Views|Unique Voices/i)).toHaveCount(0);
  expect(requests).toBe(0);
  const denied = await page.request.get("/api/site/stats");
  expect(denied.status()).toBe(401);
  expect(denied.headers()["cache-control"]).toBe("private, no-store");
  expect(await denied.json()).toEqual({ error: "Unauthorized" });
  await author(page.context());
  const statsResponse = page.waitForResponse(response => response.url().endsWith("/api/site/stats"));
  await page.reload();
  const stats = await (await statsResponse).json();
  await expect(page.locator("footer").getByText(`${new Intl.NumberFormat("en-US").format(stats.totalVisits)} Total Views`, { exact: true })).toBeVisible();
  await expect(page.locator("footer").getByText(/Unique Voices/i)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 850 });
  await page.locator("footer").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/qasas-total-views-mobile.png" });
  await page.route("**/api/site/stats", route => route.fulfill({ status: 503, json: { error: "Statistics unavailable" } }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("footer").getByText(/Total Views|Unique Voices/i)).toHaveCount(0);
  await page.unroute("**/api/site/stats");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("footer").getByText(/Total Views/i)).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.locator("footer").getByText(/Total Views|Unique Voices/i)).toHaveCount(0);
  const afterLogout = requests;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Qasas.", exact: true })).toBeVisible();
  expect(requests).toBe(afterLogout);
  expect((await page.request.get("/api/site/stats")).status()).toBe(401);
});
