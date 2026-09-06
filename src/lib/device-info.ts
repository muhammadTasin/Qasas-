/** Browser-supplied hints only; this is not a hardware fingerprint. */
export type DeviceHints = {
  model?: string;
  platform?: string;
  mobile?: boolean;
  architecture?: string;
  browser?: string;
  legacyPlatform?: string;
};

export function normalizeText(value: unknown, limit = 120): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/^"|"$/g, "").trim();
  return clean ? clean.slice(0, limit) : null;
}

// Prefer directly exposed models/codes over families and placeholders. This is
// a specificity check, not a model lookup or a way to infer hardware.
export function preferredModel(...values: unknown[]): string | null {
  let best: string | null = null;
  let rank = 0;
  for (const value of values) {
    const model = normalizeModel(value);
    if (!model) continue;
    const specificity = /^(iphone|ipad|mac|android(?: device| mobile| tablet)?|windows pc|linux pc|chromeos device)$/i.test(model) ? 1 : 2;
    if (specificity > rank) { best = model; rank = specificity; }
  }
  return best;
}

export function normalizeModel(value: unknown): string | null {
  const model = normalizeText(value);
  // Chromium's reduced Android UA uses K as a placeholder, not a real model.
  return model && !/^(unknown(?:[ _-](?:device|model))?|generic(?:[ _-]device)?|n\/a|k|macintosh|pc|wv)$/i.test(model) ? model : null;
}

export function normalizePlatform(value: unknown): string | null {
  const platform = normalizeText(value);
  if (!platform) return null;
  if (/android/i.test(platform)) return "Android";
  if (/ios|iphone|ipad/i.test(platform)) return "iOS";
  if (/chrome|chromium|cros/i.test(platform)) return "ChromeOS";
  if (/windows|win32|win64/i.test(platform)) return "Windows";
  if (/mac/i.test(platform)) return "macOS";
  if (/linux/i.test(platform)) return "Linux";
  return platform;
}

export function browserBrand(brands: string[]): string | null {
  const usable = brands.map(brand => normalizeText(brand)).filter((brand): brand is string => Boolean(brand) && !/^not[\s\W_]*a?[\s\W_]*brand$/i.test(brand!));
  for (const [pattern, name] of [[/edge/i, "Edge"], [/opera/i, "Opera"], [/chrome/i, "Chrome"], [/firefox/i, "Firefox"], [/safari/i, "Safari"]] as const) {
    if (usable.some(brand => pattern.test(brand))) return name;
  }
  return usable.find(brand => brand !== "Chromium") || (usable.includes("Chromium") ? "Chromium" : null);
}

export function deviceLabel(info: {
  deviceModel?: string | null;
  devicePlatform?: string | null;
  os?: string | null;
  deviceType?: string | null;
}) {
  if (normalizeModel(info.deviceModel)) return normalizeModel(info.deviceModel)!;
  const platform = info.devicePlatform || info.os || "";
  if (/windows/i.test(platform)) return "Windows PC";
  if (/mac/i.test(platform)) return "Mac";
  if (/ios/i.test(platform)) return info.deviceType === "tablet" ? "iPad" : "iPhone";
  if (/android/i.test(platform)) return "Android device";
  if (/chrome|chromium/i.test(platform)) return "ChromeOS device";
  if (/linux/i.test(platform)) return "Linux PC";
  return "Unknown device";
}
