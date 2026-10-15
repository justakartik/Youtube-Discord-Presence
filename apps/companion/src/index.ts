import fs from "node:fs";
import path from "node:path";
import { attachNative } from "./messaging/native";
import { DiscordIpc } from "./discord/ipc";
import { PresenceHost } from "./services/host";
import { loadConfig } from "./services/config";
import { install, installDir, uninstall } from "./install";

const VERSION = "0.1.0";
const EXT_ID = typeof __EXT_ID__ !== "undefined" ? __EXT_ID__ : "";
const args = process.argv.slice(2);
const log = (s: string) => process.stdout.write(`${s}\n`);

function arg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function pause() {
  // Double-clicked from Explorer: keep the console open so the user can read the result.
  if (process.stdin.isTTY) {
    log("\nPress any key to close...");
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once("data", () => process.exit(0));
  }
}

if (args.includes("--version")) {
  log(VERSION);
  process.exit(0);
} else if (args.includes("--uninstall")) {
  try {
    uninstall(log, args.includes("--remove-config"));
  } catch (e) {
    log(`Failed: ${(e as Error).message}`);
  }
  pause();
} else if (args.includes("--install") || process.stdin.isTTY) {
  // Run by a person (console attached) rather than by the browser (stdin is a pipe).
  try {
    install(arg("--extension-id") ?? EXT_ID, log);
    log("\nNext: load the extension (chrome://extensions -> Load unpacked), then reload it.");
  } catch (e) {
    log(`Install failed: ${(e as Error).message}`);
  }
  pause();
} else {
  runHost();
}

function runHost() {
  // eslint-disable-next-line prefer-const -- assigned after `send` exists (mutual reference)
  let host: PresenceHost;
  const send = attachNative(
    process.stdin,
    process.stdout,
    (m) => {
      dlog(`recv ${(m as { type?: string } | undefined)?.type ?? "invalid"}`);
      host.handle(m);
    },
    (err) => {
      dlog(`port closed${err ? `: ${err.message}` : ""}`);
      // Browser closed the port (or sent a bad frame): clear presence and exit.
      void host.shutdown().finally(() => process.exit(0));
    },
  );

  // Local diagnostics only (message types and statuses, never titles); size-capped.
  const logFile = path.join(path.dirname(process.execPath), "host.log");
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 100_000) fs.rmSync(logFile);
  } catch {
    /* ignore */
  }
  function dlog(line: string) {
    try {
      fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
    } catch {
      /* ignore */
    }
  }
  dlog(`host started v${VERSION}`);

  host = new PresenceHost({
    config: loadConfig(),
    version: VERSION,
    send: (r) => {
      dlog(`send ${r.type}${r.type === "status" ? ` discord=${r.discord}${r.error ? ` error=${r.error}` : ""}` : ""}`);
      send(r);
    },
    onSent: (payload, response) => {
      // Local-only diagnostics: overwritten on each update, never transmitted.
      try {
        fs.writeFileSync(
          path.join(path.dirname(process.execPath), "last-activity.json"),
          JSON.stringify({ at: new Date().toISOString(), sent: payload, discordReply: response }, null, 2),
        );
      } catch {
        /* diagnostics must never break presence */
      }
    },
    createClient: (clientId) => new DiscordIpc({ clientId }),
  });

  process.on("SIGTERM", () => void host.shutdown().finally(() => process.exit(0)));
  process.on("uncaughtException", () => void host.shutdown().finally(() => process.exit(1)));
}
