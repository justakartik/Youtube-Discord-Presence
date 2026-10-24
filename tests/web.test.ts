// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS, SITES, buildActivity, classify, classifyGeneric, faviconUrl, isSensitiveHost,
  normalizeMedia, normalizeSettings, originPatterns, safeImageUrl, selectActive, validateHostRequest,
  webSiteEnabled, activityKey, type MediaState, type Settings,
} from "../packages/shared/src";
import { WebProvider, IDLE_MS } from "../apps/extension/src/providers/web";
import { webMatches } from "../apps/extension/src/background/webScripts";
import { isFromContentScript, senderMatchesSource } from "../apps/extension/src/services/messages";
import { toDiscordActivity } from "../apps/companion/src/services/host";

const u = (s: string) => new URL(s);

describe("curated site classification (privacy-safe labels)", () => {
  it("instagram: reels / stories / chat / feed", () => {
    expect(classify(u("https://www.instagram.com/reels/C123abc/"))).toMatchObject({ siteId: "instagram", label: "Watching Reels", type: 3 });
    expect(classify(u("https://www.instagram.com/stories/someone/123/"))).toMatchObject({ label: "Watching Stories", type: 3 });
    expect(classify(u("https://www.instagram.com/direct/t/987/"))).toMatchObject({ label: "Chatting", type: 0 });
    expect(classify(u("https://www.instagram.com/"))).toMatchObject({ label: "Scrolling the feed" });
  });
  it("whatsapp web and messenger are just 'Chatting'", () => {
    expect(classify(u("https://web.whatsapp.com/"))).toMatchObject({ siteId: "whatsapp", siteName: "WhatsApp", label: "Chatting" });
    expect(classify(u("https://www.messenger.com/t/12345"))).toMatchObject({ label: "Chatting" });
    expect(classify(u("https://www.facebook.com/messages/t/12345"))).toMatchObject({ label: "Chatting" });
    expect(classify(u("https://www.facebook.com/reel/123"))).toMatchObject({ label: "Watching Reels", type: 3 });
  });
  it("labels never contain URL parts, usernames or ids", () => {
    const samples = [
      "https://www.instagram.com/direct/t/SECRET_THREAD/?igsh=tok", "https://web.whatsapp.com/send?phone=919999999999&text=hello",
      "https://twitter.com/messages/12345-67890", "https://www.reddit.com/r/private_sub/comments/abc/title_here/",
      "https://github.com/someone/secret-repo", "https://www.linkedin.com/messaging/thread/2-abc/",
    ];
    for (const s of samples) {
      const a = classify(u(s))!;
      const shown = `${a.label}|${a.siteName}|${faviconUrl(a.domain)}`;
      for (const secret of ["SECRET", "919999999999", "hello", "private_sub", "title_here", "secret-repo", "someone", "12345", "tok"]) {
        expect(shown).not.toContain(secret);
      }
    }
  });
  it("only https and only curated hosts; subdomains match, lookalikes do not", () => {
    expect(classify(u("http://www.instagram.com/"))).toBeNull();
    expect(classify(u("https://instagram.com.evil.example/"))).toBeNull();
    expect(classify(u("https://notinstagram.com/"))).toBeNull();
    expect(classify(u("https://m.facebook.com/"))).toMatchObject({ siteId: "facebook" });
    expect(classify(u("https://www.example.com/"))).toBeNull();
  });
  it("origin patterns cover each host", () => {
    const ig = SITES.find((s) => s.id === "instagram")!;
    expect(originPatterns(ig)).toEqual(["https://*.instagram.com/*"]);
    expect(originPatterns(SITES.find((s) => s.id === "x")!)).toEqual(["https://*.x.com/*", "https://*.twitter.com/*"]);
  });
});

