import crypto from "node:crypto";
import { isIP } from "node:net";
import { UAParser } from "ua-parser-js";
import { browserBrand, deviceLabel, normalizePlatform, preferredModel, normalizeText, type DeviceHints } from "./device-info";
import { iso31662 } from "iso-3166";

export type GeoInfo = { country: string | null; region: string | null; city: string | null };
export type VisitorIdentity = { visitorId: string | null; ipHash: string | null };

export function analyticsSecret(): string {
  const salt = process.env.ANALYTICS_SALT;
  if (!salt || salt.length < 32) throw new Error("ANALYTICS_SALT must contain at least 32 characters; tracking is disabled.");
  return salt;
}

export function getVisitorIdFromHeaders(headers: Headers): string | null {
  const value = headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith("visitorId="))?.slice(10);
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(decoded) ? decoded : null;
  } catch { return null; }
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const candidate = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export function getGeoFromHeaders(headers: Headers): GeoInfo {
  const read = (key: string) => {
    const value = headers.get(key);
    if (!value) return null;
    try { return normalizeText(decodeURIComponent(value)); }
    catch { return normalizeText(value); }
  };
  return {
    country: read("x-vercel-ip-country"),
    region: read("x-vercel-ip-country-region"),
    city: read("x-vercel-ip-city"),
  };
}

export function getUaInfo(headers: Headers, hints: DeviceHints = {}) {
  const userAgent = normalizeText(headers.get("user-agent"), 1024);
  const parser = new UAParser(userAgent || "");
  const device = parser.getDevice();
  const devicePlatform = normalizePlatform(headers.get("sec-ch-ua-platform")) || normalizePlatform(hints.platform) || normalizePlatform(parser.getOS().name) || normalizePlatform(hints.legacyPlatform);
  const mobile = headers.get("sec-ch-ua-mobile") === "?1" || hints.mobile === true;
  const deviceType = device.type || (mobile ? "mobile" : userAgent || devicePlatform ? "desktop" : null);
  // Only keep a parser model when it is actually present in the request's UA.
  // Some parsers translate model codes into marketing names; do not invent one.
  const parsedModel = device.model && userAgent?.toLowerCase().includes(device.model.toLowerCase()) ? device.model : null;
  const androidModel = /android/i.test(devicePlatform || "")
    ? userAgent?.match(/Android [^;()]+;\s*(?:[a-z]{2}(?:[-_][a-z]{2})?;\s*)?([^;()]+?)(?:\s+Build\/[^)]*|\))/i)?.[1]
    : null;
  const deviceModel = preferredModel(headers.get("sec-ch-ua-model"), hints.model, parsedModel, androidModel);
  const brands = [...(headers.get("sec-ch-ua") || "").matchAll(/"([^"]+)"\s*;\s*v="[^"]+"/g)].map(match => match[1]);
  return { userAgent, deviceType, deviceModel, devicePlatform, os: normalizePlatform(parser.getOS().name) || devicePlatform,
    browser: browserBrand(brands) || normalizeText(hints.browser) || parser.getBrowser().name || null };
}

export function getArchitecture(headers: Headers, hints: DeviceHints = {}) {
  return normalizeText(headers.get("sec-ch-ua-arch")) || normalizeText(hints.architecture)
    || normalizeText(new UAParser(normalizeText(headers.get("user-agent"), 1024) || "").getCPU().architecture);
}

export function computeIpHash(ip: string, userAgent: string | null): string {
  // Preserve the existing salted fallback algorithm so old fallback rows still match.
  return crypto.createHash("sha256").update(`${analyticsSecret()}${ip}${userAgent || ""}`).digest("hex");
}

export function getVisitorIdentity(headers: Headers): VisitorIdentity {
  analyticsSecret();
  const visitorId = getVisitorIdFromHeaders(headers);
  if (visitorId) return { visitorId, ipHash: null };
  const ip = getClientIpFromHeaders(headers);
  return { visitorId: null, ipHash: ip ? computeIpHash(ip, headers.get("user-agent")) : null };
}

export function anonymousSuffix(identity: VisitorIdentity & { id?: string }): string {
  const internal = identity.visitorId ? `visitor:${identity.visitorId}` : identity.ipHash ? `ip:${identity.ipHash}` : `legacy:${identity.id}`;
  return crypto.createHmac("sha256", analyticsSecret()).update(internal).digest("hex").slice(0, 12).toUpperCase();
}

export function visitorLabel(info: VisitorIdentity & { id?: string; deviceModel?: string | null; devicePlatform?: string | null; os?: string | null; deviceType?: string | null }) {
  return `${deviceLabel(info).replaceAll(" ", "-")}_unique_${anonymousSuffix(info)}`;
}

const subdivisionNames = new Map(iso31662.map(region => [region.code, region.name]));

export function approximateLocation(geo: GeoInfo): string {
  let country = normalizeText(geo.country);
  let region = normalizeText(geo.region);
  const city = normalizeText(geo.city);
  if (country && region) {
    const code = region.toUpperCase().startsWith(`${country.toUpperCase()}-`) ? region.toUpperCase() : `${country.toUpperCase()}-${region.toUpperCase()}`;
    region = subdivisionNames.get(code) || (/^[A-Z0-9-]{1,6}$/i.test(region) ? `Region ${region}` : region);
  }
  if (country && /^[a-z]{2}$/i.test(country)) {
    country = new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) || country;
  }
  return [city, region, country].filter((value, index, values) => value && values.findIndex(candidate => candidate?.toLowerCase() === value.toLowerCase()) === index).join(", ") || "Location unavailable";
}
