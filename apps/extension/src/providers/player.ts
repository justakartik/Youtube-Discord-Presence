import type { PlayerHints } from "@jpresence/shared";

/** Shorter media is a trailer, preview or ad rather than the thing being watched. */
export const MIN_FEATURE_SECONDS = 300;

const GENERIC_TITLES = new Set(["", "home", "browse", "watch", "loading", "loading...", "video", "player", "untitled"]);

export type PlayerReading = {
  /** Cleaned title if one could be found, otherwise undefined (caller falls back to "Watching <site>"). */
  title?: string;
  positionMs: number;
  durationMs: number;
  paused: boolean;
};

const clean = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

function acceptable(title: string, siteName: string): boolean {
  const t = title.toLowerCase();
  return !GENERIC_TITLES.has(t) && t !== siteName.toLowerCase() && title.length <= 200;
}

/** The main feature video: long enough, loaded, preferring one that is actually playing. */
export function pickPlayerVideo(doc: Document): HTMLVideoElement | null {
  const candidates = Array.from(doc.querySelectorAll("video")).filter(
    (v) => Number.isFinite(v.duration) && v.duration >= MIN_FEATURE_SECONDS && v.readyState >= 1,
  );
  candidates.sort((a, b) => Number(!b.paused) - Number(!a.paused) || b.duration - a.duration);
  return candidates[0] ?? null;
}

export function readTitle(doc: Document, hints: PlayerHints | undefined, siteName: string): string | undefined {
  // 1) Elements known to hold the title (site specific, best effort).
  for (const sel of hints?.titleSelectors ?? []) {
    try {
      const t = clean(doc.querySelector(sel)?.textContent);
      if (t && acceptable(t, siteName)) return t;
    } catch {
      /* invalid selector: skip */
    }
  }
  // 2) Media Session metadata, which many players publish for the OS media controls.
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession?.metadata : null;
  const mt = clean(ms?.title);
  if (mt && acceptable(mt, siteName)) return mt;
  // 3) The tab title with the site's branding removed.
  let dt = clean(doc.title).replace(/^\(\d+\)\s*/, "");
  for (const re of hints?.strip ?? []) dt = clean(dt.replace(re, ""));
  if (dt && acceptable(dt, siteName)) return dt;
  return undefined;
}

/** Read what a streaming-site player is doing, or null when no feature-length video is loaded. */
export function readPlayer(doc: Document, hints: PlayerHints | undefined, siteName: string): PlayerReading | null {
  const video = pickPlayerVideo(doc);
  if (!video) return null;
  const paused = video.paused || video.ended;
  return {
    title: readTitle(doc, hints, siteName),
    positionMs: Math.round(Math.max(0, video.currentTime) * 1000),
    durationMs: Math.round(video.duration * 1000),
    paused,
  };
}
