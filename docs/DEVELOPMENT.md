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

If YouTube changes its DOM: update selector lists at the top of `providers/youtube*.ts` and add a fixture to `tests/providers.test.ts`.
