export const PROTOCOL_VERSION = 1;
export const HOST_NAME = "com.justakartik.youtube_discord_presence";

export type Source = "youtube" | "youtube-music";
export type PlaybackState = "playing" | "paused" | "buffering" | "ended" | "stopped";

export type MediaState = {
  source: Source;
  title: string;
  creator?: string;
  album?: string;
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

export type Settings = {
  enabled: boolean;
  priority: Source;
  theme: "dark" | "light";
  accent: string;
  keepHistory: boolean;
  telemetry: false;
  youtube: SourceSettings;
  youtubeMusic: SourceSettings;
};

export type ActivityPayload = {
  source: Source;
  type: 2 | 3; // Listening | Watching
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
