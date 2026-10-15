import type { Settings, SourceSettings } from "./types";

const src = (): SourceSettings => ({
  enabled: true,
  showTitle: true,
  showCreator: true,
  showArtwork: true,
  showProgress: true,
  pauseBehavior: "show-paused",
});

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  priority: "youtube-music",
  theme: "dark",
  accent: "#4b8cff",
  keepHistory: false,
  telemetry: false,
  youtube: src(),
  youtubeMusic: src(),
};

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const pause = (v: unknown, d: SourceSettings["pauseBehavior"]) =>
  v === "clear" || v === "keep" || v === "show-paused" ? v : d;

function mergeSource(raw: unknown, d: SourceSettings): SourceSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: bool(r.enabled, d.enabled),
    showTitle: bool(r.showTitle, d.showTitle),
    showCreator: bool(r.showCreator, d.showCreator),
    showArtwork: bool(r.showArtwork, d.showArtwork),
    showProgress: bool(r.showProgress, d.showProgress),
    pauseBehavior: pause(r.pauseBehavior, d.pauseBehavior),
  };
}

/** Merge untrusted stored data over defaults; always returns a valid Settings. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    enabled: bool(r.enabled, d.enabled),
    priority: r.priority === "youtube" || r.priority === "youtube-music" ? r.priority : d.priority,
    theme: r.theme === "light" ? "light" : "dark",
    accent:
      typeof r.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(r.accent) ? r.accent : d.accent,
    keepHistory: bool(r.keepHistory, false),
    telemetry: false,
    youtube: mergeSource(r.youtube, d.youtube),
    youtubeMusic: mergeSource(r.youtubeMusic, d.youtubeMusic),
  };
}
