# Troubleshooting

| Symptom (Settings → Diagnostics) | Fix |
|---|---|
| "Companion not installed" / host not found | Run `install.ps1`; confirm registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.justakartik.youtube_discord_presence`; reload extension. |
| "Access to the native messaging host is forbidden" | Extension ID differs from `allowed_origins`; re-run `install.ps1 -ExtensionId <id>`. |
| Companion connected, Discord "disconnected" | Start Discord desktop (not browser). Discord started later is picked up automatically (retry 1→30 s). |
| "No Discord application client ID configured" | Edit `%APPDATA%\Justakartik\Presence\config.json` (`clientIds.youtube`, `clientIds.youtubeMusic`), then *Reconnect companion*. |
| Nothing on profile but status connected | Discord → Activity Privacy → share detected activities; check the toggle in the popup; paused state may be set to *Clear*. |
| No artwork | Discord may reject the image URL; set a `logo` asset in the Discord app; hide artwork in settings to confirm text works. |
| Wrong/missing title after YouTube redesign | Selectors changed; see docs/DEVELOPMENT.md. |

## Known limitations
- Untested against a live Chrome/Discord pair in this repository's CI/dev session (see DEVELOPMENT_PROGRESS.md).
- Dynamic artwork depends on Discord's media proxy accepting the URL.
- Discord shows the *application* name, so two applications are needed for "YouTube" vs "YouTube Music" naming.
- Windows only for the installer; the companion code itself is portable (Linux/macOS pipe paths implemented, untested).
- Pause/seek updates are rate-limited by Discord (≈ 1 update/15 s per client); rapid changes may lag.
- Ads on YouTube show the video's title as "buffering" with no progress.
