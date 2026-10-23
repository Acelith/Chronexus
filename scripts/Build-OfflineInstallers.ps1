param([string]$OutputDirectory = '',[string]$NsisPath = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!$OutputDirectory) { $OutputDirectory = Join-Path $root 'installers/Chronexus-0.1.0-Windows-x64' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (!$output.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $output)) { throw 'Scegli una nuova cartella di output dentro il repository. Nessun pacchetto esistente viene sovrascritto.' }
$runtime = Join-Path $root '.tools/m7-runtime/ollama'
$models = Join-Path $root '.tools/m7-runtime/models'
$app = Join-Path $root 'src-tauri/target/release/bundle/nsis/Chronexus_0.1.0_x64-setup.exe'
$license = Join-Path $root '.tools/m7-runtime/OLLAMA_LICENSE'
if (!$NsisPath) { $NsisPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'tauri/NSIS/Bin/makensis.exe' }
foreach ($required in @($app,$license,$NsisPath,(Join-Path $runtime 'ollama.exe'))) { if (!(Test-Path -LiteralPath $required -PathType Leaf)) { throw "File richiesto non disponibile: $required" } }
New-Item -ItemType Directory -Path $output | Out-Null
$ai = Join-Path $output 'AI'
New-Item -ItemType Directory -Path $ai | Out-Null
Copy-Item -LiteralPath $app -Destination (Join-Path $output 'Chronexus_0.1.0_x64-setup.exe')
Copy-Item -LiteralPath $runtime -Destination (Join-Path $ai 'runtime') -Recurse
$manifestRelative = 'manifests/registry.ollama.ai/library/qwen3/4b-instruct'
$modelManifest = Join-Path $models $manifestRelative
$metadata = Get-Content -LiteralPath $modelManifest -Raw | ConvertFrom-Json
$pending = [Collections.Generic.Queue[string]]::new()
$copied = [Collections.Generic.HashSet[string]]::new()
$pending.Enqueue($metadata.config.digest)
foreach ($layer in $metadata.layers) { $pending.Enqueue($layer.digest) }
$blobTarget = Join-Path $ai 'models/blobs'
New-Item -ItemType Directory -Path $blobTarget -Force | Out-Null
while ($pending.Count) {
    $digest = $pending.Dequeue()
    if (!$copied.Add($digest)) { continue }
    if ($digest -notmatch '^sha256:[0-9a-f]{64}$') { throw 'Digest modello non valido.' }
    $name = $digest.Replace(':','-')
    $source = Join-Path $models "blobs/$name"
    if ((Get-FileHash -LiteralPath $source).Hash.ToLowerInvariant() -ne $digest.Substring(7)) { throw "Blob modello alterato: $name" }
    Copy-Item -LiteralPath $source -Destination (Join-Path $blobTarget $name)
    if ((Get-Item -LiteralPath $source).Length -lt 1048576) {
        try { $nested = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json } catch { $nested = $null }
        if ($nested.schemaVersion -eq 2 -and $nested.config.digest) {
            $pending.Enqueue($nested.config.digest)
            foreach ($layer in $nested.layers) { $pending.Enqueue($layer.digest) }
        }
    }
}
$manifestTarget = Join-Path $ai "models/$manifestRelative"
New-Item -ItemType Directory -Path (Split-Path $manifestTarget -Parent) -Force | Out-Null
Copy-Item -LiteralPath $modelManifest -Destination $manifestTarget
foreach ($script in @('Start-AI.ps1','Install-AI.ps1')) {
    $text = Get-Content -LiteralPath (Join-Path $PSScriptRoot "distribution/$script") -Raw
    [IO.File]::WriteAllText((Join-Path $ai $script),$text,[Text.UTF8Encoding]::new($true))
}
$licenses = Join-Path $ai 'licenses'
New-Item -ItemType Directory -Path $licenses | Out-Null
Copy-Item -LiteralPath $license -Destination (Join-Path $licenses 'OLLAMA_LICENSE.txt')
$modelLicense = $metadata.layers | Where-Object mediaType -eq 'application/vnd.ollama.image.license' | Select-Object -First 1
Copy-Item -LiteralPath (Join-Path $models ('blobs/'+$modelLicense.digest.Replace(':','-'))) -Destination (Join-Path $licenses 'QWEN_LICENSE.txt')
$cmd = '@echo off'+"`r`n"+'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-AI.ps1" -Source "%~dp0." -Destination "%LOCALAPPDATA%\Chronexus\AI\ollama-0.40.10-qwen3-4b-instruct"'+"`r`n"+'pause'+"`r`n"
[IO.File]::WriteAllText((Join-Path $ai 'Install-AI.cmd'),$cmd,[Text.ASCIIEncoding]::new())
$files = @(Get-ChildItem -LiteralPath $ai -File -Recurse | ForEach-Object {
    if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'File simbolico nel pacchetto.' }
    [ordered]@{path=$_.FullName.Substring($ai.Length+1).Replace('\','/');size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}
})
$bundle = [ordered]@{formatVersion=1;bundleId='chronexus-ai-ollama-0.40.10-qwen3-4b-instruct';model='qwen3:4b-instruct';modelDigest=(Get-FileHash -LiteralPath $modelManifest).Hash.ToLowerInvariant();weightDigest='85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9';runtimeVersion='0.40.10';files=$files}
[IO.File]::WriteAllText((Join-Path $ai 'bundle.json'),($bundle | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
$aiInstaller = Join-Path $output 'Chronexus_AI_locale_x64-setup.exe'
& $NsisPath "/DOUTPUT=$aiInstaller" (Join-Path $PSScriptRoot 'distribution/ai-installer.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Compilazione installer AI non riuscita.' }
$readme = @'
CHRONEXUS — WINDOWS x64 — PACCHETTO CON AI LOCALE

1. Esegui Chronexus_0.1.0_x64-setup.exe per installare l'app.
2. Esegui Chronexus_AI_locale_x64-setup.exe per installare Ollama e Qwen3.
   Mantieni la cartella AI accanto all'installer: contiene i file offline.
   La verifica e la copia richiedono tempo e circa 4,5 GiB di spazio aggiuntivo.
3. Dal menu Start apri Chronexus > Avvia AI locale. Poi avvia Chronexus.
4. Nella campagna: Assistente locale > Controlla Ollama > qwen3:4b-instruct >
   conferma il profilo multilingue > Attiva modello locale.

AI senza account, download o cloud; usa la GPU disponibile. Qwen3 e' un modello
multilingue con fonti D&D locali, non fine-tuned su D&D. Le risposte vanno verificate.
Sono inclusi solo runtime e modello qualificati, nessuna campagna o database utente.
Campagne e conversazioni restano nell'archivio Chronexus; i backup non includono i pesi.

Se un altro Ollama occupa la porta 11434 con cloud attivo o modello diverso,
l'avviatore non lo ferma: chiudilo/configuralo prima di avviare questa copia.
Nessun servizio di sistema o avvio automatico aggiunto. L'AI viene copiata per
il solo utente nella cartella scelta. Per rimuoverla, chiudi quel runtime e
rimuovi la sua cartella e il collegamento Avvia AI locale dal menu Start.
Non rimuovere cartelle contenenti dati/modelli personali che desideri conservare.

Entrambi gli installer sono non firmati. GPU e software verificati su Windows;
questo pacchetto non contiene installer macOS/Linux o driver GPU/WebView2.
Servono Windows x64, WebView2 per Chronexus e driver GPU compatibili per l'AI.
La prima attivazione AI carica il modello: l'app resta utilizzabile senza AI.
Licenze Ollama/Qwen e avvisi dei componenti inclusi nella cartella AI.
Il manifest AI/bundle.json contiene dimensioni e SHA-256 dei file.
Non separare AI dall'installer AI se sposti il pacchetto su un altro computer.
'@
[IO.File]::WriteAllText((Join-Path $output 'LEGGIMI.txt'),$readme,[Text.UTF8Encoding]::new($true))
$checks = Get-ChildItem -LiteralPath $output -File -Filter '*.exe' | ForEach-Object { "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant(),$_.Name }
[IO.File]::WriteAllLines((Join-Path $output 'SHA256SUMS.txt'),$checks,[Text.UTF8Encoding]::new($false))
Write-Output "Pacchetto pronto: $output"
