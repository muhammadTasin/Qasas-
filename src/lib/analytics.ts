import crypto from "node:crypto";
import { isIP } from "node:net";
import { UAParser } from "ua-parser-js";
import { deviceLabel, normalizeModel, normalizeText, type DeviceHints } from "./device-info";

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
  const devicePlatform = normalizeText(headers.get("sec-ch-ua-platform")) || normalizeText(hints.platform) || parser.getOS().name || null;
  const mobile = headers.get("sec-ch-ua-mobile") === "?1" || hints.mobile === true;
  const deviceType = device.type || (mobile ? "mobile" : userAgent || devicePlatform ? "desktop" : null);
  // Only keep a parser model when it is actually present in the request's UA.
  // Some parsers translate model codes into marketing names; do not invent one.
  const parsedModel = device.model && userAgent?.toLowerCase().includes(device.model.toLowerCase()) ? device.model : null;
  const androidModel = /android/i.test(devicePlatform || "")
    ? userAgent?.match(/Android [^;()]+;\s*(?:[a-z]{2}(?:[-_][a-z]{2})?;\s*)?([^;()]+?)(?:\s+Build\/[^)]*|\))/i)?.[1]
    : null;
  const deviceModel = normalizeModel(headers.get("sec-ch-ua-model")) || normalizeModel(hints.model) || normalizeModel(parsedModel) || normalizeModel(androidModel);
  return { userAgent, deviceType, deviceModel, devicePlatform, os: parser.getOS().name || devicePlatform, browser: parser.getBrowser().name || null };
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
  return `${deviceLabel(info)}_unique_${anonymousSuffix(info)}`;
}

export function approximateLocation(geo: GeoInfo): string {
  let country = geo.country;
  if (country && /^[a-z]{2}$/i.test(country)) {
    country = new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) || country;
  }
  return [...new Set([geo.city, geo.region, country].filter(Boolean))].join(", ") || "Location unavailable";
}
