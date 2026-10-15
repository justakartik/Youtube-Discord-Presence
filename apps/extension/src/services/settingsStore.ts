import { normalizeSettings, type Settings } from "@jpresence/shared";

const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  try {
    const r = await chrome.storage.sync.get(KEY);
    return normalizeSettings(r[KEY]);
  } catch {
    return normalizeSettings(undefined);
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.sync.set({ [KEY]: normalizeSettings(s) });
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const l = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "sync" && changes[KEY]) cb(normalizeSettings(changes[KEY].newValue));
  };
  chrome.storage.onChanged.addListener(l);
  return () => chrome.storage.onChanged.removeListener(l);
}
