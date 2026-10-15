# Security & privacy

- Permissions: `storage`, `nativeMessaging`; host access only to youtube.com / music.youtube.com / m.youtube.com.
- No remote code; CSP `script-src 'self'`. No telemetry; no listening history stored. Media metadata flows only tab → extension → local companion → local Discord.
- Messages: background accepts media only from content scripts of this extension on YouTube origins with a tab id, and UI commands only from extension pages. All payloads are re-validated (`normalizeMedia`, `validateHostRequest`): control characters stripped, lengths capped, URLs limited to https + YouTube/ytimg/googleusercontent hosts.
- Native host: manifest `allowed_origins` contains only the extension origin; every message is size-capped (64 KB) and schema-validated; no network listener. Client IDs are public identifiers; there are no secrets in the extension.
- Not used: Discord user tokens, self-bots, token scraping, undocumented endpoints, Discord client modification.
- Local data: settings in `chrome.storage.sync`; "Clear locally stored metadata" empties session/local storage and clears presence.
- Dependencies audited with `pnpm audit` (no known vulnerabilities at time of writing). The companion exe is an unsigned Node SEA binary; Windows SmartScreen may warn. Code-signing is a release TODO.
- Artwork URLs are sent to Discord, whose media proxy fetches them; the image URL reveals which video/track is shown (same as the activity text itself).
