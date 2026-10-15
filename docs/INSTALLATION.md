# Installation (Windows, Chrome/Edge)

Prerequisite: Discord **desktop** app running (not the web client). Node.js is **not** needed for the packaged build.

## 1. Create the Discord applications (once)
1. Open https://discord.com/developers/applications → *New Application*.
2. Name it **YouTube** (this name appears in "Watching YouTube"). Copy the *Application ID*.
3. Repeat with the name **YouTube Music**.
4. Optional: in *Rich Presence → Art Assets* upload an image with key `logo` (fallback when no artwork exists).
5. In Discord: *User Settings → Activity Privacy* → enable "Share your detected activities".

## 2. Load the extension
1. Unzip `release/justakartik-presence-extension.zip` to a permanent folder (or use `apps/extension/dist`).
2. `chrome://extensions` → enable *Developer mode* → *Load unpacked* → pick the folder.
3. The extension ID is pinned by the manifest key and must equal `release/EXTENSION_ID.txt` (currently `fjlejmpbehpjmaihbpoilaefbnbfkdmc`).

## 3. Install the companion
```bash
powershell -ExecutionPolicy Bypass -File release/companion/install.ps1 -YouTubeClientId <id> -MusicClientId <id>
```
This copies `jpresence-host.exe` to `%LOCALAPPDATA%\Justakartik\Presence`, writes the native host manifest (allowed only for the extension ID above), registers it under HKCU for Chrome, Edge and Chromium, and writes `%APPDATA%\Justakartik\Presence\config.json`. No admin rights needed. Reload the extension afterwards.

The companion is launched and stopped by the browser automatically, so there is no startup entry.

## 4. Use
Open YouTube or YouTube Music and play something. The popup shows Companion and Discord status.

## Uninstall
```bash
powershell -ExecutionPolicy Bypass -File release/companion/uninstall.ps1 -RemoveConfig
```
Then remove the extension in `chrome://extensions`.

## Chrome Web Store
Upload the zip. The store assigns its own extension ID unless you upload with the same key; re-run `install.ps1 -ExtensionId <store id>` (or add the store origin to `allowed_origins`).
