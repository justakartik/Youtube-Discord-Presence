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

## Open issue (as of 2026-10-15 night)
Buttons ("Watch/Listen Along", "GitHub") and the play/pause badge do not show when presence comes from the browser, but DO work when the installed exe is driven directly (probe script sends a setActivity; Discord's reply accepted buttons, badge asset and proxied image).
- Finding: Chrome-launched `jpresence-host.exe` processes never wrote `host.log` / `last-activity.json`, while direct and `cmd /c`-wrapped launches did. Presence text/progress still appears in Discord from the browser path, so it is unclear which process publishes it.
- Suspects: (1) Chrome launches the host with a stripped environment; diagnostics now write next to the exe (`path.dirname(process.execPath)`), build installed, but still no log after 100 s with no reload of the extension; (2) the extension's background worker may be asleep and not relaunching the host; (3) an older activity may be lingering in Discord.
- Next: reload extension + YouTube tab, play 15 s, read `%LOCALAPPDATA%\Justakartik\Presence\host.log` and `last-activity.json`; check the extension service-worker console for errors; confirm which process holds the Discord pipe.
- Not yet in a GitHub release: the diagnostics build (release v0.1.0 contains the earlier exe).

## Blocked / needs the user
- Create two Discord applications and supply client IDs.
- Live verification in Chrome with Discord running.
