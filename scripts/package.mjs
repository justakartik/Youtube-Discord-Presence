// Builds everything and assembles release/: extension.zip + companion exe + installer scripts.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" && /^(pnpm|npx)$/.test(cmd) });
const { id } = JSON.parse(fs.readFileSync(path.join(root, "apps/extension/key.json"), "utf8"));

run("node", ["scripts/gen-assets.mjs"]);
run("pnpm", ["build"]);

const rel = path.join(root, "release");
fs.mkdirSync(rel, { recursive: true });
for (const f of fs.readdirSync(rel)) { try { fs.rmSync(path.join(rel, f), { recursive: true, force: true }); } catch { /* locked by Explorer: overwritten below */ } }
fs.mkdirSync(path.join(rel, "companion"), { recursive: true });

// extension zip (bsdtar ships with Windows 10+)
run(process.platform === "win32" ? "C:/Windows/System32/tar.exe" : "tar", ["-a", "-c", "-f", path.join(rel, "justakartik-presence-extension.zip"), "-C", path.join(root, "apps/extension/dist"), "."]);

// companion single executable (Node SEA)
const comp = path.join(root, "apps/companion");
const blob = path.join(comp, "dist/sea.blob");
fs.writeFileSync(path.join(comp, "dist/sea-config.json"), JSON.stringify({ main: "dist/host.cjs", output: "dist/sea.blob", disableExperimentalSEAWarning: true }));
run(process.execPath, ["--experimental-sea-config", "dist/sea-config.json"], comp);
const exe = path.join(rel, "companion/jpresence-host.exe");
fs.copyFileSync(process.execPath, exe);
run("npx", ["postject", `"${exe}"`, "NODE_SEA_BLOB", `"${blob}"`, "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"]);

for (const f of ["install.ps1", "uninstall.ps1"]) {
  const t = fs.readFileSync(path.join(comp, "installer", f), "utf8").replaceAll("__EXTENSION_ID__", id);
  fs.writeFileSync(path.join(rel, "companion", f), t);
}
fs.writeFileSync(path.join(rel, "EXTENSION_ID.txt"), id + "\n");
console.log("release ready:", rel, "extension id:", id);
