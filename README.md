# Justakartik YouTube Discord Presence

Spotify-style Discord activity for **YouTube** and **YouTube Music**: title, channel/artist, real thumbnail/album art, and a progress bar — updated automatically, processed locally.

```
YouTube / YouTube Music tab ──► Chrome extension (MV3) ──native messaging──► companion (jpresence-host.exe) ──local IPC──► Discord desktop
```

Why a companion? Discord only accepts Rich Presence over a *local* named pipe; a browser extension cannot open one, and Discord OAuth2 does not allow changing presence of a user account. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start (Windows)
```bash
pnpm install
node scripts/gen-assets.mjs     # icons + pinned extension key (first time)
pnpm package                    # builds, tests-free packaging into release/
```
Then follow [docs/INSTALLATION.md](docs/INSTALLATION.md) (load the extension, create two Discord applications, run `install.ps1`).

## Commands
| | |
|---|---|
| `pnpm test` | all automated tests (Vitest) |
| `pnpm build` | build extension (`apps/extension/dist`) and bundle companion |
| `pnpm typecheck` / `pnpm lint` | strict TS / ESLint |
| `pnpm package` | `release/` with extension zip, `jpresence-host.exe`, install/uninstall scripts |

## Status
Automated tests cover detection logic, selection, activity building, protocol, Discord IPC (against a fake Discord pipe), reconnection, and the packaged exe over real stdio framing. **Not yet verified against a real Chrome + real Discord** — see [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) and "Known limitations" in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

Docs: [Self-development prompt](docs/SELF_DEVELOPMENT_PROMPT.md) · [Architecture](docs/ARCHITECTURE.md) · [Installation](docs/INSTALLATION.md) · [Development](docs/DEVELOPMENT.md) · [Security](docs/SECURITY.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Release](docs/RELEASE.md)
