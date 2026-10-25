param(
    [Parameter(Mandatory = $true)][string]$PythonPath,
    [string]$TrainingHome = (Join-Path $env:APPDATA 'it.nodex.desktop/ai-training')
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$trainingRoot = [IO.Path]::GetFullPath($TrainingHome)
if (!(Test-Path -LiteralPath $PythonPath -PathType Leaf)) { throw 'Specifica il percorso assoluto di Python 3.12.' }
$version = & $PythonPath -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
if ($LASTEXITCODE -ne 0 -or $version -ne '3.12') { throw 'Il backend M8 verificato richiede Python 3.12.' }
if (Test-Path -LiteralPath $trainingRoot) {
    if ((Get-Item -LiteralPath $trainingRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The training folder must not be a link.' }
}
New-Item -ItemType Directory -Force -Path $trainingRoot | Out-Null
$venv = Join-Path $trainingRoot 'venv'
if (!(Test-Path -LiteralPath (Join-Path $venv 'Scripts/python.exe'))) {
    & $PythonPath -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Creazione ambiente isolato non riuscita.' }
}
$python = Join-Path $venv 'Scripts/python.exe'
& $python -m pip install 'torch==2.14.1+cu130' --index-url https://download.pytorch.org/whl/cu130
if ($LASTEXITCODE -ne 0) { throw 'Installazione PyTorch CUDA non riuscita.' }
& $python -m pip install -r (Join-Path $PSScriptRoot 'ai/requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Installazione dipendenze QLoRA non riuscita.' }
$env:HF_HUB_DISABLE_TELEMETRY = '1'
$env:HF_HOME = Join-Path $trainingRoot 'cache'
$env:CHRONEXUS_TRAINING_SETUP = $trainingRoot
@'
import os
from pathlib import Path
from huggingface_hub import snapshot_download
root = Path(os.environ["CHRONEXUS_TRAINING_SETUP"])
snapshot_download("google/gemma-4-12B-it", revision="707f0a3b8a3c7ad586ed01e27eafbad8a27dd0f7", local_dir=root / "hf-base", allow_patterns=["*.json", "*.jinja", "*.safetensors"])
'@ | & $python -
if ($LASTEXITCODE -ne 0) { throw 'Download checkpoint non completato; riesegui per riprendere.' }
& $python -I -B (Join-Path $PSScriptRoot 'ai/train.py') --probe
if ($LASTEXITCODE -ne 0) { throw 'Controllo backend non riuscito.' }
Write-Output 'Local environment prepared. Training starts only from the button in campaign settings. No system-wide service installed.'
