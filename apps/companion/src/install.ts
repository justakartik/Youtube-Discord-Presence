import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { HOST_NAME } from "@jpresence/shared";

const KEYS = [
  "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
  "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts",
  "HKCU\\Software\\Chromium\\NativeMessagingHosts",
];

export const installDir = (env = process.env) =>
  path.join(env.LOCALAPPDATA ?? "", "Justakartik", "Presence");

export function hostManifest(exePath: string, extensionId: string) {
  return {
    name: HOST_NAME,
    description: "Justakartik YouTube Discord Presence companion",
    path: exePath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

/** Per-user install: copy this exe, write host manifest, register for Chrome/Edge/Chromium. */
export function install(extensionId: string, log: (s: string) => void): void {
  if (process.platform !== "win32") throw new Error("The installer is Windows-only.");
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error(`Invalid extension ID: ${extensionId}`);
  const dir = installDir();
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, "jpresence-host.exe");
  if (path.resolve(process.execPath).toLowerCase() !== exe.toLowerCase()) {
    fs.copyFileSync(process.execPath, exe);
  }
  const manifest = path.join(dir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifest, JSON.stringify(hostManifest(exe, extensionId), null, 2)); // no BOM
  for (const k of KEYS) {
    execFileSync("reg.exe", ["add", `${k}\\${HOST_NAME}`, "/ve", "/t", "REG_SZ", "/d", manifest, "/f"], { stdio: "ignore" });
  }
  log(`Installed to ${dir}`);
  log(`Registered for extension ${extensionId} (Chrome, Edge, Chromium).`);
}

export function uninstall(log: (s: string) => void, removeConfig = false): void {
  if (process.platform !== "win32") throw new Error("The installer is Windows-only.");
  for (const k of KEYS) {
    try {
      execFileSync("reg.exe", ["delete", `${k}\\${HOST_NAME}`, "/f"], { stdio: "ignore" });
    } catch {
      /* not registered */
    }
  }
  const dir = installDir();
  try {
    // The running exe may be this very file; schedule removal of what we can.
    for (const f of fs.readdirSync(dir)) {
      try {
        fs.rmSync(path.join(dir, f), { force: true });
      } catch {
        /* locked (running) file */
      }
    }
  } catch {
    /* nothing installed */
  }
  if (removeConfig) {
    fs.rmSync(path.join(process.env.APPDATA ?? "", "Justakartik", "Presence"), { recursive: true, force: true });
  }
  log("Justakartik YouTube Discord Presence companion removed.");
}
