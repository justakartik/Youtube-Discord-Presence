// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_SETTINGS, buildActivity, normalizeMedia, normalizeSettings, selectActive, validateHostRequest,
  type MediaState, type Settings,
} from "../packages/shared/src";
import { WebProvider, IDLE_MS } from "../apps/extension/src/providers/web";
import { readTitle, pickPlayerVideo, MIN_FEATURE_SECONDS } from "../apps/extension/src/providers/player";
import { toDiscordActivity } from "../apps/companion/src/services/host";
import { siteById } from "../packages/shared/src";

const env = (url: string, now: number) => ({ doc: document, url: new URL(url), now });

function video(o: { duration?: number; currentTime?: number; paused?: boolean; ended?: boolean; readyState?: number } = {}) {
  const v = document.createElement("video");
  const def = (k: string, val: unknown) => Object.defineProperty(v, k, { value: val, configurable: true });
  def("duration", o.duration ?? 6000); def("currentTime", o.currentTime ?? 600);
  def("paused", o.paused ?? false); def("ended", o.ended ?? false); def("readyState", o.readyState ?? 4);
  document.body.appendChild(v);
  return v;
}
function setVisible(v: boolean) {
  Object.defineProperty(document, "visibilityState", { value: v ? "visible" : "hidden", configurable: true });
}
function setMediaSession(meta: unknown) {
  Object.defineProperty(navigator, "mediaSession", { value: { metadata: meta }, configurable: true });
}
function provider(settings: Settings = DEFAULT_SETTINGS, lastActivity = 1_000_000) {
  return new WebProvider({ getSettings: () => settings, lastActivityAt: () => lastActivity });
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.title = "";
  setVisible(true);
  setMediaSession(null);
});

describe("title detection on streaming sites", () => {
  it("Netflix: reads the player title element", () => {
    document.body.innerHTML = `<div data-uia="video-title"><h4>Stranger Things</h4><span>S4:E1</span><span>Chapter One</span></div>`;
    expect(readTitle(document, siteById("netflix")!.player, "Netflix")).toBe("Stranger Things");
  });
  it("Prime Video: player title element, else cleaned tab title", () => {
    document.body.innerHTML = `<h1 class="atvwebplayersdk-title-text">The Boys</h1>`;
    expect(readTitle(document, siteById("primevideo")!.player, "Prime Video")).toBe("The Boys");
    document.body.innerHTML = "";
    document.title = "Prime Video: Reacher";
    expect(readTitle(document, siteById("primevideo")!.player, "Prime Video")).toBe("Reacher");
  });
  it("falls back to Media Session, then the tab title with branding stripped", () => {
    setMediaSession({ title: "Oppenheimer", artist: "x" });
    document.title = "Watch Something Else Online | JioHotstar";
    expect(readTitle(document, siteById("hotstar")!.player, "JioHotstar")).toBe("Oppenheimer");
    setMediaSession(null);
    expect(readTitle(document, siteById("hotstar")!.player, "JioHotstar")).toBe("Something Else");
    document.title = "Disney+ | Loki";
    expect(readTitle(document, siteById("disneyplus")!.player, "Disney+")).toBe("Loki");
  });
  it("never returns generic or site-name-only titles", () => {
    document.title = "Netflix";
    expect(readTitle(document, siteById("netflix")!.player, "Netflix")).toBeUndefined();
    document.title = "Home - Netflix";
    expect(readTitle(document, siteById("netflix")!.player, "Netflix")).toBeUndefined();
  });
});

describe("player video selection", () => {
  it("ignores trailers/previews/ads shorter than the minimum and unloaded videos", () => {
    video({ duration: 45 }); video({ duration: MIN_FEATURE_SECONDS - 1 }); video({ duration: 7200, readyState: 0 });
    expect(pickPlayerVideo(document)).toBeNull();
    const main = video({ duration: 7200 });
    expect(pickPlayerVideo(document)).toBe(main);
  });
  it("prefers the playing video over a paused one", () => {
    video({ duration: 9000, paused: true });
    const playing = video({ duration: 3000, paused: false });
    expect(pickPlayerVideo(document)).toBe(playing);
  });
});

