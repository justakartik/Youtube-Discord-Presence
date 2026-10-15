import { useEffect, useState } from "react";
import { Music2, Play, Settings as Cog, Tv } from "lucide-react";
import { StatusDot, Toggle } from "../components/ui";
import { useSettings } from "../services/useSettings";
import type { PopupState } from "../services/messages";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Popup() {
  const { settings, update } = useSettings();
  const [st, setSt] = useState<PopupState | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const r = (await chrome.runtime.sendMessage({ type: "get-state" })) as PopupState;
        if (alive && r?.status) setSt(r);
      } catch { /* worker waking */ }
      if (alive) setTick(Date.now());
    };
    void pull();
    const t = setInterval(pull, 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const m = st?.media;
  const live = m?.playbackState === "playing" && m.positionMs !== undefined
    ? m.positionMs + (tick - m.updatedAt) : m?.positionMs;
  const pct = m?.durationMs && live !== undefined ? Math.min(100, (live / m.durationMs) * 100) : 0;
  const status = st?.status;
  const discordOk = status?.discord === "connected";

  return (
    <main className="w-[360px] p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="icons/icon-48.png" alt="" className="h-6 w-6 rounded-md" />
          <h1 className="text-sm font-semibold">Justakartik Presence</h1>
        </div>
        <button
          aria-label="Open settings"
          onClick={() => chrome.runtime.openOptionsPage()}
          className="rounded-lg p-1.5 text-muted hover:bg-card hover:text-fg"
        >
          <Cog size={18} />
        </button>
      </header>

      <section className="card p-3" aria-live="polite">
        {m ? (
          <div className="flex gap-3">
            {m.artworkUrl ? (
              <img src={m.artworkUrl} alt="" className="h-16 w-16 rounded-lg object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-lg bg-line text-muted"><Play size={20} /></div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-xs text-muted">
                {m.source === "youtube" ? <Tv size={12} /> : <Music2 size={12} />}
                {m.source === "youtube" ? "YouTube" : "YouTube Music"} · {m.playbackState}
              </div>
              <div className="truncate text-sm font-medium" title={m.title}>{m.title}</div>
              <div className="truncate text-xs text-muted">{m.creator ?? ""}</div>
              {m.durationMs ? (
                <div className="mt-2">
                  <div className="h-1 overflow-hidden rounded bg-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted">
                    <span>{fmt(live ?? 0)}</span><span>{fmt(m.durationMs)}</span>
                  </div>
                </div>
              ) : m.isLive ? <div className="mt-2 text-xs text-accent">● LIVE</div> : null}
            </div>
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-muted">Nothing playing. Open YouTube or YouTube Music.</p>
        )}
      </section>

      <section className="card mt-3 px-4 py-1">
        <Toggle
          label="Show on Discord"
          checked={settings?.enabled ?? true}
          onChange={(v) => update((s) => ({ ...s, enabled: v }))}
        />
        <div className="flex items-center justify-between border-t border-line py-2 text-xs text-muted">
          <span className="flex items-center gap-2"><StatusDot ok={!!status?.connected} warn={!status?.hostMissing} /> Companion {status?.companionVersion ? `v${status.companionVersion}` : status?.hostMissing ? "not installed" : "—"}</span>
          <span className="flex items-center gap-2"><StatusDot ok={discordOk} warn={status?.discord === "connecting"} /> Discord {status?.discord ?? "—"}</span>
        </div>
      </section>

      {status?.hostMissing && (
        <p className="mt-3 text-xs text-amber-400">Companion not found. Run install.ps1 from the release folder (see Installation docs).</p>
      )}
      {status?.configured === false && (
        <p className="mt-3 text-xs text-amber-400">Add your Discord application client ID to the companion config (see docs).</p>
      )}
      {status?.error && !status.hostMissing && <p className="mt-3 text-xs text-muted">{status.error}</p>}
    </main>
  );
}
