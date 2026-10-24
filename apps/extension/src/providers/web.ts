import {
  classify, classifyGeneric, faviconUrl, normalizeMedia, webSiteEnabled,
  type MediaState, type Settings,
} from "@jpresence/shared";
import type { MediaProvider, ProviderEnv } from "./types";

export const IDLE_MS = 2 * 60 * 1000;

export type WebProviderDeps = {
  getSettings: () => Settings;
  /** Epoch ms of the last mouse/keyboard/scroll/touch input on this page. */
  lastActivityAt: () => number;
  incognito?: boolean;
};

/**
 * Presence for non-YouTube websites. It looks only at the URL's host and first path segment and
 * emits a fixed label such as "Chatting" or "Watching Reels". It never reads page content.
 */
export class WebProvider implements MediaProvider {
  readonly source = "web" as const;
  private siteId: string | null = null;
  private startedAt = 0;

  constructor(private deps: WebProviderDeps) {}

  matches(url: URL) {
    return url.protocol === "https:";
  }

  private end(): null {
    this.siteId = null;
    return null;
  }

  read({ doc, url, now }: ProviderEnv): MediaState | null {
    const settings = this.deps.getSettings();
    if (this.deps.incognito || !settings.enabled || !settings.web.enabled) return this.end();
    // Only while the tab is in front and the user is actually there.
    if (doc.visibilityState !== "visible") return this.end();
    if (now - this.deps.lastActivityAt() > IDLE_MS) return this.end();

    const site = classify(url) ?? (settings.web.allSites ? classifyGeneric(url) : null);
    if (!site || !webSiteEnabled(settings, site.siteId)) return this.end();

    if (this.siteId !== site.siteId) {
      this.siteId = site.siteId;
      this.startedAt = now;
    }
    return normalizeMedia(
      {
        source: "web",
        title: site.label,
        siteId: site.siteId,
        siteName: site.siteName,
        activityType: site.type,
        artworkUrl: faviconUrl(site.domain),
        positionMs: now - this.startedAt,
        playbackState: "playing",
        updatedAt: now,
      },
      now,
    );
  }
}
