import {
  classify, classifyGeneric, faviconUrl, normalizeMedia, siteById, webSiteEnabled,
  type MediaState, type Settings,
} from "@jpresence/shared";
import type { MediaProvider, ProviderEnv } from "./types";
import { readPlayer } from "./player";

export const IDLE_MS = 2 * 60 * 1000;

export type WebProviderDeps = {
  getSettings: () => Settings;
  /** Epoch ms of the last mouse/keyboard/scroll/touch input on this page. */
  lastActivityAt: () => number;
  incognito?: boolean;
};

/**
 * Presence for non-YouTube websites.
 *
 * Browsing sites (chat, social, ...): only the URL's host and first path segment are used and the result is a
 * fixed label such as "Chatting". Page content is never read.
 *
 * Streaming sites (Netflix, Prime Video, ...): while a feature-length video is loaded, also reads the player
 * (title, position, duration, paused) so Discord can show what you watch with a progress bar. The title can be
 * turned off in settings, which falls back to "Watching <site>".
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

    const site = classify(url) ?? (settings.web.allSites ? classifyGeneric(url) : null);
    if (!site || !webSiteEnabled(settings, site.siteId)) return this.end();

    const profile = siteById(site.siteId);
    const hints = profile?.player;
    if (hints && (!hints.paths || hints.paths.some((p) => url.pathname.startsWith(p)))) {
      const player = readPlayer(doc, hints, site.siteName);
      // A playing video counts as presence even if the mouse has not moved for the whole movie, and even
      // when the tab is in the background. A paused one only counts while the user is around.
      if (player && (!player.paused || (doc.visibilityState === "visible" && now - this.deps.lastActivityAt() <= IDLE_MS))) {
        this.siteId = site.siteId;
        return normalizeMedia(
          {
            source: "web",
            title: settings.web.showTitles && player.title ? player.title : site.label,
            siteId: site.siteId,
            siteName: site.siteName,
            activityType: 3,
            watching: true,
            artworkUrl: faviconUrl(site.domain),
            positionMs: player.positionMs,
            durationMs: player.durationMs,
            playbackState: player.paused ? "paused" : "playing",
            updatedAt: now,
          },
          now,
        );
      }
    }

    // Plain browsing: only while the tab is in front and the user is actually there.
    if (doc.visibilityState !== "visible") return this.end();
    if (now - this.deps.lastActivityAt() > IDLE_MS) return this.end();

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
