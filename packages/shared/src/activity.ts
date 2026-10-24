import type { ActivityPayload, MediaState, Settings } from "./types";
import { mediaEnabled, sourceSettings } from "./select";
import { youtubeThumbnail, youtubeVideoId } from "./artwork";

/** Build the Discord activity for the chosen media, or null if presence should be cleared. */
export function buildActivity(
  m: MediaState,
  settings: Settings,
  now = Date.now(),
): ActivityPayload | null {
  if (m.source === "web") return buildWebActivity(m, settings, now);
  const s = sourceSettings(settings, m);
  if (!settings.enabled || !s.enabled) return null;
  if (m.playbackState === "stopped" || m.playbackState === "ended") return null;
  const paused = m.playbackState === "paused";
  if (paused && s.pauseBehavior === "clear") return null;

  const isMusic = m.source === "youtube-music";
  const details = s.showTitle ? m.title : isMusic ? "Listening to music" : "Watching a video";
  let state =
    s.showCreator && m.creator ? m.creator : isMusic ? "on YouTube Music" : "on YouTube";
  if (m.isLive) state += " • LIVE";
  if (paused) state = `Paused • ${state}`;

  let image = s.showArtwork ? m.artworkUrl : undefined;
  if (s.showArtwork && !image && !isMusic) {
    const id = youtubeVideoId(m.mediaUrl);
    if (id) image = youtubeThumbnail(id);
  }

  const a: ActivityPayload = {
    source: m.source,
    type: isMusic ? 2 : 3,
    details,
    state,
    largeImage: image,
    largeText: isMusic ? (m.album ?? "YouTube Music") : "YouTube",
    url: m.mediaUrl,
    paused,
  };
  // pauseBehavior "keep" keeps the last text but drops the moving timer, same as show-paused.
  if (!paused && s.showProgress && m.positionMs !== undefined) {
    const pos = m.positionMs + Math.max(0, now - m.updatedAt);
    a.startMs = now - pos;
    if (!m.isLive && m.durationMs !== undefined) a.endMs = a.startMs + m.durationMs;
  }
  return a;
}

/** Privacy-safe activity for a website: fixed label, site name, favicon, optional elapsed timer. No URL, no title. */
function buildWebActivity(m: MediaState, settings: Settings, now: number): ActivityPayload | null {
  if (!mediaEnabled(settings, m) || !m.siteName) return null;
  const watching = m.watching === true;
  const paused = watching && m.playbackState === "paused";
  if (m.playbackState !== "playing" && !paused) return null;
  const a: ActivityPayload = {
    source: "web",
    type: m.activityType ?? 0,
    name: m.siteName,
    // Streaming players get the same play/pause badge as YouTube; plain browsing has none.
    noBadge: !watching,
    paused: paused || undefined,
    details: m.title,
    state: paused ? "Paused" : undefined,
    largeImage: settings.web.showIcon ? m.artworkUrl : undefined,
    largeText: m.siteName,
  };
  if (paused || m.positionMs === undefined) return a;
  const pos = m.positionMs + Math.max(0, now - m.updatedAt);
  if (watching) {
    // Progress bar like YouTube (needs a known duration).
    if (settings.web.showProgress) {
      a.startMs = now - pos;
      if (m.durationMs !== undefined) a.endMs = a.startMs + m.durationMs;
    }
  } else if (settings.web.showElapsed) {
    a.startMs = now - pos;
  }
  return a;
}

/** Key used to suppress duplicate updates; timestamps are bucketed to tolerate jitter. */
export function activityKey(a: ActivityPayload | null, toleranceMs = 3000): string {
  if (!a) return "none";
  const start = a.startMs === undefined ? "-" : Math.round(a.startMs / toleranceMs);
  return JSON.stringify([
    a.source,
    a.type,
    a.name,
    a.details,
    a.state,
    a.largeImage,
    a.largeText,
    a.paused,
    start,
    a.endMs === undefined ? "-" : "e",
  ]);
}
