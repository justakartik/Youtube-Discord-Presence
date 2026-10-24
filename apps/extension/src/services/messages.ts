import type { MediaState, Settings } from "@jpresence/shared";

/** content -> background */
export type ContentMessage =
  | { type: "media"; media: MediaState }
  | { type: "media-stop" };

/** popup/options -> background */
export type UiMessage =
  | { type: "get-state" }
  | { type: "clear-local-data" }
  | { type: "reconnect" };

export type CompanionStatus = {
  connected: boolean; // native port open
  hostMissing: boolean;
  discord: "connected" | "connecting" | "disconnected";
  companionVersion?: string;
  configured?: boolean;
  lastUpdate?: number;
  error?: string;
};

export type PopupState = {
  media: MediaState | null;
  status: CompanionStatus;
  settings: Settings;
  extensionVersion: string;
  activeTabs: number;
};

/** Pure sender checks so they can be unit-tested. */
export function isYouTubeUrl(u: string | undefined): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && ["www.youtube.com", "music.youtube.com", "m.youtube.com", "youtube.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** A message from one of this extension's content scripts, in a tab, on an https page. */
export function isFromContentScript(
  sender: { id?: string; tab?: { id?: number }; url?: string },
  extId: string,
): boolean {
  if (sender.id !== extId || typeof sender.tab?.id !== "number" || !sender.url) return false;
  try {
    return new URL(sender.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** YouTube sources may only come from YouTube pages; web activity only from non-YouTube pages. */
export function senderMatchesSource(senderUrl: string | undefined, source: string): boolean {
  const yt = isYouTubeUrl(senderUrl);
  return source === "web" ? !yt && typeof senderUrl === "string" : yt;
}

export function isFromExtensionPage(sender: { id?: string; tab?: unknown; url?: string }, extId: string, base: string): boolean {
  return sender.id === extId && typeof sender.url === "string" && sender.url.startsWith(base);
}

export function parseContentMessage(raw: unknown): ContentMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { type?: unknown };
  if (r.type === "media" || r.type === "media-stop") return raw as ContentMessage;
  return null;
}

export function parseUiMessage(raw: unknown): UiMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const t = (raw as { type?: unknown }).type;
  return t === "get-state" || t === "clear-local-data" || t === "reconnect" ? ({ type: t } as UiMessage) : null;
}
