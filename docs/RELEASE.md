# Release

1. Bump `version` in `apps/extension/package.json` and `apps/companion/src/index.ts` (`VERSION`).
2. `pnpm install && pnpm typecheck && pnpm lint && pnpm test`.
3. `pnpm package` → `release/`:
   - `justakartik-presence-extension.zip` (Chrome Web Store upload; remove `key` from the manifest only if the store rejects it)
   - `companion/jpresence-host.exe`, `install.ps1`, `uninstall.ps1`
   - `EXTENSION_ID.txt`
4. `pnpm test` again (the packaged-exe test runs once `release/` exists).
5. Manual checklist (not automated): install on a clean Windows profile; YouTube + YouTube Music + Discord restart + Chrome restart; uninstall leaves no registry keys.
6. Optional: code-sign `jpresence-host.exe` before distribution.
