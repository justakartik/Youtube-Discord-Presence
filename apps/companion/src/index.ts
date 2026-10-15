import { attachNative } from "./messaging/native";
import { DiscordIpc } from "./discord/ipc";
import { PresenceHost } from "./services/host";
import { loadConfig } from "./services/config";

const VERSION = "0.1.0";

if (process.argv.includes("--version")) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

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