describe("WebProvider on streaming sites", () => {
  const now = 2_000_000;
  it("emits title + position + duration while playing", () => {
    document.body.innerHTML = `<div data-uia="video-title"><h4>Dark</h4></div>`;
    video({ duration: 3000, currentTime: 125 });
    const m = provider().read(env("https://www.netflix.com/watch/81234567?trackId=1", now))!;
    expect(m).toMatchObject({
      source: "web", title: "Dark", siteName: "Netflix", watching: true, activityType: 3,
      positionMs: 125_000, durationMs: 3_000_000, playbackState: "playing",
    });
    expect(m.mediaUrl).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain("81234567"); // the watch id never leaves the page
  });
  it("keeps showing a playing video with no mouse movement and in a background tab", () => {
    document.body.innerHTML = `<h1 class="atvwebplayersdk-title-text">Reacher</h1>`;
    video();
    setVisible(false);
    const m = provider(DEFAULT_SETTINGS, 0).read(env("https://www.primevideo.com/detail/0ABC/", now))!;
    expect(m.playbackState).toBe("playing");
  });
  it("paused: shown only while the user is around", () => {
    document.body.innerHTML = `<h1 class="atvwebplayersdk-title-text">Reacher</h1>`;
    video({ paused: true });
    const url = "https://www.primevideo.com/detail/0ABC/";
    expect(provider(DEFAULT_SETTINGS, now - 1000).read(env(url, now))).toMatchObject({ playbackState: "paused", watching: true });
    // away for longer than the idle limit: falls back to plain browsing (which also needs the user), so nothing
    expect(provider(DEFAULT_SETTINGS, now - IDLE_MS - 1).read(env(url, now))).toBeNull();
  });
  it("titles switched off: only 'Watching <site>', still with progress", () => {
    document.body.innerHTML = `<div data-uia="video-title"><h4>Dark</h4></div>`;
    video();
    const s = normalizeSettings({ web: { showTitles: false } });
    const m = provider(s, now).read(env("https://www.netflix.com/watch/1", now))!;
    expect(m.title).toBe("Watching Netflix");
    expect(m.durationMs).toBeDefined();
  });
  it("no feature video, or not a player path: plain browsing label, never a title", () => {
    document.title = "Secret Show - Netflix";
    video({ duration: 30 }); // hover preview
    const browse = provider(DEFAULT_SETTINGS, now).read(env("https://www.netflix.com/browse", now))!;
    expect(browse).toMatchObject({ title: "Choosing something to watch" });
    expect(browse.watching).toBeUndefined();
    expect(JSON.stringify(browse)).not.toContain("Secret");
    video({ duration: 6000 });
    const notPlayerPath = provider(DEFAULT_SETTINGS, now).read(env("https://www.netflix.com/title/80100172", now))!;
    expect(notPlayerPath.watching).toBeUndefined(); // Netflix player only counts on /watch/
  });
  it("chat and social sites never read titles even if a video exists", () => {
    document.title = "Alice - Private chat";
    video({ duration: 6000 });
    const m = provider(DEFAULT_SETTINGS, now).read(env("https://web.whatsapp.com/", now))!;
    expect(m.title).toBe("Chatting");
    expect(JSON.stringify(m)).not.toContain("Alice");
    expect(m.watching).toBeUndefined();
  });
  it("respects the per-site switch", () => {
    video();
    expect(provider(normalizeSettings({ web: { sites: { netflix: false } } }), now).read(env("https://www.netflix.com/watch/1", now))).toBeNull();
  });
});

describe("activity for streaming players", () => {
  const now = 2_005_000;
  const media = (o: Partial<MediaState> = {}): MediaState => ({
    source: "web", title: "Dark", siteId: "netflix", siteName: "Netflix", activityType: 3, watching: true,
    positionMs: 125_000, durationMs: 3_000_000, playbackState: "playing", updatedAt: 2_000_000, ...o,
  });
  it("Watching Netflix + title + progress bar + play badge, no URL/buttons", () => {
    const a = buildActivity(media(), DEFAULT_SETTINGS, now)!;
    expect(a).toMatchObject({ source: "web", type: 3, name: "Netflix", details: "Dark", noBadge: false });
    expect(a.startMs).toBe(now - 130_000);
    expect(a.endMs).toBe(a.startMs! + 3_000_000);
    const d: any = toDiscordActivity(a);
    expect(d.name).toBe("Netflix");
    expect(d.assets.small_image).toBe("play");
    expect(d.timestamps).toEqual({ start: a.startMs, end: a.endMs });
    expect(d.buttons).toBeUndefined();
    expect(d.details_url).toBeUndefined();
  });
  it("paused: 'Paused', pause badge, no moving timer", () => {
    const a = buildActivity(media({ playbackState: "paused" }), DEFAULT_SETTINGS, now)!;
    expect(a).toMatchObject({ state: "Paused", paused: true });
    expect(a.startMs).toBeUndefined();
    expect((toDiscordActivity(a) as any).assets.small_image).toBe("pause");
  });
  it("progress toggle off removes timestamps", () => {
    const a = buildActivity(media(), normalizeSettings({ web: { showProgress: false } }), now)!;
    expect(a.startMs).toBeUndefined();
    expect(a.endMs).toBeUndefined();
  });
  it("browsing media (not watching) still has no badge and an elapsed timer only", () => {
    const a = buildActivity(media({ watching: undefined, title: "Choosing something to watch", durationMs: undefined, positionMs: 5000, updatedAt: 2_005_000 }), DEFAULT_SETTINGS, now)!;
    expect(a.noBadge).toBe(true);
    expect(a.endMs).toBeUndefined();
    expect(a.startMs).toBe(now - 5000);
  });
  it("paused players rank below playing media but are still selected when alone", () => {
    const yt: MediaState = { source: "youtube", title: "V", playbackState: "playing", updatedAt: 2_000_000 };
    expect(selectActive([{ tabId: 1, media: media({ playbackState: "paused" }) }, { tabId: 2, media: yt }], DEFAULT_SETTINGS)!.tabId).toBe(2);
    expect(selectActive([{ tabId: 1, media: media({ playbackState: "paused" }) }], DEFAULT_SETTINGS)!.tabId).toBe(1);
    expect(selectActive([{ tabId: 1, media: media({ playbackState: "paused", watching: undefined }) }], DEFAULT_SETTINGS)).toBeNull();
  });
  it("validation keeps the watching flag only for web and survives the host request", () => {
    const n = normalizeMedia({ ...media(), source: "web" })!;
    expect(n.watching).toBe(true);
    expect(normalizeMedia({ source: "youtube", title: "x", watching: true, playbackState: "playing" })!.watching).toBeUndefined();
    const req: any = validateHostRequest({ v: 1, type: "setActivity", activity: { source: "web", type: 3, name: "Netflix", details: "Dark", state: "Paused", paused: true, noBadge: false } });
    expect(req.activity).toMatchObject({ name: "Netflix", paused: true, noBadge: false, state: "Paused" });
  });
  it("defaults: titles and progress on", () => {
    expect(DEFAULT_SETTINGS.web).toMatchObject({ showTitles: true, showProgress: true });
    expect(normalizeSettings({ web: { showTitles: "x" } }).web.showTitles).toBe(true);
  });
});
