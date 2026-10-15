import net from "node:net";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

export const enum Op {
  Handshake = 0,
  Frame = 1,
  Close = 2,
  Ping = 3,
  Pong = 4,
}

export function pipePath(n: number, platform = process.platform, env = process.env): string {
  if (platform === "win32") return `\\\\?\\pipe\\discord-ipc-${n}`;
  const base = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || "/tmp";
  return `${base.replace(/\/$/, "")}/discord-ipc-${n}`;
}

export function encodeFrame(op: number, payload: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const buf = Buffer.alloc(8 + json.length);
  buf.writeInt32LE(op, 0);
  buf.writeInt32LE(json.length, 4);
  json.copy(buf, 8);
  return buf;
}

/** Incremental frame decoder (handles partial and coalesced reads). */
export class FrameDecoder {
  private buf = Buffer.alloc(0);
  constructor(private maxFrame = 1024 * 1024) {}
  push(chunk: Buffer): { op: number; data: any }[] {
    this.buf = Buffer.concat([this.buf, chunk]);
    const out: { op: number; data: any }[] = [];
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0);
      const len = this.buf.readInt32LE(4);
      if (len < 0 || len > this.maxFrame) throw new Error("Invalid Discord frame length");
      if (this.buf.length < 8 + len) break;
      const body = this.buf.subarray(8, 8 + len).toString("utf8");
      this.buf = this.buf.subarray(8 + len);
      let data: any = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch {
        throw new Error("Invalid Discord frame JSON");
      }
      out.push({ op, data });
    }
    return out;
  }
}

export type DiscordActivity = Record<string, unknown>;

export interface DiscordLike extends EventEmitter {
  connect(): Promise<void>;
  setActivity(activity: DiscordActivity | null): Promise<void>;
  close(): void;
  readonly ready: boolean;
}

export type IpcOptions = {
  clientId: string;
  /** Candidate pipe/socket paths; defaults to discord-ipc-0..9 */
  paths?: string[];
  timeoutMs?: number;
};

/** Minimal Discord local IPC client (handshake + SET_ACTIVITY). Emits "close". */
export class DiscordIpc extends EventEmitter implements DiscordLike {
  private sock: net.Socket | null = null;
  private decoder = new FrameDecoder();
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
  ready = false;

  constructor(private opts: IpcOptions) {
    super();
  }

  async connect(): Promise<void> {
    const paths = this.opts.paths ?? Array.from({ length: 10 }, (_, i) => pipePath(i));
    let lastErr: Error = new Error("Discord IPC not found (is Discord running?)");
    for (const p of paths) {
      try {
        await this.tryConnect(p);
        return;
      } catch (e) {
        lastErr = e as Error;
      }
    }
    throw lastErr;
  }

  private tryConnect(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(path);
      const timeout = setTimeout(() => {
        sock.destroy();
        reject(new Error("Discord handshake timed out"));
      }, this.opts.timeoutMs ?? 5000);
      const fail = (e: Error) => {
        clearTimeout(timeout);
        sock.destroy();
        reject(e);
      };
      sock.once("error", fail);
      sock.once("connect", () => {
        this.sock = sock;
        this.decoder = new FrameDecoder();
        sock.write(encodeFrame(Op.Handshake, { v: 1, client_id: this.opts.clientId }));
      });
      sock.on("data", (chunk: Buffer) => {
        let frames;
        try {
          frames = this.decoder.push(chunk);
        } catch (e) {
          return fail(e as Error);
        }
        for (const f of frames) {
          if (f.op === Op.Ping) sock.write(encodeFrame(Op.Pong, f.data));
          else if (f.op === Op.Close) {
            if (!this.ready) return fail(new Error(`Discord closed: ${f.data?.message ?? "unknown"}`));
            sock.end();
          } else if (f.op === Op.Frame) {
            if (f.data?.evt === "READY" && !this.ready) {
              this.ready = true;
              clearTimeout(timeout);
              sock.removeListener("error", fail);
              sock.on("error", () => {});
              resolve();
            } else if (f.data?.evt === "ERROR" && !this.ready) {
              fail(new Error(f.data?.data?.message ?? "Discord error"));
            } else if (f.data?.nonce && this.pending.has(f.data.nonce)) {
              const p = this.pending.get(f.data.nonce)!;
              this.pending.delete(f.data.nonce);
              if (f.data.evt === "ERROR") p.reject(new Error(f.data.data?.message ?? "Discord error"));
              else p.resolve();
            }
          }
        }
      });
      sock.on("close", () => {
        const wasReady = this.ready;
        this.ready = false;
        this.sock = null;
        for (const p of this.pending.values()) p.reject(new Error("Discord connection closed"));
        this.pending.clear();
        if (wasReady) this.emit("close");
      });
    });
  }

  setActivity(activity: DiscordActivity | null): Promise<void> {
    if (!this.sock || !this.ready) return Promise.reject(new Error("Not connected to Discord"));
    const nonce = randomUUID();
    const sock = this.sock;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error("Discord did not acknowledge activity"));
      }, 5000);
      this.pending.set(nonce, {
        resolve: () => (clearTimeout(t), resolve()),
        reject: (e) => (clearTimeout(t), reject(e)),
      });
      sock.write(
        encodeFrame(Op.Frame, {
          cmd: "SET_ACTIVITY",
          args: { pid: process.pid, activity: activity ?? undefined },
          nonce,
        }),
      );
    });
  }

  close(): void {
    this.ready = false;
    this.sock?.destroy();
    this.sock = null;
  }
}
