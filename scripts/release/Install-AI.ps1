param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Hash([string]$Path) {
    $algorithm=[Security.Cryptography.SHA256]::Create()
    $stream=[IO.File]::OpenRead($Path)
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
function No-Link([string]$Path) {
    for ($p=$Path; $p; $p=Split-Path $p -Parent) {
        if ((Test-Path -LiteralPath $p) -and ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Percorso simbolico non consentito.' }
    }
}
function Safe-Path([string]$Root,[string]$Relative) {
    if ($Relative -notmatch '^[a-zA-Z0-9_./+-]+$' -or $Relative -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($Relative)) { throw 'Percorso manifest non valido.' }
    $p=[IO.Path]::GetFullPath((Join-Path $Root $Relative))
    if (!$p.StartsWith($Root+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Percorso fuori dal pacchetto.' }
    No-Link $p
    return $p
}
try {
    $sourceRoot=[IO.Path]::GetFullPath($Source).TrimEnd('\')
    $target=[IO.Path]::GetFullPath($Destination).TrimEnd('\')
    No-Link $sourceRoot; No-Link $target
    if ($target -eq [IO.Path]::GetPathRoot($target).TrimEnd('\') -or $target.StartsWith($sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Destinazione non valida.' }
    $manifest=Join-Path $sourceRoot 'bundle.json'
    $bundle=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
    if ($bundle.formatVersion -ne 2 -or $bundle.bundleId -ne 'chronexus-ai-ollama-0.40.10-gemma4-12b' -or $bundle.volumes.Count -ne 4 -or $bundle.files.Count -lt 5) { throw 'Manifest non supportato.' }
    $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($f in $bundle.files) {
        if (!$seen.Add($f.path)) { throw 'File duplicato.' }
        $p=Safe-Path $sourceRoot $f.path
        if ($f.volume) { continue }
        if ((Get-Item -LiteralPath $p).Length -ne $f.size -or (Hash $p) -ne $f.sha256) { throw "File incompleto o alterato: $($f.path)" }
    }
    if (!$seen.Add($bundle.weight.path) -or $bundle.weight.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Pesi non validi.' }
    $volumePaths=@()
    $total=0L
    # ZIPs can remain beside the extracted core folder or one directory above it.
    foreach ($v in $bundle.volumes) {
        if ($v.name -notmatch '^Chronexus-[0-9.]+-AI-pesi-[1-4]-di-4\.zip$') { throw 'Nome volume non valido.' }
        $candidates=@((Join-Path (Split-Path $sourceRoot -Parent) $v.name),(Join-Path (Split-Path (Split-Path $sourceRoot -Parent) -Parent) $v.name))
        $p=$candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        if (!$p) { throw "Volume mancante: $($v.name). Metti tutti e quattro gli ZIP accanto alla cartella estratta." }
        No-Link $p
        if ((Hash $p) -ne $v.sha256) { throw "Checksum errato: $($v.name)" }
        $zip=[IO.Compression.ZipFile]::OpenRead($p)
        try {
            $extra=@($bundle.files | Where-Object { $_.volume -eq $v.name })
            $entry=$zip.GetEntry($v.entry)
            if ($zip.Entries.Count -ne (1+$extra.Count) -or !$entry -or $entry.Length -ne $v.size) { throw 'Contenuto volume non valido.' }
            foreach ($f in $extra) {
                $part=$zip.GetEntry($f.entry)
                if (!$part -or $part.Length -ne $f.size) { throw 'Componente modello mancante.' }
            }
        } finally { $zip.Dispose() }
        $volumePaths+=@{path=$p;entry=$v.entry;name=$v.name}; $total+=$v.size
    }
    if ($total -ne $bundle.weight.size) { throw 'Dimensione totale pesi errata.' }
    if (Test-Path -LiteralPath $target) {
        $marker=Join-Path $target 'bundle.json'
        if (!(Test-Path -LiteralPath $marker) -or (Hash $marker) -ne (Hash $manifest)) { throw 'La destinazione contiene altri dati. Scegli una cartella nuova.' }
        foreach ($f in @($bundle.files)+@($bundle.weight)) {
            $p=Safe-Path $target $f.path
            if ((Get-Item -LiteralPath $p).Length -ne $f.size -or (Hash $p) -ne $f.sha256) { throw 'Installazione esistente diversa: nessuna sovrascrittura.' }
        }
        Write-Output 'AI already installed and verified.'; exit 0
    }
    $stage=$target+'.install-'+[Guid]::NewGuid().ToString('N')
    New-Item -ItemType Directory -Path $stage | Out-Null
    foreach ($f in $bundle.files) {
        $to=Safe-Path $stage $f.path
        New-Item -ItemType Directory -Path (Split-Path $to -Parent) -Force | Out-Null
        if ($f.volume) {
            $volume=@($volumePaths | Where-Object { $_.name -eq $f.volume })
            if ($volume.Count -ne 1) { throw 'Volume componente non valido.' }
            $zip=[IO.Compression.ZipFile]::OpenRead($volume[0].path)
            try {
                $inputFile=$zip.GetEntry($f.entry).Open()
                $outputFile=[IO.File]::Open($to,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
                try { $inputFile.CopyTo($outputFile) } finally { $inputFile.Dispose(); $outputFile.Dispose() }
            } finally { $zip.Dispose() }
        } else { [IO.File]::Copy((Safe-Path $sourceRoot $f.path),$to,$false) }
        if ((Hash $to) -ne $f.sha256) { throw 'Copia non riuscita.' }
    }
    $weight=Safe-Path $stage $bundle.weight.path
    $output=[IO.File]::Open($weight,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
        foreach ($v in $volumePaths) {
            $zip=[IO.Compression.ZipFile]::OpenRead($v.path)
            try { $inputFile=$zip.GetEntry($v.entry).Open(); try { $inputFile.CopyTo($output) } finally { $inputFile.Dispose() } } finally { $zip.Dispose() }
        }
        $output.Flush($true)
    } finally { $output.Dispose() }
    if ((Hash $weight) -ne $bundle.weight.sha256 -or (Get-Item -LiteralPath $weight).Length -ne $bundle.weight.size) { throw 'Pesi ricostruiti non validi.' }
    [IO.File]::Copy($manifest,(Join-Path $stage 'bundle.json'),$false)
    [IO.Directory]::Move($stage,$target)
    Write-Output "AI installed and verified in $target. Run Start-AI.ps1; no downloads or campaign changes."
} catch { Write-Error $_; exit 1 }
