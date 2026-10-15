import type { Readable, Writable } from "node:stream";
import { MAX_MESSAGE_BYTES } from "@jpresence/shared";

export function encodeMessage(msg: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(msg), "utf8");
  const out = Buffer.alloc(4 + json.length);
  out.writeUInt32LE(json.length, 0);
  json.copy(out, 4);
  return out;
}

/** Chrome native messaging reader: 4-byte LE length + UTF-8 JSON. Size-limited. */
export class NativeReader {
  private buf = Buffer.alloc(0);
  push(chunk: Buffer): unknown[] {
    this.buf = Buffer.concat([this.buf, chunk]);
    const out: unknown[] = [];
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32LE(0);
      if (len > MAX_MESSAGE_BYTES) throw new Error(`Message too large: ${len}`);
      if (this.buf.length < 4 + len) break;
      const body = this.buf.subarray(4, 4 + len).toString("utf8");
      this.buf = this.buf.subarray(4 + len);
      try {
        out.push(JSON.parse(body));
      } catch {
        out.push(undefined); // invalid JSON -> rejected by validator
      }
    }
    return out;
  }
}

export function attachNative(
  input: Readable,
  output: Writable,
  onMessage: (m: unknown) => void,
  onEnd: (err?: Error) => void,
): (msg: unknown) => void {
  const reader = new NativeReader();
  input.on("data", (c: Buffer) => {
    try {
      for (const m of reader.push(c)) onMessage(m);
    } catch (e) {
      onEnd(e as Error);
    }
  });
  input.on("end", () => onEnd());
  input.on("error", (e) => onEnd(e));
  return (msg) => {
    const b = encodeMessage(msg);
    // Host -> browser messages are limited to 1 MB by Chrome; ours are tiny.
    if (b.length <= 1024 * 1024) output.write(b);
  };
}
