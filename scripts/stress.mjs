// Memory-leak / handle-leak stress test. Run: node scripts/stress.mjs   (bundles TS with esbuild, runs with --expose-gc)
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = createRequire(path.join(root, "apps/companion/package.json"))("esbuild");
const out = path.join(root, "apps/companion/dist/stress.mjs");

await build({
  stdin: {
    resolveDir: root,
    sourcefile: "stress-entry.ts",
    loader: "ts",
    contents: `
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PresenceManager } from "./apps/extension/src/background/presence";
import { PresenceHost } from "./apps/companion/src/services/host";
import { DiscordIpc, FrameDecoder, encodeFrame } from "./apps/companion/src/discord/ipc";
import { MediaMonitor } from "./apps/extension/src/content/monitor";
import { DEFAULT_SETTINGS } from "./packages/shared/src";

const SCALE = Number(process.env.SCALE ?? 1);
const gc = (globalThis as any).gc as () => void;
const heap = () => { gc(); gc(); return process.memoryUsage().heapUsed / 1048576; };
const handles = () => (process as any)._getActiveHandles().length;
const mb = (n: number) => n.toFixed(2) + " MB";
const rows: string[] = [];
const report = (name: string, before: number, after: number, extra = "") => {
  const d = after - before;
  rows.push(name.padEnd(46) + " heap " + mb(before) + " -> " + mb(after) + "  (" + (d >= 0 ? "+" : "") + d.toFixed(2) + ")  " + extra);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- A. extension PresenceManager: many tabs, constant churn, tab closes ---
{
  let t = 1_700_000_000_000;
  const timers: Array<() => void> = [];
  const ports: any[] = [];
  const mgr = new PresenceManager({
    connectNative: () => { const p = { sent: 0, postMessage() { p.sent++; }, disconnect() {}, onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }; ports.push(p); return p as any; },
    getLastError: () => undefined, now: () => t, version: "x",
    setTimer: (cb) => { timers.push(cb); return timers.length; }, clearTimer: () => {},
  }, DEFAULT_SETTINGS);
  const mk = (i: number, n: number) => ({ source: (i % 3 === 0 ? "youtube" : i % 3 === 1 ? "youtube-music" : "web") as any, title: "T" + n, creator: "C", siteId: "whatsapp", siteName: "WhatsApp", activityType: 0 as const, mediaUrl: i % 3 === 2 ? undefined : "https://www.youtube.com/watch?v=dQw4w9WgXcQ", playbackState: "playing" as const, positionMs: n, updatedAt: t });
  for (let w = 0; w < 5000; w++) { t += 1000; mgr.update(w % 40, mk(w % 40, w)); }
  const before = heap();
  for (let n = 0; n < 300_000; n++) {
    t += 1000;
    const tab = n % 50;
    mgr.update(tab, mk(tab, n));
    if (n % 7 === 0) mgr.remove((n + 3) % 50);
    if (n % 1000 === 0) { mgr.expire(); timers.length = 0; }
  }
  const after = heap();
  report("A. PresenceManager 300k updates/50 tabs", before, after, "tabs=" + mgr.tabCount() + " ports=" + ports.length + " pendingTimers=" + timers.length);
  if (mgr.tabCount() > 50) rows.push("   !! tab map grew beyond 50");
}

// --- B. companion host + real Discord IPC against a fake Discord (named pipe) ---
{
  const name = "jp-stress-" + process.pid;
  const pipe = process.platform === "win32" ? "\\\\\\\\.\\\\pipe\\\\" + name : path.join(os.tmpdir(), name);
  let activities = 0, handshakes = 0;
  const socks = new Set<net.Socket>();
  const server = net.createServer((s) => {
    socks.add(s); s.on("close", () => socks.delete(s)); s.on("error", () => {});
    const dec = new FrameDecoder();
    s.on("data", (c) => { for (const f of dec.push(c)) {
      if (f.op === 0) { handshakes++; s.write(encodeFrame(1, { evt: "READY", cmd: "DISPATCH", data: {} })); }
      else { activities++; s.write(encodeFrame(1, { cmd: "SET_ACTIVITY", nonce: f.data.nonce, evt: null, data: { ok: 1 } })); }
    } });
  });
  await new Promise<void>((r) => server.listen(pipe, r));
  const sent: any[] = [];
  const host = new PresenceHost({
    config: { clientIds: { youtube: "111111111111111111", youtubeMusic: "222222222222222222" } }, version: "x",
    send: (r) => { sent.length = 0; sent.push(r); }, backoff: [5],
    createClient: (id) => new DiscordIpc({ clientId: id, paths: [pipe] }),
  });
  const act = (n: number, source = "youtube") => ({ v: 1, type: "setActivity", activity: { source, type: source === "youtube" ? 3 : 2, details: "Title " + n, state: "S", startMs: 1_700_000_000_000 + n } });
  host.handle(act(0)); await sleep(300);
  const before = heap(); const h0 = handles();
  for (let n = 1; n <= 3000 * SCALE; n++) {
    host.handle(act(n, n % 5 === 0 ? "youtube-music" : "youtube"));
    if (n % 3 === 0) host.handle({ v: 1, type: "clearActivity" });
    if (n % 100 === 0) await sleep(20);
  }
  await sleep(500);
  // 150 Discord restarts
  for (let k = 0; k < 150 * SCALE; k++) { for (const s of [...socks]) s.destroy(); host.handle(act(100000 + k)); await sleep(25); }
  await sleep(500);
  const after = heap(); const h1 = handles();
  report("B. Host: 3k updates + 150 Discord restarts", before, after, "handles " + h0 + " -> " + h1 + " | handshakes=" + handshakes + " activities=" + activities);
  await host.shutdown(); for (const s of socks) s.destroy(); server.close(); await sleep(200);
  rows.push("   handles after shutdown: " + handles() + " (baseline stdio handles expected)");
}

// --- C. content-script MediaMonitor: evaluate() churn, start/stop cycles ---
{
  const listeners = new Map<string, number>();
  const doc: any = {
    addEventListener: (e: string) => listeners.set(e, (listeners.get(e) ?? 0) + 1),
    removeEventListener: (e: string) => listeners.set(e, (listeners.get(e) ?? 0) - 1),
    querySelector: () => null, head: null, visibilityState: "visible", defaultView: { addEventListener() {}, removeEventListener() {} },
  };
  (globalThis as any).MutationObserver = class { observe() {} disconnect() {} };
  let n = 0, emits = 0;
  const provider: any = { read: ({ now }: any) => ({ source: "youtube", title: "T" + (n % 5), playbackState: "playing", positionMs: n * 10, updatedAt: now }) };
  const mon = new MediaMonitor({ doc, getUrl: () => new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), provider, emit: () => { emits++; }, now: () => Date.now(), setTimer: () => 0 });
  const before = heap();
  for (let c = 0; c < 2000; c++) { mon.start(); for (let k = 0; k < 20; k++) { n++; mon.evaluate(); } mon.stop(); }
  const after = heap();
  const leaked = [...listeners.entries()].filter(([, v]) => v !== 0);
  report("C. MediaMonitor 2k start/stop + 40k evaluates", before, after, "emits=" + emits + " leakedListeners=" + JSON.stringify(leaked));
}

console.log(rows.join("\\n"));
process.exit(0);
`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: out,
  logLevel: "error",
  define: { __EXT_ID__: '"x"', __DEFAULT_IDS__: "{}" },
});

const r = spawnSync(process.execPath, ["--expose-gc", out], { stdio: "inherit", cwd: root });
fs.rmSync(out, { force: true });
process.exit(r.status ?? 1);
