<#
 Justakartik Browser Presence - companion installer (per-user, no admin needed).
 Usage: powershell -ExecutionPolicy Bypass -File install.ps1 [-YouTubeClientId <id>] [-MusicClientId <id>] [-ExtensionId <id>]
#>
param(
  [string]$ExtensionId = "__EXTENSION_ID__",
  [string]$YouTubeClientId = "",
  [string]$MusicClientId = ""
)
$ErrorActionPreference = "Stop"
$HostName = "com.justakartik.youtube_discord_presence"
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$exeSrc = Join-Path $src "jpresence-host.exe"
if (-not (Test-Path $exeSrc)) { throw "jpresence-host.exe not found next to install.ps1" }
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw "Invalid extension ID '$ExtensionId'" }

$dir = Join-Path $env:LOCALAPPDATA "Justakartik\Presence"
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item $exeSrc (Join-Path $dir "jpresence-host.exe") -Force

$manifestPath = Join-Path $dir "$HostName.json"
$manifest = [ordered]@{
  name = $HostName
  description = "Justakartik Browser Presence companion"
  path = (Join-Path $dir "jpresence-host.exe")
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
# UTF-8 without BOM (Chrome rejects a BOM)
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))

foreach ($root in @("HKCU:\Software\Google\Chrome\NativeMessagingHosts", "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts", "HKCU:\Software\Chromium\NativeMessagingHosts")) {
  $key = Join-Path $root $HostName
  New-Item -Path $key -Force | Out-Null
  Set-ItemProperty -Path $key -Name "(default)" -Value $manifestPath
}

$cfgDir = Join-Path $env:APPDATA "Justakartik\Presence"
New-Item -ItemType Directory -Force $cfgDir | Out-Null
$cfg = Join-Path $cfgDir "config.json"
if ($YouTubeClientId -or $MusicClientId -or -not (Test-Path $cfg)) {
  $obj = [ordered]@{ clientIds = [ordered]@{ youtube = $YouTubeClientId; youtubeMusic = $MusicClientId } }
  [IO.File]::WriteAllText($cfg, ($obj | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
}
Write-Host "Installed. Native host registered for extension $ExtensionId."
Write-Host "Config: $cfg  (set your Discord application client IDs, see docs/INSTALLATION.md)"
Write-Host "Reload the extension in your browser."
