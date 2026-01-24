import crypto from "crypto";
import { UAParser } from "ua-parser-js";

export type GeoInfo = {
  country: string | null;
  region: string | null;
  city: string | null;
};

export type UaInfo = {
  userAgent: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
};

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc00:/,
  /^fd00:/,
  /^fe80:/,
];

export function getVisitorIdFromHeaders(headers: Headers): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const parts = cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === "visitorId") {
      return decodeURIComponent(rest.join("=") || "");
    }
  }
  return null;
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const candidates = forwarded.split(",").map((ip) => ip.trim());
  for (const ip of candidates) {
    if (ip && !PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip))) {
      return ip;
    }
  }
  return candidates[0] || null;
}

export function getGeoFromHeaders(headers: Headers): GeoInfo {
  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: headers.get("x-vercel-ip-city"),
  };
}

export function getUaInfo(headers: Headers): UaInfo {
  const userAgent = headers.get("user-agent");
  if (!userAgent) {
    return { userAgent: null, deviceType: null, os: null, browser: null };
  }
  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || "desktop";
  const os = parser.getOS().name || null;
  const browser = parser.getBrowser().name || null;
  return { userAgent, deviceType, os, browser };
}

export function computeIpHash(ip: string, userAgent: string | null): string {
  const salt = process.env.ANALYTICS_SALT || "";
  const hash = crypto
    .createHash("sha256")
    .update(`${salt}${ip}${userAgent || ""}`)
    .digest("hex");
  return hash;
}

export function getVisitorIdentity(headers: Headers): {
  visitorId: string | null;
  ipHash: string | null;
} {
  const visitorId = getVisitorIdFromHeaders(headers);
  if (visitorId) return { visitorId, ipHash: null };

  const ip = getClientIpFromHeaders(headers);
  if (!ip) return { visitorId: null, ipHash: null };
  const userAgent = headers.get("user-agent");
  return { visitorId: null, ipHash: computeIpHash(ip, userAgent) };
}
