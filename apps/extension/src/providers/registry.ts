import type { MediaProvider } from "./types";
import { YouTubeProvider } from "./youtube";
import { YouTubeMusicProvider } from "./youtubeMusic";

export class MediaProviderRegistry {
  constructor(private providers: MediaProvider[] = [new YouTubeMusicProvider(), new YouTubeProvider()]) {}
  forUrl(url: URL): MediaProvider | null {
    return this.providers.find((p) => p.matches(url)) ?? null;
  }
}
