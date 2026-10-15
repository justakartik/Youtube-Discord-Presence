import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS, normalizeSettings, normalizeMedia, validateHostRequest, buildActivity,
  activityKey, selectActive, youtubeVideoId, youtubeThumbnail, upgradeArtwork, safeImageUrl,
  type MediaState,
} from "../packages/shared/src";

const yt = (o: Partial<MediaState> = {}): MediaState => ({
  source: "youtube", title: "Video", creator: "Chan", playbackState: "playing",
  mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", durationMs: 200000, positionMs: 10000,
  updatedAt: 1_000_000, ...o,
});
const ytm = (o: Partial<MediaState> = {}): MediaState => ({
  source: "youtube-music", title: "Song", creator: "Artist", playbackState: "playing",
  updatedAt: 1_000_000, ...o,
});

describe("normalizeMedia", () => {
  it("rejects missing title / bad source", () => {
    expect(normalizeMedia({ source: "youtube", title: "  " })).toBeNull();
    expect(normalizeMedia({ source: "x", title: "a" })).toBeNull();
    expect(normalizeMedia(null)).toBeNull();
  });
  it("strips control chars and clamps position, drops duration for live", () => {
    const m = normalizeMedia({ source: "youtube", title: "a\nb\u0000c", playbackState: "playing", durationMs: 1000, positionMs: 5000 })!;
    expect(m.title).toBe("a b c");
    expect(m.positionMs).toBe(1000);
    expect(normalizeMedia({ source: "youtube", title: "L", isLive: true, durationMs: 9, playbackState: "playing" })!.durationMs).toBeUndefined();
  });
  it("only allows safe image/page urls", () => {
    expect(safeImageUrl("http://i.ytimg.com/a.jpg")).toBeUndefined();
    expect(safeImageUrl("https://evil.example/a.jpg")).toBeUndefined();
    expect(safeImageUrl("https://i.ytimg.com/vi/x/hqdefault.jpg")).toBeDefined();
    const m = normalizeMedia({ source: "youtube", title: "a", mediaUrl: "https://evil.com/watch?v=1" })!;
    expect(m.mediaUrl).toBeUndefined();
  });
});

describe("artwork", () => {
  it("extracts video ids (watch, shorts, live, youtu.be)", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/")).toBeUndefined();
  });
  it("upgrades googleusercontent art", () => {
    expect(upgradeArtwork("https://lh3.googleusercontent.com/abc=w60-h60-l90-rj", "youtube-music")).toBe("https://lh3.googleusercontent.com/abc=w512-h512");
  });
  it("builds thumbnail", () => expect(youtubeThumbnail("abc")).toContain("/vi/abc/"));
});

describe("buildActivity", () => {
  const now = 1_005_000;
  it("watching activity with thumbnail and timestamps", () => {
    const a = buildActivity(yt(), DEFAULT_SETTINGS, now)!;
    expect(a.type).toBe(3);
    expect(a.details).toBe("Video");
    expect(a.largeImage).toContain("dQw4w9WgXcQ");
    expect(a.startMs).toBe(now - 15000);
    expect(a.endMs).toBe(a.startMs! + 200000);
  });
  it("listening activity uses artist and album art", () => {
    const a = buildActivity(ytm({ artworkUrl: "https://lh3.googleusercontent.com/x=w512-h512", album: "Alb" }), DEFAULT_SETTINGS, now)!;
    expect(a.type).toBe(2);
    expect(a.state).toBe("Artist");
    expect(a.largeText).toBe("Alb");
    expect(a.largeImage).toContain("googleusercontent");
  });
  it("respects privacy toggles", () => {
    const s = normalizeSettings({ youtube: { showTitle: false, showCreator: false, showArtwork: false, showProgress: false } });
    const a = buildActivity(yt(), s, now)!;
    expect(a.details).toBe("Watching a video");
    expect(a.state).toBe("on YouTube");
    expect(a.largeImage).toBeUndefined();
    expect(a.startMs).toBeUndefined();
  });
  it("pause behaviours", () => {
    const p = yt({ playbackState: "paused" });
    expect(buildActivity(p, DEFAULT_SETTINGS, now)!.state).toContain("Paused");
    expect(buildActivity(p, DEFAULT_SETTINGS, now)!.startMs).toBeUndefined();
    const s = normalizeSettings({ youtube: { pauseBehavior: "clear" } });
    expect(buildActivity(p, s, now)).toBeNull();
  });
  it("clears for ended/stopped/disabled", () => {
    expect(buildActivity(yt({ playbackState: "ended" }), DEFAULT_SETTINGS)).toBeNull();
    expect(buildActivity(yt(), { ...DEFAULT_SETTINGS, enabled: false })).toBeNull();
  });
  it("live shows LIVE and no end", () => {
    const a = buildActivity(yt({ isLive: true, durationMs: undefined }), DEFAULT_SETTINGS, now)!;
    expect(a.state).toContain("LIVE");
    expect(a.endMs).toBeUndefined();
  });
  it("duplicate key stable across small timestamp jitter, changes on new title", () => {
    const a = buildActivity(yt(), DEFAULT_SETTINGS, now)!;
    const b = buildActivity(yt(), DEFAULT_SETTINGS, now + 400)!;
    expect(activityKey(a)).toBe(activityKey(b));
    expect(activityKey(a)).not.toBe(activityKey(buildActivity(yt({ title: "Other" }), DEFAULT_SETTINGS, now)));
  });
});

