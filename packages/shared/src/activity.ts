import type { ActivityPayload, MediaState, Settings } from "./types";
import { sourceSettings } from "./select";
import { youtubeThumbnail, youtubeVideoId } from "./artwork";

/** Build the Discord activity for the chosen media, or null if presence should be cleared. */
export function buildActivity(
  m: MediaState,
  settings: Settings,
  now = Date.now(),
): ActivityPayload | null {
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

/** Key used to suppress duplicate updates; timestamps are bucketed to tolerate jitter. */
export function activityKey(a: ActivityPayload | null, toleranceMs = 3000): string {
  if (!a) return "none";
  const start = a.startMs === undefined ? "-" : Math.round(a.startMs / toleranceMs);
  return JSON.stringify([
    a.source,
    a.type,
    a.details,
    a.state,
    a.largeImage,
    a.largeText,
    a.paused,
    start,
    a.endMs === undefined ? "-" : "e",
  ]);
}
