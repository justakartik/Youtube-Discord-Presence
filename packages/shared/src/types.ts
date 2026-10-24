export const PROTOCOL_VERSION = 1;
export const HOST_NAME = "com.justakartik.youtube_discord_presence";

export type Source = "youtube" | "youtube-music" | "web";
export type PlaybackState = "playing" | "paused" | "buffering" | "ended" | "stopped";

export type MediaState = {
  source: Source;
  /** For "web": a fixed, privacy-safe label such as "Chatting" or "Watching Reels". */
  title: string;
  creator?: string;
  album?: string;
  /** "web" only: site id (see sites.ts), display name and Discord activity type. */
  siteId?: string;
  siteName?: string;
  activityType?: 0 | 2 | 3;
  mediaUrl?: string;
  artworkUrl?: string;
  durationMs?: number;
  positionMs?: number;
  isLive?: boolean;
  playbackState: PlaybackState;
  updatedAt: number;
};

export type PauseBehavior = "clear" | "keep" | "show-paused";

export type SourceSettings = {
  enabled: boolean;
  showTitle: boolean;
  showCreator: boolean;
  showArtwork: boolean;
  showProgress: boolean;
  pauseBehavior: PauseBehavior;
};

export type WebSettings = {
  /** Master switch for every non-YouTube site. */
  enabled: boolean;
  /** Also show "Browsing the web" + domain for sites that are not on the curated list. */
  allSites: boolean;
  showElapsed: boolean;
  showIcon: boolean;
  /** Per curated site overrides (default: on). Access is still granted per site by the browser. */
  sites: Record<string, boolean>;
};

export type Settings = {
  enabled: boolean;
  priority: "youtube" | "youtube-music";
  theme: "dark" | "light";
  accent: string;
  keepHistory: boolean;
  telemetry: false;
  youtube: SourceSettings;
  youtubeMusic: SourceSettings;
  web: WebSettings;
};

export type ActivityPayload = {
  source: Source;
  type: 0 | 2 | 3; // Playing | Listening | Watching
  /** Display name override (web sites), e.g. "WhatsApp". */
  name?: string;
  /** Skip the play/pause badge (web sites). */
  noBadge?: boolean;
  details: string;
  state?: string;
  largeImage?: string;
  largeText?: string;
  paused?: boolean;
  startMs?: number;
  endMs?: number;
  url?: string;
};

/** extension -> companion */
export type HostRequest =
  | { v: 1; type: "hello"; extensionVersion: string }
  | { v: 1; type: "setActivity"; activity: ActivityPayload }
  | { v: 1; type: "clearActivity" }
  | { v: 1; type: "ping" };

/** companion -> extension */
export type HostResponse =
  | { v: 1; type: "hello"; companionVersion: string; configured: boolean }
  | {
      v: 1;
      type: "status";
      discord: "connected" | "connecting" | "disconnected";
      lastUpdate?: number;
      error?: string;
    }
  | { v: 1; type: "pong" };
