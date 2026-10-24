import type { MediaState } from "@jpresence/shared";
import type { MediaProvider } from "../providers/types";

export type MonitorDeps = {
  doc: Document;
  getUrl: () => URL;
  provider: MediaProvider;
  emit: (m: MediaState | null) => void;
  now?: () => number;
  setTimer?: (cb: () => void, ms: number) => unknown;
};

const EVENTS = ["play", "pause", "ended", "waiting", "playing", "seeked", "loadedmetadata", "durationchange", "emptied"];
const HEARTBEAT_MS = 15_000;
const SEEK_TOLERANCE_MS = 2500;

/** Detects changes via media events, SPA navigation, DOM mutations and light polling. */
export class MediaMonitor {
  private last: MediaState | null = null;
  private lastEmitAt = 0;
  private scheduled = false;
  private timers: unknown[] = [];
  private mo: MutationObserver | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private now: () => number;

  constructor(private d: MonitorDeps) {
    this.now = d.now ?? Date.now;
  }

  start() {
    const doc = this.d.doc;
    for (const e of EVENTS) doc.addEventListener(e, this.schedule, true);
    doc.addEventListener("yt-navigate-finish", this.schedule, true);
    doc.addEventListener("yt-page-data-updated", this.schedule, true);
    doc.addEventListener("visibilitychange", this.schedule);
    doc.defaultView?.addEventListener("popstate", this.schedule);
    doc.defaultView?.addEventListener("focus", this.schedule);
    this.mo = new MutationObserver(this.schedule);
    const target = doc.querySelector("title") ?? doc.head;
    if (target) this.mo.observe(target, { childList: true, subtree: true, characterData: true });
    // Fallback polling (also drives heartbeat + seek detection); cheap, one read per tick.
    this.poll = setInterval(this.schedule, 3000);
    this.schedule();
  }

  stop() {
    const doc = this.d.doc;
    for (const e of EVENTS) doc.removeEventListener(e, this.schedule, true);
    doc.removeEventListener("yt-navigate-finish", this.schedule, true);
    doc.removeEventListener("yt-page-data-updated", this.schedule, true);
    doc.removeEventListener("visibilitychange", this.schedule);
    doc.defaultView?.removeEventListener("popstate", this.schedule);
    doc.defaultView?.removeEventListener("focus", this.schedule);
    this.mo?.disconnect();
    if (this.poll) clearInterval(this.poll);
    if (this.last) this.d.emit(null);
    this.last = null;
  }

  private schedule = () => {
    if (this.scheduled) return;
    this.scheduled = true;
    (this.d.setTimer ?? ((cb, ms) => setTimeout(cb, ms)))(() => {
      this.scheduled = false;
      this.evaluate();
    }, 200);
  };

  /** exposed for tests */
  evaluate() {
    const now = this.now();
    let cur: MediaState | null = null;
    try {
      cur = this.d.provider.read({ doc: this.d.doc, url: this.d.getUrl(), now });
    } catch {
      cur = null; // provider errors must never break the page
    }
    if (!this.shouldEmit(cur, now)) return;
    this.last = cur;
    this.lastEmitAt = now;
    this.d.emit(cur);
  }

  private shouldEmit(cur: MediaState | null, now: number): boolean {
    const prev = this.last;
    if (!cur) return prev !== null;
    if (!prev) return true;
    if (
      cur.title !== prev.title || cur.creator !== prev.creator || cur.album !== prev.album ||
      cur.mediaUrl !== prev.mediaUrl || cur.artworkUrl !== prev.artworkUrl ||
      cur.playbackState !== prev.playbackState || cur.durationMs !== prev.durationMs ||
      cur.isLive !== prev.isLive
    ) return true;
    if (cur.playbackState === "playing" && cur.positionMs !== undefined && prev.positionMs !== undefined) {
      const expected = prev.positionMs + (now - prev.updatedAt);
      if (Math.abs(cur.positionMs - expected) > SEEK_TOLERANCE_MS) return true; // seek
    } else if (cur.positionMs !== prev.positionMs && cur.playbackState !== "playing") {
      return true; // seek while paused
    }
    return now - this.lastEmitAt >= HEARTBEAT_MS; // keep-alive for staleness detection
  }
}
