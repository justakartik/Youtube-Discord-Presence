# Development progress

Statuses: Not started · In progress · Implemented · Tested · Blocked. "Tested" = automated tests pass; live = real Chrome + real Discord.

| Task | Status | Files | Tests / results | Known issues / next |
|---|---|---|---|---|
| Self-development prompt | Implemented | docs/SELF_DEVELOPMENT_PROMPT.md | n/a | — |
| Monorepo, TS strict, Vite, Tailwind, Vitest, ESLint | Tested | root configs, build scripts | typecheck/lint/build clean | — |
| Shared logic (validation, selection, activity, artwork, settings) | Tested | packages/shared | tests/shared.test.ts | — |
| YouTubeProvider | Tested (jsdom fixtures) | providers/youtube.ts | title/channel/thumb/live/shorts/ads/stale-nav | **Live selectors unverified on real YouTube** |
| YouTubeMusicProvider | Tested (jsdom fixtures) | providers/youtubeMusic.ts | track change, stale mediaSession, artwork | **Live selectors unverified** |
| MediaMonitor (events, seek, heartbeat) | Tested | content/monitor.ts | tests/providers.test.ts | SPA events fire only in real page |
| Background PresenceManager, multi-tab, reconnect | Tested | background/presence.ts | tests/background.test.ts | MV3 worker restart path (`storage.session` restore) untested |
| Companion: Discord IPC, host, native framing | Tested vs fake Discord | apps/companion | tests/companion.test.ts, e2e.test.ts | **Real Discord unverified**; auth-less SET_ACTIVITY relies on known IPC behaviour (docs describe AUTHORIZE for general RPC) |
| Pipeline ext→companion→Discord (both sources) | Tested (fake Discord) | tests/e2e.test.ts | pass; found & fixed epoch-timestamp validation bug | — |
| Popup + options UI | Implemented | popup/, options/ | built; no rendering tests | Add React Testing Library tests; visual QA in Chrome pending |
| Packaging: extension zip, SEA exe, install/uninstall.ps1 | Tested (exe stdio smoke) | scripts/package.mjs, installer/ | tests/packaged-exe.test.ts | install.ps1/uninstall.ps1 **not executed** here; exe unsigned |
| Docs | Implemented | docs/, README | — | — |
| Dependency audit | Tested | — | `pnpm audit`: none known | — |

## Blocked / needs the user
- Create two Discord applications and supply client IDs.
- Live verification in Chrome with Discord running.
