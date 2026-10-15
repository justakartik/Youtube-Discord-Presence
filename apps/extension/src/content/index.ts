import { MediaMonitor } from "./monitor";
import { MediaProviderRegistry } from "../providers/registry";

const provider = new MediaProviderRegistry().forUrl(new URL(location.href));
if (provider) {
  let dead = false;
  const monitor: MediaMonitor = new MediaMonitor({
    doc: document,
    getUrl: () => new URL(location.href),
    provider,
    emit: (media) => {
      if (dead) return;
      try {
        const msg = media ? { type: "media", media } : { type: "media-stop" };
        void chrome.runtime.sendMessage(msg).catch(() => {
          // service worker asleep/restarting: next heartbeat retries
        });
      } catch {
        // "Extension context invalidated" after update/reload: stop quietly.
        dead = true;
        monitor.stop();
      }
    },
  });
  monitor.start();
  addEventListener("pagehide", () => monitor.stop());
}
