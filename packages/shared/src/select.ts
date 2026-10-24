import type { MediaState, Settings, SourceSettings } from "./types";
import { webSiteEnabled } from "./settings";

export type TabMedia = { tabId: number; media: MediaState; lastActiveAt?: number };

const WEB_SOURCE_SETTINGS: SourceSettings = {
  enabled: true,
  showTitle: true,
  showCreator: true,
  showArtwork: true,
  showProgress: true,
  pauseBehavior: "clear",
};

export const sourceSettings = (s: Settings, m: MediaState): SourceSettings =>
  m.source === "youtube" ? s.youtube : m.source === "youtube-music" ? s.youtubeMusic : WEB_SOURCE_SETTINGS;

/** Whether presence is allowed at all for this media (global switch, source switch, per-site switch). */
export function mediaEnabled(s: Settings, m: MediaState): boolean {
  if (!s.enabled) return false;
  if (m.source === "web") return webSiteEnabled(s, m.siteId);
  return sourceSettings(s, m).enabled;
}

/** Media that is really playing beats plain browsing, which beats paused media. */
const rank = (m: MediaState) => {
  if (m.source === "web") return m.playbackState === "playing" ? 2.5 : m.watching && m.playbackState === "paused" ? 1 : 0;
  return m.playbackState === "playing"
    ? 3
    : m.playbackState === "buffering"
      ? 2
      : m.playbackState === "paused"
        ? 1
        : 0;
};

/** Deterministic choice: rank; site priority; recency; lowest tab id. */
export function selectActive(tabs: TabMedia[], settings: Settings): TabMedia | null {
  const candidates = tabs.filter((t) => mediaEnabled(settings, t.media) && rank(t.media) > 0);
  candidates.sort(
    (a, b) =>
      rank(b.media) - rank(a.media) ||
      Number(b.media.source === settings.priority) - Number(a.media.source === settings.priority) ||
      (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0) ||
      b.media.updatedAt - a.media.updatedAt ||
      a.tabId - b.tabId,
  );
  return candidates[0] ?? null;
}
