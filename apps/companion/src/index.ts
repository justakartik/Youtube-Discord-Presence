import { attachNative } from "./messaging/native";
import { DiscordIpc } from "./discord/ipc";
import { PresenceHost } from "./services/host";
import { loadConfig } from "./services/config";
import { install, uninstall } from "./install";

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
    (m) => host.handle(m),
    () => {
      // Browser closed the port (or sent a bad frame): clear presence and exit.
      void host.shutdown().finally(() => process.exit(0));
    },
  );

  host = new PresenceHost({
    config: loadConfig(),
    version: VERSION,
    send,
    createClient: (clientId) => new DiscordIpc({ clientId }),
  });

  process.on("SIGTERM", () => void host.shutdown().finally(() => process.exit(0)));
  process.on("uncaughtException", () => void host.shutdown().finally(() => process.exit(1)));
}