describe("generic sites (domain only) and the sensitive blocklist", () => {
  it("shows the domain and nothing else", () => {
    const a = classifyGeneric(u("https://www.somecoolblog.dev/post/my-private-title?x=1"))!;
    expect(a).toMatchObject({ siteId: "other", siteName: "somecoolblog.dev", label: "Browsing the web" });
  });
  it("blocks banks, mail, health, gov, auth pages, IPs and intranet hosts", () => {
    for (const h of [
      "https://netbanking.hdfcbank.com/", "https://mail.google.com/", "https://outlook.live.com/", "https://www.paypal.com/",
      "https://accounts.google.com/", "https://login.example.com/", "https://www.medicalnews.org/", "https://www.incometax.gov.in/",
      "http://localhost:3000/", "https://192.168.1.10/", "https://router.local/", "https://intranet/", "https://www.coinbase.com/",
    ]) expect(classifyGeneric(u(h)), h).toBeNull();
    expect(isSensitiveHost("onlinebanking.example.com")).toBe(true);
  });
  it("does not shadow curated sites or YouTube", () => {
    expect(classifyGeneric(u("https://www.instagram.com/"))).toBeNull();
    expect(classifyGeneric(u("https://www.youtube.com/watch?v=x"))).toBeNull();
    expect(classifyGeneric(u("https://youtu.be/abc"))).toBeNull();
  });
});

describe("settings", () => {
  it("web defaults: on, no 'all sites', curated sites default on", () => {
    expect(DEFAULT_SETTINGS.web).toMatchObject({ enabled: true, allSites: false });
    expect(webSiteEnabled(DEFAULT_SETTINGS, "whatsapp")).toBe(true);
    expect(webSiteEnabled(DEFAULT_SETTINGS, "other")).toBe(false);
    expect(webSiteEnabled(DEFAULT_SETTINGS, "unknown-site")).toBe(false);
  });
  it("normalizes garbage and drops unknown site ids", () => {
    const s = normalizeSettings({ web: { enabled: "yes", allSites: true, sites: { whatsapp: false, evil: true, instagram: "x" } } });
    expect(s.web.enabled).toBe(true);
    expect(s.web.allSites).toBe(true);
    expect(s.web.sites).toEqual({ whatsapp: false });
    expect(normalizeSettings(null).web).toEqual(DEFAULT_SETTINGS.web);
  });
  it("master switch and per-site switch", () => {
    expect(webSiteEnabled(normalizeSettings({ web: { enabled: false } }), "whatsapp")).toBe(false);
    expect(webSiteEnabled(normalizeSettings({ web: { sites: { whatsapp: false } } }), "whatsapp")).toBe(false);
    expect(webSiteEnabled(normalizeSettings({ enabled: false }), "whatsapp")).toBe(true); // web-level only; global handled by mediaEnabled
  });
});

const webMedia = (o: Partial<MediaState> = {}): MediaState => ({
  source: "web", title: "Chatting", siteId: "whatsapp", siteName: "WhatsApp", activityType: 0,
  artworkUrl: faviconUrl("web.whatsapp.com"), positionMs: 65_000, playbackState: "playing", updatedAt: 1_000_000, ...o,
});
const ytMedia = (o: Partial<MediaState> = {}): MediaState => ({
  source: "youtube", title: "Video", creator: "C", mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  playbackState: "playing", updatedAt: 1_000_000, ...o,
});

describe("media validation for web", () => {
  it("requires site id and name; strips url/creator; allows favicon image only", () => {
    expect(normalizeMedia({ source: "web", title: "Chatting", playbackState: "playing" })).toBeNull();
    const m = normalizeMedia({ ...webMedia(), mediaUrl: "https://web.whatsapp.com/send?phone=1", creator: "Alice" })!;
    expect(m.mediaUrl).toBeUndefined();
    expect(m.creator).toBeUndefined();
    expect(m.artworkUrl).toContain("google.com/s2/favicons");
    expect(safeImageUrl("https://www.google.com/search?q=x")).toBeUndefined();
    expect(safeImageUrl("https://www.google.com/s2/favicons?domain=instagram.com&sz=128")).toBeDefined();
  });
});

