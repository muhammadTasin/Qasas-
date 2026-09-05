/** Browser-supplied hints only; this is not a hardware fingerprint. */
export type DeviceHints = {
  model?: string;
  platform?: string;
  mobile?: boolean;
};

export function normalizeText(value: unknown, limit = 120): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/^"|"$/g, "").trim();
  return clean ? clean.slice(0, limit) : null;
}

export function normalizeModel(value: unknown): string | null {
  const model = normalizeText(value);
  // Chromium's reduced Android UA uses K as a placeholder, not a real model.
  return model && !/^(unknown|generic|k|macintosh|pc|wv)$/i.test(model) ? model : null;
}

export function deviceLabel(info: {
  deviceModel?: string | null;
  devicePlatform?: string | null;
  os?: string | null;
  deviceType?: string | null;
}) {
  if (normalizeModel(info.deviceModel)) return normalizeModel(info.deviceModel)!;
  const platform = info.devicePlatform || info.os || "";
  if (/windows/i.test(platform)) return "Windows-PC";
  if (/mac/i.test(platform)) return "macOS-Desktop";
  if (/ios/i.test(platform)) return info.deviceType === "tablet" ? "iPad" : "iPhone";
  if (/android/i.test(platform)) return info.deviceType === "tablet" ? "Android-Tablet" : "Android-Mobile";
  if (/linux/i.test(platform)) return "Linux-PC";
  return [platform, info.deviceType].filter(Boolean).join("-") || "Unknown-device";
}
