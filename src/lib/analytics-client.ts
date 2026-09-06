import { browserBrand, type DeviceHints } from "./device-info";

type HintNavigator = Navigator & { userAgentData?: { mobile?: boolean; platform?: string; brands?: { brand: string; version: string }[]; getHighEntropyValues?: (hints: string[]) => Promise<DeviceHints> } };
let hintPromise: Promise<DeviceHints> | undefined;
let availableHints: DeviceHints = {};

export function getAvailableClientHints(): DeviceHints { return availableHints; }

export function getClientHints(): Promise<DeviceHints> {
  if (hintPromise) return hintPromise.then(() => availableHints);
  hintPromise ??= new Promise(resolve => {
    const data = (navigator as HintNavigator).userAgentData;
    const basic = { platform: data?.platform, mobile: data?.mobile, legacyPlatform: navigator.platform, browser: browserBrand(data?.brands?.map(value => value.brand) || []) || undefined };
    availableHints = basic;
    if (!data?.getHighEntropyValues) { resolve(basic); return; }
    // Some browsers deny or never resolve entropy requests. Tracking must proceed.
    const timer = window.setTimeout(() => resolve(basic), 200);
    Promise.resolve().then(() => data.getHighEntropyValues!(["model", "platform", "architecture"]))
      .then(hints => {
        // Retain late entropy for the next existing read-time batch as well.
        availableHints = { ...basic, platform: hints.platform || basic.platform, model: hints.model, architecture: hints.architecture };
        resolve(availableHints);
      }, () => resolve(basic))
      .finally(() => window.clearTimeout(timer));
  });
  return hintPromise;
}

const sent = new Map<string, number>();
export function recentlyTracked(key: string) {
  const now = Date.now();
  const previous = sent.get(key);
  if (previous && now - previous < 3000) return true;
  if (sent.size > 100) sent.clear();
  sent.set(key, now);
  return false;
}

export function sendAnalytics(url: string, body: object, beacon = false) {
  const json = JSON.stringify(body);
  if (beacon && navigator.sendBeacon?.(url, new Blob([json], { type: "application/json" }))) return;
  void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => {});
}
