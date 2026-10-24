export const WEB_SCRIPT_ID = "jp-web";

/** YouTube is handled by the static content script; the web script must never run there too. */
export const YOUTUBE_EXCLUDES = [
  "https://www.youtube.com/*",
  "https://music.youtube.com/*",
  "https://m.youtube.com/*",
  "https://youtube.com/*",
];

const STATIC = new Set(["https://www.youtube.com/*", "https://music.youtube.com/*", "https://m.youtube.com/*"]);

/** Granted origin patterns the web content script should run on (https only, minus the static YouTube ones). */
export function webMatches(origins: readonly string[] | undefined): string[] {
  return [...new Set((origins ?? []).filter((o) => /^https:\/\/[^/]+\/\*$/.test(o) && !STATIC.has(o)))];
}

/** Registers/updates/removes the dynamic content script to match the permissions the user has granted. */
export async function syncWebScripts(): Promise<void> {
  try {
    const perms = await chrome.permissions.getAll();
    const matches = webMatches(perms.origins);
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [WEB_SCRIPT_ID] });
    if (matches.length === 0) {
      if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [WEB_SCRIPT_ID] });
      return;
    }
    const script = {
      id: WEB_SCRIPT_ID,
      js: ["webcontent.js"],
      matches,
      excludeMatches: YOUTUBE_EXCLUDES,
      runAt: "document_idle" as const,
      allFrames: false,
      persistAcrossSessions: true,
    };
    if (existing.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
  } catch {
    /* scripting unavailable: web presence simply stays off */
  }
}
