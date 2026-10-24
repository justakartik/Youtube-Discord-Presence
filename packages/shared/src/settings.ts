import type { Settings, SourceSettings, WebSettings } from "./types";
import { OTHER_SITE_ID, SITES, siteById } from "./sites";

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
  // On by default, but nothing happens until the user grants the browser permission for a site.
  web: { enabled: true, allSites: false, showElapsed: true, showIcon: true, sites: {} },
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

function mergeWeb(raw: unknown, d: WebSettings): WebSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawSites = (r.sites && typeof r.sites === "object" ? r.sites : {}) as Record<string, unknown>;
  const sites: Record<string, boolean> = {};
  for (const s of SITES) if (typeof rawSites[s.id] === "boolean") sites[s.id] = rawSites[s.id] as boolean;
  return {
    enabled: bool(r.enabled, d.enabled),
    allSites: bool(r.allSites, d.allSites),
    showElapsed: bool(r.showElapsed, d.showElapsed),
    showIcon: bool(r.showIcon, d.showIcon),
    sites,
  };
}

/** Is presence allowed for this web site id (curated id or "other")? */
export function webSiteEnabled(settings: Settings, siteId: string | undefined): boolean {
  if (!settings.web.enabled || !siteId) return false;
  if (siteId === OTHER_SITE_ID) return settings.web.allSites;
  if (!siteById(siteId)) return false;
  return settings.web.sites[siteId] ?? true;
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
    web: mergeWeb(r.web, d.web),
  };
}
