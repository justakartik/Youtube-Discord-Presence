# Development

Requirements: Node 22+ (tested on 24), pnpm (`npm i -g pnpm`).

```bash
pnpm install
node scripts/gen-assets.mjs   # creates apps/extension/key.json + icons; private key goes to .secrets/ (gitignored)
pnpm typecheck && pnpm lint && pnpm test
pnpm build                    # extension -> apps/extension/dist, companion -> apps/companion/dist/host.cjs
pnpm package                  # release/ (Node SEA exe via postject)
```
Layout: `packages/shared` (pure logic) · `apps/extension` (MV3; Vite builds popup/options as pages, background as ES module, content as IIFE) · `apps/companion` · `tests/` (Vitest, jsdom for providers; Discord is faked by a real named-pipe server).

Manual dev loop: `pnpm build`, load `apps/extension/dist` unpacked, run `install.ps1` from `release/` once (or point the host manifest at `node host.cjs` via a .bat wrapper), watch `chrome://extensions` → service worker console.

Memory/leak check: `node scripts/stress.mjs` (optionally `SCALE=5`) drives the extension state manager, companion host, Discord IPC and content-script monitor through heavy churn and prints heap/handle deltas.

## Diagnostics
The companion writes `host.log` (message types and Discord connection states, no titles), `startup.log` and `last-activity.json` (the exact payload sent to Discord plus Discord's reply) next to `jpresence-host.exe`, i.e. in `%LOCALAPPDATA%\Justakartik\Presence`. They are local only and size-capped.

**Gotcha when developing from the Claude desktop app:** its shell is sandboxed (MSIX), and writes to `%LOCALAPPDATA%`/`%APPDATA%` land in a private copy that Chrome never sees. Install and inspect through a process outside the sandbox (for example a one-off Windows scheduled task, or just double-click the exe in Explorer yourself).

If YouTube changes its DOM: update selector lists at the top of `providers/youtube*.ts` and add a fixture to `tests/providers.test.ts`.
