import type { Source } from "./types";

export function youtubeVideoId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || undefined;
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/);
    return m?.[1];
  } catch {
    return undefined;
  }
}

/** Real YouTube thumbnail for a video id. */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Upgrade a googleusercontent/ytimg artwork URL to a larger square size. */
export function upgradeArtwork(url: string | undefined, source: Source): string | undefined {
  if (!url) return undefined;
  if (/googleusercontent\.com|ggpht\.com/.test(url)) {
    return url.replace(/=w\d+-h\d+[^?]*$/, "=w512-h512").replace(/=s\d+[^?]*$/, "=s512");
  }
  if (source === "youtube-music" && /ytimg\.com\/vi/.test(url)) {
    return (url.split("?")[0] ?? url).replace(/\/(default|mqdefault|sddefault|hq720)\.jpg/, "/hqdefault.jpg");
  }
  return url;
}
