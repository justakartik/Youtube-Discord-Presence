import { describe, it, expect, beforeEach } from "vitest";
import { PresenceManager, type NativePortLike } from "../apps/extension/src/background/presence";
import { isFromContentScript, isFromExtensionPage, parseContentMessage, parseUiMessage } from "../apps/extension/src/services/messages";
import { DEFAULT_SETTINGS, normalizeSettings, type MediaState } from "../packages/shared/src";

class FakePort implements NativePortLike {
  sent: any[] = [];
  msgCbs: Array<(m: unknown) => void> = [];
  dcCbs: Array<() => void> = [];
  onMessage = { addListener: (cb: (m: unknown) => void) => void this.msgCbs.push(cb) };
  onDisconnect = { addListener: (cb: () => void) => void this.dcCbs.push(cb) };
  postMessage(m: unknown) { this.sent.push(m); }
  disconnect() {}
  reply(m: unknown) { this.msgCbs.forEach((c) => c(m)); }
  drop() { this.dcCbs.forEach((c) => c()); }
}

let t = 1_000_000;
let ports: FakePort[];
let lastError: string | undefined;
let timers: Array<() => void>;
let connectFails: Error | null;

const media = (o: Partial<MediaState> = {}): MediaState => ({
  source: "youtube", title: "V", creator: "C", mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  playbackState: "playing", positionMs: 0, durationMs: 100000, updatedAt: t, ...o,
});

function mk(settings = DEFAULT_SETTINGS) {
  return new PresenceManager({
    connectNative: () => { if (connectFails) throw connectFails; const p = new FakePort(); ports.push(p); return p; },
    getLastError: () => lastError, now: () => t, version: "9.9.9",
    setTimer: (cb) => (timers.push(cb), timers.length), clearTimer: () => {},
  }, settings);
}
const sentTypes = () => ports.flatMap((p) => p.sent.map((s) => s.type));

beforeEach(() => { t = 1_000_000; ports = []; lastError = undefined; timers = []; connectFails = null; });

describe("PresenceManager", () => {
  it("connects lazily, says hello, sends activity, dedupes", () => {
    const m = mk();
    expect(ports.length).toBe(0);
    m.update(1, media());
    expect(ports.length).toBe(1);
    expect(ports[0]!.sent[0]).toEqual({ v: 1, type: "hello", extensionVersion: "9.9.9" });
    expect(ports[0]!.sent[1].type).toBe("setActivity");
    t += 500; m.update(1, media({ updatedAt: t, positionMs: 500 }));
    expect(sentTypes().filter((x) => x === "setActivity").length).toBe(1);
  });
  it("switches between sites and tabs without restart; clears when tab closes", () => {
    const m = mk();
    m.update(1, media());
    m.update(2, media({ source: "youtube-music", title: "Song", creator: "Art" }));
    expect(ports[0]!.sent.at(-1).activity).toMatchObject({ source: "youtube-music", details: "Song", type: 2 });
    m.remove(2);
    expect(ports[0]!.sent.at(-1).activity).toMatchObject({ source: "youtube", type: 3 });
    m.remove(1);
    expect(ports[0]!.sent.at(-1)).toEqual({ v: 1, type: "clearActivity" });
  });
  it("one tab pausing while another continues", () => {
    const m = mk();
    m.update(1, media({ title: "One" }));
    m.update(2, media({ title: "Two" }));
    m.update(2, media({ title: "Two", playbackState: "paused" }));
    expect(m.current()!.title).toBe("One");
  });
  it("disabling clears immediately; re-enabling republishes", () => {
    const m = mk();
    m.update(1, media());
    m.setSettings({ ...DEFAULT_SETTINGS, enabled: false });
    expect(ports[0]!.sent.at(-1).type).toBe("clearActivity");
    m.setSettings(DEFAULT_SETTINGS);
    expect(ports[0]!.sent.at(-1).type).toBe("setActivity");
  });
  it("privacy toggles change payload", () => {
    const m = mk(normalizeSettings({ youtube: { showTitle: false, showArtwork: false } }));
    m.update(1, media());
    const a = ports[0]!.sent.at(-1).activity;
    expect(a.details).toBe("Watching a video");
    expect(a.largeImage).toBeUndefined();
  });
  it("expires silent tabs", () => {
    const m = mk();
    m.update(1, media());
    t += 50_000; m.expire();
    expect(m.tabCount()).toBe(0);
    expect(ports[0]!.sent.at(-1).type).toBe("clearActivity");
  });
  it("reconnects after native disconnect and republishes; flags missing host", () => {
    const m = mk();
    m.update(1, media());
    lastError = "Specified native messaging host not found.";
    ports[0]!.drop();
    expect(m.status.hostMissing).toBe(true);
    expect(m.status.connected).toBe(false);
    expect(timers.length).toBe(1);
    timers.shift()!();
    expect(ports.length).toBe(2);
    expect(ports[1]!.sent.at(-1).type).toBe("setActivity");
  });
  it("survives connectNative throwing and backs off", () => {
    connectFails = new Error("boom");
    const m = mk();
    expect(() => m.update(1, media())).not.toThrow();
    expect(m.status.connected).toBe(false);
    expect(timers.length).toBe(1);
  });
  it("tracks companion status; ignores invalid host messages", () => {
    const m = mk();
    m.update(1, media());
    ports[0]!.reply({ v: 1, type: "hello", companionVersion: "0.1.0", configured: true });
    ports[0]!.reply({ v: 1, type: "status", discord: "connected", lastUpdate: 5 });
    ports[0]!.reply({ v: 7, type: "status", discord: "hacked" });
    ports[0]!.reply("junk");
    expect(m.status).toMatchObject({ companionVersion: "0.1.0", configured: true, discord: "connected", lastUpdate: 5 });
  });
  it("clearAll clears presence", () => {
    const m = mk();
    m.update(1, media());
    m.clearAll();
    expect(ports[0]!.sent.at(-1).type).toBe("clearActivity");
    expect(m.current()).toBeNull();
  });
});

