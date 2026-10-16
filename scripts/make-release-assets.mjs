// Assembles release/github (the files attached to a GitHub release) after `pnpm package`.
// Writes SHA256SUMS.txt, which install.ps1 verifies before installing anything.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = path.join(root, "release");
const out = path.join(rel, "github");
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(rel, "companion/jpresence-host.exe"), path.join(out, "JustakartikPresence.exe"));
fs.copyFileSync(path.join(rel, "justakartik-presence-extension.zip"), path.join(out, "justakartik-presence-extension.zip"));
execFileSync("node", ["scripts/gen-discord-assets.mjs"], { cwd: root, stdio: "ignore" });
const tar = process.platform === "win32" ? "C:/Windows/System32/tar.exe" : "tar";
execFileSync(tar, ["-a", "-c", "-f", path.join(out, "discord-assets.zip"), "-C", path.join(rel, "discord-assets"), "play.png", "pause.png", "logo.png"]);

const names = ["JustakartikPresence.exe", "justakartik-presence-extension.zip", "discord-assets.zip"];
const lines = names.map((n) => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(out, n))).digest("hex")}  ${n}`);
fs.writeFileSync(path.join(out, "SHA256SUMS.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
