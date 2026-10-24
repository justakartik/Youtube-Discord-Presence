# Self-Development Prompt — Justakartik Browser Presence

## 1. Product goal
Show what the user watches on YouTube or listens to on YouTube Music as a Discord activity (Watching / Listening, with title, creator, artwork, progress bar), automatically, locally, privately.

## 2. Required features
YouTube/Shorts/live detection; YouTube Music detection; shared `MediaState`; multi-tab selection; configurable activity text; artwork; pause/ended handling; reconnect; privacy controls; popup + options UI; diagnostics; installer.

## 3. Architecture (decided after research)
Discord's documented RPC is a *local* transport (named pipe `\\?\pipe\discord-ipc-N`, handshake opcode 0 with `client_id`, then `SET_ACTIVITY` frames). A web page/extension cannot open named pipes, and Discord's OAuth2 does not grant presence control over a user account. Therefore:

`content script (provider) → background service worker (state manager, selector, presence builder) → Chrome Native Messaging → companion (Node, single-file exe) → Discord IPC`.

- Shared pure logic (types, validation, selection, activity building, artwork URL rules) in `packages/shared`, fully unit-tested.
- Companion has no HTTP server, no dependencies on third-party RPC libs (the IPC framing is ~100 lines; owning it removes supply-chain risk).
- Stack: MV3, React, TS strict, Vite, Tailwind 4, lucide, Vitest, pnpm workspaces.
- Discord identity: Discord shows the *application name* ("Watching YouTube"). Two Discord applications (YouTube, YouTube Music) are supported via two client IDs; client IDs are public identifiers, not secrets, and live in the user's companion config, never in the extension.

## 4. Research requirements
Verify: Discord IPC handshake/pipe names/activity types/external image URLs (done: docs.discord.com RPC + gateway-events); MV3 + native messaging (`connectNative`, 1 MB host→browser, 4-byte LE length framing, `allowed_origins`); Media Session API; Windows HKCU registration of native hosts.

## 5. Phases
1. Scaffold monorepo. 2. Shared logic + tests. 3. Providers + tests (jsdom). 4. Companion (Discord IPC client, native framing, host) + tests using a fake Discord pipe server. 5. Extension background/popup/options. 6. Packaging (extension zip, companion exe via Node SEA, PowerShell install/uninstall). 7. Docs, audit, final verification.

## 6. Integration requirements
Versioned JSON protocol `{v:1,type,...}`; types: `hello`, `setActivity`, `clearActivity`, `status`, `ping/pong`. Companion replies with `status` (discord connected / error).

## 7. Security & privacy
Least permissions (`storage`, `nativeMessaging`, host perms for youtube only); sender validation on every runtime message; size limits (64 KB); URL allow-list (https youtube/ytimg/googleusercontent only); no tokens, no user-token APIs, no telemetry, no history by default; native host restricted to the extension ID derived from the pinned manifest key; logs sanitized.

## 8. Testing
Vitest: shared logic, providers (jsdom), native framing, Discord client against a fake pipe server, companion host end-to-end with fake Discord, extension settings merging. Manual (documented, not claimed): real Chrome + real Discord; installer on a clean machine.

## 9. Packaging
`pnpm build`, `pnpm package` → `release/extension.zip`, `release/companion/jpresence-host.exe`, `install.ps1`, `uninstall.ps1`.

## 10. Acceptance criteria
Builds clean; all automated tests pass; manifest references exist in dist; companion framing/IPC verified against fake Discord; all unverified live behaviour listed in `DEVELOPMENT_PROGRESS.md`.

## 11. Risks
YouTube DOM churn (mitigated by Media Session + `<video>` + multiple fallbacks); Discord assets proxying of external URLs may reject some URLs (fallback to logo asset key); SW lifetime (native port keeps alive; state mirrored in `storage.session`); SEA build tooling on Windows; no ability here to run real Discord/Chrome.

## 12. Debugging rules
Reproduce with a test first, fix root cause, rerun full suite.

## 13. Incomplete work reporting
Anything not run against real Chrome/Discord is labelled "Implemented", not "Tested".

## 14. Definition of completion
All items in the brief's Definition of Done either satisfied with evidence, or explicitly listed as unverified/limited.
