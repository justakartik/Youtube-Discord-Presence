import { describe, it, expect, afterEach } from "vitest";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PresenceManager, type NativePortLike } from "../apps/extension/src/background/presence";
import { PresenceHost } from "../apps/companion/src/services/host";
import { DiscordIpc, FrameDecoder, encodeFrame } from "../apps/companion/src/discord/ipc";
import { DEFAULT_SETTINGS, type MediaState } from "../packages/shared/src";

/** Extension PresenceManager <-> (in-memory native port) <-> companion PresenceHost <-> fake Discord pipe. */
function rig() {
  const p = process.platform === "win32" ? `\\\\.\\pipe\\jp-e2e-${process.pid}-${Date.now()}` : path.join(os.tmpdir(), `jp-e2e-${process.pid}-${Date.now()}`);
  const handshakes: any[] = []; const acts: any[] = []; const socks: net.Socket[] = [];
  const server = net.createServer((s) => {
    socks.push(s); const dec = new FrameDecoder();
    s.on("data", (c) => { for (const f of dec.push(c)) {
      if (f.op === 0) { handshakes.push(f.data); s.write(encodeFrame(1, { evt: "READY", cmd: "DISPATCH", data: {} })); }
      else { acts.push(f.data.args.activity); s.write(encodeFrame(1, { cmd: "SET_ACTIVITY", nonce: f.data.nonce, evt: null, data: {} })); }
    } });
    s.on("error", () => {});
  });
  const ready = new Promise<void>((r) => server.listen(p, r));
  // eslint-disable-next-line prefer-const -- referenced by `port` before assignment
  let host!: PresenceHost;
  const msgCbs: Array<(m: unknown) => void> = [];
  const port: NativePortLike = {
    postMessage: (m) => queueMicrotask(() => host.handle(JSON.parse(JSON.stringify(m)))), // JSON roundtrip like real native messaging
    disconnect() {},
    onMessage: { addListener: (cb) => void msgCbs.push(cb) },
    onDisconnect: { addListener() {} },
  };
  host = new PresenceHost({
    config: { clientIds: { youtube: "111111111111111111", youtubeMusic: "222222222222222222" } },
    version: "0.1.0", send: (r) => msgCbs.forEach((c) => c(JSON.parse(JSON.stringify(r)))),
    createClient: (id) => new DiscordIpc({ clientId: id, paths: [p] }),
  });
  const mgr = new PresenceManager({
    connectNative: () => port, getLastError: () => undefined, now: () => Date.now(), version: "t",
    setTimer: (cb, ms) => setTimeout(cb, ms), clearTimer: (h) => clearTimeout(h as any),
  }, DEFAULT_SETTINGS);
  return { mgr, host, handshakes, acts, ready, close: async () => { await host.shutdown(); socks.forEach((s) => s.destroy()); server.close(); } };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let r: ReturnType<typeof rig>;
afterEach(async () => r?.close());
const m = (o: Partial<MediaState>): MediaState => ({ source: "youtube", title: "T", playbackState: "playing", updatedAt: Date.now(), ...o });

describe("pipeline: extension -> companion -> Discord (fake Discord IPC)", () => {
  it("YouTube workflow", async () => {
    r = rig(); await r.ready;
    r.mgr.update(1, m({ title: "Cool Video", creator: "Chan", mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", positionMs: 5000, durationMs: 60000 }));
    await wait(300);
    expect(r.handshakes[0].client_id).toBe("111111111111111111");
    expect(r.acts[0]).toMatchObject({ type: 3, details: "Cool Video", state: "Chan", assets: { large_image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" } });
    expect(r.acts[0].timestamps.end - r.acts[0].timestamps.start).toBe(60000);
  });
  it("YouTube Music workflow, then switch from YouTube tab, then close", async () => {
    r = rig(); await r.ready;
    r.mgr.update(1, m({ title: "Video" }));
    await wait(250);
    r.mgr.update(2, m({ source: "youtube-music", title: "Song", creator: "Artist", artworkUrl: "https://lh3.googleusercontent.com/x=w512-h512" }));
    await wait(400);
    expect(r.handshakes.map((h) => h.client_id)).toEqual(["111111111111111111", "222222222222222222"]);
    expect(r.acts.at(-1)).toMatchObject({ type: 2, details: "Song", state: "Artist" });
    r.mgr.remove(2);
    await wait(400);
    expect(r.acts.at(-1)).toMatchObject({ type: 3, details: "Video" });
    r.mgr.remove(1);
    await wait(300);
    expect(r.acts.at(-1)).toBeUndefined();
  });
});
