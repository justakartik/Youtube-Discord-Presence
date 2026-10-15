import type { MediaState, Settings, SourceSettings } from "./types";

export type TabMedia = { tabId: number; media: MediaState; lastActiveAt?: number };

export const sourceSettings = (s: Settings, m: MediaState): SourceSettings =>
  m.source === "youtube" ? s.youtube : s.youtubeMusic;

const rank = (m: MediaState) =>
  m.playbackState === "playing"
    ? 3
    : m.playbackState === "buffering"
      ? 2
      : m.playbackState === "paused"
        ? 1
        : 0;

/** Deterministic choice: playing > buffering > paused; site priority; recency; lowest tabId. */
export function selectActive(tabs: TabMedia[], settings: Settings): TabMedia | null {
  const candidates = tabs.filter(
    (t) => settings.enabled && sourceSettings(settings, t.media).enabled && rank(t.media) > 0,
  );
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
