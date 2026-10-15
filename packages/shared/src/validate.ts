import type { HostRequest, HostResponse, MediaState, PlaybackState, Source } from "./types";

export const MAX_MESSAGE_BYTES = 64 * 1024;
const STATES: PlaybackState[] = ["playing", "paused", "buffering", "ended", "stopped"];
const ALLOWED_IMAGE_HOSTS = [/(^|\.)ytimg\.com$/, /(^|\.)googleusercontent\.com$/, /(^|\.)ggpht\.com$/];
const ALLOWED_PAGE_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "music.youtube.com",
  "m.youtube.com",
  "youtu.be",
];

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

const clean = (s: unknown, max: number): string | undefined => {
  if (typeof s !== "string") return undefined;
  const t = s.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
};

export function safeImageUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || u.length > 256) return undefined;
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return undefined;
    return ALLOWED_IMAGE_HOSTS.some((r) => r.test(url.hostname)) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function safePageUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || u.length > 512) return undefined;
  try {
    const url = new URL(u);
    if (url.protocol !== "https:" || !ALLOWED_PAGE_HOSTS.includes(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

const num = (n: unknown): number | undefined =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.floor(n) : undefined;

/** Epoch milliseconds (activity timestamps) need a larger bound than durations. */
const epoch = (n: unknown): number | undefined =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e14 ? Math.floor(n) : undefined;

/** Validate + normalize untrusted media metadata. Returns null if unusable. */
export function normalizeMedia(raw: unknown, now = Date.now()): MediaState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = r.source as Source;
  if (source !== "youtube" && source !== "youtube-music") return null;
  const title = clean(r.title, 128);
  if (!title) return null;
  const playbackState = STATES.includes(r.playbackState as PlaybackState)
    ? (r.playbackState as PlaybackState)
    : "stopped";
  let durationMs = num(r.durationMs);
  let positionMs = num(r.positionMs);
  const isLive = r.isLive === true;
  if (isLive || durationMs === 0) durationMs = undefined;
  if (durationMs !== undefined && positionMs !== undefined) {
    positionMs = Math.min(positionMs, durationMs);
  }
  return {
    source,
    title,
    creator: clean(r.creator, 128),
    album: clean(r.album, 128),
    mediaUrl: safePageUrl(r.mediaUrl),
    artworkUrl: safeImageUrl(r.artworkUrl),
    durationMs,
    positionMs,
    isLive,
    playbackState,
    updatedAt: num(r.updatedAt) ?? now,
  };
}

export function validateHostRequest(raw: unknown): HostRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  if (r.v !== 1) return null;
  switch (r.type) {
    case "ping":
      return { v: 1, type: "ping" };
    case "clearActivity":
      return { v: 1, type: "clearActivity" };
    case "hello":
      return { v: 1, type: "hello", extensionVersion: clean(r.extensionVersion, 32) ?? "unknown" };
    case "setActivity": {
      const a = r.activity;
      if (!a || typeof a !== "object") return null;
      if (a.source !== "youtube" && a.source !== "youtube-music") return null;
      if (a.type !== 2 && a.type !== 3) return null;
      const details = clean(a.details, 128);
      if (!details) return null;
      const startMs = epoch(a.startMs);
      const endMs = epoch(a.endMs);
      return {
        v: 1,
        type: "setActivity",
        activity: {
          source: a.source,
          type: a.type,
          details,
          state: clean(a.state, 128),
          largeImage: safeImageUrl(a.largeImage),
          largeText: clean(a.largeText, 128),
          paused: a.paused === true,
          startMs,
          endMs: endMs !== undefined && startMs !== undefined && endMs > startMs ? endMs : undefined,
          url: safePageUrl(a.url),
        },
      };
    }
    default:
      return null;
  }
}

export function validateHostResponse(raw: unknown): HostResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  if (r.v !== 1) return null;
  if (r.type === "pong") return { v: 1, type: "pong" };
  if (r.type === "hello") {
    return {
      v: 1,
      type: "hello",
      companionVersion: clean(r.companionVersion, 32) ?? "unknown",
      configured: r.configured === true,
    };
  }
  if (r.type === "status") {
    const d = r.discord;
    if (d !== "connected" && d !== "connecting" && d !== "disconnected") return null;
    return { v: 1, type: "status", discord: d, lastUpdate: num(r.lastUpdate), error: clean(r.error, 200) };
  }
  return null;
}
