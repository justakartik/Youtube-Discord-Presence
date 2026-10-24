# Architecture

## Decision record: why extension + companion
Sources: Discord RPC docs (docs.discord.com/developers/topics/rpc) and Activity object docs.
- Rich Presence is set over Discord's local IPC (`\\?\pipe\discord-ipc-N`; handshake opcode 0 with `client_id`, then `SET_ACTIVITY` frames). Extensions cannot open named pipes.
- Discord's OAuth2 scopes do not grant remote control of a user's presence; user tokens/self-bots are prohibited and not used.
- Therefore: Chrome Native Messaging launches a small companion that talks to Discord IPC. No HTTP server is exposed.

## Components
| Piece | Location | Role |
|---|---|---|
| `YouTubeProvider`, `YouTubeMusicProvider`, `MediaProviderRegistry` | `apps/extension/src/providers` | Read metadata from the page (DOM selectors with fallbacks, Media Session, `<video>` state). Return a validated `MediaState`; return `null` rather than stale data. |
| `MediaMonitor` | `src/content/monitor.ts` | Media events, SPA navigation events, title MutationObserver, 3 s fallback poll; dedupes, detects seeks, 15 s heartbeat. |
| `PresenceManager` (state manager + `ActiveMediaSelector` + native port) | `src/background/presence.ts` | Per-tab state, selection, activity building, duplicate suppression, reconnect/backoff, expiry of silent tabs. |
| `selectActive`, `buildActivity`, `ArtworkResolver` (`artwork.ts`), `normalizeSettings` | `packages/shared` | Pure, unit-tested logic shared by both sides. |
| `PresenceHost`, `DiscordIpc`, native framing | `apps/companion/src` | Validates every message, maintains the Discord IPC connection per Discord application, retries with backoff, clears on shutdown. |

## Protocol (v1, JSON, 4-byte LE length framing, 64 KB cap)
Extension → companion: `hello`, `setActivity`, `clearActivity`, `ping`. Companion → extension: `hello` (version, configured), `status` (discord state, last update, error), `pong`. Unknown versions/types are rejected.

## Discord identity
Discord renders "Watching/Listening to **{application name}**". Two Discord applications ("YouTube", "YouTube Music") are therefore supported; the companion switches IPC client when the source changes. If only one client ID is configured it is used for both. Client IDs are public identifiers stored in `%APPDATA%\Justakartik\Presence\config.json`, never in the extension.

## Artwork
YouTube: `https://i.ytimg.com/vi/<id>/hqdefault.jpg` (the real thumbnail for the current video id; works for Shorts/live). YouTube Music: largest Media Session artwork or player-bar image, upgraded to 512×512. URLs are restricted to ytimg/googleusercontent/ggpht over https and sent as `large_image`; per Discord's docs external URLs are accepted via the media proxy. If no artwork, asset key `logo` is used (upload one to your Discord app for a branded fallback). Not verified live; see limitations.

## Multi-tab selection
playing > buffering > paused; then preferred site; then most recently started playing; then most recent update; then lowest tab id. Tabs silent for 45 s are dropped.

## Websites (v0.2)
`WebProvider` (extension/src/providers/web.ts) runs in a dynamically registered content script (`webcontent.js`, see background/webScripts.ts) on sites the user granted. It maps the URL to a `MediaState` with `source: "web"`, a fixed label as `title`, `siteName`, an activity type and the site favicon. `buildActivity` turns that into an activity whose Discord `name` is the site (Discord honours an activity-level `name`, verified against the live client), with an elapsed timer, no badge, no buttons, no URL. The companion reuses the YouTube Discord application (or `clientIds.web` if set), so switching between YouTube and a site needs no reconnect.