describe("selectActive", () => {
  it("prefers playing over paused, then site priority, then recency, then tabId", () => {
    const tabs = [
      { tabId: 1, media: yt({ playbackState: "paused" }) },
      { tabId: 2, media: yt() },
      { tabId: 3, media: ytm() },
    ];
    expect(selectActive(tabs, DEFAULT_SETTINGS)!.tabId).toBe(3); // music priority
    expect(selectActive(tabs, { ...DEFAULT_SETTINGS, priority: "youtube" })!.tabId).toBe(2);
    const two = [{ tabId: 5, media: yt(), lastActiveAt: 1 }, { tabId: 4, media: yt(), lastActiveAt: 2 }];
    expect(selectActive(two, DEFAULT_SETTINGS)!.tabId).toBe(4);
    expect(selectActive([{ tabId: 9, media: yt() }, { tabId: 8, media: yt() }], DEFAULT_SETTINGS)!.tabId).toBe(8);
  });
  it("falls back to paused when nothing plays; respects disabled sources", () => {
    expect(selectActive([{ tabId: 1, media: yt({ playbackState: "paused" }) }], DEFAULT_SETTINGS)!.tabId).toBe(1);
    const s = normalizeSettings({ youtubeMusic: { enabled: false } });
    expect(selectActive([{ tabId: 3, media: ytm() }], s)).toBeNull();
    expect(selectActive([{ tabId: 3, media: yt({ playbackState: "ended" }) }], DEFAULT_SETTINGS)).toBeNull();
  });
});

describe("protocol validation", () => {
  it("rejects bad versions/types and sanitizes setActivity", () => {
    expect(validateHostRequest({ v: 2, type: "ping" })).toBeNull();
    expect(validateHostRequest({ v: 1, type: "nope" })).toBeNull();
    expect(validateHostRequest({ v: 1, type: "setActivity", activity: { source: "youtube", type: 5, details: "x" } })).toBeNull();
    const r: any = validateHostRequest({ v: 1, type: "setActivity", activity: { source: "youtube", type: 3, details: "x", largeImage: "https://evil.com/a.png" } });
    expect(r.activity.largeImage).toBeUndefined();
  });
  it("keeps real epoch-ms timestamps (regression)", () => {
    const now = Date.now();
    const r: any = validateHostRequest({ v: 1, type: "setActivity", activity: { source: "youtube", type: 3, details: "x", startMs: now, endMs: now + 5000 } });
    expect(r.activity.startMs).toBe(now);
    expect(r.activity.endMs).toBe(now + 5000);
  });
  it("normalizeSettings tolerates garbage", () => {
    expect(normalizeSettings("junk")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ accent: "red", youtube: 5 }).accent).toBe("#4b8cff");
  });
});
