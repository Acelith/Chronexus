param([string]$OllamaPath = '', [string]$ModelsPath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDirectory = Join-Path $projectRoot '.tools/m7-runtime'
if (!$OllamaPath) { $OllamaPath = Join-Path $runtimeDirectory 'ollama/ollama.exe' }
if (!(Test-Path -LiteralPath $OllamaPath -PathType Leaf)) {
    throw 'Ollama non trovato. Specifica -OllamaPath con il percorso del programma locale. Questo script non installa o scarica programmi.'
}
if (!$ModelsPath) { $ModelsPath = Join-Path $runtimeDirectory 'models' }
try {
    $status = Invoke-RestMethod 'http://127.0.0.1:11434/api/status' -TimeoutSec 2
    if ($status.cloud.disabled -ne $true) { throw 'cloud non disabilitato' }
    Write-Output 'Ollama locale è già disponibile con cloud disabilitato.'
    return
} catch {
    # Do not stop/reconfigure an existing user service. A successful TCP connection
    # means the user must fix that service before launching another instance.
    $socket = [System.Net.Sockets.TcpClient]::new()
    try { $occupied = $socket.ConnectAsync('127.0.0.1',11434).Wait(1000) -and $socket.Connected } catch { $occupied = $false } finally { $socket.Dispose() }
    if ($occupied) { throw 'La porta di Ollama è occupata ma il blocco cloud non è verificabile. Chiudi o configura quel runtime con OLLAMA_NO_CLOUD=1, poi riprova.' }
}
New-Item -ItemType Directory -Path $runtimeDirectory,$ModelsPath -Force | Out-Null
# These settings apply only to this launcher and its child, not the system.
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = [System.IO.Path]::GetFullPath($ModelsPath)
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_CONTEXT_LENGTH = '4096'
$process = Start-Process -FilePath ([System.IO.Path]::GetFullPath($OllamaPath)) -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'server-out.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server-err.log')
$process.Id | Set-Content (Join-Path $runtimeDirectory 'server.pid')
Write-Output "Ollama avviato localmente (processo $($process.Id)). Apri Assistente locale in Chronexus e premi Controlla Ollama."
