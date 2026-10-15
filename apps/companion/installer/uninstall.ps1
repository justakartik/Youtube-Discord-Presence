param([switch]$RemoveConfig)
$ErrorActionPreference = "SilentlyContinue"
$HostName = "com.justakartik.youtube_discord_presence"
Get-Process jpresence-host | Stop-Process -Force
foreach ($root in @("HKCU:\Software\Google\Chrome\NativeMessagingHosts", "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts", "HKCU:\Software\Chromium\NativeMessagingHosts")) {
  Remove-Item -Path (Join-Path $root $HostName) -Recurse -Force
}
Remove-Item -Path (Join-Path $env:LOCALAPPDATA "Justakartik\Presence") -Recurse -Force
if ($RemoveConfig) { Remove-Item -Path (Join-Path $env:APPDATA "Justakartik\Presence") -Recurse -Force }
Write-Host "Justakartik YouTube Discord Presence companion removed."
