param([ValidateSet('desktop','dev','build','build:desktop','test','test:rust','typecheck','lint')][string]$Task = 'desktop')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location -LiteralPath $projectRoot
try {
    # Keep portable toolchains relative to the checkout, including after a move.
    $cargoDirectory = Join-Path $projectRoot '.tools/cargo'
    $rustupDirectory = Join-Path $projectRoot '.tools/rustup'
    if ((Test-Path -LiteralPath $cargoDirectory) -and (Test-Path -LiteralPath $rustupDirectory)) {
        $env:CARGO_HOME = $cargoDirectory
        $env:RUSTUP_HOME = $rustupDirectory
        $env:Path = (Join-Path $cargoDirectory 'bin') + [IO.Path]::PathSeparator + $env:Path
    }
    & pnpm $Task
    if ($LASTEXITCODE -ne 0) { throw "Comando $Task non riuscito (codice $LASTEXITCODE)." }
} finally { Pop-Location }
