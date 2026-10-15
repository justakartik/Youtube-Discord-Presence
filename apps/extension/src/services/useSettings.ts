import { useEffect, useState } from "react";
import { normalizeSettings, type Settings } from "@jpresence/shared";
import { loadSettings, onSettingsChanged, saveSettings } from "./settingsStore";

export function applyTheme(s: Settings) {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.style.setProperty("--accent", s.accent);
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void loadSettings().then((s) => { setSettings(s); applyTheme(s); });
    return onSettingsChanged((s) => { setSettings(s); applyTheme(s); });
  }, []);
  const update = (patch: (s: Settings) => Settings) => {
    if (!settings) return;
    const next = normalizeSettings(patch(settings));
    setSettings(next);
    applyTheme(next);
    void saveSettings(next);
  };
  return { settings, update };
}
