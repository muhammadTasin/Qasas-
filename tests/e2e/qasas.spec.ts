import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.TEST_DATABASE_URL;
if (!dbUrl || !["localhost", "127.0.0.1"].includes(new URL(dbUrl).hostname) || new URL(dbUrl).pathname !== "/qasas_test") {
  throw new Error("E2E tests require TEST_DATABASE_URL pointing at a dedicated localhost qasas_test database.");
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const emails: string[] = [];
const storyContent = "  A browser test story created only in the isolated local test database.\nIt exists to verify editing and restoration preserve every original relationship.  ";
const androidUa = "Mozilla/5.0 (Linux; Android 13; RMX3834) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

async function signupAndLogin(page: Page) {
  const email = `e2e-${randomUUID()}@example.invalid`;
  emails.push(email);
  await page.goto("/signup");
  await page.getByPlaceholder("Name (optional)").fill("Browser test author");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("isolated-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("isolated-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  return email;
}
async function login(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("isolated-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}
async function publish(page: Page, title: string) {
  await page.goto("/write");
  await page.getByLabel("Story title", { exact: true }).fill(title);
  await page.getByLabel("Story content").fill(storyContent);
  await page.getByRole("button", { name: "Publish Story" }).click();
  await expect(page).toHaveURL(/\/stories\/[^/]+$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}
async function viewStory(context: BrowserContext, storyId: string) {
  const page = await context.newPage();
  const tracked = page.waitForResponse(response => response.url().endsWith(`/stories/${storyId}/view`));
  await page.goto(`/stories/${storyId}`);
  expect((await tracked).status()).toBe(204);
  return page;
}

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.story.deleteMany({ where: { authorId: { in: users.map(user => user.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
});

for (const theme of ["qasas", "journal"] as const) {
test(`${theme}: privacy, create/edit authorization, soft delete and persistent Restore`, async ({ page, browser }) => {
  await page.context().addCookies([{ name: "qasas-theme", value: theme, url: "http://localhost:3000" }]);
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Qasas.", exact: true })).toBeVisible();
  await expect(page.getByText(/Unique Voices/i)).toHaveCount(0);
  expect((await page.request.get("/api/site/stats")).status()).toBe(401);
  const cookie = (await page.context().cookies()).find(value => value.name === "visitorId")!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.secure).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(360 * 86400);

  const ownerEmail = await signupAndLogin(page);
  expect((await page.context().cookies()).find(value => value.name === "visitorId")?.value).toBe(cookie.value);
  await expect(page.getByText(/Unique Voices/i)).toBeVisible();
  expect((await page.request.get("/api/site/stats")).status()).toBe(200);

  const title = `Browser fixture ${randomUUID()}`;
  await page.goto("/write");
  await page.getByLabel("Story title", { exact: true }).fill(title);
  await page.getByLabel("Story content").fill(storyContent);
  let createRequests = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/write", async route => {
    if (route.request().method() === "POST") { createRequests++; await gate; }
    await route.continue();
  });
  await page.locator("main form").evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect(page.getByRole("button", { name: "Publishing..." })).toBeDisabled();
  release();
  await expect(page).toHaveURL(/\/stories\/[^/]+$/);
  await page.unroute("**/write");
  expect(createRequests).toBe(1);
  const storyId = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  expect(await prisma.story.count({ where: { title } })).toBe(1);

  await page.getByPlaceholder("Write a reflection...").fill("Browser comment fixture");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("Browser comment fixture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Love ·/ }).click();
  await expect(page.getByRole("button", { name: "Love · 1" })).toBeVisible();

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.locator('[name="title"]')).toHaveValue(title);
  await expect(page.locator('[name="content"]')).toHaveValue(storyContent);
  await page.locator('[name="title"]').fill(`${title} edited`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${storyId}$`));
  await expect(page.getByRole("heading", { name: `${title} edited` })).toBeVisible();
  await page.getByRole("link", { name: "Qasas", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${title} edited` })).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `/tmp/qasas-ui-restore/${theme}-home.png` });
  await expect(page.getByRole("heading", { name: `${title} edited` })).toBeVisible();

  const android = await browser.newContext({ userAgent: androidUa, extraHTTPHeaders: { "x-vercel-ip-city": "Test%20City", "x-vercel-ip-country": "BD" } });
  await android.addInitScript(() => Object.defineProperty(navigator, "userAgentData", { value: { platform: "Android", mobile: true, getHighEntropyValues: async () => ({ model: "RMX3834", platform: "Android" }) } }));
  const guest = await viewStory(android, storyId);
  const guestCookie = (await android.cookies()).find(value => value.name === "visitorId")!;
  const initial = await prisma.storyView.findUniqueOrThrow({ where: { storyId_visitorId: { storyId, visitorId: guestCookie.value } } });
  for (let i = 0; i < 5; i++) await guest.reload({ waitUntil: "networkidle" });
  expect(await prisma.storyView.count({ where: { storyId, visitorId: guestCookie.value } })).toBe(1);
  expect((await prisma.storyView.findUniqueOrThrow({ where: { id: initial.id } })).lastSeenAt.getTime()).toBeGreaterThan(initial.lastSeenAt.getTime());
  expect((await android.request.get(`/api/stories/${storyId}/insights`)).status()).toBe(401);
  expect((await android.request.get("/api/site/stats")).status()).toBe(401);
  await expect(guest.getByRole("button", { name: "Insights", exact: true })).toHaveCount(0);

  let insights = await (await page.request.get(`/api/stories/${storyId}/insights`)).json();
  const firstLabel = insights.viewers.find((view: { deviceModel: string }) => view.deviceModel === "RMX3834").visitorLabel;
  expect(firstLabel).toMatch(/^RMX3834_unique_[A-F0-9]{12}$/);
  expect(insights.viewers.find((view: { visitorLabel: string }) => view.visitorLabel === firstLabel).approximateLocation).toBe("Test City, Bangladesh");
  for (const view of insights.viewers) for (const field of ["id", "visitorId", "ipHash", "userAgent", "email", "authUserId"]) expect(view).not.toHaveProperty(field);

  const secondAndroid = await browser.newContext({ userAgent: androidUa });
  await viewStory(secondAndroid, storyId);
  insights = await (await page.request.get(`/api/stories/${storyId}/insights`)).json();
  const labels = insights.viewers.filter((view: { deviceModel: string }) => view.deviceModel === "RMX3834").map((view: { visitorLabel: string }) => view.visitorLabel);
  expect(new Set(labels).size).toBe(2);

  const strangerEmail = await signupAndLogin(guest);
  await guest.goto(`/stories/${storyId}`);
  await expect.poll(async () => (await prisma.storyView.findUniqueOrThrow({ where: { id: initial.id } })).isAuthenticated).toBe(true);
  expect((await android.cookies()).find(value => value.name === "visitorId")?.value).toBe(guestCookie.value);
  expect(await prisma.storyView.count({ where: { storyId, visitorId: guestCookie.value } })).toBe(1);
  const denied = await android.request.get(`/api/stories/${storyId}/insights`);
  expect(denied.status()).toBe(404);
  await guest.goto(`/stories/${storyId}/edit`);
  await expect(guest.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  const ownStoryId = await publish(guest, "Stranger fixture");
  await guest.goto(`/stories/${ownStoryId}/edit`);
  await guest.locator('[name="storyId"]').evaluate((input, id) => { (input as HTMLInputElement).value = id; }, storyId);
  await guest.getByRole("button", { name: "Save changes" }).click();
  await expect(guest.locator("form").getByRole("alert")).toContainText("belongs to you");

  // Injecting another owner's ID into an otherwise valid form must fail server-side.
  await guest.goto("/me");
  await guest.locator('form input[name="storyId"]').evaluate((input, id) => { (input as HTMLInputElement).value = id; }, storyId);
  await guest.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(guest.locator("form").getByRole("alert")).toContainText("belongs to you");
  await guest.goto("/me");
  await guest.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(guest).toHaveURL("http://localhost:3000/");

  await page.goto(`/stories/${storyId}/insights`);
  await expect(page.getByText(firstLabel, { exact: true })).toBeVisible();
  await page.screenshot({ path: `/tmp/qasas-ui-restore/${theme}-insights.png`, fullPage: true });
  await page.goto(`/stories/${storyId}`);
  await page.screenshot({ path: `/tmp/qasas-ui-restore/${theme}-story.png`, fullPage: true });
  const original = await prisma.story.findUniqueOrThrow({ where: { id: storyId }, include: { comments: true, reactions: true } });
  const viewIds = (await prisma.storyView.findMany({ where: { storyId }, select: { id: true } })).map(view => view.id).sort();
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: `${title} edited` })).toHaveCount(0);
  const deleted = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
  expect(deleted.deletedAt).not.toBeNull();
  const publicRequest = await browser.newContext();
  expect((await publicRequest.request.get(`/stories/${storyId}`)).status()).toBe(404);
  expect((await publicRequest.request.post(`/api/stories/${storyId}/view`, { data: {} })).status()).toBe(404);
  expect((await publicRequest.request.post(`/api/stories/${storyId}/readtime`, { data: { seconds: 15 } })).status()).toBe(404);
  expect((await page.request.get(`/api/stories/${storyId}/insights`)).status()).toBe(404);

  await guest.goto("/me?trash=1");
  await guest.locator('form input[name="storyId"]').evaluate((input, id) => { (input as HTMLInputElement).value = id; }, storyId);
  await guest.getByRole("button", { name: "Restore" }).click();
  await expect(guest.locator("form").getByRole("alert")).toContainText("your Trash");
  expect((await prisma.story.findUniqueOrThrow({ where: { id: storyId } })).deletedAt).not.toBeNull();

  await page.goto("/me?trash=1");
  await page.reload();
  await expect(page.getByRole("heading", { name: `${title} edited` })).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByText(/Unique Voices/i)).toHaveCount(0);
  await login(page, ownerEmail);
  await page.goto("/me?trash=1");
  await page.screenshot({ path: `/tmp/qasas-ui-restore/${theme}-trash.png`, fullPage: true });
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page).toHaveURL("http://localhost:3000/me");
  await expect(page.getByRole("heading", { name: `${title} edited` })).toBeVisible();
  await page.screenshot({ path: `/tmp/qasas-ui-restore/${theme}-me.png`, fullPage: true });
  await page.getByRole("link", { name: "View", exact: true }).click();
  await expect(page.getByText("Browser comment fixture", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Love · 1" })).toBeVisible();
  const restored = await prisma.story.findUniqueOrThrow({ where: { id: storyId }, include: { comments: true, reactions: true } });
  expect(restored.id).toBe(original.id);
  expect(restored.content).toBe(original.content);
  expect(restored.createdAt).toEqual(original.createdAt);
  expect(restored.comments).toEqual(original.comments);
  expect(restored.reactions).toEqual(original.reactions);
  expect((await prisma.storyView.findMany({ where: { storyId }, select: { id: true } })).map(view => view.id).sort()).toEqual(viewIds);

  // Analytics transport failure must leave the actual reading and editing UI usable.
  await page.route("**/api/site/**", route => route.abort());
  await page.route("**/api/stories/**", route => route.abort());
  await page.goto(`/stories/${storyId}`);
  await expect(page.getByRole("heading", { name: `${title} edited` })).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${storyId}$`));
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(page).toHaveURL("http://localhost:3000/");
  expect(browserErrors).toEqual([]);
  expect(strangerEmail).not.toBe(ownerEmail);
  await Promise.all([android.close(), secondAndroid.close(), publicRequest.close()]);
});

}

test("mobile browser: existing homepage styling remains usable without private totals", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Qasas.", exact: true })).toBeVisible();
  await expect(page.getByText(/Unique Voices/i)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/qasas-verify/home-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await context.close();
});

test("themes persist before hydration and preserve original Light geometry and sign-in", async ({ browser }) => {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "qasas");
    await expect(page.getByRole("heading", { name: "Qasas.", exact: true })).toBeVisible();
    const originalNav = await page.getByRole("navigation", { name: width < 640 ? "Mobile navigation" : "Main navigation" }).boundingBox();
    expect(originalNav).not.toBeNull();
    const toggle = page.getByRole("button", { name: "Switch between Original Qasas and Journal theme" }).filter({ visible: true });
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "journal");
    expect(await page.evaluate(() => localStorage.getItem("qasas-theme"))).toBe("journal");
    const html = await (await page.request.get("/")).text();
    expect(html).toContain('data-theme="journal"');
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "journal");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/qasas-ui-restore/journal-home-${width}.png`, fullPage: true });
    await page.goto("/signin");
    await page.screenshot({ path: `/tmp/qasas-ui-restore/journal-signin-${width}.png`, fullPage: true });
    await expect(page.getByRole("link", { name: /forgot password/i })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
    }
    await page.goto("/"); await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "qasas");
    const restoredNav = await page.getByRole("navigation", { name: width < 640 ? "Mobile navigation" : "Main navigation" }).boundingBox();
    expect(restoredNav).toEqual(originalNav);
    await page.screenshot({ path: `/tmp/qasas-ui-restore/qasas-home-${width}.png`, fullPage: true });
    await page.goto("/signin");
    await page.screenshot({ path: `/tmp/qasas-ui-restore/qasas-signin-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.close();
  }
  // A cookie preference is already present in HTML with JavaScript disabled.
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.addCookies([{ name: "qasas-theme", value: "journal", url: "http://localhost:3000" }]);
  const page = await context.newPage(); await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "journal");
  await context.close();
});

test("removed password-reset routes return 404 and sign-in has no reset prompts", async ({ page }) => {
  for (const path of ["/forgot-password", "/reset-password"]) {
    expect((await page.request.get(path)).status()).toBe(404);
    expect((await page.request.post(path, { form: { email: "missing@example.invalid", password: "unused-password" } })).status()).toBe(404);
  }
  await page.goto("/signin?reset=success&error=OAuthSignin");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Please try again");
  await expect(page.getByText(/reset|forgot password/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /create one/i })).toBeVisible();
});

test("Google callback sessions keep existing stories and owner controls in both themes", async ({ page, browser }) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const providers = await (await page.request.get("/api/auth/providers")).json();
    expect(providers.google.id).toBe("google");
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
  }
  const email = await signupAndLogin(page);
  const storyId = await publish(page, "Owned before Google sign-in");
  const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
  const before = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
  process.env.DATABASE_URL = dbUrl;
  process.env.DIRECT_URL = dbUrl;
  const { authOptions } = await import("../../src/lib/auth");
  const { encode } = await import("next-auth/jwt");
  const subject = randomUUID();
  const user = { id: subject, email, name: "Google display name" };
  const account = { provider: "google", providerAccountId: subject, type: "oauth" as const };
  const profile = { sub: subject, email, name: user.name, email_verified: true };
  // Feed a synthetic verified Google result through the real callbacks, then
  // exercise its signed session against the running app. No external OAuth call.
  expect(await authOptions.callbacks!.signIn!({ user, account, profile })).toBe(true);
  const token = await authOptions.callbacks!.jwt!({ token: {}, user, account, profile, trigger: "signIn" });
  expect(token.sub).toBe(owner.id);
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Browser verification requires the local server's NEXTAUTH_SECRET.");
  const sessionToken = await encode({ token, secret });
  const context = await browser.newContext();
  try {
    await context.addCookies([{ name: "next-auth.session-token", value: sessionToken, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
    const googlePage = await context.newPage();
    expect((await (await googlePage.request.get("/api/auth/session")).json()).user.id).toBe(owner.id);
    for (const theme of ["qasas", "journal"]) {
      await context.addCookies([{ name: "qasas-theme", value: theme, url: "http://localhost:3000" }]);
      await googlePage.goto("/me");
      await expect(googlePage.getByRole("heading", { name: "Owned before Google sign-in", exact: true })).toBeVisible();
      await expect(googlePage.getByRole("link", { name: "View", exact: true })).toHaveAttribute("href", `/stories/${storyId}`);
      await googlePage.goto(`/stories/${storyId}`);
      await expect(googlePage.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
      await expect(googlePage.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
      expect((await googlePage.request.get(`/api/stories/${storyId}/insights`)).status()).toBe(200);
    }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).toEqual(owner);
    expect(await prisma.story.findUniqueOrThrow({ where: { id: storyId } })).toMatchObject({ id: before.id, authorId: before.authorId, title: before.title, content: before.content, createdAt: before.createdAt });
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    await googlePage.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(googlePage).toHaveURL("http://localhost:3000/");
  } finally { await context.close(); }
});
