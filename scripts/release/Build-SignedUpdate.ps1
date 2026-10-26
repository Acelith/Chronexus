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
    # Fail before reading signing material or building an untranslated release.
    & pnpm i18n:check
    if ($LASTEXITCODE -ne 0) { throw 'Localization checks failed. No installer was built or signed.' }
    $resolvedKey = (Resolve-Path -LiteralPath $KeyFile).Path
    $resolvedPassword = (Resolve-Path -LiteralPath $PasswordFile).Path
    $publicKey = (Get-Content -LiteralPath "$resolvedKey.pub" -Raw).Trim()
    $configuration = Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
    if ($publicKey -ne $configuration.plugins.updater.pubkey) {
        throw 'The key does not match the public key embedded in Chronexus.'
    }
    $protectedPassword = (Get-Content -LiteralPath $resolvedPassword -Raw).Trim() | ConvertTo-SecureString
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $protectedPassword).Password
    if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD.Length -lt 60) {
        throw 'Key password unavailable: restore the protected copy.'
    }
    $env:TAURI_SIGNING_PRIVATE_KEY = $resolvedKey
    & pnpm icons
    if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }
    & pnpm tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw 'Signed build failed. No public channel was updated.' }
} finally {
    $env:TAURI_SIGNING_PRIVATE_KEY = $previousKey
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousPassword
    Set-Location -LiteralPath $previousDirectory
}
