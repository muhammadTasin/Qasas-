import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { anonymousSuffix, approximateLocation, computeIpHash, getGeoFromHeaders, getUaInfo, getVisitorIdentity, visitorLabel } from "../src/lib/analytics";
import { deviceLabel } from "../src/lib/device-info";

// Deliberately synthetic fixtures: never used by application code or production.
process.env.ANALYTICS_SALT = "test-only-analytics-salt-with-at-least-32-characters";
const androidUa = "Mozilla/5.0 (Linux; Android 13; RMX3834 Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

test("real Android UA and client hints preserve runtime model codes", () => {
  const headers = new Headers({ "user-agent": androidUa });
  assert.equal(getUaInfo(headers).deviceModel, "RMX3834");
  assert.equal(getUaInfo(headers, { model: "SM-S918B" }).deviceModel, "SM-S918B");
  headers.set("sec-ch-ua-model", '"Pixel 8 Pro"');
  assert.equal(getUaInfo(headers, { model: "SM-S918B" }).deviceModel, "Pixel 8 Pro");
});

test("reduced Android UA never becomes the fake model K", () => {
  const info = getUaInfo(new Headers({ "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" }));
  assert.equal(info.deviceModel, null);
  assert.equal(deviceLabel(info), "Android device");
  const missingModel = getUaInfo(new Headers({ "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" }));
  assert.equal(missingModel.deviceModel, null);
});

test("iPhone and desktop use truthful generic fallbacks", () => {
  const iphone = getUaInfo(new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" }));
  assert.equal(deviceLabel(iphone), "iPhone");
  assert.equal(deviceLabel(getUaInfo(new Headers({ "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }))), "Windows PC");
  assert.equal(deviceLabel(getUaInfo(new Headers({ "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }))), "Mac");
  assert.equal(deviceLabel({ os: "Linux", deviceType: "desktop" }), "Linux PC");
  assert.equal(deviceLabel({ os: "Android", deviceType: "tablet" }), "Android device");
  assert.equal(deviceLabel({}), "Unknown device");
});

test("cookie identity and private HMAC label remain stable through login", () => {
  const first = randomUUID();
  const second = randomUUID();
  const headers = new Headers({ cookie: `visitorId=${first}`, "user-agent": androidUa });
  const guest = getVisitorIdentity(headers);
  headers.append("cookie", "; next-auth.session-token=synthetic-test-token");
  assert.deepEqual(getVisitorIdentity(headers), guest);
  const label = visitorLabel({ ...guest, ...getUaInfo(headers) });
  assert.match(label, /^RMX3834_unique_[A-F0-9]{12}$/);
  assert.equal(label.includes(first), false);
  assert.equal(anonymousSuffix(guest), anonymousSuffix(getVisitorIdentity(headers)));
  assert.notEqual(anonymousSuffix(guest), anonymousSuffix({ visitorId: second, ipHash: null }));
});

test("malformed cookies do not throw; fallback IP is salted and never raw", () => {
  const identity = getVisitorIdentity(new Headers({ cookie: "visitorId=%GG", "x-forwarded-for": "203.0.113.10" }));
  assert.equal(identity.visitorId, null);
  assert.match(identity.ipHash!, /^[a-f0-9]{64}$/);
  assert.equal(identity.ipHash, computeIpHash("203.0.113.10", null));
});

test("approximate network location decodes headers and never fills missing cities", () => {
  const geo = getGeoFromHeaders(new Headers({ "x-vercel-ip-city": "Test%20City", "x-vercel-ip-country-region": "Test Region", "x-vercel-ip-country": "BD" }));
  assert.equal(approximateLocation(geo), "Test City, Test Region, Bangladesh");
  assert.equal(approximateLocation({ city: null, region: "Test Region", country: "BD" }), "Test Region, Bangladesh");
  assert.equal(approximateLocation({ city: null, region: null, country: "BD" }), "Bangladesh");
  assert.equal(approximateLocation({ city: null, region: null, country: null }), "Location unavailable");
});

test("legacy rows produce private labels without exposing database or IP hashes", () => {
  const info = { id: "fixture-legacy-row", visitorId: null, ipHash: null, os: "Windows", deviceType: "desktop" };
  assert.match(visitorLabel(info), /^Windows-PC_unique_[A-F0-9]{12}$/);
  assert.equal(visitorLabel(info).includes(info.id), false);
});

test("analytics refuses to silently use an empty or short salt", () => {
  const previous = process.env.ANALYTICS_SALT;
  delete process.env.ANALYTICS_SALT;
  assert.throws(() => getVisitorIdentity(new Headers()), /ANALYTICS_SALT/);
  process.env.ANALYTICS_SALT = "short";
  assert.throws(() => anonymousSuffix({ visitorId: randomUUID(), ipHash: null }), /ANALYTICS_SALT/);
  process.env.ANALYTICS_SALT = previous;
});

test("explicit browser models beat families without a hardware lookup", async () => {
  const { preferredModel } = await import("../src/lib/device-info");
  for (const model of ["RMX3834", "SM-A546E", "Samsung Galaxy S23", "Pixel 8 Pro", "iPhone 15 Pro", "Acer Predator PHN16-71", "Dell XPS 15 9530", "MacBook"]) {
    const info = getUaInfo(new Headers({ "sec-ch-ua-model": `"${model}"`, "sec-ch-ua-platform": '"Linux"' }));
    assert.equal(deviceLabel(info), model);
  }
  assert.equal(preferredModel("iPhone", "iPhone 15 Pro"), "iPhone 15 Pro");
  assert.equal(preferredModel("K", "Unknown", "RMX3834"), "RMX3834");
  assert.equal(deviceLabel({ devicePlatform: "ChromeOS" }), "ChromeOS device");
});

test("OS, browser and architecture use exposed hints without inferring hardware", async () => {
  const { getArchitecture } = await import("../src/lib/analytics");
  const headers = new Headers({ "sec-ch-ua": '"Not A Brand";v="99", "Chromium";v="130", "Microsoft Edge";v="130"', "sec-ch-ua-platform": '"Windows"', "sec-ch-ua-arch": '"x86"' });
  const info = getUaInfo(headers);
  assert.equal(info.browser, "Edge"); assert.equal(info.os, "Windows"); assert.equal(info.deviceModel, null);
  assert.equal(getArchitecture(headers), "x86"); assert.equal(deviceLabel(info), "Windows PC");
  assert.equal(getArchitecture(new Headers(), { architecture: "arm" }), "arm");
  assert.equal(getArchitecture(new Headers()), null);
});

test("ISO subdivision names improve network location without guessing city or precision", () => {
  assert.equal(approximateLocation({ city: "Kushtia", region: "D", country: "BD" }), "Kushtia, Khulna, Bangladesh");
  assert.equal(approximateLocation({ city: "Dhaka", region: "C", country: "BD" }), "Dhaka, Bangladesh");
  assert.equal(approximateLocation({ city: "Chattogram", region: null, country: "BD" }), "Chattogram, Bangladesh");
  assert.equal(approximateLocation({ city: null, region: "ZZ", country: "BD" }), "Region ZZ, Bangladesh");
});

test("Insights read time retains short reads and formats hours", async () => {
  const { formatInsightReadTime } = await import("../src/lib/format");
  for (const [seconds, expected] of [[0, "0 sec"], [18, "18 sec"], [59, "59 sec"], [60, "1 min"], [300, "5 min"], [3600, "1 hr"], [4320, "1 hr 12 min"]] as const) assert.equal(formatInsightReadTime(seconds), expected);
});
