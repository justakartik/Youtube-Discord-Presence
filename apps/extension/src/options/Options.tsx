import { useEffect, useState } from "react";
import { Activity, Lock, Music2, Palette, SlidersHorizontal, Tv } from "lucide-react";
import { DEFAULT_SETTINGS, type Settings, type SourceSettings } from "@jpresence/shared";
import { Section, Select, StatusDot, Toggle } from "../components/ui";
import { useSettings } from "../services/useSettings";
import type { PopupState } from "../services/messages";

const PAUSE = [
  { value: "show-paused", label: "Show as paused" },
  { value: "keep", label: "Keep last activity" },
  { value: "clear", label: "Clear presence" },
] as const;

function SourceSection({
  title, icon, s, onChange, nouns,
}: {
  title: string; icon: React.ReactNode; s: SourceSettings; onChange: (p: Partial<SourceSettings>) => void;
  nouns: { title: string; creator: string; art: string };
}) {
  return (
    <Section title={title} icon={icon}>
      <Toggle label={`Enable ${title} presence`} checked={s.enabled} onChange={(v) => onChange({ enabled: v })} />
      <Toggle label={`Show ${nouns.title}`} checked={s.showTitle} onChange={(v) => onChange({ showTitle: v })} />
      <Toggle label={`Show ${nouns.creator}`} checked={s.showCreator} onChange={(v) => onChange({ showCreator: v })} />
      <Toggle label={`Show ${nouns.art}`} checked={s.showArtwork} onChange={(v) => onChange({ showArtwork: v })} />
      <Toggle label="Show progress" checked={s.showProgress} onChange={(v) => onChange({ showProgress: v })} />
      <Select label="When paused" value={s.pauseBehavior} options={[...PAUSE]} onChange={(v) => onChange({ pauseBehavior: v })} />
    </Section>
  );
}

export function Options() {
  const { settings, update } = useSettings();
  const [st, setSt] = useState<PopupState | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const pull = () => chrome.runtime.sendMessage({ type: "get-state" }).then((r) => r?.status && setSt(r)).catch(() => {});
    void pull();
    const t = setInterval(pull, 2000);
    return () => clearInterval(t);
  }, []);

  if (!settings) return null;
  const patch = (k: "youtube" | "youtubeMusic") => (p: Partial<SourceSettings>) =>
    update((s: Settings) => ({ ...s, [k]: { ...s[k], ...p } }));

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <header className="mb-2 flex items-center gap-3">
        <img src="icons/icon-48.png" alt="" className="h-10 w-10 rounded-xl" />
        <div>
          <h1 className="text-xl font-semibold">Justakartik YouTube Discord Presence</h1>
          <p className="text-sm text-muted">Settings are saved automatically.</p>
        </div>
      </header>

      <Section title="General" icon={<SlidersHorizontal size={14} />}>
        <Toggle label="Enable presence" hint="Master switch. Off clears Discord immediately." checked={settings.enabled} onChange={(v) => update((s) => ({ ...s, enabled: v }))} />
        <Select label="Preferred site when both play" value={settings.priority}
          options={[{ value: "youtube-music", label: "YouTube Music" }, { value: "youtube", label: "YouTube" }]}
          onChange={(v) => update((s) => ({ ...s, priority: v }))} />
        <p className="py-2 text-xs text-muted">The companion starts and stops with your browser automatically; no startup entry is needed.</p>
      </Section>

      <SourceSection title="YouTube" icon={<Tv size={14} />} s={settings.youtube} onChange={patch("youtube")}
        nouns={{ title: "video title", creator: "channel", art: "thumbnail" }} />
      <SourceSection title="YouTube Music" icon={<Music2 size={14} />} s={settings.youtubeMusic} onChange={patch("youtubeMusic")}
        nouns={{ title: "song title", creator: "artist", art: "album artwork" }} />

      <Section title="Appearance" icon={<Palette size={14} />}>
        <Select label="Theme" value={settings.theme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
          onChange={(v) => update((s) => ({ ...s, theme: v }))} />
        <div className="flex items-center justify-between py-2">
          <label htmlFor="accent" className="text-sm">Accent color</label>
          <div className="flex items-center gap-2">
            <button className="text-xs text-muted underline" onClick={() => update((s) => ({ ...s, accent: DEFAULT_SETTINGS.accent }))}>Reset</button>
            <input id="accent" type="color" value={settings.accent} onChange={(e) => update((s) => ({ ...s, accent: e.target.value }))} className="h-8 w-10 rounded border border-line bg-transparent" />
          </div>
        </div>
      </Section>

      <Section title="Privacy" icon={<Lock size={14} />}>
        <p className="py-2 text-xs text-muted">
          Media metadata is processed locally and sent only to Discord on this computer via the companion. No listening
          history is stored and there is no telemetry.
        </p>
        <Toggle label="Disable presence now" hint="Immediately stops sharing and clears Discord." checked={!settings.enabled} onChange={(v) => update((s) => ({ ...s, enabled: !v }))} />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Clear locally stored metadata</span>
          <button
            className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-bg"
            onClick={async () => { await chrome.runtime.sendMessage({ type: "clear-local-data" }); setCleared(true); }}
          >
            {cleared ? "Cleared" : "Clear"}
          </button>
        </div>
      </Section>

      <Section title="Diagnostics" icon={<Activity size={14} />}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 py-2 text-sm">
          <dt className="text-muted">Extension</dt><dd>v{st?.extensionVersion ?? "—"}</dd>
          <dt className="text-muted">Companion</dt><dd className="flex items-center gap-2"><StatusDot ok={!!st?.status.connected} /> {st?.status.companionVersion ? `v${st.status.companionVersion}` : st?.status.hostMissing ? "not installed" : "not connected"}</dd>
          <dt className="text-muted">Discord</dt><dd className="flex items-center gap-2"><StatusDot ok={st?.status.discord === "connected"} warn={st?.status.discord === "connecting"} /> {st?.status.discord ?? "—"}</dd>
          <dt className="text-muted">Client ID configured</dt><dd>{st?.status.configured === undefined ? "—" : st.status.configured ? "yes" : "no"}</dd>
          <dt className="text-muted">Last update</dt><dd>{st?.status.lastUpdate ? new Date(st.status.lastUpdate).toLocaleTimeString() : "—"}</dd>
          <dt className="text-muted">Last error</dt><dd className="break-words">{st?.status.error ?? "none"}</dd>
        </dl>
        <div className="py-2">
          <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white" onClick={() => chrome.runtime.sendMessage({ type: "reconnect" })}>Reconnect companion</button>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
            <li>Companion not installed: run <code>install.ps1</code> from the release folder, then reload this extension.</li>
            <li>Discord not connected: start the Discord desktop app (not the web client).</li>
            <li>No client ID: edit <code>%APPDATA%\Justakartik\Presence\config.json</code>.</li>
            <li>Discord setting “Display current activity as a status message” must be on.</li>
          </ul>
        </div>
      </Section>
    </main>
  );
}