describe("activity for websites", () => {
  const now = 1_005_000;
  it("sets the site as the activity name, fixed label, favicon, elapsed time, no url/buttons/badge", () => {
    const a = buildActivity(webMedia(), DEFAULT_SETTINGS, now)!;
    expect(a).toMatchObject({ source: "web", type: 0, name: "WhatsApp", details: "Chatting", noBadge: true });
    expect(a.url).toBeUndefined();
    expect(a.state).toBeUndefined();
    expect(a.endMs).toBeUndefined();
    expect(a.startMs).toBe(now - 70_000);
    expect(a.largeImage).toContain("favicons");
    const d: any = toDiscordActivity(a);
    expect(d.name).toBe("WhatsApp");
    expect(d.buttons).toBeUndefined();
    expect(d.details_url).toBeUndefined();
    expect(d.assets.small_image).toBeUndefined();
    expect(d.timestamps.start).toBe(a.startMs);
  });
  it("respects toggles", () => {
    const s = normalizeSettings({ web: { showElapsed: false, showIcon: false } });
    const a = buildActivity(webMedia(), s, now)!;
    expect(a.startMs).toBeUndefined();
    expect(a.largeImage).toBeUndefined();
  });
  it("is cleared when disabled globally, per site, or master off", () => {
    expect(buildActivity(webMedia(), { ...DEFAULT_SETTINGS, enabled: false }, now)).toBeNull();
    expect(buildActivity(webMedia(), normalizeSettings({ web: { sites: { whatsapp: false } } }), now)).toBeNull();
    expect(buildActivity(webMedia(), normalizeSettings({ web: { enabled: false } }), now)).toBeNull();
    expect(buildActivity(webMedia({ playbackState: "stopped" }), DEFAULT_SETTINGS, now)).toBeNull();
  });
  it("duplicate key stable across jitter, differs by site", () => {
    const a = buildActivity(webMedia(), DEFAULT_SETTINGS, now)!;
    const b = buildActivity(webMedia({ updatedAt: 1_000_400 }), DEFAULT_SETTINGS, now + 400)!;
    expect(activityKey(a)).toBe(activityKey(b));
    expect(activityKey(a)).not.toBe(activityKey(buildActivity(webMedia({ siteName: "Telegram", siteId: "telegram" }), DEFAULT_SETTINGS, now)));
  });
  it("host request validation keeps name/type 0, drops bad ones", () => {
    const ok: any = validateHostRequest({ v: 1, type: "setActivity", activity: { source: "web", type: 0, name: "WhatsApp", noBadge: true, details: "Chatting" } });
    expect(ok.activity).toMatchObject({ source: "web", type: 0, name: "WhatsApp", noBadge: true });
    expect(validateHostRequest({ v: 1, type: "setActivity", activity: { source: "web", type: 4, details: "x" } })).toBeNull();
  });
});

describe("selection with websites", () => {
  it("playing media beats browsing; browsing beats paused media; disabled sites are ignored", () => {
    const tabs = [{ tabId: 1, media: webMedia() }, { tabId: 2, media: ytMedia() }];
    expect(selectActive(tabs, DEFAULT_SETTINGS)!.tabId).toBe(2);
    expect(selectActive([{ tabId: 1, media: webMedia() }, { tabId: 2, media: ytMedia({ playbackState: "paused" }) }], DEFAULT_SETTINGS)!.tabId).toBe(1);
    expect(selectActive(tabs.slice(0, 1), normalizeSettings({ web: { sites: { whatsapp: false } } }))).toBeNull();
    expect(selectActive(tabs.slice(0, 1), normalizeSettings({ web: { enabled: false } }))).toBeNull();
  });
});

