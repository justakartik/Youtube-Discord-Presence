import {
  activityKey, buildActivity, selectActive, validateHostResponse,
  type HostRequest, type MediaState, type Settings,
} from "@jpresence/shared";
import type { CompanionStatus } from "../services/messages";

export interface NativePortLike {
  postMessage(m: unknown): void;
  disconnect(): void;
  onMessage: { addListener(cb: (m: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

export type PresenceDeps = {
  connectNative: () => NativePortLike;
  getLastError: () => string | undefined;
  now: () => number;
  version: string;
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (h: unknown) => void;
  onChange?: () => void;
};

type Entry = { media: MediaState; receivedAt: number; lastActiveAt: number };

/** Combines MediaStateManager + ActiveMediaSelector + PresenceManager. */
export class PresenceManager {
  private tabs = new Map<number, Entry>();
  private port: NativePortLike | null = null;
  private lastKey = "none";
  private attempt = 0;
  private reconnectTimer: unknown = null;
  private settings: Settings;
  status: CompanionStatus = { connected: false, hostMissing: false, discord: "disconnected" };
  static STALE_MS = 45_000;

  constructor(private d: PresenceDeps, settings: Settings) {
    this.settings = settings;
  }

  setSettings(s: Settings) {
    this.settings = s;
    this.sync();
  }

  update(tabId: number, media: MediaState) {
    const prev = this.tabs.get(tabId);
    const now = this.d.now();
    const becamePlaying = media.playbackState === "playing" && prev?.media.playbackState !== "playing";
    this.tabs.set(tabId, {
      media,
      receivedAt: now,
      lastActiveAt: becamePlaying || !prev ? now : prev.lastActiveAt,
    });
    this.sync();
  }

  remove(tabId: number) {
    if (this.tabs.delete(tabId)) this.sync();
  }

  /** Drop entries whose content script went silent (crashed tab, extension reload). */
  expire() {
    const now = this.d.now();
    let changed = false;
    for (const [id, e] of this.tabs) {
      if (now - e.receivedAt > PresenceManager.STALE_MS) { this.tabs.delete(id); changed = true; }
    }
    if (changed) this.sync();
  }

  current(): MediaState | null {
    return this.pick()?.media ?? null;
  }
  tabCount() { return this.tabs.size; }

  clearAll() {
    this.tabs.clear();
    this.lastKey = "none";
    this.send({ v: 1, type: "clearActivity" });
    this.d.onChange?.();
  }

  private pick() {
    const list = [...this.tabs].map(([tabId, e]) => ({ tabId, media: e.media, lastActiveAt: e.lastActiveAt }));
    return selectActive(list, this.settings);
  }

  sync() {
    const chosen = this.pick();
    const activity = chosen ? buildActivity(chosen.media, this.settings, this.d.now()) : null;
    const key = activityKey(activity);
    if (key !== this.lastKey) {
      this.lastKey = key;
      if (activity) this.send({ v: 1, type: "setActivity", activity });
      else if (this.port) this.send({ v: 1, type: "clearActivity" });
    }
    this.d.onChange?.();
  }

  private ensurePort(): NativePortLike | null {
    if (this.port) return this.port;
    try {
      const port = this.d.connectNative();
      this.port = port;
      port.onMessage.addListener((raw) => this.onHostMessage(raw));
      port.onDisconnect.addListener(() => {
        const err = this.d.getLastError();
        this.port = null;
        const missing = /not found|forbidden|specified native messaging host/i.test(err ?? "");
        this.status = {
          ...this.status, connected: false, hostMissing: missing, discord: "disconnected",
          error: err ? err.slice(0, 200) : "Companion disconnected",
        };
        this.lastKey = "none"; // force re-publish after reconnect
        this.d.onChange?.();
        this.scheduleReconnect();
      });
      this.status = { ...this.status, connected: true, hostMissing: false };
      port.postMessage({ v: 1, type: "hello", extensionVersion: this.d.version } satisfies HostRequest);
      return port;
    } catch (e) {
      this.status = { ...this.status, connected: false, error: (e as Error).message.slice(0, 200) };
      this.scheduleReconnect();
      return null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.tabs.size === 0) return;
    const steps = [1000, 2000, 5000, 15000, 30000];
    const delay = steps[Math.min(this.attempt++, steps.length - 1)]!;
    this.reconnectTimer = this.d.setTimer(() => {
      this.reconnectTimer = null;
      if (this.tabs.size > 0) this.sync();
    }, delay);
  }

  reconnect() {
    this.port?.disconnect();
    this.port = null;
    this.attempt = 0;
    this.lastKey = "none";
    this.sync();
  }

  private send(req: HostRequest) {
    if (req.type === "clearActivity" && !this.port) return;
    const port = this.ensurePort();
    try {
      port?.postMessage(req);
    } catch {
      /* port died; onDisconnect will handle */
    }
  }

  private onHostMessage(raw: unknown) {
    const r = validateHostResponse(raw);
    if (!r) return;
    this.attempt = 0;
    if (r.type === "hello") {
      this.status = { ...this.status, companionVersion: r.companionVersion, configured: r.configured };
    } else if (r.type === "status") {
      this.status = { ...this.status, discord: r.discord, lastUpdate: r.lastUpdate, error: r.error };
    }
    this.d.onChange?.();
  }
}
