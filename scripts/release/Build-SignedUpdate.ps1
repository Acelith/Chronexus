# Builds signed app-only updater artifacts. Private key/password never enter Git.
[CmdletBinding()]
param(
    [string]$KeyFile = '.tools/signing/chronexus-update-protected.key',
    [string]$PasswordFile = '.tools/signing/password.dpapi'
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$previousDirectory = Get-Location
$previousKey = $env:TAURI_SIGNING_PRIVATE_KEY
$previousPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
try {
    Set-Location -LiteralPath $projectRoot
    $resolvedKey = (Resolve-Path -LiteralPath $KeyFile).Path
    $resolvedPassword = (Resolve-Path -LiteralPath $PasswordFile).Path
    $publicKey = (Get-Content -LiteralPath "$resolvedKey.pub" -Raw).Trim()
    $configuration = Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
    if ($publicKey -ne $configuration.plugins.updater.pubkey) {
        throw 'La chiave non corrisponde alla chiave pubblica incorporata in Chronexus.'
    }
    $protectedPassword = (Get-Content -LiteralPath $resolvedPassword -Raw).Trim() | ConvertTo-SecureString
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $protectedPassword).Password
    if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD.Length -lt 60) {
        throw 'Password della chiave non disponibile: ripristina la copia protetta.'
    }
    $env:TAURI_SIGNING_PRIVATE_KEY = $resolvedKey
    & pnpm icons
    if ($LASTEXITCODE -ne 0) { throw 'Generazione icone non riuscita.' }
    & pnpm tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw 'Build firmata non riuscita. Nessun canale pubblico aggiornato.' }
} finally {
    $env:TAURI_SIGNING_PRIVATE_KEY = $previousKey
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousPassword
    Set-Location -LiteralPath $previousDirectory
}
