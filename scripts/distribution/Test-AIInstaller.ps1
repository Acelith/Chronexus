$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$testRoot = Join-Path $root ('.tools/installer-tests-'+[Guid]::NewGuid().ToString('N'))
$source = Join-Path $testRoot 'source'
New-Item -ItemType Directory -Path $source -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $source 'one.txt'),'original one')
[IO.File]::WriteAllText((Join-Path $source 'two.txt'),'original two')
$files = @(Get-ChildItem -LiteralPath $source -File | ForEach-Object { @{path=$_.Name;size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()} })
$manifest = @{bundleId='chronexus-ai-ollama-0.40.10-qwen3-4b-instruct';files=$files}
function Write-Manifest { [IO.File]::WriteAllText((Join-Path $source 'bundle.json'),($manifest | ConvertTo-Json -Depth 5)) }
function Run-Install([string]$Destination,[bool]$Expected) {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Source "{1}" -Destination "{2}"' -f (Join-Path $PSScriptRoot 'Install-AI.ps1'),$source,$Destination
    $process = Start-Process -FilePath powershell.exe -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $testRoot 'last-output.log') -RedirectStandardError (Join-Path $testRoot 'last-error.log')
    if (($process.ExitCode -eq 0) -ne $Expected) { throw "Esito installer inatteso: $Destination" }
}
Write-Manifest
$target = Join-Path $testRoot 'destination with spaces'
Run-Install $target $true
Run-Install $target $true
if ([IO.File]::ReadAllText((Join-Path $target 'one.txt')) -ne 'original one') { throw 'Copia alterata.' }
[IO.File]::WriteAllText((Join-Path $target 'one.txt'),'user modified')
Run-Install $target $false
if ([IO.File]::ReadAllText((Join-Path $target 'one.txt')) -ne 'user modified') { throw 'File utente sovrascritto.' }
$occupied = Join-Path $testRoot 'unrelated'
New-Item -ItemType Directory -Path $occupied | Out-Null
[IO.File]::WriteAllText((Join-Path $occupied 'sentinel.txt'),'preserve')
Run-Install $occupied $false
if ([IO.File]::ReadAllText((Join-Path $occupied 'sentinel.txt')) -ne 'preserve') { throw 'Dati estranei modificati.' }
[IO.File]::WriteAllText((Join-Path $source 'one.txt'),'corrupted')
$corruptTarget = Join-Path $testRoot 'corrupt'
Run-Install $corruptTarget $false
if (Test-Path -LiteralPath $corruptTarget) { throw 'Copia iniziata prima della validazione completa.' }
$manifest.files[0].path = '../escape.txt'
Write-Manifest
Run-Install (Join-Path $testRoot 'traversal') $false
Write-Output 'PASS: installazione con spazi, ripetizione, file modificato, dati estranei, checksum errato, traversal (6 scenari).'
exit 0