describe("sender validation", () => {
  const ID = "abc";
  it("content script messages", () => {
    expect(isFromContentScript({ id: ID, tab: { id: 1 }, url: "https://www.youtube.com/watch?v=x" }, ID)).toBe(true);
    // Any https page may host a (user-granted) web content script; the *source* check is senderMatchesSource.
    expect(isFromContentScript({ id: ID, tab: { id: 1 }, url: "https://evil.com/" }, ID)).toBe(true);
    expect(isFromContentScript({ id: ID, tab: { id: 1 }, url: "http://evil.com/" }, ID)).toBe(false);
    expect(isFromContentScript({ id: "other", tab: { id: 1 }, url: "https://www.youtube.com/" }, ID)).toBe(false);
    expect(isFromContentScript({ id: ID, url: "https://www.youtube.com/" }, ID)).toBe(false);
  });
  it("extension pages", () => {
    expect(isFromExtensionPage({ id: ID, url: "chrome-extension://abc/popup.html" }, ID, "chrome-extension://abc/")).toBe(true);
    expect(isFromExtensionPage({ id: ID, url: "https://www.youtube.com/" }, ID, "chrome-extension://abc/")).toBe(false);
  });
  it("message parsing", () => {
    expect(parseContentMessage({ type: "media-stop" })).toEqual({ type: "media-stop" });
    expect(parseContentMessage({ type: "eval" })).toBeNull();
    expect(parseUiMessage({ type: "get-state" })).toEqual({ type: "get-state" });
    expect(parseUiMessage({ type: "media" })).toBeNull();
  });
});

describe("idle disconnect (frees the companion process and lets the worker sleep)", () => {
  it("closes the native port after 60 s with nothing to show, and reconnects on demand", () => {
    const m = mk();
    m.update(1, media());
    expect(ports.length).toBe(1);
    let disconnected = 0;
    ports[0]!.disconnect = () => { disconnected++; };
    m.remove(1); // nothing left -> clearActivity + idle timer armed
    expect(ports[0]!.sent.at(-1).type).toBe("clearActivity");
    expect(timers.length).toBe(1);
    expect(disconnected).toBe(0);
    timers.shift()!(); // 60 s later
    expect(disconnected).toBe(1);
    expect(m.status.connected).toBe(false);
    m.update(2, media({ title: "Next" })); // new activity opens a fresh connection
    expect(ports.length).toBe(2);
    expect(ports[1]!.sent.at(-1).type).toBe("setActivity");
  });
  it("does not disconnect if something starts playing again before the timer fires", () => {
    const m = mk();
    m.update(1, media());
    let disconnected = 0;
    ports[0]!.disconnect = () => { disconnected++; };
    m.remove(1);
    m.update(3, media({ title: "Back" }));
    timers.shift()!();
    expect(disconnected).toBe(0);
    expect(ports.length).toBe(1);
  });
});