describe("WebProvider (content script logic)", () => {
  const env = (url: string, now: number) => ({ doc: document, url: new URL(url), now });
  function mk(settings: Settings = DEFAULT_SETTINGS, last = 1_000_000, incognito = false) {
    let lastAct = last;
    const p = new WebProvider({ getSettings: () => settings, lastActivityAt: () => lastAct, incognito });
    return { p, touch: (t: number) => (lastAct = t) };
  }
  it("emits a label, tracks a session start, resets when the site changes or after idle", () => {
    const { p, touch } = mk();
    const a = p.read(env("https://web.whatsapp.com/", 1_000_000))!;
    expect(a).toMatchObject({ source: "web", title: "Chatting", siteName: "WhatsApp", positionMs: 0 });
    expect(a.mediaUrl).toBeUndefined();
    expect(p.read(env("https://web.whatsapp.com/", 1_030_000))!.positionMs).toBe(30_000);
    expect(p.read(env("https://www.instagram.com/reels/abc/", 1_040_000))!.positionMs).toBe(0); // new site, new timer
    touch(1_040_000);
    expect(p.read(env("https://www.instagram.com/reels/abc/", 1_040_000 + IDLE_MS + 1))).toBeNull(); // idle
    touch(1_040_000 + IDLE_MS + 5000);
    expect(p.read(env("https://www.instagram.com/reels/abc/", 1_040_000 + IDLE_MS + 5000))!.positionMs).toBe(0); // fresh session
  });
  it("is silent for hidden tabs, disabled sites, uncurated sites (unless all-sites), incognito", () => {
    const hidden = mk();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    expect(hidden.p.read(env("https://web.whatsapp.com/", 1_000_000))).toBeNull();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(mk(normalizeSettings({ web: { sites: { whatsapp: false } } })).p.read(env("https://web.whatsapp.com/", 1_000_000))).toBeNull();
    expect(mk().p.read(env("https://www.randomsite.dev/", 1_000_000))).toBeNull();
    const all = mk(normalizeSettings({ web: { allSites: true } })).p.read(env("https://www.randomsite.dev/secret/path?q=1", 1_000_000))!;
    expect(all).toMatchObject({ siteId: "other", siteName: "randomsite.dev", title: "Browsing the web" });
    expect(JSON.stringify(all)).not.toContain("secret");
    expect(mk(normalizeSettings({ web: { allSites: true } })).p.read(env("https://mail.google.com/", 1_000_000))).toBeNull();
    expect(mk(DEFAULT_SETTINGS, 1_000_000, true).p.read(env("https://web.whatsapp.com/", 1_000_000))).toBeNull();
  });
});

describe("dynamic script registration + sender checks", () => {
  it("webMatches keeps granted https patterns, drops YouTube and non-https", () => {
    expect(webMatches(["https://*.instagram.com/*", "https://www.youtube.com/*", "http://*.x.com/*", "https://*.instagram.com/*", "<all_urls>"]))
      .toEqual(["https://*.instagram.com/*"]);
    expect(webMatches(["https://*/*"])).toEqual(["https://*/*"]);
    expect(webMatches(undefined)).toEqual([]);
  });
  it("sender must match the media source", () => {
    expect(senderMatchesSource("https://web.whatsapp.com/", "web")).toBe(true);
    expect(senderMatchesSource("https://www.youtube.com/watch?v=x", "web")).toBe(false); // YouTube pages can't claim to be a website
    expect(senderMatchesSource("https://web.whatsapp.com/", "youtube")).toBe(false); // other sites can't spoof YouTube
    expect(senderMatchesSource("https://music.youtube.com/", "youtube-music")).toBe(true);
    expect(isFromContentScript({ id: "x", tab: { id: 1 }, url: "http://insecure.example/" }, "x")).toBe(false);
    expect(isFromContentScript({ id: "x", tab: { id: 1 }, url: "https://web.whatsapp.com/" }, "x")).toBe(true);
  });
});
