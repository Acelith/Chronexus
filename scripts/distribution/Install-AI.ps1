param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
function Get-Sha256([string]$Path) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
try {
    $sourceRoot = [IO.Path]::GetFullPath($Source).TrimEnd('\')
    $targetRoot = [IO.Path]::GetFullPath($Destination).TrimEnd('\')
    function Assert-NoReparse([string]$Path) {
        for ($p=$Path; $p; $p=Split-Path $p -Parent) {
            if ((Test-Path -LiteralPath $p) -and ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Percorso simbolico non consentito.' }
        }
    }
    Assert-NoReparse $sourceRoot
    Assert-NoReparse $targetRoot
    if ($targetRoot -eq [IO.Path]::GetPathRoot($targetRoot).TrimEnd('\') -or $targetRoot.StartsWith($sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Cartella di destinazione non valida.' }
    $manifestPath = Join-Path $sourceRoot 'bundle.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.bundleId -ne 'chronexus-ai-ollama-0.40.10-qwen3-4b-instruct' -or $manifest.files.Count -lt 2) { throw 'Manifest AI non valido.' }
    if (Test-Path -LiteralPath $targetRoot) {
        $marker = Join-Path $targetRoot 'bundle.json'
        if (!(Test-Path -LiteralPath $marker) -or (Get-Sha256 $marker) -ne (Get-Sha256 $manifestPath)) { throw 'La destinazione contiene altri dati: scegli una cartella nuova.' }
    }
    foreach ($file in $manifest.files) {
        if ($file.path -notmatch '^[a-zA-Z0-9_./+-]+$' -or $file.path -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($file.path)) { throw 'Percorso non valido nel manifest.' }
        $from = [IO.Path]::GetFullPath((Join-Path $sourceRoot $file.path))
        $to = [IO.Path]::GetFullPath((Join-Path $targetRoot $file.path))
        if (!$from.StartsWith($sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or !$to.StartsWith($targetRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Percorso fuori dal pacchetto.' }
        $item = Get-Item -LiteralPath $from
        Assert-NoReparse $from
        Assert-NoReparse $to
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $file.size -or (Get-Sha256 $from) -ne $file.sha256) { throw "File del pacchetto alterato o incompleto: $($file.path)" }
        if (Test-Path -LiteralPath $to) {
            if ((Get-Item -LiteralPath $to).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Destinazione simbolica non consentita.' }
            if ((Get-Sha256 $to) -ne $file.sha256) { throw "File esistente diverso: $($file.path). Nessun file sovrascritto." }
        }
    }
    # Validate every file and every destination before copying anything.
    foreach ($file in $manifest.files) {
        $to = Join-Path $targetRoot $file.path
        if (!(Test-Path -LiteralPath $to)) {
            New-Item -ItemType Directory -Path (Split-Path $to -Parent) -Force | Out-Null
            $inputFile = [IO.File]::OpenRead((Join-Path $sourceRoot $file.path))
            try {
                $outputFile = [IO.File]::Open($to,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
                try { $inputFile.CopyTo($outputFile); $outputFile.Flush($true) } finally { $outputFile.Dispose() }
            } finally { $inputFile.Dispose() }
            if ((Get-Sha256 $to) -ne $file.sha256) { throw "Copia non riuscita: $($file.path)" }
        }
    }
    Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $targetRoot 'bundle.json')
    Write-Output 'AI installata. Nessun download, account o modifica alle campagne.'
    exit 0
} catch { Write-Error $_; exit 1 }
