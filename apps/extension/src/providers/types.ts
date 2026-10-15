import type { MediaState, Source } from "@jpresence/shared";

export type ProviderEnv = {
  doc: Document;
  /** location of the page (injected for tests) */
  url: URL;
  now: number;
};

export interface MediaProvider {
  readonly source: Source;
  matches(url: URL): boolean;
  /** Returns the current media or null when nothing (non-stale) is available. */
  read(env: ProviderEnv): MediaState | null;
}

export const text = (el: Element | null | undefined): string | undefined => {
  const t = el?.textContent?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
};

export function firstText(doc: Document, selectors: string[]): string | undefined {
  for (const s of selectors) {
    try {
      const t = text(doc.querySelector(s));
      if (t) return t;
    } catch {
      /* invalid selector in this engine: skip */
    }
  }
  return undefined;
}

export function pickVideo(doc: Document): HTMLVideoElement | null {
  const vids = Array.from(doc.querySelectorAll("video"));
  return (
    vids.find((v) => v.classList.contains("html5-main-video")) ??
    vids.find((v) => v.currentSrc || v.src || v.readyState > 0) ??
    vids[0] ??
    null
  );
}

export function playbackOf(v: HTMLVideoElement | null, adShowing = false) {
  if (!v) return "stopped" as const;
  if (v.ended) return "ended" as const;
  if (adShowing) return "buffering" as const;
  if (v.paused) return "paused" as const;
  if (v.readyState < 3) return "buffering" as const;
  return "playing" as const;
}

export const ms = (sec: number | undefined): number | undefined =>
  typeof sec === "number" && Number.isFinite(sec) && sec >= 0 ? Math.round(sec * 1000) : undefined;

export function largestArtwork(art: readonly { src: string; sizes?: string }[] | undefined): string | undefined {
  if (!art?.length) return undefined;
  const size = (a: { sizes?: string }) => parseInt((a.sizes ?? "").split("x")[0] ?? "0", 10) || 0;
  return [...art].sort((a, b) => size(b) - size(a))[0]?.src;
}
