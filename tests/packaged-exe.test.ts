import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { encodeMessage, NativeReader } from "../apps/companion/src/messaging/native";

const exe = path.resolve(__dirname, "../release/companion/jpresence-host.exe");

// Runs only after `pnpm package` (skipped otherwise).
describe.skipIf(!fs.existsSync(exe))("packaged companion exe (real native-messaging framing over stdio)", () => {
  it("answers hello/ping, rejects garbage, and exits when the browser closes the pipe", async () => {
    const child = spawn(exe, [], { stdio: ["pipe", "pipe", "pipe"] });
    const reader = new NativeReader();
    const got: any[] = [];
    child.stdout.on("data", (c) => got.push(...reader.push(c)));
    child.stdin.write(encodeMessage({ v: 1, type: "hello", extensionVersion: "t" }));
    child.stdin.write(encodeMessage({ v: 1, type: "ping" }));
    child.stdin.write(encodeMessage({ v: 1, type: "rm -rf" }));
    await new Promise((r) => setTimeout(r, 1500));
    const exited = new Promise<number | null>((r) => child.on("exit", (c) => r(c)));
    child.stdin.end();
    const code = await Promise.race([exited, new Promise<string>((r) => setTimeout(() => r("timeout"), 5000))]);
    if (code === "timeout") child.kill();
    expect(got.find((m) => m.type === "hello")).toMatchObject({ v: 1, companionVersion: "0.3.0" });
    expect(got.some((m) => m.type === "pong")).toBe(true);
    expect(got.some((m) => m.type === "status" && /invalid/i.test(m.error ?? ""))).toBe(true);
    expect(code).toBe(0);
  }, 20000);
});
